// Docker-only synthetic TLS provider -> native Rust -> actual signed API gate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import {createSupabasePrivateApp} from '../apps/api/dist/supabase-private-app.js';
import pg from 'pg';
import {installPrivateWorkspaceSchema} from '../apps/api/dist/private-workspace-schema.js';
import {PostgresPrivateBootstrapStore} from '../apps/api/dist/private-bootstrap-store.js';
const withWorkspace=process.argv.includes('--workspace');
const schema='greiva_private_native_'+crypto.randomUUID().replaceAll('-','');
const pool=withWorkspace?new pg.Pool({connectionString:process.env.DATABASE_URL}):undefined;
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'greiva-native-http-'));
const keyFile=path.join(temp,'key.pem'),certFile=path.join(temp,'cert.pem');
const generated=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',keyFile,'-out',certFile,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost','-addext','basicConstraints=critical,CA:TRUE'],{stdio:'ignore'});
assert.equal(generated.status,0,'fixture certificate generation');
const keys=await generateKeyPair('ES256');const jwk={...await exportJWK(keys.publicKey),kid:'native-http-fixture',alg:'ES256'};
let project,issuer,privateApp,nestApi,api;
const modes=new Map(),refreshes=new Map(),counts={},violations=[];
let trap=0;
const count=(mode,operation)=>{counts[mode]??={password:0,refresh:0,verify:0,revoke:0,bootstrap:0};counts[mode][operation]++;};
const json=(response,value,status=200)=>{response.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});response.end(JSON.stringify(value));};
async function token(mode){
 let jwt=await new SignJWT({sub:mode==='mismatch'?'owner-B':'owner-A',iss:issuer,aud:'authenticated',exp:Math.floor(Date.now()/1000)+(mode==='expired'?-30:300)})
  .setProtectedHeader({alg:'ES256',kid:'native-http-fixture'}).sign(keys.privateKey);
 if(mode==='bad-signature'){const parts=jwt.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);jwt=parts.join('.');}
 modes.set(jwt,mode);return jwt;
}
const provider=https.createServer({key:fs.readFileSync(keyFile),cert:fs.readFileSync(certFile)},async(request,response)=>{
 try {
  if(request.headers.apikey!=='sb_publishable_fixture' || request.headers.cookie || request.headers.referer)violations.push('provider-headers');
  let bytes='';for await(const chunk of request){bytes+=chunk;if(bytes.length>8192)throw Error();}
  const url=new URL(request.url,project),body=JSON.parse(bytes);
  if(url.pathname==='/auth/v1/logout'){
   const mode=modes.get(request.headers.authorization?.slice(7));if(!mode)throw Error();count(mode,'revoke');
   assert.equal(url.search,'?scope=local');json(response,{},mode==='revoke-fail'?503:200);return;
  }
  if(request.method!=='POST' || url.pathname!=='/auth/v1/token')throw Error();
  let mode;
  if(url.search==='?grant_type=password'){
   mode=body.email.split('@')[0];if(body.password!=='fixture-password' || request.headers.authorization)violations.push('password-route');count(mode,'password');
  }else if(url.search==='?grant_type=refresh_token'){
   const saved=refreshes.get(body.refresh_token);if(!saved || saved.used)throw Error();saved.used=true;mode=saved.mode;count(mode,'refresh');
   if(mode==='refresh-fail'){json(response,{error:'fixture consumed refresh'},503);return;}
  }else throw Error();
  if(mode==='redirect'){response.writeHead(307,{location:api+'/trap'});response.end();return;}
  if(mode==='oversize'){response.writeHead(200,{'content-type':'application/json'});response.write(' '.repeat(40000));response.end(' '.repeat(40000));return;}
  const access=await token(mode),refresh=`fixture-${mode}-${counts[mode].password+counts[mode].refresh}`;
  refreshes.set(refresh,{mode,used:false});
  const value={access_token:access,refresh_token:refresh,token_type:'bearer',user:{id:'owner-A',email:'ignored@example.invalid',user_metadata:{ignored:'profile'}}};
  if(mode==='wrong-type'){response.writeHead(200,{'content-type':'text/plain'});response.end(JSON.stringify(value));return;}
  if(mode==='duplicate'){response.writeHead(200,{'content-type':'application/json'});response.end(`{"access_token":${JSON.stringify(access)},`+JSON.stringify(value).slice(1));return;}
  json(response,value);
 }catch{violations.push('provider-contract');if(!response.headersSent)json(response,{error:'fixture'},500);else response.end();}
});
const proxy=http.createServer(async(request,response)=>{
 try {
  if(request.url==='/trap'){trap++;json(response,{});return;}
  const bootstrap=request.method==='POST' && request.url==='/v1/workspaces/bootstrap';
  if(!bootstrap && (request.method!=='GET' || request.url!=='/v1/session'))throw Error();
  if(request.headers.apikey || request.headers.cookie || request.headers.referer)violations.push('api-headers');
  const mode=modes.get(request.headers.authorization?.slice(7));if(!mode)throw Error();count(mode,bootstrap?'bootstrap':'verify');
  if(bootstrap){
   if(!pool)throw Error();let body='';for await(const chunk of request)body+=chunk;
   const value=JSON.parse(body);assert.deepEqual(Object.keys(value).sort(),['clientId']);
   if(mode==='workspace-revoked')await pool.query(`UPDATE "${schema}".private_devices SET revoked=true WHERE id=$1`,[value.clientId]);
   const result=await fetch(nestApi+request.url,{method:'POST',headers:{authorization:request.headers.authorization,'content-type':'application/json'},body,redirect:'error'});
   json(response,await result.json(),result.status);return;
  }
  if(mode==='foreign-issuer'){json(response,{issuer:'https://other.invalid/auth/v1',subjectId:'owner-A',expiresAt:Math.floor(Date.now()/1000)+300});return;}
  if(mode==='bad-session'){json(response,{issuer,subjectId:'owner-A',expiresAt:1.5});return;}
  if(mode==='extra-session'){json(response,{issuer,subjectId:'owner-A',expiresAt:Math.floor(Date.now()/1000)+300,profile:'unexpected'});return;}
  const result=await fetch(nestApi+'/v1/session',{headers:{authorization:request.headers.authorization},redirect:'error'});
  json(response,await result.json(),result.status);
 }catch{violations.push('api-contract');json(response,{error:'fixture'},500);}
});
let exit=1;
try {
 await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));project=`https://localhost:${provider.address().port}`;issuer=project+'/auth/v1';
 if(pool)await installPrivateWorkspaceSchema(pool,schema);
 privateApp=await createSupabasePrivateApp({projectUrl:project,algorithm:'ES256'},{read:async()=>{throw Error('unexpected workspace query');}},pool?new PostgresPrivateBootstrapStore(pool,schema):undefined,async()=>new Response(JSON.stringify({keys:[jwk]})));
 await privateApp.listen(0,'127.0.0.1');nestApi=await privateApp.getUrl();
 await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));api=`http://127.0.0.1:${proxy.address().port}`;
 const child=spawn('/opt/cargo/bin/cargo',['test','--locked','--offline','--manifest-path','apps/client/src-tauri/crates/page-store/Cargo.toml','--lib','--target-dir','.data/native-target',withWorkspace?'native_http_actual_':'native_http_actual_tls_signed_session_and_failure_boundaries','--','--ignored'],{
  stdio:'inherit',env:{...process.env,GREIVA_FIXTURE_PROJECT:project,GREIVA_FIXTURE_API:api,GREIVA_FIXTURE_CA:certFile}});
 const code=await new Promise(resolve=>child.once('exit',resolve));assert.equal(code,0,'native HTTP Rust acceptance');
 assert.equal(trap,0,'redirect must never send credential to trap');assert.deepEqual(violations,[],'route/header contract violations');assert.equal(counts['tls-untrusted'],undefined,'untrusted TLS must reject before sending password');
 for(const [mode,value] of Object.entries(counts)){
  assert.equal(value.password,1,'no automatic password retry');assert.equal(value.refresh,['normal','revoke-fail','refresh-fail','workspace'].includes(mode)?1:0,'no automatic refresh retry');
  assert.equal(value.revoke,['normal','revoke-fail','workspace'].includes(mode)?1:0,'revoke once after local lock');
 }
 let registration;
 if(pool){const rows=await pool.query(`SELECT (SELECT count(*)::int FROM "${schema}".private_workspaces) AS workspaces,count(*)::int AS devices,count(*) FILTER (WHERE revoked)::int AS revoked FROM "${schema}".private_devices`);registration=rows.rows[0];assert.deepEqual(registration,{workspaces:1,devices:1,revoked:1});assert.equal(counts.workspace.bootstrap,2);assert.equal(counts['workspace-revoked'].bootstrap,1);}
 console.log(JSON.stringify({result:'Pass',fixtureOnly:true,actualTls:true,actualApiSignedVerification:true,jwks:'public fixture transport',redirectTrapRequests:trap,untrustedTlsSent:false,registration,counts},null,2));exit=0;
}finally{
 provider.closeAllConnections();proxy.closeAllConnections();await Promise.all([new Promise(r=>provider.close(r)),new Promise(r=>proxy.close(r)),privateApp?.close()]);
 if(pool){await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end();}
 fs.rmSync(temp,{recursive:true,force:true});
}
process.exitCode=exit;
