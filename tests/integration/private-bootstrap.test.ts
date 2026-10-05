import { it, expect, vi } from 'vitest';
import type pg from 'pg';
import { newId } from '@greiva/shared';
import { PostgresPrivateBootstrapStore, PrivateBootstrapInvalidRequest, PrivateBootstrapUnavailable } from '../../apps/api/src/private-bootstrap-store.js';
import { installPrivateWorkspaceSchema } from '../../apps/api/src/private-workspace-schema.js';
import { createPrivateApp } from '../../apps/api/src/private-app.js';
import { SessionVerificationError } from '../../apps/api/src/session-verifier.js';

const session = () => ({ issuer: 'https://auth.fixture.invalid/auth/v1', subjectId: 'subject-A', expiresAt: Math.floor(Date.now()/1000)+300 });
it('PRIVATE-BOOTSTRAP: validates strict client request and verified identity before any database connection', async () => {
  const connect = vi.fn(), pool = { connect } as unknown as pg.Pool, store = new PostgresPrivateBootstrapStore(pool, 'greiva_private_fixture');
  for (const body of [{}, { clientId: 'bad' }, { clientId: newId(), subjectId: 'forged' }, { clientId: newId(), workspaceId: newId() }]) await expect(store.bootstrap(session(), body)).rejects.toBeInstanceOf(PrivateBootstrapInvalidRequest);
  await expect(store.bootstrap({ ...session(), expiresAt: 1 }, { clientId: newId() })).rejects.toBeInstanceOf(SessionVerificationError);
  await expect(store.bootstrap({ ...session(), issuer: '' }, { clientId: newId() })).rejects.toBeInstanceOf(SessionVerificationError);
  expect(connect).not.toHaveBeenCalled();
  await expect(installPrivateWorkspaceSchema(pool, 'public')).rejects.toThrow('Explicit private schema'); expect(connect).not.toHaveBeenCalled();
});
it('PRIVATE-BOOTSTRAP: captures body/session before async connection and never exposes provider/SQL causes', async () => {
  let resume!: () => void; const wait = new Promise<void>(resolve => { resume = resolve; });
  const workspaceId = newId(), epoch = newId();
  const query = vi.fn(async (sql: string, _args?: unknown[]) => {
    if (sql.startsWith('SELECT version')) return { rowCount: 1, rows: [{ version: 1 }] };
    if (sql.startsWith('SELECT id')) return { rowCount: 1, rows: [{ id: workspaceId, epoch, deleted: false }] };
    if (sql.startsWith('SELECT workspace_id')) return { rowCount: 1, rows: [{ workspace_id: workspaceId, revoked: false }] };
    if (sql === 'COMMIT') throw Error('Private SQL credential detail');
    return { rowCount: 0, rows: [] };
  }), release = vi.fn(), pool = { connect: async () => { await wait; return { query, release }; } } as unknown as pg.Pool;
  const store = new PostgresPrivateBootstrapStore(pool, 'greiva_private_fixture'), actor = session(), body = { clientId: newId() }, original = { issuer: actor.issuer, subject: actor.subjectId, clientId: body.clientId };
  const result = store.bootstrap(actor, body); actor.subjectId = 'mutated'; actor.issuer = 'mutated'; body.clientId = newId(); resume();
  const error = await result.catch(error => error); expect(error).toBeInstanceOf(PrivateBootstrapUnavailable); expect(error.outcome).toBe('unknown'); expect(error.cause).toBeUndefined();
  const insert = query.mock.calls.find(([sql]) => sql.startsWith('INSERT INTO'))!; expect(insert[1]?.slice(1,3)).toEqual([original.issuer,original.subject]); expect(query).toHaveBeenCalledWith('ROLLBACK'); expect(release).toHaveBeenCalledOnce();
  const device = query.mock.calls.find(([sql]) => sql.includes('private_devices(id,workspace_id)'))!; expect(device[1]).toEqual([original.clientId,workspaceId]);
});
it('PRIVATE-BOOTSTRAP-HTTP: optional route authenticates first and returns safe 400/503 without request echo', async () => {
  const verify = vi.fn(async (_header: unknown) => session()), bootstrap = vi.fn(async (_actor: unknown, _body: unknown) => { throw new PrivateBootstrapInvalidRequest(); });
  const app = await createPrivateApp({ verify }, { read: async () => null }, { bootstrap });
  try {
    const api = app.getHttpAdapter().getInstance(), request = () => api.inject({ method: 'POST', url: '/v1/workspaces/bootstrap', payload: { clientId: newId(), subjectId: 'private-fixture' } });
    verify.mockRejectedValueOnce(new SessionVerificationError('invalid_session')); const invalid = await request(); expect(invalid.statusCode).toBe(401); expect(bootstrap).not.toHaveBeenCalled();
    const bad = await request(); expect(bad.statusCode).toBe(400); expect(bad.json()).toEqual({ error: 'invalid_request' });
    bootstrap.mockRejectedValueOnce(new PrivateBootstrapUnavailable()); const unavailable = await request(); expect(unavailable.statusCode).toBe(503); expect(unavailable.json()).toEqual({ error: 'bootstrap_unavailable' });
  } finally { await app.close(); }
});
