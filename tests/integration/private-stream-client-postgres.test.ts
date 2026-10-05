import { it,expect } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import pg from 'pg';
import { generateKeyPair,exportJWK,SignJWT } from 'jose';
import { newId } from '@greiva/shared';
import { supabaseAuthSession,PrivateWorkspaceConnection } from '@greiva/sync';
import { createSupabasePrivateApp } from '../../apps/api/src/supabase-private-app.js';
import { installPrivateWorkspaceSchema } from '../../apps/api/src/private-workspace-schema.js';
import { installPrivateStructuredSchema } from '../../apps/api/src/private-structured-schema.js';
import { PostgresPrivateBootstrapStore } from '../../apps/api/src/private-bootstrap-store.js';
import { PostgresPrivateAccessStore } from '../../apps/api/src/private-access-store.js';
import { PostgresPrivateTransactions } from '../../apps/api/src/private-transactions.js';
import { PostgresPrivateStructuredStore } from '../../apps/api/src/private-structured-store.js';
import { WorkspaceDevice } from '../support/workspace-device.js';

it.skipIf(process.env.GREIVA_TEST_POSTGRES!=='1')('PRIVATE-STREAM-CLIENT-PG: signed HTTP and two actual SQLite stores recover lost ACK/restart, paginate and retain revoked pending',async()=>{
  const schema='greiva_private_'+newId().replaceAll('-',''),pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),directory=mkdtempSync(join(tmpdir(),'greiva-private-sync-'));
  const projectUrl='https://project.fixture.invalid',issuer=projectUrl+'/auth/v1',keys=await generateKeyPair('ES256'),jwk={...await exportJWK(keys.publicKey),kid:'fixture',alg:'ES256'};
  const auths:ReturnType<typeof supabaseAuthSession>[]=[],devices:WorkspaceDevice[]=[];let app:Awaited<ReturnType<typeof createSupabasePrivateApp>>|undefined;
  try{
    await installPrivateWorkspaceSchema(pool,schema);await installPrivateStructuredSchema(pool,schema);
    app=await createSupabasePrivateApp({projectUrl,algorithm:'ES256'},new PostgresPrivateAccessStore(pool,schema),new PostgresPrivateBootstrapStore(pool,schema),async()=>new Response(JSON.stringify({keys:[jwk]})),new PostgresPrivateTransactions(pool,schema),new PostgresPrivateStructuredStore(pool,schema));
    await app.listen(0,'127.0.0.1');const apiUrl=await app.getUrl();
    async function auth(subjectId='owner'){
      const session=supabaseAuthSession({projectUrl,algorithm:'ES256',publishableKey:'sb_publishable_fixture',apiUrl},async(input,init)=>{
        if(new URL(String(input)).origin!==projectUrl)return fetch(input,init);
        const token=await new SignJWT({sub:subjectId,iss:issuer,aud:'authenticated',exp:Math.floor(Date.now()/1000)+300}).setProtectedHeader({alg:'ES256',kid:'fixture'}).sign(keys.privateKey);
        return new Response(JSON.stringify({access_token:token,refresh_token:'fixture-refresh',token_type:'bearer',user:{id:subjectId}}));
      });auths.push(session);await session.login('fixture@example.invalid','fixture-password');return session;
    }
    let loseAck=true;const firstAuth=await auth(),secondAuth=await auth();
    const first=new PrivateWorkspaceConnection(firstAuth,{apiUrl,clientId:newId()},async(input,init)=>{const response=await fetch(input,init);if(String(input).endsWith('/sync/push') && response.ok && loseAck){await response.clone().json();loseAck=false;throw new TypeError('Fixture response lost after commit');}return response;});
    const second=new PrivateWorkspaceConnection(secondAuth,{apiUrl,clientId:newId()}),one=await first.bootstrap(),two=await second.bootstrap();expect(one.workspaceId).toBe(two.workspaceId);expect(one.streamEpoch).toBe(two.streamEpoch);
    const device=new WorkspaceDevice(join(directory,'one.sqlite'),one),peer=new WorkspaceDevice(join(directory,'two.sqlite'),two);devices.push(device,peer);const sync=first.openSync(device),peerSync=second.openSync(peer);
    const create=(clientId:string,title:string)=>({operationId:newId(),clientId,entityType:'task',entityId:newId(),kind:'create',baseVersion:null,payload:{title,status:'todo',due:null}}),operation=create(one.clientId,'first durable');
    await device.request('mutate',{operation});const wire=await device.request('prepare');await expect(sync.push(wire)).rejects.toMatchObject({stage:'transport'});expect(await device.request('prepare')).toBe(wire);
    await device.close('SIGKILL');expect(await device.request('prepare')).toBe(wire);await sync.push(wire);expect((await device.request('snapshot')).snapshot.operations[0].status).toBe('acknowledged');
    await peer.request('mutate',{operation:create(two.clientId,'second durable')});await peerSync.push(await peer.request('prepare'));
    const pull=(context:typeof one,cursor:string|null)=>({protocolVersion:1,workspaceId:context.workspaceId,clientId:context.clientId,cursor,limit:1});
    await sync.pull(pull(one,null));const cursor=(await device.request('snapshot')).snapshot.state.cursor;expect(cursor).toMatch(/^gw1\./);await sync.pull(pull(one,cursor));
    await peerSync.pull(pull(two,null));await peerSync.pull(pull(two,(await peer.request('snapshot')).snapshot.state.cursor));
    const a=(await device.request('snapshot')).snapshot,b=(await peer.request('snapshot')).snapshot;expect(a.tasks).toEqual(b.tasks);expect(a.tasks.map((row:{title:string})=>row.title).sort()).toEqual(['first durable','second durable']);expect(a.state.cursor).toBe(b.state.cursor);
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_structured_operations`)).rows[0].n).toBe(2);
    await firstAuth.refresh();await expect(sync.pull(pull(one,a.state.cursor))).rejects.toMatchObject({stage:'closed'});expect(await first.bootstrap()).toEqual(one);const refreshed=first.openSync(device);await refreshed.pull(pull(one,a.state.cursor));
    const unrelated=await auth('other');const forbidden=await unrelated.authorized((header,signal)=>fetch(`${apiUrl}/v1/workspaces/${one.workspaceId}/sync/pull`,{method:'POST',headers:{authorization:header,'content-type':'application/json'},body:JSON.stringify(pull(one,null)),signal}));expect(forbidden.status).toBe(403);expect(await forbidden.json()).toEqual({error:'access_denied'});
    const pending=create(one.clientId,'retain after revocation');await device.request('mutate',{operation:pending});const saved=await device.request('prepare');await pool.query(`UPDATE "${schema}".private_devices SET revoked=true WHERE id=$1`,[one.clientId]);await expect(refreshed.push(saved)).rejects.toMatchObject({stage:'closed'});expect(first.context).toBeNull();expect(await device.request('prepare')).toBe(saved);expect((await device.request('snapshot')).snapshot.operations.find((row:{operationId:string})=>row.operationId===pending.operationId).status).toBe('pending');
  }finally{for(const auth of auths)auth.close();for(const device of devices)await device.close();await app?.close();try{await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);}finally{await pool.end();rmSync(directory,{recursive:true,force:true});}}
});
