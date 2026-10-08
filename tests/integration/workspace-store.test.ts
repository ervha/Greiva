import { it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { newId } from '@greiva/shared';
import { WorkspaceSyncSession } from '@greiva/sync';
import { WorkspaceDevice } from '../support/workspace-device.js';
import { StructuredDevice } from '../support/structured-device.js';

const time='2026-10-05T08:00:00.000Z';
function fixture() {
  const directory=mkdtempSync(join(tmpdir(),'greiva-workspace-store-'));
  const context={issuer:'https://auth.fixture.invalid/auth/v1',subjectId:'owner-A',workspaceId:newId(),clientId:newId(),streamEpoch:newId()};
  const device=new WorkspaceDevice(join(directory,'device.sqlite'),context),devices=[device];
  const operation={operationId:newId(),clientId:context.clientId,entityId:newId(),entityType:'task',kind:'create',baseVersion:null,payload:{title:'durable 日本語',status:'todo',due:null}};
  const result={operationId:operation.operationId,clientId:operation.clientId,entityId:operation.entityId,entityType:'task',status:'acknowledged',serverOrder:'1',conflicts:[],entity:{id:operation.entityId,...operation.payload,version:1,createdAt:time,updatedAt:time,deletedAt:null}};
  const push={protocolVersion:1,workspaceId:context.workspaceId,streamEpoch:context.streamEpoch,results:[result]};
  const request={protocolVersion:1,workspaceId:context.workspaceId,clientId:context.clientId,cursor:null,limit:1};
  const pull={protocolVersion:1,workspaceId:context.workspaceId,streamEpoch:context.streamEpoch,operations:[result],cursor:'signed-opaque-1',headCursor:'signed-opaque-1',hasMore:false,serverTime:time};
  function sql(query:string) {const db=new DatabaseSync(device.path);try{return db.prepare(query).get();}finally{db.close();}}
  return {directory,context,device,devices,operation,result,push,request,pull,sql,async cleanup(){for(const device of devices)await device.close();rmSync(directory,{recursive:true,force:true});}};
}
it('WORKSPACE-STORE: prepared bytes and causal offline intent survive process restart; ACK never skips pull',async()=>{
  const f=fixture();try{
    await f.device.request('mutate',{operation:f.operation});
    const update={...f.operation,operationId:newId(),kind:'update',baseVersion:0,payload:{title:'offline draft'}};
    await f.device.request('mutate',{operation:update});
    const wire=await f.device.request('prepare');await f.device.close('SIGKILL');expect(await f.device.request('prepare')).toBe(wire);
    await f.device.request('ack',{wire,response:f.push});await f.device.request('ack',{wire,response:f.push});
    const snap=(await f.device.request('snapshot')).snapshot;expect(snap.state.cursor).toBeNull();expect(snap.tasks[0]).toMatchObject({title:'offline draft',version:1});
    const next=JSON.parse(await f.device.request('prepare'));expect(next.operations[0]).toMatchObject({...update,baseVersion:1,predecessorOperationId:f.operation.operationId});
    await f.device.request('pull',{request:f.request,response:f.pull});await f.device.close('SIGKILL');
    expect((await f.device.request('snapshot')).snapshot.state.cursor).toBe(f.pull.cursor);
    expect(f.sql('SELECT count(*) AS n FROM workspace_ack_receipts')?.n).toBe(1);
  }finally{await f.cleanup();}
});
it('WORKSPACE-STORE: every account/workspace/device/epoch mismatch fails without adopting or deleting the old database',async()=>{
  const f=fixture();try{
    await f.device.request('mutate',{operation:f.operation});const before=await f.device.request('snapshot');
    for(const key of Object.keys(f.context) as (keyof typeof f.context)[]){
      const context={...f.context,[key]:key==='issuer'?'https://other.fixture.invalid/auth/v1':key==='subjectId'?'owner-B':newId()};
      const other=new WorkspaceDevice(f.device.path,context);f.devices.push(other);await expect(other.request('snapshot')).rejects.toThrow('Workspace storage rejected or unavailable');await other.close();
    }
    await expect(f.device.request('mutate',{operation:{...f.operation,operationId:newId(),clientId:newId()}})).rejects.toThrow();
    expect(await f.device.request('snapshot')).toEqual(before);
    const other=new WorkspaceDevice(join(f.directory,'other.sqlite'),{...f.context,workspaceId:newId(),clientId:newId(),streamEpoch:newId()});f.devices.push(other);
    await other.request('mutate',{operation:{...f.operation,clientId:other.context.clientId,payload:{...f.operation.payload,title:'other workspace'}}});
    expect((await other.request('snapshot')).snapshot.tasks[0].title).toBe('other workspace');expect(await f.device.request('snapshot')).toEqual(before);
  }finally{await f.cleanup();}
});
it('WORKSPACE-STORE: private schema never imports PoC or unversioned data; ordinary PoC cannot open a bound database',async()=>{
  const f=fixture(),old=new StructuredDevice(join(f.directory,'old.sqlite'));
  try{
    await old.snapshot();await old.close();
    const incompatible=new WorkspaceDevice(old.path,f.context);f.devices.push(incompatible);await expect(incompatible.request('snapshot')).rejects.toThrow();
    const unknownPath=join(f.directory,'unknown.sqlite'),db=new DatabaseSync(unknownPath);db.exec("CREATE TABLE retained(value TEXT);INSERT INTO retained VALUES('keep');");db.close();
    const unknown=new WorkspaceDevice(unknownPath,f.context);f.devices.push(unknown);await expect(unknown.request('snapshot')).rejects.toThrow();await unknown.close();
    const check=new DatabaseSync(unknownPath);expect(check.prepare('SELECT value FROM retained').get()?.value).toBe('keep');expect(check.prepare('PRAGMA user_version').get()?.user_version).toBe(0);check.close();
    await f.device.request('snapshot');expect(f.sql('PRAGMA user_version')?.user_version).toBe(8);
    const ordinary=new StructuredDevice(f.device.path);try{await expect(ordinary.snapshot()).rejects.toThrow('Unsupported local schema version: 8');}finally{await ordinary.close();}
  }finally{await old.close();await f.cleanup();}
});
it('WORKSPACE-STORE: invalid ACK scope/identity/bytes and altered replay never partially acknowledge local intent',async()=>{
  const f=fixture();try{
    await f.device.request('mutate',{operation:f.operation});const wire=await f.device.request('prepare'),before=await f.device.request('snapshot');
    for(const response of [{...f.push,workspaceId:newId()},{...f.push,streamEpoch:newId()},{...f.push,protocolVersion:2},{...f.push,results:[]},{...f.push,results:[{...f.result,clientId:newId()}]},{...f.push,results:[{...f.result,operationId:newId()}]}])await expect(f.device.request('ack',{wire,response})).rejects.toThrow();
    await expect(f.device.request('ack',{wire:JSON.stringify(JSON.parse(wire),null,2),response:f.push})).rejects.toThrow();expect(await f.device.request('snapshot')).toEqual(before);
    await f.device.request('ack',{wire,response:f.push});const committed=await f.device.request('snapshot');
    await expect(f.device.request('ack',{wire,response:{...f.push,results:[{...f.result,serverOrder:'2'}]}})).rejects.toThrow();expect(await f.device.request('snapshot')).toEqual(committed);
    expect(f.sql('SELECT count(*) AS n FROM workspace_ack_receipts')?.n).toBe(1);
  }finally{await f.cleanup();}
});
it('WORKSPACE-STORE: pull validation and cursor-write failure roll back entity/receipt/cursor; exact page replay is idempotent',async()=>{
  const f=fixture();try{
    const before=await f.device.request('snapshot');
    for(const response of [{...f.pull,workspaceId:newId()},{...f.pull,streamEpoch:newId()},{...f.pull,operations:[{...f.result,serverOrder:'2'}]},{...f.pull,hasMore:true},{...f.pull,serverTime:'invalid'}])await expect(f.device.request('pull',{request:f.request,response})).rejects.toThrow();
    await expect(f.device.request('pull',{request:{...f.request,limit:0},response:f.pull})).rejects.toThrow();expect(await f.device.request('snapshot')).toEqual(before);
    const db=new DatabaseSync(f.device.path);db.exec("CREATE TRIGGER fail_cursor BEFORE UPDATE ON sync_state BEGIN SELECT RAISE(ABORT,'private cursor error'); END");db.close();
    await expect(f.device.request('pull',{request:f.request,response:f.pull})).rejects.toThrow('Workspace storage rejected or unavailable');expect(await f.device.request('snapshot')).toEqual(before);expect(f.sql('SELECT count(*) AS n FROM workspace_pull_receipts')?.n).toBe(0);
    const fix=new DatabaseSync(f.device.path);fix.exec('DROP TRIGGER fail_cursor');fix.close();
    await f.device.request('pull',{request:f.request,response:f.pull});const committed=await f.device.request('snapshot');
    await f.device.request('pull',{request:f.request,response:{...f.pull,serverTime:'2026-10-05T09:00:00.000Z'}});expect(await f.device.request('snapshot')).toEqual(committed);
    await expect(f.device.request('pull',{request:f.request,response:{...f.pull,operations:[{...f.result,entity:{...f.result.entity,title:'changed replay'}}]}})).rejects.toThrow();
    expect(await f.device.request('snapshot')).toEqual(committed);expect(f.sql('SELECT count(*) AS n FROM workspace_pull_receipts')?.n).toBe(1);
  }finally{await f.cleanup();}
});
it('WORKSPACE-STORE: closed portable session ignores a late network ACK and fresh sessions commit only their bound native store',async()=>{
  const f=fixture();let resolve!:(value:unknown)=>void;const wait=new Promise<unknown>(yes=>{resolve=yes;});
  const session=new WorkspaceSyncSession(f.context,{store:f.device,transport:{push:async()=>wait,pull:async()=>f.pull}});
  try{
    await f.device.request('mutate',{operation:f.operation});const wire=await f.device.request('prepare');const work=session.push(wire);session.close();resolve(f.push);await expect(work).rejects.toMatchObject({stage:'closed'});
    expect((await f.device.request('snapshot')).snapshot.operations[0].status).toBe('pending');
    const fresh=new WorkspaceSyncSession(f.context,{store:f.device,transport:{push:async()=>f.push,pull:async()=>f.pull}});await fresh.push(wire);await fresh.pull(f.request);fresh.close();
    expect((await f.device.request('snapshot')).snapshot.state).toMatchObject({cursor:f.pull.cursor,lastSuccessfulSyncAt:time});
  }finally{session.close();await f.cleanup();}
});
for(const stage of ['prepare','ack','pull'] as const)for(const boundary of ['before','after'] as const){
  it(`WORKSPACE-STORE-SIGKILL: ${stage} ${boundary} commit recovers atomic durable state and retries without duplication`,async()=>{
    const f=fixture(),root=join(f.directory,'barrier'),crash=new WorkspaceDevice(f.device.path,f.context,{crashRoot:root});f.devices.push(crash);
    try{
      let wire:string|null=null;await f.device.request('snapshot');if(stage!=='pull'){await f.device.request('mutate',{operation:f.operation});if(stage==='ack')wire=await f.device.request('prepare');}
      await f.device.close();writeFileSync(root+'.armed',`workspace-${stage}-${boundary}-commit`);
      const fields=stage==='prepare'?{}:stage==='ack'?{wire,response:f.push}:{request:f.request,response:f.pull};
      const interrupted=crash.request(stage,fields).catch(error=>error);await expect.poll(()=>existsSync(root+'.reached'),{timeout:8000}).toBe(true);
      await crash.close('SIGKILL');expect(await interrupted).toBeInstanceOf(Error);unlinkSync(root+'.armed');
      const snap=(await f.device.request('snapshot')).snapshot,committed=boundary==='after';
      if(stage==='prepare')expect(f.sql('SELECT count(*) AS n FROM workspace_prepared')?.n).toBe(committed?1:0);
      if(stage==='ack'){expect(snap.operations[0].status).toBe(committed?'acknowledged':'pending');expect(f.sql('SELECT count(*) AS n FROM workspace_ack_receipts')?.n).toBe(committed?1:0);expect(snap.state.cursor).toBeNull();}
      if(stage==='pull'){expect(snap.state.cursor).toBe(committed?f.pull.cursor:null);expect(snap.tasks.length).toBe(committed?1:0);expect(f.sql('SELECT count(*) AS n FROM workspace_pull_receipts')?.n).toBe(committed?1:0);}
      if(stage==='prepare'){const retry=await f.device.request('prepare');expect(JSON.parse(retry).operations[0]).toEqual(f.operation);await f.device.close('SIGKILL');expect(await f.device.request('prepare')).toBe(retry);}
      else{await f.device.request(stage,fields);await f.device.request(stage,fields);expect(f.sql(`SELECT count(*) AS n FROM workspace_${stage==='ack'?'ack':'pull'}_receipts`)?.n).toBe(1);}
      expect(f.sql('PRAGMA quick_check')?.quick_check).toBe('ok');
    }finally{await f.cleanup();}
  });
}
