import { it, expect } from 'vitest';
import pg from 'pg';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { newId } from '@greiva/shared';
import { PrivateWorkspaceAccessDenied, privateWorkspaceAccess } from '@greiva/application';
import { PostgresPrivateBootstrapStore, PrivateBootstrapUnavailable } from '../../apps/api/src/private-bootstrap-store.js';
import { installPrivateWorkspaceSchema } from '../../apps/api/src/private-workspace-schema.js';
import { PostgresPrivateAccessStore } from '../../apps/api/src/private-access-store.js';
import { createPrivateApp } from '../../apps/api/src/private-app.js';
import { sessionVerifier } from '../../apps/api/src/session-verifier.js';

const enabled = process.env.GREIVA_TEST_POSTGRES === '1';
const actor = (subjectId = 'subject-A', issuer = 'https://auth.fixture.invalid/auth/v1') => ({ subjectId, issuer, expiresAt: Math.floor(Date.now()/1000)+300 });
async function isolated(run: (pool: pg.Pool, schema: string) => Promise<void>) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, max: 6 }), schema = `greiva_private_${newId().replaceAll('-','')}`; let installed = false;
  try { await installPrivateWorkspaceSchema(pool, schema); installed = true; await run(pool, schema); }
  finally {
    try { if (installed) { await pool.query(`DROP SCHEMA "${schema}" CASCADE`); expect((await pool.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[schema])).rowCount).toBe(0); } }
    finally { await pool.end(); }
  }
}
it.skipIf(!enabled)('PRIVATE-SCHEMA-PG: fresh transactional tables/views refuse reinstall and unknown version without changing existing rows', async () => {
  await isolated(async (pool,schema) => {
    const store = new PostgresPrivateBootstrapStore(pool,schema), result = await store.bootstrap(actor(),{clientId:newId()});
    await expect(installPrivateWorkspaceSchema(pool,schema)).rejects.toThrow();
    expect((await pool.query(`SELECT id FROM "${schema}".private_workspaces`)).rows).toEqual([{id:result.workspaceId}]);
    await pool.query(`UPDATE "${schema}".private_schema_version SET version=999`);
    await expect(store.bootstrap(actor('subject-B'),{clientId:newId()})).rejects.toBeInstanceOf(PrivateBootstrapUnavailable);
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_workspaces`)).rows[0].n).toBe(1);
  });
});
it.skipIf(!enabled)('PRIVATE-BOOTSTRAP-PG: concurrent/replayed registration is stable, issuer/account/device isolation rolls back, canonical tombstone views deny access', async () => {
  await isolated(async (pool,schema) => {
    const store = new PostgresPrivateBootstrapStore(pool,schema), clientId = newId();
    const results = await Promise.all(Array.from({length:6},()=>store.bootstrap(actor(),{clientId}))); expect(new Set(results.map(value=>value.workspaceId)).size).toBe(1); expect(new Set(results.map(value=>value.epoch)).size).toBe(1);
    const first=results[0]!, otherDevice=await store.bootstrap(actor(),{clientId:newId()}); expect(otherDevice.workspaceId).toBe(first.workspaceId); expect(otherDevice.epoch).toBe(first.epoch);
    const otherIssuer=await store.bootstrap(actor('subject-A','https://other.fixture.invalid/auth/v1'),{clientId:newId()}); expect(otherIssuer.workspaceId).not.toBe(first.workspaceId);
    await expect(store.bootstrap(actor('subject-B'),{clientId})).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_workspaces`)).rows[0].n).toBe(2);
    const read = new PostgresPrivateAccessStore(pool,schema), access=privateWorkspaceAccess(actor().subjectId,read,actor().issuer), pageId=newId();
    await pool.query(`INSERT INTO "${schema}".private_resources(type,id,workspace_id) VALUES('page',$1,$2)`,[pageId,first.workspaceId]);
    await expect(access.pageDocument(first.workspaceId,`page:${pageId}`)).resolves.toMatchObject({resources:[{type:'page',id:pageId}]});
    await expect(access.pageDocument(otherIssuer.workspaceId,`page:${pageId}`)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    await pool.query(`UPDATE "${schema}".private_resources SET deleted=true WHERE id=$1`,[pageId]); await expect(access.pageDocument(first.workspaceId,`page:${pageId}`)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    await pool.query(`UPDATE "${schema}".private_devices SET revoked=true WHERE id=$1`,[clientId]); await expect(store.bootstrap(actor(),{clientId})).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    expect((await pool.query(`SELECT revoked FROM "${schema}".private_devices WHERE id=$1`,[clientId])).rows[0].revoked).toBe(true);
    await pool.query(`UPDATE "${schema}".private_workspaces SET deleted=true WHERE id=$1`,[first.workspaceId]); await expect(store.bootstrap(actor(),{clientId:newId()})).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied); await expect(access.workspace(first.workspaceId)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_workspaces`)).rows[0].n).toBe(2);
  });
});
it.skipIf(!enabled)('PRIVATE-BOOTSTRAP-HTTP-PG: signed actual HTTP creates stable owner workspace and rejects body identity spoof without partial registration', async () => {
  await isolated(async (pool,schema) => {
    const issuer=actor().issuer,keys=await generateKeyPair('ES256',{extractable:true}),jwk={...await exportJWK(keys.publicKey),alg:'ES256',kid:'fixture'};
    const verifier=sessionVerifier({issuer,audience:'authenticated',jwksUrl:issuer+'/.well-known/jwks.json',algorithms:['ES256']},async()=>new Response(JSON.stringify({keys:[jwk]})));
    const app=await createPrivateApp(verifier,new PostgresPrivateAccessStore(pool,schema),new PostgresPrivateBootstrapStore(pool,schema));
    try {
      await app.listen(0,'127.0.0.1'); const base=await app.getUrl();
      const jwt=(sub:string)=>new SignJWT({sub,iss:issuer,aud:'authenticated',exp:Math.floor(Date.now()/1000)+300,role:'service_role'}).setProtectedHeader({alg:'ES256',kid:'fixture'}).sign(keys.privateKey);
      const owner=await jwt('subject-A'),other=await jwt('subject-B'),clientId=newId();
      const request=(body:unknown,bearer?:string)=>fetch(base+'/v1/workspaces/bootstrap',{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:'Bearer '+bearer}:{})},body:JSON.stringify(body)});
      expect((await request({clientId})).status).toBe(401);
      const success=await request({clientId},owner); expect(success.status).toBe(200);const result=await success.json();
      expect(await (await request({clientId},owner)).json()).toEqual(result);
      const access=await fetch(base+`/v1/workspaces/${result.workspaceId}/access`,{headers:{authorization:'Bearer '+owner}}); expect(access.status).toBe(200);
      expect((await request({clientId,subjectId:'subject-A'},other)).status).toBe(400);
      expect((await request({clientId},other)).status).toBe(403);
      expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_workspaces`)).rows[0].n).toBe(1);
      await pool.query(`UPDATE "${schema}".private_schema_version SET version=999`);const fail=await request({clientId},owner); expect(fail.status).toBe(503); expect(await fail.json()).toEqual({error:'bootstrap_unavailable'});
    } finally { await app.close(); }
  });
});
