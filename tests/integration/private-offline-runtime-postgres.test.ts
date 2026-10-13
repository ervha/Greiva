import {it,expect} from 'vitest';import pg from 'pg';import {createServer} from 'node:net';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {randomBytes} from 'node:crypto';
import {generateKeyPair,exportJWK,SignJWT,jwtVerify} from 'jose';import {newId} from '@greiva/shared';
import {installPrivateWorkspaceSchema} from '../../apps/api/src/private-workspace-schema.js';
import {privateRuntimeConfiguration,startPrivateApi} from '../../apps/api/src/private-runtime.js';
const test=it.skipIf(process.env.GREIVA_TEST_POSTGRES!=='1');
async function port(){const s=createServer();await new Promise<void>(done=>s.listen(0,'127.0.0.1',done));const a=s.address();if(!a||typeof a==='string')throw Error();await new Promise<void>(done=>s.close(()=>done()));return a.port;}
test('OFFLINE-RUNTIME-PG: explicit private signing file enables authenticated runtime route; absent config leaves it disabled',async()=>{
  const root=await mkdtemp(path.join(tmpdir(),'greiva-offline-runtime-')),pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),schema='greiva_private_offline_'+newId().replaceAll('-','');let runtime:Awaited<ReturnType<typeof startPrivateApi>>|undefined;
  try{
    await installPrivateWorkspaceSchema(pool,schema);const signing=await generateKeyPair('EdDSA',{extractable:true}),auth=await generateKeyPair('ES256'),jwk={...await exportJWK(auth.publicKey),kid:'auth',alg:'ES256'},keyFile=path.join(root,'key.json');await writeFile(keyFile,JSON.stringify(await exportJWK(signing.privateKey)),{mode:0o600});
    const base={GREIVA_SUPABASE_URL:'https://auth.fixture.invalid',GREIVA_SUPABASE_ALGORITHM:'ES256',DATABASE_URL:process.env.DATABASE_URL,GREIVA_PRIVATE_SCHEMA:schema,GREIVA_PRIVATE_PORT:String(await port())};const keyConfig={GREIVA_OFFLINE_ISSUER:'https://api.fixture.invalid',GREIVA_OFFLINE_AUDIENCE:'native',GREIVA_OFFLINE_KID:'one',GREIVA_OFFLINE_KEY_FILE:keyFile};
    const fetchJwks=async()=>new Response(JSON.stringify({keys:[jwk]}));runtime=await startPrivateApi(privateRuntimeConfiguration({...base,...keyConfig}),{fetchJwks});
    const token=await new SignJWT({iss:base.GREIVA_SUPABASE_URL+'/auth/v1',sub:'synthetic-runtime-owner',aud:'authenticated',exp:Math.floor(Date.now()/1000)+300}).setProtectedHeader({alg:'ES256',kid:'auth'}).sign(auth.privateKey);
    const headers={authorization:'Bearer '+token,'content-type':'application/json'};const bootstrap=await fetch(runtime.address+'/v1/workspaces/bootstrap',{method:'POST',headers,body:JSON.stringify({clientId:newId()})});expect(bootstrap.status).toBe(200);const binding=await bootstrap.json() as {clientId:string;workspaceId:string;epoch:string};
    const url='/v1/workspaces/'+binding.workspaceId+'/offline-grant',body={clientId:binding.clientId,epoch:binding.epoch,nonce:randomBytes(32).toString('hex')};const response=await fetch(runtime.address+url,{method:'POST',headers,body:JSON.stringify(body)});expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('no-store');const data=await response.json() as {grant:string};const verified=await jwtVerify(data.grant,signing.publicKey,{issuer:keyConfig.GREIVA_OFFLINE_ISSUER,audience:'native',algorithms:['EdDSA']});expect(verified.payload.clientId).toBe(binding.clientId);
    await runtime.close();runtime=undefined;runtime=await startPrivateApi(privateRuntimeConfiguration({...base,GREIVA_PRIVATE_PORT:String(await port())}),{fetchJwks});expect((await fetch(runtime.address+url,{method:'POST',headers,body:JSON.stringify(body)})).status).toBe(404);
  }finally{await runtime?.close();try{await pool.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await pool.end();await rm(root,{recursive:true,force:true});}}
});
