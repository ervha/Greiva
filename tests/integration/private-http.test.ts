import { it, expect, vi } from 'vitest';
import { newId } from '@greiva/shared';
import type { PrivateAccessSnapshot, ResourceReference } from '@greiva/domain';
import { createPrivateApp } from '../../apps/api/src/private-app.js';
import { SessionVerificationError } from '../../apps/api/src/session-verifier.js';

function fixture() {
  const workspaceId = newId(), pageId = newId(), issuer = 'https://auth.fixture.invalid/auth/v1';
  const verify = vi.fn(async (_header: unknown) => ({ subjectId: 'subject-A', issuer, expiresAt: 2000000000 }));
  const read = vi.fn(async (_workspaceId: string, targets: readonly ResourceReference[]): Promise<PrivateAccessSnapshot | null> => ({ workspace: { id: workspaceId, ownerSubjectId: 'subject-A', ownerIssuer: issuer }, resources: targets.length ? [{ type: 'page', id: pageId, workspaceId, deleted: false }] : [] }));
  return { workspaceId, pageId, issuer, verify, read };
}
it('PRIVATE-HTTP: exposes only verified session fields and immutable authorized workspace/page references', async () => {
  const f = fixture(), app = await createPrivateApp({ verify: f.verify }, { read: f.read });
  try {
    const api = app.getHttpAdapter().getInstance();
    expect((await api.inject({ method: 'GET', url: '/v1/session', headers: { authorization: 'Bearer fixture' } })).json()).toEqual({ subjectId: 'subject-A', issuer: f.issuer, expiresAt: 2000000000 });
    const root = await api.inject({ method: 'GET', url: `/v1/workspaces/${f.workspaceId}/access`, headers: { authorization: 'Bearer fixture' } });
    expect(root.statusCode).toBe(200); expect(root.json()).toMatchObject({ workspaceId: f.workspaceId, resources: [] });
    const page = await api.inject({ method: 'GET', url: `/v1/workspaces/${f.workspaceId}/pages/${f.pageId}/access`, headers: { authorization: 'Bearer fixture' } });
    expect(page.statusCode).toBe(200); expect(page.json()).toMatchObject({ resources: [{ type: 'page', id: f.pageId }] });
  } finally { await app.close(); }
});
it('PRIVATE-HTTP: returns distinct 401/403/503 with no SQL, token or provider cause leak', async () => {
  const f = fixture(), app = await createPrivateApp({ verify: f.verify }, { read: f.read });
  try {
    const api = app.getHttpAdapter().getInstance(), url = `/v1/workspaces/${f.workspaceId}/access`;
    f.verify.mockRejectedValueOnce(new SessionVerificationError('invalid_session'));
    const invalid = await api.inject({ method: 'GET', url }); expect(invalid.statusCode).toBe(401); expect(invalid.json()).toEqual({ error: 'invalid_session' }); expect(f.read).not.toHaveBeenCalled();
    f.verify.mockRejectedValueOnce(new SessionVerificationError('verification_unavailable'));
    const unavailable = await api.inject({ method: 'GET', url }); expect(unavailable.statusCode).toBe(503); expect(unavailable.json()).toEqual({ error: 'verification_unavailable' }); expect(f.read).not.toHaveBeenCalled();
    f.read.mockResolvedValueOnce(null);
    const denied = await api.inject({ method: 'GET', url }); expect(denied.statusCode).toBe(403); expect(denied.json()).toEqual({ error: 'access_denied' });
    f.read.mockRejectedValueOnce(Error('Private SQL/transport detail'));
    const storage = await api.inject({ method: 'GET', url }); expect(storage.statusCode).toBe(503); expect(storage.json()).toEqual({ error: 'access_unavailable' });
  } finally { await app.close(); }
});
it('PRIVATE-HTTP: has no unprotected PoC alias, bootstrap/write fallback or request echo', async () => {
  const f = fixture(), app = await createPrivateApp({ verify: f.verify }, { read: f.read });
  try {
    const api = app.getHttpAdapter().getInstance();
    for (const [method, url] of [['GET', '/tasks'], ['GET', '/relations'], ['POST', '/sync/push'], ['POST', '/v1/workspaces/bootstrap'], ['GET', '/unknown?private=fixture']] as const) {
      const result = await api.inject({ method, url }); expect(result.statusCode).toBe(404); expect(result.json()).toEqual({ error: 'not_found' });
    }
    expect(f.read).not.toHaveBeenCalled();
  } finally { await app.close(); }
});
