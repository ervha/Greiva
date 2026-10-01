import { it,expect } from 'vitest';
import pg from 'pg';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { newId } from '@greiva/shared';
import type { PushOperation } from '@greiva/protocol';
import { StructuredSyncEngine,httpStructuredTransport, type StructuredReport, type StructuredTransport } from '@greiva/sync';
import { StructuredDevice } from '../support/structured-device.js';
import { StructuredRepository } from '../../apps/api/dist/structured-repository.js';
import { createApp } from '../../apps/api/dist/app.js';
const real = it.skipIf(process.env.GREIVA_TEST_POSTGRES!=='1');
const url = process.env.DATABASE_URL ?? 'postgresql://greiva:greiva_dev_only@127.0.0.1:5432/greiva_poc';
async function fixture() {
  const directory = mkdtempSync(join(tmpdir(),'greiva-sync-client-')); const name = `greiva_test_${newId().replaceAll('-','')}`;
  const admin = new pg.Client({connectionString:url}); await admin.connect();
  const repository = await StructuredRepository.open(url,name);
  let app = await createApp({databaseUrl:url,schemaName:name}); await app.listen(0,'127.0.0.1');
  let address = await app.getUrl(); const devices: StructuredDevice[] = []; const engines: StructuredSyncEngine[] = [];
  const op = (clientId: string,entityId: string,kind: PushOperation['kind'],payload: unknown,baseVersion: number | null = kind==='create' ? null : 1,entityType: PushOperation['entityType']='task'): PushOperation => ({operationId:newId(),clientId,entityId,entityType,kind,payload,baseVersion});
  async function device() { const value = new StructuredDevice(join(directory,`${newId()}.sqlite`)); devices.push(value); const clientId = newId(); await value.request('structured-client-id',{candidate:clientId}); return {value,clientId}; }
  function engine(store: StructuredDevice,transport: StructuredTransport = httpStructuredTransport(address),paused = false) {
    const state = {latest:null as StructuredReport | null,history:[] as StructuredReport[]};
    const value = new StructuredSyncEngine(store,transport,report=> {state.latest=report;state.history.push(report);},{paused,pollMs:100}); engines.push(value); value.start();
    return {value,state,async phase(phase: StructuredReport['phase']) { await expect.poll(()=>state.latest?.phase,{timeout:12_000,interval:50}).toBe(phase); }};
  }
  async function closeApi() {
    // These sockets belong exclusively to this fixture. Aborted fetch/keep-alive
    // connections can otherwise hold Fastify.close open after assertions pass.
    app.getHttpAdapter().getInstance().server.closeAllConnections();
    await app.close();
  }
  return {name,admin,repository,op,device,engine,address,
    async restart() { const endpoint = new URL(address); await closeApi(); app = await createApp({databaseUrl:url,schemaName:name}); await app.listen(Number(endpoint.port),'127.0.0.1'); address=await app.getUrl(); },
    async cleanup() {
      for (const engine of engines) engine.stop();
      for (const device of devices) await device.close();
      await closeApi();
      await repository.close();
      await admin.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`); await admin.end(); rmSync(directory,{recursive:true,force:true});
    } };
}

real('STEP7-CLIENT-HTTP: offline Task/Relation chains survive SIGKILL and converge through restore/pull/push/pull in creation order',async () => {
  const f = await fixture(); const a = await f.device(); const b = await f.device(); const id = newId(); const relationId = newId();
  try {
    const create = f.op(a.clientId,id,'create',{title:'offline',status:'todo',due:null});
    const update = f.op(a.clientId,id,'update',{title:'edited offline',status:'in_progress',due:'2028-02-29'},0);
    await a.value.mutate(create); await a.value.mutate(update);
    await a.value.mutate(f.op(a.clientId,relationId,'create',{fromType:'page',fromId:newId(),toType:'task',toId:id},null,'relation'));
    const before = await a.value.snapshot(); await a.value.close('SIGKILL'); expect(await a.value.snapshot()).toEqual(before);
    const trace: string[] = []; const transport = httpStructuredTransport(f.address);
    const engine = f.engine(a.value,{pull:async (cursor,signal)=> {trace.push('pull'); return transport.pull(cursor,signal);},push:async (operation,signal)=> {trace.push(`push:${operation.operationId}`); return transport.push(operation,signal);}});
    await engine.phase('synced'); expect(trace[0]).toBe('pull'); expect(trace.filter(item=>item.startsWith('push:'))).toEqual(before.operations.map(operation=>`push:${operation.operationId}`));
    expect(trace.at(-1)).toBe('pull'); const peer = f.engine(b.value); await peer.phase('synced');
    const restored = await a.value.snapshot(); const received = await b.value.snapshot();
    expect(restored.tasks).toEqual(received.tasks); expect(restored.relations).toEqual(received.relations);
    expect(restored.tasks).toEqual(await f.repository.tasks(true)); expect(restored.relations).toEqual(await f.repository.relations(true));
    expect(restored.tasks[0]).toMatchObject({title:'edited offline',status:'in_progress',due:'2028-02-29',version:2});
    expect((await f.repository.pull(null)).operations).toHaveLength(3);
  } finally { await f.cleanup(); }
});
real('STEP7-CLIENT-ACK-LOSS: commit followed by dropped HTTP ACK and API/store restart is recovered once through durable pull',async () => {
  const f = await fixture(); const a = await f.device(); const id = newId();
  try {
    const create = f.op(a.clientId,id,'create',{title:'once',status:'todo',due:null}); await a.value.mutate(create);
    let dropped = false;
    const transport = httpStructuredTransport(f.address,async (input,init)=> {
      const response = await fetch(input,init);
      if (String(input).endsWith('/push') && !dropped) { dropped=true; throw new TypeError('Injected ACK loss after server commit'); }
      return response;
    });
    const first = f.engine(a.value,transport); await first.phase('retrying'); first.value.stop();
    expect((await a.value.snapshot()).operations[0]?.status).toBe('pending'); expect(await a.value.prepare()).toEqual(create);
    await a.value.close('SIGKILL'); await f.restart();
    const recovered = f.engine(a.value); await recovered.phase('synced');
    expect((await f.repository.pull(null)).operations).toHaveLength(1);
    expect((await a.value.snapshot()).tasks).toEqual(await f.repository.tasks(true));
    expect((await a.value.snapshot()).operations[0]?.status).toBe('acknowledged');
  } finally { await f.cleanup(); }
});
real('STEP7-CLIENT-CONFLICT: actual HTTP plus Rust stores preserve peer fields, expose both values, and converge after explicit new resolution',async () => {
  const f = await fixture(); const a = await f.device(); const b = await f.device(); const id = newId();
  try {
    await f.repository.push(f.op(newId(),id,'create',{title:'base',status:'todo',due:null}));
    const left = f.engine(a.value); const right = f.engine(b.value); await left.phase('synced'); await right.phase('synced');
    left.value.setPaused(true); await left.phase('offline');
    await a.value.mutate(f.op(a.clientId,id,'update',{title:'local',due:'2026-10-10'})); await left.value.localChanged();
    await b.value.mutate(f.op(b.clientId,id,'update',{title:'remote',status:'done'})); await right.value.localChanged(); await right.phase('synced');
    left.value.setPaused(false); await left.phase('conflict');
    const conflict = (await a.value.snapshot()).conflicts.find(value=>value.status==='open')!;
    expect(conflict).toMatchObject({field:'title',base:'base',local:'local',remote:'remote'});
    expect((await a.value.snapshot()).tasks[0]).toMatchObject({title:'remote',status:'done',due:'2026-10-10'});
    const version = (await a.value.snapshot()).tasks[0]!.version;
    const resolution = {...f.op(a.clientId,id,'update',{title:conflict.local},version),resolution:{conflictIds:[conflict.id],choice:'local' as const}};
    await a.value.mutate(resolution); await left.value.localChanged(); await left.phase('synced');
    await expect.poll(async()=> (await b.value.snapshot()).tasks[0]?.title,{timeout:6000}).toBe('local');
    expect((await a.value.snapshot()).tasks).toEqual((await b.value.snapshot()).tasks);
    expect((await a.value.snapshot()).tasks).toEqual(await f.repository.tasks(true));
    expect((await b.value.snapshot()).conflicts[0]?.resolvedBy).toBe(resolution.operationId);
  } finally { await f.cleanup(); }
});
real('STEP7-CLIENT-PULL-FAILURE: cursor commit failure stops network progress; restart and explicit retry keep the original cursor and restore all records',async () => {
  const f = await fixture(); const a = await f.device(); const id = newId();
  try {
    await f.repository.push(f.op(newId(),id,'create',{title:'durable server',status:'todo',due:null}));
    const db = new DatabaseSync(a.value.path); db.exec("CREATE TRIGGER fail_cursor BEFORE UPDATE ON sync_state BEGIN SELECT RAISE(ABORT,'Injected cursor failure'); END");
    const engine = f.engine(a.value); await engine.phase('storage-error');
    expect((await a.value.snapshot()).tasks).toEqual([]); expect((await a.value.snapshot()).state.cursor).toBeNull();
    engine.value.stop(); await a.value.close('SIGKILL'); db.exec('DROP TRIGGER fail_cursor'); db.close();
    const recovered = f.engine(a.value); await recovered.phase('synced');
    expect((await a.value.snapshot()).tasks).toEqual(await f.repository.tasks(true));
    expect((await a.value.snapshot()).operations).toEqual([]);
  } finally { await f.cleanup(); }
});
real('STEP7-CLIENT-LATENCY: 500ms, 2s and 5s HTTP ACK delays never report pending edits as synced; repeated pause/resume keeps intent',async () => {
  const f = await fixture(); const a = await f.device();
  try {
    let delay = 0; let entered: (()=>void) | undefined;
    const transport = httpStructuredTransport(f.address,async (input,init)=> {
      const response = await fetch(input,init);
      if (String(input).endsWith('/push') && delay>0) { entered?.(); await new Promise<void>(done=>setTimeout(done,delay)); }
      return response;
    });
    const engine = f.engine(a.value,transport); await engine.phase('synced');
    for (const milliseconds of [500,2000,5000]) {
      delay=milliseconds; const pushed = new Promise<void>(done=> {entered=done;});
      await a.value.mutate(f.op(a.clientId,newId(),'create',{title:`delayed ${milliseconds}`,status:'todo',due:null})); await engine.value.localChanged();
      await pushed; expect(engine.state.latest?.phase).toBe('syncing'); expect(engine.state.latest?.snapshot?.operations.some(operation=>operation.status==='pending')).toBe(true);
      await engine.phase('synced');
    }
    delay=0; engine.value.setPaused(true); const id = newId(); await a.value.mutate(f.op(a.clientId,id,'create',{title:'paused',status:'todo',due:null})); await engine.value.localChanged();
    for (let i=0;i<4;i++) {engine.value.setPaused(false);engine.value.setPaused(true);}
    expect(engine.state.latest?.phase).toBe('offline'); engine.value.setPaused(false); await engine.phase('synced');
    expect(await f.repository.tasks()).toHaveLength(4);
  } finally { await f.cleanup(); }
},30_000);
real('STEP7-CLIENT-REJECTED: create collision stops the affected causal chain, retains both original payloads and never displays synced',async () => {
  const f = await fixture(); const a = await f.device(); const id = newId();
  try {
    await f.repository.push(f.op(newId(),id,'create',{title:'server',status:'todo',due:null}));
    await a.value.mutate(f.op(a.clientId,id,'create',{title:'different local',status:'todo',due:null})); await a.value.mutate(f.op(a.clientId,id,'update',{title:'next local'},0));
    const engine = f.engine(a.value); await engine.phase('rejected');
    const snapshot = await a.value.snapshot(); expect(snapshot.operations.map(operation=>operation.status)).toEqual(['rejected','rejected']);
    expect(snapshot.errors.map(value=>value.error)).toEqual(['entity_id_collision','predecessor_rejected']);
    expect(snapshot.operations[0]?.payload).toMatchObject({title:'different local'}); expect(snapshot.operations[1]?.payload).toEqual({title:'next local'});
    expect(snapshot.tasks).toEqual(await f.repository.tasks(true)); expect(engine.state.latest?.phase).not.toBe('synced');
  } finally { await f.cleanup(); }
});
