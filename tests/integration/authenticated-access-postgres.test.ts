import { it, expect, vi } from 'vitest';
import pg from 'pg';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { newId } from '@greiva/shared';
import { PrivateWorkspaceAccessDenied } from '@greiva/application';
import { PostgresPrivateAccessStore } from '../../apps/api/src/private-access-store.js';
import { sessionVerifier, SessionVerificationError } from '../../apps/api/src/session-verifier.js';
import { authenticatedPrivateAccess } from '../../apps/api/src/authenticated-private-access.js';

it.skipIf(process.env.GREIVA_TEST_POSTGRES !== '1')('AUTH-ACCESS-PG: signed local JWT plus real SQL ownership rejects forged workspace/role and verifies session before metadata access', async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, max: 2 });
  const schema = `greiva_auth_${newId().replaceAll('-', '')}`, workspaceId = newId(), pageId = newId(); let created = false;
  try {
    await pool.query(`CREATE SCHEMA "${schema}"`); created = true;
    await pool.query(`CREATE TABLE "${schema}".workspace_access(id uuid PRIMARY KEY,owner_subject_id text NOT NULL,owner_issuer text NOT NULL)`);
    await pool.query(`CREATE TABLE "${schema}".resource_access(type text NOT NULL,id uuid NOT NULL,workspace_id uuid NOT NULL,deleted boolean NOT NULL,PRIMARY KEY(type,id))`);
    const issuer = 'https://auth.fixture.invalid/auth/v1';
    await pool.query(`INSERT INTO "${schema}".workspace_access VALUES($1,'subject-A',$2)`, [workspaceId, issuer]);
    await pool.query(`INSERT INTO "${schema}".resource_access VALUES('page',$1,$2,false)`, [pageId, workspaceId]);
    const keys = await generateKeyPair('ES256', { extractable: true }), jwk = { ...await exportJWK(keys.publicKey), kid: 'fixture', alg: 'ES256' };
    const configuration = { issuer: 'https://auth.fixture.invalid/auth/v1', audience: 'authenticated', jwksUrl: 'https://auth.fixture.invalid/auth/v1/.well-known/jwks.json', algorithms: ['ES256'] as const };
    const verifier = sessionVerifier(configuration, async () => new Response(JSON.stringify({ keys: [jwk] })));
    const store = new PostgresPrivateAccessStore(pool, schema), read = vi.spyOn(store, 'read'), access = authenticatedPrivateAccess(verifier, store);
    const token = (subjectId: string) => new SignJWT({ sub: subjectId, iss: configuration.issuer, aud: configuration.audience, exp: Math.floor(Date.now()/1000)+300, workspaceId, role: 'service_role', clientId: newId() })
      .setProtectedHeader({ alg: 'ES256', kid: 'fixture' }).sign(keys.privateKey);
    await expect(access.pageDocument(`Bearer ${await token('subject-A')}`, workspaceId, `page:${pageId}`)).resolves.toMatchObject({ subjectId: 'subject-A', resources: [{ type: 'page', id: pageId }] });
    await expect(access.pageDocument(`Bearer ${await token('subject-B')}`, workspaceId, `page:${pageId}`)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    const count = read.mock.calls.length;
    await expect(access.pageDocument('Bearer not-a-jwt', workspaceId, `page:${pageId}`)).rejects.toBeInstanceOf(SessionVerificationError); expect(read.mock.calls.length).toBe(count);
    await pool.query(`UPDATE "${schema}".workspace_access SET owner_subject_id='subject-B' WHERE id=$1`, [workspaceId]);
    await expect(access.pageDocument(`Bearer ${await token('subject-A')}`, workspaceId, `page:${pageId}`)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    await pool.query(`UPDATE "${schema}".workspace_access SET owner_subject_id='subject-A',owner_issuer='https://other.fixture.invalid/auth/v1' WHERE id=$1`, [workspaceId]);
    await expect(access.pageDocument(`Bearer ${await token('subject-A')}`, workspaceId, `page:${pageId}`)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
  } finally {
    try {
      if (created) {
        await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
        expect((await pool.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema])).rowCount).toBe(0);
      }
    } finally { await pool.end(); }
  }
});
