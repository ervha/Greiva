import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { newId } from '@greiva/shared';
import { emptyPageUpdate } from '@greiva/sync';
import { WorkspaceRegistryDevice } from '../support/workspace-registry-device.js';
import { nativeWorkspaceDevice } from '../../apps/client/src/workspace/native-workspace-device.js';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'greiva-device-')), root = join(directory, 'stores'), registry = new WorkspaceRegistryDevice(root), devices = [registry];
  const owner = { issuer: 'https://auth.fixture.invalid/auth/v1', subjectId: 'owner' };
  return { directory, root, registry, devices, owner, resolve: (candidate = newId(), one = owner) => registry.request('device', { owner: one, candidate }),
    async cleanup() { for (const device of devices) await device.close(); rmSync(directory, { recursive: true, force: true }); } };
}
it('WORKSPACE-DEVICE: same owner keeps ID after process kill; issuer/subject isolate accounts and collision never reassigns another owner', async () => {
  const f = fixture(); try {
    const first = await f.resolve(); expect(await f.resolve()).toEqual(first); await f.registry.close('SIGKILL'); expect(await f.resolve()).toEqual(first);
    const second = await f.resolve(newId(), { ...f.owner, subjectId: 'other' }), third = await f.resolve(newId(), { ...f.owner, issuer: 'https://other.fixture.invalid/auth/v1' });
    expect(new Set([first.clientId, second.clientId, third.clientId]).size).toBe(3);
    await expect(f.resolve(first.clientId, { ...f.owner, subjectId: 'collision' })).rejects.toThrow('Private workspace device unavailable'); expect(await f.resolve()).toEqual(first);
    const db = new DatabaseSync(join(f.root, 'devices.sqlite'), { readOnly: true });
    try { expect(db.prepare('SELECT count(*) AS n FROM workspace_devices').get()?.n).toBe(3); expect(db.prepare('PRAGMA table_info(workspace_devices)').all().map(row => row.name)).toEqual(['issuer', 'subject_id', 'client_id']); } finally { db.close(); }
  } finally { await f.cleanup(); }
});
it('WORKSPACE-DEVICE: concurrent first creation across two processes chooses one durable ID', async () => {
  const f = fixture(), other = new WorkspaceRegistryDevice(f.root); f.devices.push(other); try {
    const [one, two] = await Promise.all([f.resolve(), other.request('device', { owner: f.owner, candidate: newId() })]); expect(one).toEqual(two); expect(await f.resolve()).toEqual(one);
    const db = new DatabaseSync(join(f.root, 'devices.sqlite'), { readOnly: true }); try { expect(db.prepare('SELECT count(*) AS n FROM workspace_devices').get()?.n).toBe(1); } finally { db.close(); }
  } finally { await f.cleanup(); }
});
it('WORKSPACE-DEVICE: metadata lookup keeps active handle; stable ID reopens exact retained Page wire', async () => {
  const f = fixture(); try {
    const identity = { ...f.owner, expiresAt: Math.floor(Date.now() / 1000) + 300 }, clientId = await nativeWorkspaceDevice(identity, new AbortController().signal, f.registry.invoke);
    const context = { ...f.owner, clientId, workspaceId: newId(), streamEpoch: newId() }, pageId = newId(), first = await f.registry.request('open', { context });
    await f.registry.request('execute', { handle: first.handle, request: { command: 'page_create', pageId, title: '保存済み・未送信', update: Array.from(emptyPageUpdate()) } });
    const prepared = await f.registry.request('execute', { handle: first.handle, request: { command: 'page_prepare', pageId } }); await f.resolve();
    expect(await f.registry.request('execute', { handle: first.handle, request: { command: 'page_prepare', pageId } })).toEqual(prepared);
    await f.registry.close('SIGKILL'); const recovered = await nativeWorkspaceDevice(identity, new AbortController().signal, f.registry.invoke); expect(recovered).toBe(clientId);
    const next = await f.registry.request('open', { context: { ...context, clientId: recovered } }); expect(await f.registry.request('execute', { handle: next.handle, request: { command: 'page_prepare', pageId } })).toEqual(prepared);
    expect(readdirSync(f.root).filter(name => name.endsWith('.sqlite'))).toHaveLength(2);
  } finally { await f.cleanup(); }
});
it('WORKSPACE-DEVICE: extra/private owner fields, invalid candidates and unknown version reject without replacement', async () => {
  const f = fixture(); try {
    const first = await f.resolve();
    for (const owner of [{ ...f.owner, email: 'profile@example.invalid' }, { ...f.owner, path: '../foreign' }, { ...f.owner, subjectId: '' }, { ...f.owner, issuer: 'http://auth.invalid' }]) await expect(f.registry.request('device', { owner, candidate: newId() })).rejects.toThrow('Private workspace device unavailable');
    await expect(f.resolve('invalid')).rejects.toThrow('Private workspace device unavailable'); await f.registry.close();
    const db = new DatabaseSync(join(f.root, 'devices.sqlite')); try { db.exec('PRAGMA user_version=99'); } finally { db.close(); }
    await expect(f.resolve()).rejects.toThrow('Private workspace device unavailable'); const check = new DatabaseSync(join(f.root, 'devices.sqlite'), { readOnly: true });
    try { expect(check.prepare('SELECT client_id FROM workspace_devices').get()?.client_id).toBe(first.clientId); expect(check.prepare('PRAGMA user_version').get()?.user_version).toBe(99); } finally { check.close(); }
  } finally { await f.cleanup(); }
});
for (const stage of ['before', 'after'] as const) it(`WORKSPACE-DEVICE: kill ${stage} commit gives rollback or same durable registration; lost reply never rotates committed ID`, async () => {
  const f = fixture(), barrier = join(f.directory, 'barrier'), crash = new WorkspaceRegistryDevice(f.root, { crashRoot: barrier }); f.devices.push(crash);
  try {
    const candidate = newId(); writeFileSync(barrier + '.armed', `workspace-device-${stage}-commit`);
    const work = crash.request('device', { owner: f.owner, candidate }); void work.catch(() => {});
    await expect.poll(() => existsSync(barrier + '.reached'), { timeout: 8000 }).toBe(true); await crash.close('SIGKILL'); await expect(work).rejects.toThrow();
    const recovered = await f.resolve(); expect(recovered.clientId === candidate).toBe(stage === 'after'); expect(await f.resolve()).toEqual(recovered);
  } finally { await f.cleanup(); }
});
it('WORKSPACE-DEVICE: missing identity DB next to retained workspaces and unattributed database never creates a replacement identity', async () => {
  const f = fixture(); try {
    mkdirSync(f.root); writeFileSync(join(f.root, 'retained.sqlite'), 'retained sentinel'); await expect(f.resolve()).rejects.toThrow('Private workspace device unavailable');
    expect(existsSync(join(f.root, 'devices.sqlite'))).toBe(false); unlinkSync(join(f.root, 'retained.sqlite'));
    const db = new DatabaseSync(join(f.root, 'devices.sqlite')); try { db.exec('CREATE TABLE foreign_data(value TEXT); INSERT INTO foreign_data VALUES (\'retained\')'); } finally { db.close(); }
    await expect(f.resolve()).rejects.toThrow('Private workspace device unavailable'); const check = new DatabaseSync(join(f.root, 'devices.sqlite'), { readOnly: true });
    try { expect(check.prepare('SELECT value FROM foreign_data').get()?.value).toBe('retained'); expect(check.prepare('PRAGMA user_version').get()?.user_version).toBe(0); } finally { check.close(); }
  } finally { await f.cleanup(); }
});
