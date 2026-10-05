import { it, expect } from 'vitest';
import pg from 'pg';
import { newId } from '@greiva/shared';
import { PrivateWorkspaceAccessDenied } from '@greiva/application';
import type { PushOperation } from '@greiva/protocol';
import { PostgresPrivateBootstrapStore } from '../../apps/api/src/private-bootstrap-store.js';
import { installPrivateWorkspaceSchema, verifyPrivateWorkspaceSchema } from '../../apps/api/src/private-workspace-schema.js';
import { installPrivateStructuredSchema } from '../../apps/api/src/private-structured-schema.js';
import { PostgresPrivateStructuredStore, PrivateSyncInvalidRequest } from '../../apps/api/src/private-structured-store.js';
import { PostgresPrivateTransactions,PrivateTransactionUnavailable } from '../../apps/api/src/private-transactions.js';

const real=it.skipIf(process.env.GREIVA_TEST_POSTGRES!=='1');
const actor=(subjectId='owner')=>({issuer:'https://auth.fixture.invalid/auth/v1',subjectId,expiresAt:Math.floor(Date.now()/1000)+300});
async function isolated(run:(pool:pg.Pool,schema:string)=>Promise<void>){const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:8,connectionTimeoutMillis:5000,statement_timeout:5000}),schema='greiva_private_'+newId().replaceAll('-','');try{await installPrivateWorkspaceSchema(pool,schema);await run(pool,schema);}finally{try{await pool.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await pool.end();}}}
async function fixture(pool:pg.Pool,schema:string){await installPrivateStructuredSchema(pool,schema);const owner=actor(),bootstrap=new PostgresPrivateBootstrapStore(pool,schema),binding=await bootstrap.bootstrap(owner,{clientId:newId()}),store=new PostgresPrivateStructuredStore(pool,schema);const create=(title='original',entityId=newId()):PushOperation=>({operationId:newId(),clientId:binding.clientId,entityType:'task',entityId,kind:'create',baseVersion:null,payload:{title,status:'todo',due:null}});
  // Explicit wire builder: bootstrap epoch is a response field, not push input.
  const send=(operations:PushOperation[])=>store.push(owner,binding.workspaceId,{protocolVersion:1,workspaceId:binding.workspaceId,clientId:binding.clientId,operations});
  const pull=(cursor:string|null=null,limit=100)=>store.pull(owner,binding.workspaceId,{protocolVersion:1,workspaceId:binding.workspaceId,clientId:binding.clientId,cursor,limit});
  return{owner,bootstrap,binding,store,create,send,pull};}
real('PRIVATE-STREAM-SCHEMA-PG: explicit atomic upgrade preserves metadata/key; repeated/partial/orphaned installation refuses without repair',async()=>{
  await isolated(async(pool,schema)=>{
    const bootstrap=new PostgresPrivateBootstrapStore(pool,schema),binding=await bootstrap.bootstrap(actor(),{clientId:newId()}),pageId=newId();
    await pool.query(`INSERT INTO "${schema}".private_resources VALUES('page',$1,$2,false)`,[pageId,binding.workspaceId]);
    const before=(await pool.query(`SELECT * FROM "${schema}".private_workspaces`)).rows;
    await pool.query(`CREATE TABLE "${schema}".private_structured_history (unexpected boolean)`);
    await expect(installPrivateStructuredSchema(pool,schema)).rejects.toThrow();expect(await verifyPrivateWorkspaceSchema(pool,schema)).toBe(1);
    expect((await pool.query('SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2',[schema,'private_structured_config'])).rowCount).toBe(0);
    await pool.query(`DROP TABLE "${schema}".private_structured_history`);
    let entered!:()=>void,finish!:()=>void;const start=new Promise<void>(done=>{entered=done;}),wait=new Promise<void>(done=>{finish=done;});
    const active=new PostgresPrivateTransactions(pool,schema).run(actor(),binding.workspaceId,binding.clientId,[],async()=>{entered();await wait;return true;});await start;
    const upgrade=installPrivateStructuredSchema(pool,schema);void upgrade.catch(()=>{});
    try{await expect.poll(async()=>(await pool.query("SELECT 1 FROM pg_stat_activity WHERE query LIKE $1 AND wait_event_type='Lock'",[`SELECT version FROM "${schema}".private_schema_version%FOR UPDATE`])).rowCount).toBe(1);finish();await active;await upgrade;}finally{finish();await Promise.allSettled([active,upgrade]);}
    expect(await verifyPrivateWorkspaceSchema(pool,schema)).toBe(2);
    const secret=(await pool.query(`SELECT secret FROM "${schema}".private_structured_config`)).rows[0].secret;expect(secret.length).toBe(32);
    await expect(installPrivateStructuredSchema(pool,schema)).rejects.toThrow();expect((await pool.query(`SELECT secret FROM "${schema}".private_structured_config`)).rows[0].secret).toEqual(secret);
    expect((await pool.query(`SELECT * FROM "${schema}".private_workspaces`)).rows).toEqual(before);expect((await pool.query(`SELECT workspace_id FROM "${schema}".private_resources WHERE id=$1`,[pageId])).rows[0].workspace_id).toBe(binding.workspaceId);
    await pool.query(`DROP TABLE "${schema}".private_structured_conflicts`);await expect(verifyPrivateWorkspaceSchema(pool,schema)).rejects.toThrow('Private workspace schema unavailable');
  });
  await isolated(async(pool,schema)=>{const binding=await new PostgresPrivateBootstrapStore(pool,schema).bootstrap(actor(),{clientId:newId()});await pool.query(`INSERT INTO "${schema}".private_resources VALUES('task',$1,$2,false)`,[newId(),binding.workspaceId]);await expect(installPrivateStructuredSchema(pool,schema)).rejects.toThrow();expect(await verifyPrivateWorkspaceSchema(pool,schema)).toBe(1);});
});
real('PRIVATE-STREAM-LEDGER-PG: duplicate batches return immutable results; changed ID reuse and foreign scope roll back the whole batch',async()=>{
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema),a=f.create(),b=f.create('second'),first=await f.send([a,b]);expect(first.results.map(row=>row.serverOrder)).toEqual(['1','2']);expect(await f.send([a,b])).toEqual(first);
    const next=f.create('must rollback');await expect(f.send([next,{...a,payload:{title:'changed',status:'done',due:null}}])).rejects.toMatchObject({code:'operation_id_reused'});
    expect((await f.pull()).operations).toEqual(first.results);expect((await pool.query(`SELECT id FROM "${schema}".private_resources WHERE id=$1`,[next.entityId])).rowCount).toBe(0);
    const other=await f.bootstrap.bootstrap(actor('other'),{clientId:newId()});await expect(f.store.pull(actor('other'),f.binding.workspaceId,{protocolVersion:1,workspaceId:f.binding.workspaceId,clientId:other.clientId,cursor:null})).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    await expect(f.store.push(actor('other'),other.workspaceId,{protocolVersion:1,workspaceId:other.workspaceId,clientId:other.clientId,operations:[{...a,clientId:other.clientId}]})).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    await expect(f.store.push(f.owner,f.binding.workspaceId,{protocolVersion:1,workspaceId:other.workspaceId,clientId:f.binding.clientId,operations:[f.create()]})).rejects.toBeInstanceOf(PrivateSyncInvalidRequest);
    expect((await f.store.pull(actor('other'),other.workspaceId,{protocolVersion:1,workspaceId:other.workspaceId,clientId:other.clientId,cursor:null})).operations).toEqual([]);
  });
});
real('PRIVATE-STREAM-CONFLICT-PG: different fields merge, same field retains three values; new resolution operation and causal frames survive stale bases',async()=>{
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema),create=f.create(),initial=(await f.send([create])).results[0]!;expect(initial.entity?.version).toBe(1);
    const update=(payload:unknown,baseVersion=1,clientId=f.binding.clientId):PushOperation=>({...create,operationId:newId(),clientId,kind:'update',baseVersion,payload});
    const peer=await f.bootstrap.bootstrap(f.owner,{clientId:newId()}),peerSend=(operation:PushOperation)=>f.store.push(f.owner,f.binding.workspaceId,{protocolVersion:1,workspaceId:f.binding.workspaceId,clientId:peer.clientId,operations:[operation]});
    await f.send([update({title:'remote'})]);const merged=(await peerSend(update({status:'done'},1,peer.clientId))).results[0]!;expect(merged.status).toBe('acknowledged');expect(merged.entity).toMatchObject({title:'remote',status:'done',version:3});
    const local=update({title:'local'}),conflicted=(await f.send([local])).results[0]!;expect(conflicted.status).toBe('conflict');expect(conflicted.entity).toMatchObject({title:'remote',version:3});expect(conflicted.conflicts[0]).toMatchObject({base:'original',local:'local',remote:'remote',status:'open'});
    const causal=update({due:'2026-10-06'},3);causal.predecessorOperationId=local.operationId;const queued=(await f.send([causal])).results[0]!;expect(queued.status).toBe('acknowledged');expect(queued.entity).toMatchObject({title:'remote',due:'2026-10-06',version:4});
    const resolve=update({title:'local'},4);resolve.resolution={conflictIds:[conflicted.conflicts[0]!.id],choice:'local'};const resolved=(await f.send([resolve])).results[0]!;expect(resolved.entity).toMatchObject({title:'local',status:'done',version:5});expect(resolved.conflicts[0]).toMatchObject({status:'resolved',resolvedBy:resolve.operationId});
    expect(await f.send([local])).toMatchObject({results:[conflicted]});expect((await pool.query(`SELECT status FROM "${schema}".private_structured_conflicts`)).rows).toEqual([{status:'resolved'}]);
    const invalid=update({title:'different'},5);invalid.resolution={conflictIds:[conflicted.conflicts[0]!.id],choice:'local'};expect((await f.send([invalid])).results[0]).toMatchObject({status:'rejected',error:{code:'invalid_resolution'}});
  });
});
real('PRIVATE-STREAM-TOMBSTONE-PG: deletions retain immutable history; pending updates acknowledge tombstones and conflicts resolve by delete',async()=>{
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema),create=f.create();await f.send([create]);const remote={...create,operationId:newId(),kind:'update' as const,baseVersion:1,payload:{title:'remote'}};await f.send([remote]);
    const local={...remote,operationId:newId(),payload:{title:'local'}};const conflict=(await f.send([local])).results[0]!;
    const deleted=(await f.send([{...create,operationId:newId(),kind:'delete',baseVersion:1,payload:{}}])).results[0]!;expect(deleted.entity?.deletedAt).not.toBeNull();expect(deleted.conflicts).toMatchObject([{id:conflict.conflicts[0]!.id,status:'resolved'}]);
    const ignored=(await f.send([{...remote,operationId:newId(),payload:{title:'after delete'}}])).results[0]!;expect(ignored.status).toBe('acknowledged');expect(ignored.entity).toEqual(deleted.entity);
    const causal={...remote,operationId:newId(),baseVersion:deleted.entity!.version,predecessorOperationId:ignored.operationId,payload:{status:'done'}};expect((await f.send([causal])).results[0]?.entity).toEqual(deleted.entity);
    expect((await pool.query(`SELECT deleted FROM "${schema}".private_resources WHERE type='task' AND id=$1`,[create.entityId])).rows).toEqual([{deleted:true}]);
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_structured_history`)).rows[0].n).toBe(3);
  });
});
real('PRIVATE-STREAM-RELATION-PG: endpoints are typed/live/same workspace; foreign refs and entities cannot leave prior batch writes or disclose data',async()=>{
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema),task=f.create();await f.send([task]);const pageId=newId(),other=await f.bootstrap.bootstrap(actor('other'),{clientId:newId()}),foreignId=newId();
    await pool.query(`INSERT INTO "${schema}".private_resources VALUES('page',$1,$2,false),('page',$3,$4,false)`,[pageId,f.binding.workspaceId,foreignId,other.workspaceId]);
    const relation:PushOperation={...f.create(),entityType:'relation',payload:{fromType:'page',fromId:pageId,toType:'task',toId:task.entityId}};const initial=(await f.send([relation])).results[0]!;expect(initial.status).toBe('acknowledged');
    const next=f.create('rolled back');await expect(f.send([next,{...relation,operationId:newId(),kind:'update',baseVersion:1,payload:{fromId:foreignId}}])).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    expect((await pool.query(`SELECT id FROM "${schema}".private_resources WHERE id=$1`,[next.entityId])).rowCount).toBe(0);
    const ownMissing={...relation,operationId:newId(),kind:'update' as const,baseVersion:1,payload:{toId:newId()}};expect((await f.send([ownMissing])).results[0]).toMatchObject({status:'rejected',error:{code:'invalid_relation_endpoint'}});
    await pool.query(`UPDATE "${schema}".private_resources SET deleted=true WHERE id=$1`,[pageId]);expect((await f.send([{...relation,operationId:newId(),kind:'update',baseVersion:1,payload:{toType:'page',toId:pageId}}])).results[0]).toMatchObject({status:'rejected',error:{code:'invalid_relation_endpoint'}});
    expect((await f.send([{...relation,operationId:newId(),kind:'delete',baseVersion:1,payload:{}}])).results[0]?.status).toBe('acknowledged');
    await expect(f.send([{...relation,operationId:newId(),kind:'update',baseVersion:1,payload:{toType:'page',toId:foreignId}}])).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    await expect(f.store.push(actor('other'),other.workspaceId,{protocolVersion:1,workspaceId:other.workspaceId,clientId:other.clientId,operations:[{...task,operationId:newId(),clientId:other.clientId}]})).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
  });
});
real('PRIVATE-STREAM-REJECTIONS-PG: malformed payload/base/predecessor/collision results are durable and retry stable without guessed data',async()=>{
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema),create=f.create();await f.send([create]);
    for(const [operation,code] of [
      [{...f.create(),payload:{title:'bad',status:'invalid'}},'invalid_payload'],
      [{...create,operationId:newId(),payload:{title:'collision',status:'done',due:null}},'entity_id_collision'],
      [{...create,operationId:newId(),kind:'update',baseVersion:999,payload:{title:'update'}},'base_unavailable'],
      [{...create,operationId:newId(),kind:'update',baseVersion:1,payload:{title:'update'},predecessorOperationId:newId()},'invalid_predecessor'],
      [{...f.create(),kind:'delete',baseVersion:1,payload:{}},'entity_not_found'],
    ] as [PushOperation,string][]){const first=await f.send([operation]);expect(first.results[0]).toMatchObject({status:'rejected',error:{code,retryable:false}});expect(await f.send([operation])).toEqual(first);}
    expect((await f.pull()).operations.map(row=>row.serverOrder)).toEqual(['1','2','3','4','5','6']);
  });
});
real('PRIVATE-STREAM-ORDER-PG: concurrent commits and pagination stay contiguous; cursors persist across reopen and reject foreign/forged/future tokens',async()=>{
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema),operations=Array.from({length:6},()=>f.create());await Promise.all(operations.map(operation=>f.send([operation])));
    const first=await f.pull(null,2);expect(first.operations.map(row=>row.serverOrder)).toEqual(['1','2']);expect(first.hasMore).toBe(true);
    const reopened=new PostgresPrivateStructuredStore(pool,schema),second=await reopened.pull(f.owner,f.binding.workspaceId,{protocolVersion:1,workspaceId:f.binding.workspaceId,clientId:f.binding.clientId,cursor:first.cursor,limit:2});expect(second.operations.map(row=>row.serverOrder)).toEqual(['3','4']);
    const third=await f.pull(second.cursor,2);expect(third.operations.map(row=>row.serverOrder)).toEqual(['5','6']);expect(third.hasMore).toBe(false);expect(third.cursor).toBe(third.headCursor);expect((await f.pull(third.cursor)).operations).toEqual([]);
    const other=await f.bootstrap.bootstrap(actor('other'),{clientId:newId()});await expect(f.store.pull(actor('other'),other.workspaceId,{protocolVersion:1,workspaceId:other.workspaceId,clientId:other.clientId,cursor:first.cursor})).rejects.toMatchObject({code:'invalid_cursor'});
    await expect(f.pull(first.cursor.slice(0,-2)+'XX')).rejects.toMatchObject({code:'invalid_cursor'});
    await pool.query(`UPDATE "${schema}".private_structured_streams SET last_order=1 WHERE workspace_id=$1`,[f.binding.workspaceId]);await expect(f.pull(third.cursor)).rejects.toMatchObject({code:'invalid_cursor'});
    await pool.query(`UPDATE "${schema}".private_structured_streams SET last_order=7 WHERE workspace_id=$1`,[f.binding.workspaceId]);await expect(f.pull(third.cursor)).rejects.toBeInstanceOf(PrivateTransactionUnavailable);
  });
});
real('PRIVATE-STREAM-ISOLATION-PG: clients cannot mix IDs or use revoked registration; per-workspace streams have independent order and durable epoch',async()=>{
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema),other=await f.bootstrap.bootstrap(actor('other'),{clientId:newId()}),create=f.create();await f.send([create]);
    const foreignOp={...f.create('other'),clientId:other.clientId};const response=await f.store.push(actor('other'),other.workspaceId,{protocolVersion:1,workspaceId:other.workspaceId,clientId:other.clientId,operations:[foreignOp]});expect(response.results[0]?.serverOrder).toBe('1');expect(response.streamEpoch).toBe(other.epoch);
    await expect(f.send([foreignOp])).rejects.toBeInstanceOf(PrivateSyncInvalidRequest);
    await pool.query(`UPDATE "${schema}".private_devices SET revoked=true WHERE id=$1`,[f.binding.clientId]);await expect(f.send([f.create()])).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);await expect(f.pull()).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_structured_operations WHERE workspace_id=$1`,[f.binding.workspaceId])).rows[0].n).toBe(1);
  });
});
real('PRIVATE-STREAM-CAPTURE-PG: queued push retains detached payload/identity despite caller mutation while the stream is locked',async()=>{
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema);await f.pull();const blocker=await pool.connect(),operation=f.create('captured'),originalId=operation.entityId;let pending:ReturnType<typeof f.send>|undefined;
    try{
      await blocker.query('BEGIN');await blocker.query(`SELECT last_order FROM "${schema}".private_structured_streams WHERE workspace_id=$1 FOR UPDATE`,[f.binding.workspaceId]);pending=f.send([operation]);void pending.catch(()=>{});
      await expect.poll(async()=>(await pool.query("SELECT 1 FROM pg_stat_activity WHERE query LIKE $1 AND wait_event_type='Lock'",[`SELECT last_order FROM "${schema}".private_structured_streams%FOR UPDATE`])).rowCount).toBe(1);
      (operation.payload as {title:string}).title='mutated';operation.clientId=newId();operation.entityId=newId();await blocker.query('COMMIT');const result=await pending;
      expect(result.results[0]).toMatchObject({clientId:f.binding.clientId,entityId:originalId,entity:{title:'captured'}});expect((await f.pull()).operations).toEqual(result.results);
    }finally{await blocker.query('ROLLBACK');if(pending)await Promise.allSettled([pending]);blocker.release();}
  });
});
