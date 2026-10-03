import { it, expect, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newId } from '@greiva/shared';
import type { PushOperation, PushResult, Task, Conflict } from '@greiva/protocol';
import { StructuredSyncEngine, type StructuredStore, type StructuredReport, type StructuredTransport } from '@greiva/sync';
import { StructuredDevice } from '../support/structured-device.js';

const time = '2026-10-03T00:00:00.000Z';
async function fixture(count: number) {
  const directory = mkdtempSync(join(tmpdir(), 'greiva-progress-'));
  const device = new StructuredDevice(join(directory, 'device.sqlite'));
  const clientId = newId(); await device.request('structured-client-id', { candidate: clientId });
  const operations: PushOperation[] = [];
  for (let i = 0; i < count; i++) {
    const operation: PushOperation = { operationId: newId(), clientId, entityId: newId(), entityType: 'task',
      kind: 'create', baseVersion: null, payload: { title: `task ${i}`, status: 'todo', due: null } };
    operations.push(operation); await device.mutate(operation);
  }
  let clock = 0; const now = vi.spyOn(performance, 'now').mockImplementation(() => clock);
  let snapshots = 0; const committed: string[] = []; const ledger: PushResult[] = [];
  const history: StructuredReport[] = [];
  let latest: StructuredReport | undefined;
  const store: StructuredStore = {
    async snapshot() { snapshots++; return device.snapshot(); },
    mutate: operation => device.mutate(operation), prepare: () => device.prepare(),
    async acknowledge(result) { await device.acknowledge(result); committed.push(result.operationId); },
    applyPull: (cursor, batch) => device.applyPull(cursor, batch),
  };
  const transport: StructuredTransport = {
    async pull(cursor) {
      const after = Number(cursor?.slice(1) ?? 0);
      return { operations: ledger.slice(after), cursor: `c${ledger.length}`, headCursor: `c${ledger.length}`, hasMore: false, serverTime: time };
    },
    async push(operation) {
      // The next push must never overtake the previous local ACK transaction.
      expect(committed).toEqual(operations.slice(0, ledger.length).map(op => op.operationId));
      clock += 10;
      const entity: Task = { id: operation.entityId, title: (operation.payload as { title: string }).title,
        status: 'todo', due: null, version: 1, createdAt: time, updatedAt: time, deletedAt: null };
      const result: PushResult = { operationId: operation.operationId, clientId, entityId: operation.entityId,
        entityType: 'task', serverOrder: String(ledger.length + 1), status: 'acknowledged', entity, conflicts: [] };
      ledger.push(result); return result;
    },
  };
  const engine = new StructuredSyncEngine(store, transport, value => { latest = value; history.push(value); }, { pollMs: 60_000 });
  return { device, operations, store, transport, engine, ledger, committed, history,
    latest: () => latest, snapshots: () => snapshots,
    async phase(phase: StructuredReport['phase']) { await expect.poll(() => latest?.phase, { timeout: 6000 }).toBe(phase); },
    async cleanup() { engine.stop(); now.mockRestore(); await device.close(); rmSync(directory, { recursive: true, force: true }); },
  };
}

it('STEP8-PROGRESS: coalesces ordinary ACK snapshots while retaining durable order and final state', async () => {
  const f = await fixture(30);
  try {
    f.engine.start(); await f.phase('synced');
    expect(f.snapshots()).toBeLessThan(15); // The previous per-ACK implementation reads >30 snapshots.
    expect(f.history.filter(report => report.phase === 'syncing').some(report =>
      report.snapshot?.operations.filter(op => op.status === 'acknowledged').length === 10)).toBe(true);
    const snapshot = f.latest()!.snapshot!;
    expect(snapshot.operations.every(op => op.status === 'acknowledged')).toBe(true);
    expect(snapshot.state.cursor).toBe('c30'); expect(snapshot.state.headCursor).toBe('c30');
    expect(snapshot).toEqual(await f.device.snapshot());
    expect(f.committed).toEqual(f.operations.map(op => op.operationId));
    expect(f.history.filter(report => report.phase === 'synced').every(report =>
      report.snapshot?.operations.every(op => op.status === 'acknowledged'))).toBe(true);
  } finally { await f.cleanup(); }
});

it('STEP8-PROGRESS: local edits refresh immediately while a later network ACK is held', async () => {
  const f = await fixture(2); let release!: () => void;
  const gate = new Promise<void>(done => { release = done; });
  let entered = false;
  const push = f.transport.push;
  f.transport.push = async (operation, signal) => {
    if (f.ledger.length === 1) { entered = true; await gate; }
    return push(operation, signal);
  };
  try {
    f.engine.start(); await expect.poll(() => entered).toBe(true);
    await f.device.mutate({ ...f.operations[0]!, operationId: newId(), entityId: newId(), payload: { title: 'new local', status: 'todo', due: null } });
    await f.engine.localChanged();
    expect(f.latest()?.phase).toBe('syncing');
    expect(f.latest()?.snapshot?.tasks.some(task => task.title === 'new local')).toBe(true);
    expect(f.latest()?.snapshot?.operations.filter(op => op.status === 'pending')).toHaveLength(2);
    // Keep the fixture's ordered server expectation consistent with the new operation.
    f.operations.push((await f.device.snapshot()).operations.at(-1)!);
    release(); await f.phase('synced');
  } finally { release(); await f.cleanup(); }
});

it('STEP8-PROGRESS: exposes conflicts and rejections before the next push even inside the display interval', async () => {
  for (const status of ['conflict', 'rejected'] as const) {
    const f = await fixture(2); const push = f.transport.push;
    let checked = false;
    f.transport.push = async (operation, signal) => {
      if (f.ledger.length === 1) {
        checked = true;
        expect(status === 'conflict' ? f.latest()?.snapshot?.conflicts.length : f.latest()?.snapshot?.errors.length).toBe(1);
      }
      const result = await push(operation, signal);
      if (f.ledger.length !== 1) return result;
      if (result.status !== 'acknowledged') throw new Error('Fixture expected an ordinary ACK before injecting its result');
      let special: PushResult;
      if (status === 'conflict') {
        const conflict: Conflict = { id: newId(), operationId: operation.operationId, entityType: 'task', entityId: operation.entityId,
          field: 'title', base: '', local: 'local', remote: 'remote', createdAt: time, status: 'open', resolvedBy: null };
        special = { ...result, status: 'conflict', conflicts: [conflict] };
      } else special = { ...result, status: 'rejected', error: { code: 'entity_id_collision', message: 'Injected collision', retryable: false } };
      f.ledger[0] = special; return special;
    };
    try { f.engine.start(); await f.phase(status); expect(checked).toBe(true); }
    finally { await f.cleanup(); }
  }
});
