import { it, expect } from 'vitest';
import pg from 'pg';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { newId } from '@greiva/shared';
import { createPrivateApp } from '../../apps/api/src/private-app.js';
import { PostgresPrivateAccessStore } from '../../apps/api/src/private-access-store.js';
import { sessionVerifier } from '../../apps/api/src/session-verifier.js';

it.skipIf(process.env.GREIVA_TEST_POSTGRES !== '1')('PRIVATE-HTTP-PG: actual loopback HTTP plus signed JWT/SQL ownership rejects unauthenticated, foreign scope, deletion, spoofed query and old aliases', async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, max: 2 });
  const schema = `greiva_http_${newId().replaceAll('-', '')}`, workspaceId = newId(), otherWorkspace = newId(), pageId = newId(); let created = false;
  let app: Awaited<ReturnType<typeof createPrivateApp>> | undefined;
  try {
    await pool.query(`CREATE SCHEMA "${schema}"`); created = true;
    await pool.query(`CREATE TABLE "${schema}".workspace_access(id uuid PRIMARY KEY,owner_subject_id text NOT NULL,owner_issuer text NOT NULL)`);
    await pool.query(`CREATE TABLE "${schema}".resource_access(type text NOT NULL,id uuid NOT NULL,workspace_id uuid NOT NULL,deleted boolean NOT NULL,PRIMARY KEY(type,id))`);
    const issuer = 'https://auth.fixture.invalid/auth/v1';
    await pool.query(`INSERT INTO "${schema}".workspace_access VALUES($1,'subject-A',$3),($2,'subject-B',$3)`, [workspaceId, otherWorkspace, issuer]);
    await pool.query(`INSERT INTO "${schema}".resource_access VALUES('page',$1,$2,false)`, [pageId, workspaceId]);
    const keys = await generateKeyPair('ES256', { extractable: true }), jwk = { ...await exportJWK(keys.publicKey), alg: 'ES256', kid: 'fixture' };
    const configuration = { issuer, audience: 'authenticated', jwksUrl: issuer+'/.well-known/jwks.json', algorithms: ['ES256'] as const };
    app = await createPrivateApp(sessionVerifier(configuration, async () => new Response(JSON.stringify({ keys: [jwk] }))), new PostgresPrivateAccessStore(pool, schema));
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const token = (subjectId: string) => new SignJWT({ sub: subjectId, iss: issuer, aud: configuration.audience, exp: Math.floor(Date.now()/1000)+300, workspaceId, role: 'service_role' }).setProtectedHeader({ alg: 'ES256', kid: 'fixture' }).sign(keys.privateKey);
    const owner = await token('subject-A'), other = await token('subject-B'), path = `/v1/workspaces/${workspaceId}/pages/${pageId}/access`;
    const request = (url: string, bearer?: string) => fetch(base+url, { headers: bearer ? { authorization: 'Bearer '+bearer } : {} });
    expect((await request(path)).status).toBe(401);
    const allowed = await request(path, owner); expect(allowed.status).toBe(200); expect(await allowed.json()).toMatchObject({ subjectId: 'subject-A', resources: [{ type: 'page', id: pageId }] });
    const denied = await request(path+`?subjectId=subject-A&workspaceId=${workspaceId}`, other); expect(denied.status).toBe(403); expect(await denied.json()).toEqual({ error: 'access_denied' });
    expect((await request(`/v1/workspaces/${otherWorkspace}/pages/${pageId}/access`, owner)).status).toBe(403);
    const duplicate = new Headers(); duplicate.append('authorization', 'Bearer '+owner); duplicate.append('authorization', 'Bearer '+other);
    expect((await fetch(base+path, { headers: duplicate })).status).toBe(401);
    await pool.query(`UPDATE "${schema}".resource_access SET deleted=true WHERE id=$1`, [pageId]); expect((await request(path, owner)).status).toBe(403);
    for (const url of ['/tasks', '/relations', '/sync/pull']) expect((await request(url, owner)).status).toBe(404);
    await pool.query(`DROP TABLE "${schema}".resource_access`);
    const unavailable = await request(path, owner); expect(unavailable.status).toBe(503); expect(await unavailable.json()).toEqual({ error: 'access_unavailable' });
  } finally {
    try {
      await app?.close();
      if (created) {
        await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
        expect((await pool.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema])).rowCount).toBe(0);
      }
    } finally { await pool.end(); }
  }
});
