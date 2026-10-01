import { it,expect } from 'vitest';
import pg from 'pg';
import { newId } from '@greiva/shared';
import { pullResponseSchema, pushResponseSchema, type PushOperation, type PushResult } from '@greiva/protocol';
import { StructuredRepository, InvalidCursorError } from '../../apps/api/dist/structured-repository.js';
import { createApp } from '../../apps/api/dist/app.js';
const url = process.env.DATABASE_URL ?? 'postgresql://greiva:greiva_dev_only@127.0.0.1:5432/greiva_poc';
const real = it.skipIf(process.env.GREIVA_TEST_POSTGRES !== '1');
async function fixture() {
  const name = `greiva_test_${newId().replaceAll('-','')}`;
  const admin = new pg.Client({connectionString:url}); await admin.connect();
  const repository = await StructuredRepository.open(url,name);
  const clientId = newId();
  const op = (id: string,kind: PushOperation['kind'],payload: unknown,baseVersion: number | null = kind==='create' ? null : 1,entityType: PushOperation['entityType']='task'): PushOperation => ({operationId:newId(),entityId:id,entityType,kind,payload,baseVersion,clientId});
  return {name,admin,repository,op,cleanup:async () => { await repository.close(); await admin.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`); await admin.end(); }};
}
function accepted(result: PushResult) {
  expect(result.status).toBe('acknowledged'); if (result.status==='rejected') throw new Error(result.error.code); return result.entity;
}
real('STEP7-SERVER-IDEMPOTENCY: concurrent replays, ID collisions, malformed payloads and API recreation retain immutable results',async () => {
  const f = await fixture(); const id = newId();
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  try {
    const create = f.op(id,'create',{title:'original',status:'todo',due:null});
    const copies = await Promise.all([f.repository.push(create),f.repository.push(create)]);
    expect(copies[0]).toEqual(copies[1]); expect(accepted(copies[0]!).version).toBe(1);
    expect((await f.repository.pull(null)).operations).toHaveLength(1);
    const badReuse = await f.repository.push({...create,payload:{title:'changed request',status:'todo',due:null}});
    expect(badReuse).toMatchObject({status:'rejected',error:{code:'operation_id_reused',retryable:false}});
    expect(await f.repository.push(create)).toEqual(copies[0]);
    expect(accepted(await f.repository.push(f.op(id,'update',{title:'remote'},1))).version).toBe(2);
    expect(accepted(await f.repository.push(f.op(id,'create',create.payload))).version).toBe(2);
    const collision = f.op(id,'create',{title:'different contents',status:'todo',due:null});
    const rejected = await f.repository.push(collision);
    expect(rejected).toMatchObject({status:'rejected',error:{code:'entity_id_collision'}});
    expect(await f.repository.push(collision)).toEqual(rejected);
    const invalid = f.op(newId(),'create',{title:'invalid',status:'todo',due:'2026-02-29'});
    const invalidResult = await f.repository.push(invalid);
    expect(invalidResult).toMatchObject({status:'rejected',entity:null,error:{code:'invalid_payload',retryable:false}});
    expect(await f.repository.push(invalid)).toEqual(invalidResult);
    expect(await f.repository.tasks()).toHaveLength(1);
    app = await createApp({databaseUrl:url,schemaName:f.name});
    const response = await app.inject({method:'POST',url:'/sync/push',payload:{operations:[create,invalid]}});
    expect(response.statusCode).toBe(200);
    expect(pushResponseSchema.parse(response.json()).results).toEqual([copies[0],invalidResult]);
    const initialPull = pullResponseSchema.parse((await app.inject({method:'POST',url:'/sync/pull',payload:{cursor:null,limit:2}})).json());
    await app.close(); app = await createApp({databaseUrl:url,schemaName:f.name});
    const replay = await app.inject({method:'POST',url:'/sync/push',payload:{operations:[create]}});
    expect(pushResponseSchema.parse(replay.json()).results[0]).toEqual(copies[0]);
    const continuation = await app.inject({method:'POST',url:'/sync/pull',payload:{cursor:initialPull.cursor}});
    expect(continuation.statusCode).toBe(200);
    expect(pullResponseSchema.parse(continuation.json()).operations.map(result=>result.operationId)).toEqual((await f.repository.pull(initialPull.cursor)).operations.map(result=>result.operationId));
    expect((await app.inject({method:'POST',url:'/sync/pull',payload:{cursor:'bad cursor'}})).statusCode).toBe(400);
  } finally { await app?.close(); await f.cleanup(); }
});
real('STEP7-SERVER-MERGE: field merge keeps peer edits and same-field conflicts retain base/local/remote through explicit resolution',async () => {
  const f = await fixture(); const id = newId();
  try {
    await f.repository.push(f.op(id,'create',{title:'base',status:'todo',due:null}));
    await f.repository.push(f.op(id,'update',{title:'peer'},1));
    const disjoint = accepted(await f.repository.push(f.op(id,'update',{title:'base',status:'todo',due:'2026-10-10'},1)));
    expect(disjoint).toMatchObject({title:'peer',due:'2026-10-10',version:3});
    const competing = f.op(id,'update',{title:'local'},1);
    const result = await f.repository.push(competing);
    expect(result).toMatchObject({status:'conflict',entity:{title:'peer',version:3},conflicts:[{field:'title',base:'base',local:'local',remote:'peer',status:'open'}]});
    const conflict = result.conflicts[0]!;
    const resolve = {...f.op(id,'update',{title:conflict.local},3),resolution:{conflictIds:[conflict.id],choice:'local' as const}};
    const resolved = await f.repository.push(resolve);
    expect(resolved).toMatchObject({status:'acknowledged',entity:{title:'local',due:'2026-10-10',version:4},conflicts:[{id:conflict.id,status:'resolved',resolvedBy:resolve.operationId}]});
    expect(await f.repository.push(competing)).toEqual(result); // Historical ACKs are immutable.
    const events = (await f.repository.pull(null)).operations;
    expect(events.find(event=>event.operationId===competing.operationId)?.conflicts[0]!.local).toBe('local');
    expect(events.find(event=>event.operationId===resolve.operationId)?.conflicts[0]!.resolvedBy).toBe(resolve.operationId);
    const another = f.op(id,'update',{title:'another'},1);
    const remoteConflict = (await f.repository.push(another)).conflicts[0]!;
    const badResolution = {...f.op(id,'update',{title:'unrelated'},4),resolution:{conflictIds:[remoteConflict.id],choice:'remote' as const}};
    expect(await f.repository.push(badResolution)).toMatchObject({status:'rejected',error:{code:'invalid_resolution'}});
    const remoteChoice = {...f.op(id,'update',{title:remoteConflict.remote},4),resolution:{conflictIds:[remoteConflict.id],choice:'remote' as const}};
    expect(await f.repository.push(remoteChoice)).toMatchObject({status:'acknowledged',entity:{title:'local',version:5},conflicts:[{status:'resolved',resolvedBy:remoteChoice.operationId}]});
    const staleBase = await f.repository.push(f.op(id,'update',{title:'unsafe'},999));
    expect(staleBase).toMatchObject({status:'rejected',error:{code:'base_unavailable'}});
    const mixedId = newId();
    await f.repository.push(f.op(mixedId,'create',{title:'base',status:'todo',due:null}));
    await f.repository.push(f.op(mixedId,'update',{title:'peer'},1));
    const mixed = await f.repository.push(f.op(mixedId,'update',{title:'local',due:'2026-12-01'},1));
    expect(mixed).toMatchObject({status:'conflict',entity:{title:'peer',due:'2026-12-01',version:3},conflicts:[{field:'title',local:'local'}]});
  } finally { await f.cleanup(); }
});
real('STEP7-SERVER-RELATION: disjoint endpoint edits merge and same endpoint conflicts resolve as a new operation',async () => {
  const f = await fixture(); const id = newId(); const from = newId(); const to = newId(); const peer = newId(); const local = newId(); const changedFrom = newId();
  try {
    await f.repository.push(f.op(id,'create',{fromType:'page',fromId:from,toType:'task',toId:to},null,'relation'));
    await f.repository.push(f.op(id,'update',{toId:peer},1,'relation'));
    expect(await f.repository.push(f.op(id,'update',{fromId:changedFrom},1,'relation'))).toMatchObject({status:'acknowledged',entity:{fromId:changedFrom,toId:peer,version:3}});
    const result = await f.repository.push(f.op(id,'update',{toId:local},1,'relation'));
    expect(result).toMatchObject({status:'conflict',conflicts:[{field:'toId',base:to,local,remote:peer}]});
    const resolution = {...f.op(id,'update',{toId:peer},3,'relation'),resolution:{conflictIds:[result.conflicts[0]!.id],choice:'remote' as const}};
    expect(await f.repository.push(resolution)).toMatchObject({status:'acknowledged',entity:{fromId:changedFrom,toId:peer,version:4},conflicts:[{resolvedBy:resolution.operationId}]});
  } finally { await f.cleanup(); }
});
real('STEP7-SERVER-DELETE: deletes dominate stale Task/Relation updates and close existing conflicts without resurrecting entities',async () => {
  const f = await fixture(); const id = newId(); const relationId = newId();
  try {
    const create = f.op(id,'create',{title:'base',status:'todo',due:null}); await f.repository.push(create);
    await f.repository.push(f.op(id,'update',{title:'remote'},1));
    const conflict = (await f.repository.push(f.op(id,'update',{title:'local'},1))).conflicts[0]!;
    const deleteOp = f.op(id,'delete',{},1);
    const deleted = await f.repository.push(deleteOp);
    expect(deleted).toMatchObject({status:'acknowledged',entity:{version:3,deletedAt:expect.any(String)},conflicts:[{id:conflict.id,status:'resolved',resolvedBy:deleteOp.operationId}]});
    const staleUpdate = await f.repository.push(f.op(id,'update',{title:'revive'},1));
    expect(staleUpdate).toMatchObject({status:'acknowledged',entity:deleted.entity});
    expect(await f.repository.push(f.op(id,'create',create.payload))).toMatchObject({status:'acknowledged',entity:deleted.entity});
    expect(await f.repository.tasks()).toEqual([]);
    await f.repository.push(f.op(relationId,'create',{fromType:'page',fromId:newId(),toType:'task',toId:id},null,'relation'));
    await f.repository.push(f.op(relationId,'update',{toId:newId()},1,'relation'));
    const relationDeleted = await f.repository.push(f.op(relationId,'delete',{},1,'relation'));
    expect(await f.repository.push(f.op(relationId,'update',{fromId:newId()},1,'relation'))).toMatchObject({status:'acknowledged',entity:relationDeleted.entity});
    expect(await f.repository.relations()).toEqual([]);
  } finally { await f.cleanup(); }
});
real('STEP7-SERVER-ORDER: concurrent writers cannot leave lower committed operations behind a pull cursor',async () => {
  const f = await fixture(); const blocker = new pg.Client({connectionString:url}); await blocker.connect();
  let writes: Promise<PushResult>[] = [];
  try {
    const initial = await f.repository.pull(null);
    await blocker.query('BEGIN'); await blocker.query(`SELECT * FROM "${f.name}".stream_state WHERE singleton=1 FOR UPDATE`);
    writes.push(f.repository.push(f.op(newId(),'create',{title:'one',status:'todo',due:null})));
    writes.push(f.repository.push(f.op(newId(),'create',{title:'two',status:'todo',due:null})));
    const deadline = Date.now()+5000; let waiting = 0;
    while (Date.now()<deadline) {
      const result = await f.admin.query<{count:number}>("SELECT count(*)::int AS count FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE $1",[`%${f.name}%stream_state%FOR UPDATE%`]);
      waiting = result.rows[0]!.count; if (waiting===2) break;
      await new Promise(done=>setTimeout(done,20));
    }
    expect(waiting).toBe(2);
    const during = await f.repository.pull(initial.cursor);
    expect(during.operations).toEqual([]); expect(during.headCursor).toBe(initial.headCursor);
    await blocker.query('COMMIT');
    const results = await Promise.all(writes); writes=[];
    expect(results.map(result=>result.serverOrder).sort()).toEqual(['1','2']);
    const first = await f.repository.pull(initial.cursor,1);
    expect(first.operations).toHaveLength(1); expect(first.hasMore).toBe(true);
    const second = await f.repository.pull(first.cursor,1);
    expect(second.operations).toHaveLength(1); expect(second.hasMore).toBe(false); expect(second.cursor).toBe(second.headCursor);
    expect([first.operations[0]!.serverOrder,second.operations[0]!.serverOrder]).toEqual(['1','2']);
    expect((await f.repository.pull(second.cursor)).operations).toEqual([]);
    await expect(f.repository.pull(first.cursor.slice(0,-3)+'bad')).rejects.toBeInstanceOf(InvalidCursorError);
  } finally { await blocker.query('ROLLBACK'); await Promise.allSettled(writes); await blocker.end(); await f.cleanup(); }
});
real('STEP7-SERVER-ATOMIC: ledger failure rolls back entity/history/counter and retry finalizes exactly once',async () => {
  const f = await fixture(); const id = newId();
  try {
    await f.admin.query(`CREATE FUNCTION "${f.name}".fail_ledger() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''injected ledger failure''; END'`);
    await f.admin.query(`CREATE TRIGGER fail_ledger BEFORE INSERT ON "${f.name}".server_operations FOR EACH ROW EXECUTE FUNCTION "${f.name}".fail_ledger()`);
    const operation = f.op(id,'create',{title:'recover',status:'todo',due:null});
    await expect(f.repository.push(operation)).rejects.toMatchObject({cause:{message:'injected ledger failure'}});
    expect(await f.repository.tasks()).toEqual([]);
    expect((await f.repository.pull(null)).operations).toEqual([]);
    expect((await f.admin.query(`SELECT count(*)::int AS count FROM "${f.name}".entity_history`)).rows[0].count).toBe(0);
    await f.admin.query(`DROP TRIGGER fail_ledger ON "${f.name}".server_operations`);
    expect(await f.repository.push(operation)).toMatchObject({status:'acknowledged',serverOrder:'1',entity:{version:1}});
    expect((await f.repository.pull(null)).operations).toHaveLength(1);
  } finally { await f.cleanup(); }
});
real('STEP7-SERVER-MIGRATION: Step 6 rows and tombstones enter the new stream atomically without fabricating missing history',async () => {
  const f = await fixture();
  try {
    const id = newId();
    // A dedicated fixture schema, reconstructed to the documented Step 6 state.
    await f.admin.query(`DROP TABLE "${f.name}".server_operations,"${f.name}".entity_history,"${f.name}".conflicts,"${f.name}".stream_state`);
    await f.admin.query(`UPDATE "${f.name}".schema_version SET version=1`);
    await f.admin.query(`INSERT INTO "${f.name}".tasks VALUES ($1,7,$2,$2,$2,'historical','done','2028-02-29')`,[id,'2026-09-30T12:00:00.000Z']);
    const migrated = await StructuredRepository.open(url,f.name);
    try {
      const result = await migrated.pull(null);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toMatchObject({status:'acknowledged',entity:{id,version:7,title:'historical',status:'done',due:'2028-02-29',deletedAt:'2026-09-30T12:00:00.000Z'}});
      expect((await f.admin.query(`SELECT version FROM "${f.name}".schema_version`)).rows[0].version).toBe(3);
    } finally { await migrated.close(); }
  } finally { await f.cleanup(); }
});
real('STEP7-SERVER-CAUSAL: sequential offline intent keeps competing peer values and merges its own accepted fields',async () => {
  const f = await fixture(); const id = newId();
  try {
    const create = f.op(id,'create',{title:'base',status:'todo',due:null});
    await f.repository.push(create);
    const own = {...f.op(id,'update',{title:'first'},1),predecessorOperationId:create.operationId};
    expect(await f.repository.push(own)).toMatchObject({status:'acknowledged',entity:{title:'first',version:2}});
    await f.repository.push({...f.op(id,'update',{title:'peer'},2),clientId:newId()});
    const offline = {...f.op(id,'update',{title:'second',due:'2026-10-10'},2),predecessorOperationId:own.operationId};
    const partial = await f.repository.push(offline);
    expect(partial).toMatchObject({status:'conflict',entity:{title:'peer',due:'2026-10-10',version:4},conflicts:[{field:'title',base:'first',local:'second',remote:'peer'}]});
    // The next offline form has the previous LOCAL value, not the server value.
    // Its unchanged title must neither overwrite the peer nor create a duplicate conflict.
    const following = {...f.op(id,'update',{title:'second',status:'todo',due:'2026-10-11'},4),predecessorOperationId:offline.operationId};
    expect(await f.repository.push(following)).toMatchObject({status:'acknowledged',entity:{title:'peer',due:'2026-10-11',version:5},conflicts:[]});
    const another = {...f.op(id,'update',{title:'third'},5),predecessorOperationId:following.operationId};
    expect(await f.repository.push(another)).toMatchObject({status:'conflict',entity:{title:'peer',version:5},conflicts:[{base:'second',local:'third',remote:'peer'}]});
    expect(await f.repository.push(offline)).toEqual(partial);
    const rows = await f.admin.query(`SELECT record FROM "${f.name}".conflicts WHERE status='open' ORDER BY record->>'createdAt',id`);
    expect(rows.rows.map(row=>row.record.local).sort()).toEqual(['second','third']);
    const reopened = await StructuredRepository.open(url,f.name);
    try { expect(await reopened.push(another)).toEqual(await f.repository.push(another)); }
    finally { await reopened.close(); }
  } finally { await f.cleanup(); }
});
real('STEP7-SERVER-CAUSAL-VALIDATION: aliases preserve original intent, invalid dependencies reject durably and chained deletes remain acknowledged',async () => {
  const f = await fixture(); const id = newId();
  try {
    const create = f.op(id,'create',{title:'base',status:'todo',due:null}); await f.repository.push(create);
    await f.repository.push({...f.op(id,'update',{title:'peer'},1),clientId:newId()});
    const alias = f.op(id,'create',create.payload); await f.repository.push(alias);
    const update = {...f.op(id,'update',{title:'offline'},2),predecessorOperationId:alias.operationId};
    expect(await f.repository.push(update)).toMatchObject({status:'conflict',entity:{title:'peer',version:2},conflicts:[{base:'base',local:'offline',remote:'peer'}]});
    const rejected = f.op(id,'update',{title:'bad date',due:'2026-02-29'},2); await f.repository.push(rejected);
    const differentId = newId(); const other = f.op(differentId,'create',{title:'other',status:'todo',due:null}); await f.repository.push(other);
    for (const invalid of [
      {...f.op(id,'update',{title:'bad'},2),predecessorOperationId:newId()},
      {...f.op(id,'update',{title:'bad'},2),predecessorOperationId:alias.operationId,clientId:newId()},
      {...f.op(id,'update',{title:'bad'},1),predecessorOperationId:other.operationId},
      {...f.op(id,'update',{title:'bad'},2),predecessorOperationId:rejected.operationId},
      {...f.op(id,'update',{title:'bad'},1),predecessorOperationId:alias.operationId},
      {...f.op(newId(),'create',create.payload),predecessorOperationId:create.operationId},
    ]) {
      const result = await f.repository.push(invalid);
      expect(result).toMatchObject({status:'rejected',error:{code:'invalid_predecessor',retryable:false}});
      expect(await f.repository.push(invalid)).toEqual(result);
    }
    const deletion = f.op(id,'delete',{},1); const deleted = await f.repository.push(deletion);
    const afterDelete = {...f.op(id,'update',{title:'cannot revive'},3),predecessorOperationId:deletion.operationId};
    expect(await f.repository.push(afterDelete)).toMatchObject({status:'acknowledged',entity:deleted.entity});
    const next = {...f.op(id,'update',{title:'still cannot revive'},3),predecessorOperationId:afterDelete.operationId};
    expect(await f.repository.push(next)).toMatchObject({status:'acknowledged',entity:deleted.entity});
  } finally { await f.cleanup(); }
});
real('STEP7-SERVER-CAUSAL-MIGRATION: existing version 2 ledger frames are reconstructed without changing immutable ACKs or cursors',async () => {
  const f = await fixture(); const id = newId();
  try {
    const create = f.op(id,'create',{title:'base',status:'todo',due:null}); await f.repository.push(create);
    await f.repository.push({...f.op(id,'update',{title:'peer'},1),clientId:newId()});
    const offline = f.op(id,'update',{title:'local',due:'2026-10-10'},1);
    const original = await f.repository.push(offline); const before = await f.repository.pull(null);
    const deletedId = newId();
    await f.repository.push(f.op(deletedId,'create',{title:'deleted',status:'todo',due:null}));
    await f.repository.push(f.op(deletedId,'delete',{},1));
    const tombstoneAck = f.op(deletedId,'update',{title:'ignored'},0);
    const tombstone = await f.repository.push(tombstoneAck);
    const head = await f.repository.pull(before.cursor);
    await f.admin.query(`ALTER TABLE "${f.name}".server_operations DROP COLUMN local_after`);
    await f.admin.query(`UPDATE "${f.name}".schema_version SET version=2`);
    const migrated = await StructuredRepository.open(url,f.name);
    try {
      expect(await migrated.push(offline)).toEqual(original);
      expect((await migrated.pull(head.cursor)).operations).toEqual([]);
      expect(await migrated.push({...f.op(deletedId,'update',{title:'ignored again'},2),predecessorOperationId:tombstoneAck.operationId})).toMatchObject({status:'acknowledged',entity:tombstone.entity});
      const next = {...f.op(id,'update',{title:'next',due:'2026-10-11'},3),predecessorOperationId:offline.operationId};
      expect(await migrated.push(next)).toMatchObject({status:'conflict',entity:{title:'peer',due:'2026-10-11',version:4},conflicts:[{base:'local',local:'next',remote:'peer'}]});
    } finally { await migrated.close(); }
  } finally { await f.cleanup(); }
});
