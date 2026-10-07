import { invoke, isTauri } from '@tauri-apps/api/core';
import { newId, privateApiOrigin } from '@greiva/shared';
import { workspaceDeviceIdentitySchema as deviceSchema } from '@greiva/protocol/workspace';
import type { AuthIdentity } from '@greiva/sync';
import type { NativeWorkspaceInvoke } from './native-workspace-store.js';

export class NativeWorkspaceDeviceError extends Error {
  constructor(readonly stage: 'configuration' | 'closed' | 'storage' | 'protocol') {
    super(`Native workspace device ${stage}`); this.name = 'NativeWorkspaceDeviceError';
  }
}
// Called within AuthSession.authorized by trusted composition. It sends only
// the verified owner and a candidate UUID, never the authorization/token.
export async function nativeWorkspaceDevice(identity: AuthIdentity, signal: AbortSignal, invokePort: NativeWorkspaceInvoke = invoke): Promise<string> {
  if (invokePort === invoke && !isTauri()) throw new NativeWorkspaceDeviceError('configuration');
  if (signal.aborted || identity.expiresAt <= Math.floor(Date.now() / 1000)) throw new NativeWorkspaceDeviceError('closed');
  const owner = Object.freeze({ issuer: identity.issuer, subjectId: identity.subjectId });
  try { const url = new URL(owner.issuer); privateApiOrigin(url.origin); if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || owner.issuer !== owner.issuer.trim() || !deviceSchema.shape.subjectId.safeParse(owner.subjectId).success) throw Error(); }
  catch { throw new NativeWorkspaceDeviceError('protocol'); }
  const candidate = newId(); let value: unknown;
  try { value = await invokePort('workspace_device', { owner, candidate }); }
  catch { throw new NativeWorkspaceDeviceError(signal.aborted ? 'closed' : 'storage'); }
  if (signal.aborted || identity.expiresAt <= Math.floor(Date.now() / 1000)) throw new NativeWorkspaceDeviceError('closed');
  const parsed = deviceSchema.safeParse(value);
  if (!parsed.success || parsed.data.issuer !== owner.issuer || parsed.data.subjectId !== owner.subjectId) throw new NativeWorkspaceDeviceError('protocol');
  return parsed.data.clientId;
}
