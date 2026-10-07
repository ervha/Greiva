import { it, expect, vi } from 'vitest';
import { newId } from '@greiva/shared';
import { nativeWorkspaceDevice } from '../../apps/client/src/workspace/native-workspace-device.js';
const identity = () => ({ issuer: 'https://auth.fixture.invalid/auth/v1', subjectId: 'owner', expiresAt: Math.floor(Date.now() / 1000) + 300 });
it('WORKSPACE-DEVICE-PORT: captures only verified owner and UUID; caller mutation never rebinds a late response', async () => {
  const owner = identity(), clientId = newId(); let resolve!: (value: unknown) => void;
  const invoke = vi.fn((_command: string, _args?: Record<string, unknown>) => new Promise<unknown>(done => { resolve = done; }));
  const work = nativeWorkspaceDevice(owner, new AbortController().signal, invoke);
  expect(invoke).toHaveBeenCalledWith('workspace_device', { owner: { issuer: owner.issuer, subjectId: owner.subjectId }, candidate: expect.any(String) });
  expect(invoke.mock.calls[0]?.[1]).not.toHaveProperty('expiresAt'); owner.subjectId = 'other';
  resolve({ issuer: owner.issuer, subjectId: 'owner', clientId }); expect(await work).toBe(clientId);
});
it('WORKSPACE-DEVICE-PORT: abort/expiry defeats late ID and rejects before invoking after close', async () => {
  const owner = identity(), controller = new AbortController(); let resolve!: (value: unknown) => void;
  const invoke = vi.fn((_command: string, _args?: Record<string, unknown>) => new Promise<unknown>(done => { resolve = done; }));
  const work = nativeWorkspaceDevice(owner, controller.signal, invoke); controller.abort(); resolve({ ...owner, expiresAt: undefined, clientId: newId() });
  await expect(work).rejects.toMatchObject({ stage: 'closed' }); await expect(nativeWorkspaceDevice(owner, controller.signal, invoke)).rejects.toMatchObject({ stage: 'closed' });
  await expect(nativeWorkspaceDevice({ ...owner, expiresAt: 1 }, new AbortController().signal, invoke)).rejects.toMatchObject({ stage: 'closed' }); expect(invoke).toHaveBeenCalledTimes(1);
});
it('WORKSPACE-DEVICE-PORT: foreign/extra/malformed response and private invoke errors stay fail-closed without fallback', async () => {
  const owner = identity();
  for (const value of [{ issuer: owner.issuer, subjectId: 'foreign', clientId: newId() }, { ...owner, clientId: newId() }, { issuer: owner.issuer, subjectId: owner.subjectId, clientId: 'invalid' }]) {
    await expect(nativeWorkspaceDevice(owner, new AbortController().signal, async () => value)).rejects.toMatchObject({ stage: 'protocol' });
  }
  await expect(nativeWorkspaceDevice(owner, new AbortController().signal, async () => { throw Error('private path token'); })).rejects.toMatchObject({ stage: 'storage', message: 'Native workspace device storage' });
  const invoke = vi.fn(async () => null); await expect(nativeWorkspaceDevice({ ...owner, issuer: 'https://secret@auth.invalid/' }, new AbortController().signal, invoke)).rejects.toMatchObject({ stage: 'protocol' }); expect(invoke).not.toHaveBeenCalled();
});
