import { it, expect } from 'vitest';
import pg from 'pg';
import { newId } from '@greiva/shared';
import { taskSchema, relationSchema, type PushOperation } from '@greiva/protocol';
import { StructuredRepository, EntityWriteError } from '../../apps/api/dist/structured-repository.js';
import { createApp } from '../../apps/api/dist/app.js';
const url = process.env.DATABASE_URL ?? 'postgresql://greiva:greiva_dev_only@127.0.0.1:5432/greiva_poc';
it.skipIf(process.env.GREIVA_TEST_POSTGRES !== '1')('STEP6-POSTGRES: real models survive reopen; version guards serialize competing edits; Nest exposes durable reads', async () => {
  const schema = `greiva_test_${newId().replaceAll('-','')}`;
  const admin = new pg.Client({ connectionString: url }); await admin.connect();
  let repository: StructuredRepository | undefined;
  let app: Awaited<ReturnType<typeof createApp>> | undefined;
  const clientId = newId(); const taskId = newId(); const relationId = newId();
  const op = (entityId: string,entityType: PushOperation['entityType'],kind: PushOperation['kind'],payload: unknown,baseVersion: number | null = kind === 'create' ? null : 1): PushOperation => ({ operationId:newId(),entityId,entityType,kind,payload,baseVersion,clientId });
  try {
    repository = await StructuredRepository.open(url,schema);
    const task = taskSchema.parse(await repository.mutate(op(taskId,'task','create',{title:'task',status:'todo',due:'2028-02-29'})));
    expect(task).toMatchObject({ id:taskId,version:1,status:'todo',due:'2028-02-29',deletedAt:null });
    expect(task.createdAt).toMatch(/Z$/);
    const competition = await Promise.allSettled([
      repository.mutate(op(taskId,'task','update',{title:'first'})),
      repository.mutate(op(taskId,'task','update',{title:'second'})),
    ]);
    expect(competition.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = competition.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(EntityWriteError);
    expect(rejected.reason.code).toBe('version_conflict');
    expect((await repository.tasks())[0]!.version).toBe(2);
    await expect(repository.mutate(op(taskId,'task','update',{due:'2026-02-29'},2))).rejects.toThrow();
    await expect(repository.mutate(op(taskId,'task','update',{version:100},2))).rejects.toThrow();
    expect((await repository.tasks())[0]!.version).toBe(2);
    // Page references stay opaque; there is no second REST copy of the Page body.
    const pageId = newId();
    const relation = relationSchema.parse(await repository.mutate(op(relationId,'relation','create',{fromType:'page',fromId:pageId,toType:'task',toId:taskId})));
    expect(relation.fromId).toBe(pageId);
    expect((await repository.mutate(op(relationId,'relation','update',{fromId:newId()}))).version).toBe(2);
    await repository.close(); repository = undefined;
    app = await createApp({ databaseUrl:url,schemaName:schema });
    const tasks = await app.inject({ method:'GET',url:'/tasks' });
    expect(tasks.statusCode).toBe(200); expect(tasks.json()).toHaveLength(1);
    expect(taskSchema.parse(tasks.json()[0]).version).toBe(2);
    expect((await app.inject({method:'GET',url:'/relations'})).json()).toHaveLength(1);
    expect((await app.inject({method:'POST',url:'/sync/push',payload:{}})).statusCode).toBe(404);
    await app.close(); app = undefined;
    repository = await StructuredRepository.open(url,schema);
    expect((await repository.mutate(op(taskId,'task','delete',{},2))).version).toBe(3);
    expect((await repository.mutate(op(relationId,'relation','delete',{},2))).version).toBe(3);
    expect(await repository.tasks()).toEqual([]); expect(await repository.relations()).toEqual([]);
    expect((await repository.tasks(true))[0]!.deletedAt).toMatch(/Z$/);
    expect((await repository.relations(true))[0]!.deletedAt).toMatch(/Z$/);
    await expect(repository.mutate(op(taskId,'task','update',{title:'resurrect'},3))).rejects.toMatchObject({code:'deleted'});
    await repository.close(); repository = undefined;
    await admin.query(`UPDATE "${schema}".schema_version SET version=99`);
    await expect(StructuredRepository.open(url,schema)).rejects.toThrow('Unsupported structured schema version');
    expect((await admin.query(`SELECT count(*)::int AS count FROM "${schema}".tasks`)).rows[0].count).toBe(1);
  } finally {
    await app?.close(); await repository?.close();
    // Only this test's newly created namespace, never the application schema.
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end();
  }
});
