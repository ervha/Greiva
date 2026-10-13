import { it,expect } from 'vitest';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { generateKeyPair,exportJWK,SignJWT,jwtVerify } from 'jose';
import { newId } from '@greiva/shared';
import { installPrivateWorkspaceSchema } from '../../apps/api/src/private-workspace-schema.js';
import { PostgresPrivateBootstrapStore } from '../../apps/api/src/private-bootstrap-store.js';
import { PostgresPrivateTransactions } from '../../apps/api/src/private-transactions.js';
import { PostgresPrivateOfflineGrants,offlineSeconds } from '../../apps/api/src/private-offline-grant.js';
import { PostgresPrivateAccessStore } from '../../apps/api/src/private-access-store.js';
import { createPrivateApp } from '../../apps/api/src/private-app.js';
import { sessionVerifier } from '../../apps/api/src/session-verifier.js';
const test=it.skipIf(process.env.GREIVA_TEST_POSTGRES!=='1');
const apiIssuer='https://api.fixture.invalid',authIssuer='https://auth.fixture.invalid/auth/v1',audience='greiva-private';
async function fixture(run:(f:any)=>Promise<void>){
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),schema='greiva_private_offline_'+newId().replaceAll('-','');let app:Awaited<ReturnType<typeof createPrivateApp>>|undefined;
  try{
    await installPrivateWorkspaceSchema(pool,schema);const now=Math.floor(Date.now()/1000),owner={issuer:authIssuer,subjectId:'offline-owner',expiresAt:now+300};
    const bootstrap=new PostgresPrivateBootstrapStore(pool,schema),binding=await bootstrap.bootstrap(owner,{clientId:newId()}),transactions=new PostgresPrivateTransactions(pool,schema);
    const keys=await generateKeyPair('EdDSA'),authKeys=await generateKeyPair('ES256'),authJwk={...await exportJWK(authKeys.publicKey),kid:'session',alg:'ES256'};
    const grants=new PostgresPrivateOfflineGrants(transactions,{issuer:apiIssuer,audience,kid:'offline',key:keys.privateKey});
    const verifier=sessionVerifier({issuer:authIssuer,audience:'authenticated',jwksUrl:'https://auth.fixture.invalid/auth/v1/.well-known/jwks.json',algorithms:['ES256']},async()=>new Response(JSON.stringify({keys:[authJwk]})));
    app=await createPrivateApp(verifier,new PostgresPrivateAccessStore(pool,schema),bootstrap,transactions,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,[],grants);
    const auth=await new SignJWT({sub:owner.subjectId,iss:authIssuer,aud:'authenticated',exp:owner.expiresAt}).setProtectedHeader({alg:'ES256',kid:'session'}).sign(authKeys.privateKey);
    const body={clientId:binding.clientId,epoch:binding.epoch,nonce:randomBytes(32).toString('hex')};
    const request=async(candidate:unknown=body,authorization='Bearer '+auth)=>app!.getHttpAdapter().getInstance().inject({method:'POST',url:`/v1/workspaces/${binding.workspaceId}/offline-grant`,headers:{authorization,'content-type':'application/json'},payload:JSON.stringify(candidate)});
    await run({pool,schema,owner,binding,keys,grants,body,request,now,transactions});
  }finally{await app?.close();try{await pool.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await pool.end();}}
}
test('OFFLINE-GRANT-PG: authenticated HTTP scope and Node signature verify in native Rust at exact seven-day boundary',async()=>fixture(async f=>{
  const response=await f.request();expect(response.statusCode).toBe(200);expect(response.headers['cache-control']).toBe('no-store');const {grant}=response.json();
  const result=await jwtVerify(grant,f.keys.publicKey,{issuer:apiIssuer,audience,algorithms:['EdDSA'],typ:'greiva-offline-v1+jwt'});expect(result.payload.exp!-result.payload.iat!).toBe(offlineSeconds);
  const context={issuer:authIssuer,subjectId:f.owner.subjectId,workspaceId:f.binding.workspaceId,clientId:f.binding.clientId,streamEpoch:f.binding.epoch};
  const publicKey=await exportJWK(f.keys.publicKey),input={token:grant,context,key:[...Buffer.from(publicKey.x!,'base64url')],now:result.payload.exp!-1,highWater:result.payload.iat,nonce:f.body.nonce,issuer:apiIssuer,audience,kid:'offline'};
  const native=(value:unknown)=>{const ran=spawnSync('.data/native-target/debug/examples/offline-grant-driver',[],{input:JSON.stringify(value),encoding:'utf8'});expect(ran.status,ran.stderr).toBe(0);return JSON.parse(ran.stdout).accepted;};
  expect(native(input)).toBe(true);expect(native({...input,now:result.payload.exp})).toBe(false);expect(native({...input,now:input.now-1,highWater:input.now})).toBe(false);
  expect(native({...input,nonce:randomBytes(32).toString('hex')})).toBe(false);expect(native({...input,context:{...context,clientId:newId()}})).toBe(false);
  const parts=grant.split('.');const signature=Buffer.from(parts[2],'base64url');signature[0]=signature[0]!^1;parts[2]=signature.toString('base64url');expect(native({...input,token:parts.join('.')})).toBe(false);
}));
test('OFFLINE-GRANT-PG: invalid auth/body/epoch and revoked device never issue an offline grant',async()=>fixture(async f=>{
  expect((await f.request(f.body,'Bearer invalid')).statusCode).toBe(401);
  for(const body of [{...f.body,ttl:999999},{...f.body,subjectId:'another'},{...f.body,nonce:'bad'}])expect((await f.request(body)).statusCode).toBe(400);
  expect((await f.request({...f.body,epoch:newId()})).statusCode).toBe(403);
  expect((await f.request({...f.body,clientId:newId()})).statusCode).toBe(403);
  await f.pool.query(`UPDATE "${f.schema}".private_devices SET revoked=true WHERE id=$1`,[f.binding.clientId]);const denied=await f.request();expect(denied.statusCode).toBe(403);expect(denied.json()).toEqual({error:'access_denied'});
}));
test('OFFLINE-GRANT-PG: signing configuration/time failures do not issue a usable result',async()=>fixture(async f=>{
  expect(()=>new PostgresPrivateOfflineGrants(f.transactions,{issuer:apiIssuer,audience,kid:'offline',key:f.keys.publicKey})).toThrow('Offline grant unavailable');
  for(const clock of [()=>0,()=>Number.MAX_SAFE_INTEGER,()=>f.owner.expiresAt]){const service=new PostgresPrivateOfflineGrants(f.transactions,{issuer:apiIssuer,audience,kid:'offline',key:f.keys.privateKey},clock);await expect(service.issue(f.owner,f.binding.workspaceId,f.body)).rejects.toThrow();}
  let calls=0;const service=new PostgresPrivateOfflineGrants(f.transactions,{issuer:apiIssuer,audience,kid:'offline',key:f.keys.privateKey},()=>++calls===1?f.now:f.now-1);await expect(service.issue(f.owner,f.binding.workspaceId,f.body)).rejects.toThrow();
}));
