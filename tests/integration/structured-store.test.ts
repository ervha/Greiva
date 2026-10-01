import { it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { newId } from '@greiva/shared';
import { emptyPageUpdate } from '@greiva/sync';
import { structuredSnapshotSchema, taskSchema, relationSchema, type PushOperation } from '@greiva/protocol';
function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'greiva-structured-'));
  const path = join(directory, 'store.sqlite');
  const clientId = newId();
  const request = (...items: object[]) => {
    const run = spawnSync(resolve('.data/native-target/debug/examples/store-driver'), [path], { input: items.map((item,id) => JSON.stringify({ ...item,id })).join('\n') + '\n', encoding: 'utf8' });
    expect(run.status,run.stderr).toBe(0);
    return run.stdout.trim().split('\n').map(line => JSON.parse(line) as { value?: unknown; error?: string });
  };
  const snapshot = () => structuredSnapshotSchema.parse(request({ command: 'structured-snapshot' })[0]!.value);
  const mutate = (operation: PushOperation) => request({ command: 'structured-mutate', operation })[0]!;
  const op = (entityId: string, entityType: PushOperation['entityType'], kind: PushOperation['kind'], payload: unknown, baseVersion: number | null = kind === 'create' ? null : 0): PushOperation => ({ operationId: newId(), entityId, entityType, kind, payload, baseVersion, clientId });
  const cleanup = () => rmSync(directory, { recursive: true, force: true });
  return { path, clientId, request, snapshot, mutate, op, cleanup };
}
it('STEP6-LOCAL: atomically migrates Page schema, keeps binary updates and stable client identity across reopen', () => {
  const f = fixture(); const pageId = newId();
  try {
    const db = new DatabaseSync(f.path);
    db.exec(readFileSync('apps/client/src-tauri/crates/page-store/schema.sql','utf8'));
    db.prepare('INSERT INTO pages VALUES (?,?,?,?,?)').run(pageId,'old Page',`page:${pageId}`,'2026-09-30T00:00:00.000Z','2026-09-30T00:00:00.000Z');
    const bytes = emptyPageUpdate();
    db.prepare('INSERT INTO page_updates(page_id,update_bytes,digest) VALUES (?,?,?)').run(pageId,bytes,createHash('sha256').update(bytes).digest());
    db.close();
    expect(f.request({ command: 'structured-client-id', candidate: f.clientId })[0]!.value).toBe(f.clientId);
    expect(f.request({ command: 'structured-client-id', candidate: newId() })[0]!.value).toBe(f.clientId);
    expect(f.snapshot()).toMatchObject({ tasks: [], relations: [], operations: [], clientId: f.clientId, state: { stream: 'structured', cursor: null, lastSuccessfulSyncAt: null } });
    expect(f.request({ command: 'load',pageId })[0]!.value).toMatchObject({ metadata: { title: 'old Page' },updates:[Array.from(bytes)] });
    const after = new DatabaseSync(f.path);
    expect(after.prepare('PRAGMA user_version').get()?.user_version).toBe(3); after.close();
  } finally { f.cleanup(); }
});
it('STEP6-MIGRATION: an incompatible existing table rolls back the whole upgrade and preserves Page data', () => {
  const f = fixture(); const pageId = newId();
  try {
    const db = new DatabaseSync(f.path);
    db.exec(readFileSync('apps/client/src-tauri/crates/page-store/schema.sql','utf8'));
    db.prepare('INSERT INTO pages VALUES (?,?,?,?,?)').run(pageId,'preserved',`page:${pageId}`,'2026-09-30T00:00:00.000Z','2026-09-30T00:00:00.000Z');
    db.exec('CREATE TABLE sync_operations (unexpected TEXT)');
    expect(f.request({command:'structured-snapshot'})[0]!.error).toContain('already exists');
    expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(2);
    expect(db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name IN ('tasks','relations')").get()?.count).toBe(0);
    expect(db.prepare('SELECT title FROM pages WHERE id=?').get(pageId)?.title).toBe('preserved'); db.close();
  } finally { f.cleanup(); }
});
it('STEP6-ATOMIC: queue failure rolls back Task/Relation edits, retains pending operations and causal bases after restart', () => {
  const f = fixture(); const taskId = newId(); const relationId = newId(); const pageId = newId();
  try {
    f.request({ command: 'structured-client-id',candidate: f.clientId });
    const db = new DatabaseSync(f.path);
    db.exec("CREATE TRIGGER reject_queue BEFORE INSERT ON sync_operations BEGIN SELECT RAISE(ABORT,'queue failure'); END");
    const create = f.op(taskId,'task','create',{ title: 'original',status: 'todo',due: '2028-02-29' });
    expect(f.mutate(create).error).toContain('queue failure');
    expect(f.snapshot().tasks).toEqual([]);
    db.exec('DROP TRIGGER reject_queue');
    expect(taskSchema.parse(f.mutate(create).value)).toMatchObject({ id: taskId,version: 0,due: '2028-02-29' });
    expect(f.mutate(create).error).toBeUndefined();
    const update = f.op(taskId,'task','update',{ title: 'changed',status: 'in_progress',due: null });
    expect(f.mutate(update).error).toBeUndefined();
    const relation = f.op(relationId,'relation','create',{ fromType: 'page',fromId: pageId,toType: 'task',toId: taskId });
    expect(relationSchema.parse(f.mutate(relation).value)).toMatchObject({ fromId: pageId,toId: taskId });
    db.exec("CREATE TRIGGER reject_queue BEFORE INSERT ON sync_operations BEGIN SELECT RAISE(ABORT,'queue failure'); END");
    expect(f.mutate(f.op(taskId,'task','delete',{})).error).toContain('queue failure');
    expect(f.mutate(f.op(relationId,'relation','update',{ toId: newId() })).error).toContain('queue failure');
    expect(f.snapshot().tasks[0]!.deletedAt).toBeNull();
    expect(f.snapshot().relations[0]!.toId).toBe(taskId);
    db.exec('DROP TRIGGER reject_queue');
    expect(f.mutate(f.op(taskId,'task','delete',{})).error).toBeUndefined();
    expect(f.mutate(f.op(relationId,'relation','delete',{})).error).toBeUndefined();
    expect(f.mutate(f.op(taskId,'task','update',{ title: 'resurrect' })).error).toContain('deleted');
    const restored = f.snapshot();
    expect(restored.operations).toHaveLength(5);
    expect(restored.operations.every(operation => operation.status === 'pending')).toBe(true);
    expect(restored.tasks[0]!.deletedAt).toMatch(/Z$/);
    expect(restored.relations[0]!.deletedAt).toMatch(/Z$/);
    const queued = db.prepare('SELECT dependency_operation_id,base_entity FROM sync_operations WHERE operation_id=?').get(update.operationId);
    expect(queued?.dependency_operation_id).toBe(create.operationId);
    expect(JSON.parse(String(queued?.base_entity)).title).toBe('original');
    expect(f.mutate({ ...create,payload: { title: 'different',status: 'todo',due: null } }).error).toContain('reused');
    expect(restored.state.cursor).toBeNull(); db.close();
  } finally { f.cleanup(); }
});
it('STEP6-VALIDATION: native IPC rejects malformed, immutable and stale writes without creating queue entries', () => {
  const f = fixture(); const id = newId();
  try {
    f.request({ command: 'structured-client-id',candidate: f.clientId });
    for (const payload of [{ title:'x',status:'todo',due:'2026-02-29' },{ title:'x',status:'bad',due:null },{ title:'x',status:'todo',due:null,version:9 }]) {
      expect(f.mutate(f.op(id,'task','create',payload)).error).toBeTruthy();
    }
    expect(f.mutate({ ...f.op(id,'task','create',{title:'x',status:'todo',due:null}),entityId:'../../outside' }).error).toBeTruthy();
    expect(f.mutate(f.op(id,'task','create',{title:'x',status:'todo',due:null})).error).toBeUndefined();
    expect(f.mutate(f.op(id,'task','update',{ title:'stale' },2)).error).toContain('Stale');
    expect(f.mutate(f.op(id,'task','update',{})).error).toContain('Empty');
    expect(f.snapshot().operations).toHaveLength(1);
  } finally { f.cleanup(); }
});
