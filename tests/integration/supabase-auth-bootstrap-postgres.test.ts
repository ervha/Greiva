import { it, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import pg from 'pg';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { newId } from '@greiva/shared';
import { supabaseAuthSession, PrivateWorkspaceConnection } from '@greiva/sync';
import { createSupabasePrivateApp } from '../../apps/api/src/supabase-private-app.js';
import { installPrivateWorkspaceSchema } from '../../apps/api/src/private-workspace-schema.js';
import { PostgresPrivateAccessStore } from '../../apps/api/src/private-access-store.js';
import { PostgresPrivateBootstrapStore } from '../../apps/api/src/private-bootstrap-store.js';
import { WorkspaceDevice } from '../support/workspace-device.js';

it.skipIf(process.env.GREIVA_TEST_POSTGRES!=='1')('SUPABASE-AUTH-PG: client login/verified bootstrap binds actual SQLite; foreign device registration and revoked-device retry roll back',async()=>{
  const schema='greiva_private_auth_'+newId().replaceAll('-',''),pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),directory=mkdtempSync(join(tmpdir(),'greiva-auth-bootstrap-'));
  const projectUrl='https://project.fixture.invalid',issuer=projectUrl+'/auth/v1',keys=await generateKeyPair('ES256'),jwk={...await exportJWK(keys.publicKey),kid:'fixture',alg:'ES256'};
  let app:Awaited<ReturnType<typeof createSupabasePrivateApp>>|undefined,device:WorkspaceDevice|undefined;
  const sessions:ReturnType<typeof supabaseAuthSession>[]=[];
  try{
    await installPrivateWorkspaceSchema(pool,schema);
    app=await createSupabasePrivateApp({projectUrl,algorithm:'ES256'},new PostgresPrivateAccessStore(pool,schema),new PostgresPrivateBootstrapStore(pool,schema),async()=>new Response(JSON.stringify({keys:[jwk]})));
    await app.listen(0,'127.0.0.1');const apiUrl=await app.getUrl(),clientId=newId();
    function session(subjectId:string){const auth=supabaseAuthSession({projectUrl,algorithm:'ES256',publishableKey:'sb_publishable_fixture',apiUrl},async(input,init)=>{
      if(new URL(String(input)).origin!==projectUrl)return fetch(input,init);
      const token=await new SignJWT({sub:subjectId,iss:issuer,aud:'authenticated',exp:Math.floor(Date.now()/1000)+300}).setProtectedHeader({alg:'ES256',kid:'fixture'}).sign(keys.privateKey);
      return new Response(JSON.stringify({access_token:token,refresh_token:'fixture-refresh',token_type:'bearer',user:{id:subjectId}}));
    });sessions.push(auth);return auth;}
    const owner=session('owner-A');await owner.login('fixture@example.invalid','fixture-password');
    const connection=new PrivateWorkspaceConnection(owner,{apiUrl,clientId}),first=await connection.bootstrap();
    expect(await connection.bootstrap()).toEqual(first);await owner.refresh();expect(connection.context).toBeNull();expect(await connection.bootstrap()).toEqual(first);
    device=new WorkspaceDevice(join(directory,'workspace.sqlite'),first);
    const operation={operationId:newId(),clientId,entityId:newId(),entityType:'task',kind:'create',baseVersion:null,payload:{title:'authenticated pending',status:'todo',due:null}};
    await device.request('mutate',{operation});const wire=await device.request('prepare');await device.close('SIGKILL');expect(await device.request('prepare')).toBe(wire);
    const sync=connection.openSync(device);await expect(sync.push(wire)).rejects.toMatchObject({stage:'transport'});expect(await device.request('prepare')).toBe(wire); // New sync routes remain absent; never fall back to PoC.
    const other=session('owner-B');await other.login('other@example.invalid','fixture-password');const foreign=new PrivateWorkspaceConnection(other,{apiUrl,clientId});await expect(foreign.bootstrap()).rejects.toMatchObject({stage:'access_denied'});expect(foreign.context).toBeNull();
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_workspaces`)).rows[0].n).toBe(1);
    const forbidden=await other.authorized(async(header,signal)=>fetch(`${apiUrl}/v1/workspaces/${first.workspaceId}/access`,{headers:{authorization:header},signal}));expect(forbidden.status).toBe(403);
    await pool.query(`UPDATE "${schema}".private_devices SET revoked=true WHERE id=$1`,[clientId]);await expect(connection.bootstrap()).rejects.toMatchObject({stage:'access_denied'});expect(connection.context).toBeNull();await expect(sync.push(wire)).rejects.toMatchObject({stage:'closed'});
    expect(await device.request('prepare')).toBe(wire);expect((await device.request('snapshot')).snapshot.operations[0].status).toBe('pending');
  }finally{
    for(const auth of sessions)auth.close();await device?.close();await app?.close();
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end();rmSync(directory,{recursive:true,force:true});
  }
});
