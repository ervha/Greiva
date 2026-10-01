import { it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { newId } from '@greiva/shared';
import { type PushOperation, type PushResult, type Task, type Conflict, type PullResponse } from '@greiva/protocol';
import { StructuredDevice } from '../support/structured-device.js';
const time = '2026-10-01T08:00:00.000Z';
function fixture() {
  const directory = mkdtempSync(join(tmpdir(),'greiva-sync-store-'));
  const device = new StructuredDevice(join(directory,'local.sqlite')); const clientId = newId();
  const op = (entityId: string,kind: PushOperation['kind'],payload: unknown,baseVersion: number | null = kind==='create' ? null : 1): PushOperation => ({ operationId:newId(),entityType:'task',entityId,kind,payload,baseVersion,clientId });
  return { device,clientId,op, async initialize() { await device.request('structured-client-id',{candidate:clientId}); },
    async cleanup() { await device.close(); rmSync(directory,{recursive:true,force:true}); } };
}
function task(id: string,version = 1,extra: Partial<Task> = {}): Task { return { id,version,title:'original',status:'todo',due:null,createdAt:time,updatedAt:time,deletedAt:null,...extra }; }
function ack(operation: PushOperation,order: number,entity: Task,conflicts: Conflict[] = []): PushResult {
  return { operationId:operation.operationId,clientId:operation.clientId,entityId:operation.entityId,entityType:operation.entityType,serverOrder:String(order),entity,conflicts,status:conflicts.some(record=>record.status==='open') ? 'conflict' : 'acknowledged' };
}
function page(operations: PushResult[],cursor: string,headCursor = cursor): PullResponse { return { operations,cursor,headCursor,hasMore:cursor!==headCursor,serverTime:time }; }

it('STEP7-STORE: immutable prepared requests and causal offline intent survive store SIGKILL; ACK does not skip pull', async () => {
  const f = fixture(); const id = newId();
  try {
    await f.initialize();
    const create = f.op(id,'create',{title:'original',status:'todo',due:null});
    const update = f.op(id,'update',{title:'offline',status:'todo',due:null},0);
    await f.device.mutate(create); await f.device.mutate(update);
    expect(await f.device.prepare()).toEqual(create);
    await f.device.close('SIGKILL'); expect(await f.device.prepare()).toEqual(create);
    const result = ack(create,1,task(id)); await f.device.acknowledge(result);
    const snapshot = await f.device.snapshot();
    expect(snapshot.tasks[0]).toMatchObject({title:'offline',version:1});
    expect(snapshot.state.cursor).toBeNull(); expect(snapshot.operations.map(operation=>operation.status)).toEqual(['acknowledged','pending']);
    const prepared = { ...update,baseVersion:1,predecessorOperationId:create.operationId };
    expect(await f.device.prepare()).toEqual(prepared);
    await f.device.close('SIGKILL'); expect(await f.device.prepare()).toEqual(prepared);
    await f.device.applyPull(null,page([result],'c1')); await f.device.acknowledge(ack(update,2,task(id,2,{title:'offline'})));
    expect((await f.device.snapshot()).state.lastSuccessfulSyncAt).toBeNull();
    await f.device.applyPull('c1',page([ack(update,2,task(id,2,{title:'offline'}))],'c2'));
    expect((await f.device.snapshot()).state).toMatchObject({cursor:'c2',headCursor:'c2',lastSuccessfulSyncAt:time});
    expect(await f.device.prepare()).toBeNull();
  } finally { await f.cleanup(); }
});
it('STEP7-PROJECTION: pulling a peer edit preserves only local changed fields, causal bases and unsent intent', async () => {
  const f = fixture(); const id = newId();
  try {
    await f.initialize(); const seed = f.op(id,'create',{}); const seedResult = ack(seed,1,task(id));
    await f.device.applyPull(null,page([seedResult],'c1'));
    const update = f.op(id,'update',{title:'local draft',status:'todo',due:null}); await f.device.mutate(update);
    const peer = {...f.op(id,'update',{status:'done'}),clientId:newId()};
    await f.device.applyPull('c1',page([ack(peer,2,task(id,2,{status:'done'}))],'c2'));
    expect((await f.device.snapshot()).tasks[0]).toMatchObject({title:'local draft',status:'done',version:2});
    expect(await f.device.prepare()).toEqual(update); // Never rebase first-send intent to the peer version.
    const db = new DatabaseSync(f.device.path);
    expect(JSON.parse(String(db.prepare('SELECT base_entity FROM sync_operations WHERE operation_id=?').get(update.operationId)?.base_entity))).toMatchObject({title:'original',status:'todo',version:1}); db.close();
    await f.device.close('SIGKILL'); expect((await f.device.snapshot()).tasks[0]).toMatchObject({title:'local draft',status:'done'});
  } finally { await f.cleanup(); }
});
it('STEP7-PULL-ATOMIC: cursor-write failure rolls back entity, receipt and cursor; committed pages replay idempotently', async () => {
  const f = fixture(); const id = newId();
  try {
    await f.initialize(); const result = ack(f.op(id,'create',{}),1,task(id)); const db = new DatabaseSync(f.device.path);
    db.exec("CREATE TRIGGER fail_cursor BEFORE UPDATE ON sync_state BEGIN SELECT RAISE(ABORT,'cursor commit failure'); END");
    await expect(f.device.applyPull(null,page([result],'c1'))).rejects.toThrow('cursor commit failure');
    expect((await f.device.snapshot()).tasks).toEqual([]); expect(db.prepare('SELECT count(*) AS count FROM structured_received').get()?.count).toBe(0);
    expect((await f.device.snapshot()).state.cursor).toBeNull(); db.exec('DROP TRIGGER fail_cursor');
    await f.device.applyPull(null,page([result],'c1')); const before = await f.device.snapshot();
    await f.device.applyPull(null,page([result],'c1')); expect(await f.device.snapshot()).toEqual(before);
    await expect(f.device.applyPull('stale',page([],'unrelated'))).rejects.toThrow('cursor changed');
    await expect(f.device.applyPull('c1',page([ack(f.op(id,'update',{}),3,task(id,2))],'c3'))).rejects.toThrow('skipped or reordered');
    expect(await f.device.snapshot()).toEqual(before); db.close();
  } finally { await f.cleanup(); }
});
it('STEP7-ACK-ATOMIC: failed ACK keeps prepared wire and pending status; delayed older ACK cannot roll back newer pull', async () => {
  const f = fixture(); const id = newId();
  try {
    await f.initialize(); const create = f.op(id,'create',{title:'original',status:'todo',due:null}); await f.device.mutate(create); await f.device.prepare();
    const db = new DatabaseSync(f.device.path); db.exec("CREATE TRIGGER fail_ack BEFORE UPDATE ON sync_operations BEGIN SELECT RAISE(ABORT,'ACK commit failure'); END");
    const result = ack(create,1,task(id)); await expect(f.device.acknowledge(result)).rejects.toThrow('ACK commit failure');
    expect((await f.device.snapshot()).operations[0]?.status).toBe('pending'); expect(await f.device.prepare()).toEqual(create);
    db.exec('DROP TRIGGER fail_ack');
    const peer = ack({...f.op(id,'update',{}),clientId:newId()},2,task(id,2,{title:'newer'}));
    await f.device.applyPull(null,page([result,peer],'c2')); await f.device.acknowledge(result);
    expect((await f.device.snapshot()).tasks[0]).toMatchObject({version:2,title:'newer'});
    await expect(f.device.acknowledge({...result,entity:task(id,1,{title:'different'})})).rejects.toThrow('Immutable'); db.close();
  } finally { await f.cleanup(); }
});
it('STEP7-CONFLICT: preserve base/local/remote; resolve as a new operation; old receipt cannot reopen it', async () => {
  const f = fixture(); const id = newId();
  try {
    await f.initialize(); await f.device.applyPull(null,page([ack(f.op(id,'create',{}),1,task(id))],'c1'));
    const update = f.op(id,'update',{title:'local'}); await f.device.mutate(update); await f.device.prepare();
    const conflict: Conflict = { id:newId(),operationId:update.operationId,entityType:'task',entityId:id,field:'title',base:'original',local:'local',remote:'remote',createdAt:time,status:'open',resolvedBy:null };
    const result = ack(update,2,task(id,2,{title:'remote'}),[conflict]); await f.device.acknowledge(result);
    expect((await f.device.snapshot()).conflicts).toEqual([conflict]);
    await expect(f.device.mutate({...f.op(id,'update',{title:'wrong'},2),resolution:{conflictIds:[conflict.id],choice:'local'}})).rejects.toThrow('choice');
    const resolution = {...f.op(id,'update',{title:'local'},2),resolution:{conflictIds:[conflict.id],choice:'local' as const}};
    await f.device.mutate(resolution); expect((await f.device.snapshot()).conflicts[0]?.status).toBe('open');
    expect(await f.device.prepare()).toEqual(resolution);
    const resolved = {...conflict,status:'resolved' as const,resolvedBy:resolution.operationId};
    const resolvedResult = ack(resolution,3,task(id,3,{title:'local'}),[resolved]); await f.device.acknowledge(resolvedResult);
    await f.device.applyPull('c1',page([result,resolvedResult],'c3')); await f.device.acknowledge(result);
    expect((await f.device.snapshot()).conflicts).toEqual([resolved]); expect((await f.device.snapshot()).tasks[0]?.title).toBe('local');
    await f.device.close('SIGKILL'); expect((await f.device.snapshot()).conflicts).toEqual([resolved]);
  } finally { await f.cleanup(); }
});
it('STEP7-TOMBSTONE: remote deletion wins over pending update without discarding its recorded payload', async () => {
  const f = fixture(); const id = newId();
  try {
    await f.initialize(); await f.device.applyPull(null,page([ack(f.op(id,'create',{}),1,task(id))],'c1'));
    const update = f.op(id,'update',{title:'offline'}); await f.device.mutate(update);
    const deleted = task(id,2,{deletedAt:time});
    await f.device.applyPull('c1',page([ack({...f.op(id,'delete',{}),clientId:newId()},2,deleted)],'c2'));
    expect((await f.device.snapshot()).tasks[0]).toEqual(deleted); expect((await f.device.snapshot()).operations[0]?.payload).toEqual({title:'offline'});
    expect(await f.device.prepare()).toEqual(update); await f.device.acknowledge(ack(update,3,deleted));
    await f.device.applyPull('c2',page([ack(update,3,deleted)],'c3')); await f.device.close('SIGKILL');
    expect((await f.device.snapshot()).tasks[0]?.deletedAt).toBe(time);
    await expect(f.device.mutate(f.op(id,'update',{title:'resurrect'},2))).rejects.toThrow('deleted');
  } finally { await f.cleanup(); }
});
it('STEP7-REJECTION: permanent rejection and dependent local operations remain inspectable after restart', async () => {
  const f = fixture(); const id = newId();
  try {
    await f.initialize(); const create = f.op(id,'create',{title:'retained',status:'todo',due:null}); const next = f.op(id,'update',{title:'retained next'},0);
    await f.device.mutate(create); await f.device.mutate(next); await f.device.prepare();
    const rejected: PushResult = {status:'rejected',operationId:create.operationId,clientId:f.clientId,entityType:'task',entityId:id,serverOrder:'1',conflicts:[],entity:null,error:{code:'invalid_payload',message:'invalid',retryable:false}};
    await f.device.acknowledge(rejected); expect(await f.device.prepare()).toBeNull(); await f.device.close('SIGKILL');
    const snapshot = await f.device.snapshot(); expect(snapshot.operations.map(operation=>operation.status)).toEqual(['rejected','rejected']);
    expect(snapshot.operations[1]?.payload).toEqual({title:'retained next'}); expect(snapshot.errors).toHaveLength(2);
    await f.device.applyPull(null,page([rejected],'c1')); expect((await f.device.snapshot()).state.lastSuccessfulSyncAt).toBeNull();
  } finally { await f.cleanup(); }
});
it('STEP7-VALIDATION: malformed metadata, mismatched identity, unknown fields and invalid Conflict values leave storage unchanged', async () => {
  const f = fixture(); const id = newId();
  try {
    await f.initialize(); const valid = ack(f.op(id,'create',{}),1,task(id));
    for (const invalid of [{...valid,extra:1},{...valid,serverOrder:'01'},{...valid,entity:task(newId())},{...valid,entity:task(id,0)},{...valid,entity:task(id,1,{updatedAt:'2026-02-29T99:00:00.000Z'})}]) {
      await expect(f.device.request('structured-pull',{baseCursor:null,batch:page([invalid as PushResult],'c1')})).rejects.toThrow();
      expect((await f.device.snapshot()).tasks).toEqual([]); expect((await f.device.snapshot()).state.cursor).toBeNull();
    }
    await expect(f.device.acknowledge(valid)).rejects.toThrow('not a local');
  } finally { await f.cleanup(); }
});
it('STEP7-MIGRATION: schema 3 queue/client/Page survive schema 4 upgrade; incompatible destination rolls back columns and version', async () => {
  for (const incompatible of [false,true]) {
    const f = fixture(); const pageId = newId(); const id = newId(); const operation = f.op(id,'create',{title:'original',status:'todo',due:null});
    try {
      const db = new DatabaseSync(f.device.path);
      db.exec(readFileSync('apps/client/src-tauri/crates/page-store/schema.sql','utf8'));
      db.exec(readFileSync('apps/client/src-tauri/crates/page-store/structured.sql','utf8'));
      db.prepare('INSERT INTO pages VALUES (?,?,?,?,?)').run(pageId,'existing',`page:${pageId}`,time,time);
      db.prepare('INSERT INTO structured_client VALUES (1,?)').run(f.clientId);
      db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?)').run(id,'original','todo',null,0,time,time,null);
      db.prepare("INSERT INTO sync_operations(operation_id,entity_type,entity_id,kind,base_version,payload,client_id,created_at,status,prepared_wire) VALUES (?,'task',?,'create',NULL,?,?,?,'pending',?)").run(operation.operationId,id,JSON.stringify(operation.payload),f.clientId,time,JSON.stringify(operation));
      if (incompatible) {
        db.exec('CREATE TABLE structured_received (wrong TEXT)');
        await expect(f.device.snapshot()).rejects.toThrow('already exists');
        expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(3);
        expect(db.prepare('PRAGMA table_info(sync_operations)').all().some(row=>row.name==='local_result')).toBe(false);
      } else {
        const snapshot = await f.device.snapshot(); expect(snapshot.clientId).toBe(f.clientId); expect(snapshot.operations[0]?.operationId).toBe(operation.operationId);
        expect(await f.device.prepare()).toEqual(operation); expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(4);
      }
      expect(db.prepare('SELECT title FROM pages WHERE id=?').get(pageId)?.title).toBe('existing'); db.close();
    } finally { await f.cleanup(); }
  }
});
