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
import {installPrivateStructuredSchema} from '../apps/api/dist/private-structured-schema.js';
import {installPrivatePageSchema} from '../apps/api/dist/private-page-schema.js';
import {PostgresPrivateBootstrapStore} from '../apps/api/dist/private-bootstrap-store.js';
import {PostgresPrivatePageStore} from '../apps/api/dist/private-page-store.js';
import {PostgresPrivatePageMetadataStore} from '../apps/api/dist/private-page-metadata-store.js';
import {installPrivatePageMetadataSchema} from '../apps/api/dist/private-page-metadata-schema.js';
import * as Y from 'yjs';
import {PostgresPrivateOfflineGrants} from '../apps/api/dist/private-offline-grant.js';
import {PostgresPrivateTransactions} from '../apps/api/dist/private-transactions.js';
const withOffline=process.argv.includes('--offline');const offlineRequests=[];
const offlineKeys=withOffline?await generateKeyPair('EdDSA'):undefined;
const offlinePublic=offlineKeys?Buffer.from((await exportJWK(offlineKeys.publicKey)).x,'base64url').toString('hex'):undefined;
const withCatalog=process.argv.includes('--catalog')||withOffline;
const withRead=process.argv.includes('--read')||withCatalog;
const catalogRequests=[];let catalogSeeded=false;
const withPages=process.argv.includes('--pages')||withRead;
const withWorkspace=process.argv.includes('--workspace')||withPages;
const pageFrames=[];const pageDoc=new Y.Doc();pageDoc.on('update',bytes=>pageFrames.push(Array.from(bytes)));pageDoc.getText('fixture').insert(0,'native HTTP saved');pageDoc.getText('fixture').insert(17,' and appended');
const pageRequests=[];
const titleRequests=[],titleReads=[];
const readRequests=[],readSetupRequests=[];const localFrames=[];const localDoc=new Y.Doc();localDoc.on('update',bytes=>localFrames.push(Array.from(bytes)));localDoc.getText('fixture').insert(0,'local retained / ');
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
  if(withPages&&request.method==='POST'&&/^\/v1\/workspaces\/[0-9a-f-]+\/pages\/[0-9a-f-]+\/metadata\/(rename|read)$/.test(request.url)){
   assert.equal(modes.get(request.headers.authorization?.slice(7)),'page-sync');assert.equal(request.headers.apikey,undefined);assert.equal(request.headers.cookie,undefined);assert.equal(request.headers.referer,undefined);
   let body='';for await(const chunk of request)body+=chunk;const rename=request.url.endsWith('/rename');const requests=rename?titleRequests:titleReads;requests.push({route:request.url,body});
   const result=await fetch(nestApi+request.url,{method:'POST',headers:{authorization:request.headers.authorization,'content-type':'application/json'},body,redirect:'error'});assert.equal(result.status,200);const row=await result.json();
   if(requests.length===1)row.workspaceEpoch='01900000-0000-7000-8000-000000000099';if(rename&&requests.length===2){response.destroy();return;}
   // Schema-valid legacy conflicts can exceed the former 8 MiB cap. Control
   // characters exercise JSON's six-byte expansion without changing metadata.
   if(!rename&&requests.length===3){row.conflicts=Array.from({length:50},(_,index)=>({id:`01900000-0000-7000-8000-${String(1000+index).padStart(12,'0')}`,operationId:`01900000-0000-7000-8000-${String(2000+index).padStart(12,'0')}`,baseVersion:0,remoteVersion:row.version,base:'\u0000'.repeat(65536),local:'\u0001'.repeat(65536),remote:row.metadata.title}));assert.ok(Buffer.byteLength(JSON.stringify(row))>8*1024*1024);}
   json(response,row);return;
  }
  const pageSend=withPages && request.method==='POST' && /^\/v1\/workspaces\/[0-9a-f-]+\/pages\/[0-9a-f-]+\/document\/(bootstrap|append)$/.test(request.url);
  const pageRead=withRead && request.method==='POST' && /^\/v1\/workspaces\/[0-9a-f-]+\/pages\/[0-9a-f-]+\/document\/read$/.test(request.url);
  if(withOffline&&request.method==='POST'&&/^\/v1\/workspaces\/[0-9a-f-]+\/offline-grant$/.test(request.url)){
   assert.equal(modes.get(request.headers.authorization?.slice(7)),'offline-grant');assert.equal(request.headers.apikey,undefined);assert.equal(request.headers.cookie,undefined);assert.equal(request.headers.referer,undefined);let body='';for await(const chunk of request)body+=chunk;const value=JSON.parse(body);assert.deepEqual(Object.keys(value).sort(),['clientId','epoch','nonce']);assert.match(value.nonce,/^[0-9a-f]{64}$/);assert.ok(!offlineRequests.includes(value.nonce));offlineRequests.push(value.nonce);
   const result=await fetch(nestApi+request.url,{method:'POST',headers:{authorization:request.headers.authorization,'content-type':'application/json'},body,redirect:'error'});assert.equal(result.status,200);const row=await result.json();if(offlineRequests.length===1)row.protocolVersion=2;if(offlineRequests.length===2){response.destroy();return;}json(response,row);return;
  }
  if(withCatalog&&request.method==='POST'&&/^\/v1\/workspaces\/[0-9a-f-]+\/pages\/query$/.test(request.url)){
   assert.equal(modes.get(request.headers.authorization?.slice(7)),'catalog-reader');assert.equal(request.headers.apikey,undefined);assert.equal(request.headers.cookie,undefined);assert.equal(request.headers.referer,undefined);
   let body='';for await(const chunk of request)body+=chunk;catalogRequests.push({route:request.url,body});const value=JSON.parse(body);assert.deepEqual(Object.keys(value).sort(),['clientId','cursor','limit','protocolVersion']);assert.equal(value.limit,20);assert.equal(value.protocolVersion,1);
   if(!catalogSeeded){catalogSeeded=true;const prefix=request.url.slice(0,-6);for(let i=0;i<21;i++){const id=`01900000-0000-7000-8000-${String(100+i).padStart(12,'0')}`;const seeded=await fetch(nestApi+prefix+'/'+id+'/document/bootstrap',{method:'POST',headers:{authorization:request.headers.authorization,'content-type':'application/json'},body:JSON.stringify({protocolVersion:1,clientId:value.clientId,editorSchemaVersion:1,title:'catalog fixture '+i,initialUpdate:Buffer.from(pageFrames[0]).toString('base64url')}),redirect:'error'});assert.equal(seeded.status,200);}}
   const result=await fetch(nestApi+request.url,{method:'POST',headers:{authorization:request.headers.authorization,'content-type':'application/json'},body,redirect:'error'});assert.equal(result.status,200);const row=await result.json();if(catalogRequests.length===1)row.workspaceEpoch='01900000-0000-7000-8000-000000000099';if(catalogRequests.length===3){response.destroy();return;}json(response,row);return;
  }
  if(pageRead){
   assert.equal(modes.get(request.headers.authorization?.slice(7)),'read-reader');assert.equal(request.headers.apikey,undefined);assert.equal(request.headers.cookie,undefined);assert.equal(request.headers.referer,undefined);
   let body='';for await(const chunk of request)body+=chunk;readRequests.push({route:request.url,body});const value=JSON.parse(body);assert.deepEqual(Object.keys(value).sort(),['clientId','editorSchemaVersion','protocolVersion','stateVector']);assert.equal(value.stateVector,'AA');
   const result=await fetch(nestApi+request.url,{method:'POST',headers:{authorization:request.headers.authorization,'content-type':'application/json'},body,redirect:'error'});assert.equal(result.status,200);const responseValue=await result.json();
   if(readRequests.length===1)responseValue.workspaceId='01900000-0000-7000-8000-000000000099';
   if(readRequests.length===2)responseValue.digest='0'.repeat(64);
   if(readRequests.length===3){response.destroy();return;}
   json(response,responseValue);return;
  }
  if(pageSend){
   const mode=modes.get(request.headers.authorization?.slice(7));assert.ok(mode==='page-sync'||withRead&&mode==='read-writer');assert.equal(request.headers.apikey,undefined);assert.equal(request.headers.cookie,undefined);assert.equal(request.headers.referer,undefined);
   let body='';for await(const chunk of request)body+=chunk;if(mode==='page-sync')pageRequests.push({route:request.url,body});else readSetupRequests.push({route:request.url,body});
   const result=await fetch(nestApi+request.url,{method:'POST',headers:{authorization:request.headers.authorization,'content-type':'application/json'},body,redirect:'error'});assert.equal(result.status,200);const receipt=await result.json();
   if(mode==='page-sync'&&pageRequests.length===1){receipt.workspaceId='01900000-0000-7000-8000-000000000099';json(response,receipt);return;}
   if(mode==='page-sync'&&pageRequests.length===2){response.destroy();return;}
   json(response,receipt);return;
  }
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
 if(withPages){await installPrivateStructuredSchema(pool,schema);await installPrivatePageSchema(pool,schema);await installPrivatePageMetadataSchema(pool,schema);}
 privateApp=await createSupabasePrivateApp({projectUrl:project,algorithm:'ES256'},{read:async()=>{throw Error('unexpected workspace query');}},pool?new PostgresPrivateBootstrapStore(pool,schema):undefined,async()=>new Response(JSON.stringify({keys:[jwk]})),undefined,undefined,withPages?new PostgresPrivatePageStore(pool,schema):undefined,withPages?new PostgresPrivatePageMetadataStore(pool,schema):undefined,...Array(7).fill(undefined),withOffline?new PostgresPrivateOfflineGrants(new PostgresPrivateTransactions(pool,schema),{issuer:'https://offline.fixture.invalid',audience:'native',kid:'fixture-offline',key:offlineKeys.privateKey}):undefined);
 await privateApp.listen(0,'127.0.0.1');nestApi=await privateApp.getUrl();
 await new Promise(resolve=>proxy.listen(0,'127.0.0.1',resolve));api=`http://127.0.0.1:${proxy.address().port}`;
 const child=spawn('/opt/cargo/bin/cargo',['test','--locked','--offline','--manifest-path','apps/client/src-tauri/crates/page-store/Cargo.toml','--lib','--target-dir','.data/native-target',withWorkspace?'native_http_actual_':'native_http_actual_tls_signed_session_and_failure_boundaries','--','--ignored',...(!withPages?['--skip','native_http_actual_page_send_unknown_receipt_retry_and_durable_ack']:[]),...(!withRead?['--skip','native_http_actual_page_read_adopts_remote_and_keeps_local_pending']:[]),...(!withCatalog?['--skip','native_http_actual_page_catalog_paginates_without_receiving_body']:[]),...(!withOffline?['--skip','native_http_actual_offline_preparation_uses_signed_grant_and_os_lease']:[])],{
  stdio:'inherit',env:{...process.env,GREIVA_FIXTURE_PROJECT:project,GREIVA_FIXTURE_API:api,GREIVA_FIXTURE_CA:certFile,...(withOffline?{GREIVA_FIXTURE_OFFLINE_PUBLIC:offlinePublic,GREIVA_FIXTURE_OFFLINE_RESULT:path.join(temp,'offline-result.json')}:{}),...(withPages?{GREIVA_FIXTURE_PAGE_FRAMES:JSON.stringify(pageFrames)}:{}),...(withRead?{GREIVA_FIXTURE_LOCAL_FRAME:JSON.stringify(localFrames[0]),GREIVA_FIXTURE_READ_RESULT:path.join(temp,'read-result.json')}:{})}});
 const code=await new Promise(resolve=>child.once('exit',resolve));assert.equal(code,0,'native HTTP Rust acceptance');
 assert.equal(trap,0,'redirect must never send credential to trap');assert.deepEqual(violations,[],'route/header contract violations');assert.equal(counts['tls-untrusted'],undefined,'untrusted TLS must reject before sending password');
 for(const [mode,value] of Object.entries(counts)){
  assert.equal(value.password,1,'no automatic password retry');assert.equal(value.refresh,['normal','revoke-fail','refresh-fail','workspace','offline-grant'].includes(mode)?1:0,'no automatic refresh retry');
  assert.equal(value.revoke,['normal','revoke-fail','workspace','offline-grant'].includes(mode)?1:0,'revoke once after local lock');
 }
 let registration;
 if(pool){const rows=await pool.query(`SELECT (SELECT count(*)::int FROM "${schema}".private_workspaces) AS workspaces,count(*)::int AS devices,count(*) FILTER (WHERE revoked)::int AS revoked FROM "${schema}".private_devices`);registration=rows.rows[0];assert.deepEqual(registration,{workspaces:1,devices:withOffline?6:withCatalog?5:withRead?4:withPages?2:1,revoked:1});assert.equal(counts.workspace.bootstrap,2);assert.equal(counts['workspace-revoked'].bootstrap,1);}
 if(withPages){assert.equal(pageRequests.length,4);assert.deepEqual(pageRequests[0],pageRequests[1]);assert.deepEqual(pageRequests[1],pageRequests[2]);assert.ok(pageRequests[3].route.endsWith('/append'));const rows=await pool.query(`SELECT update FROM "${schema}".private_page_updates WHERE page_id='01900000-0000-7000-8000-000000000061' ORDER BY server_order`);assert.equal(rows.rowCount,2);const replay=new Y.Doc();for(const row of rows.rows)Y.applyUpdate(replay,row.update);assert.equal(replay.getText('fixture').toString(),pageDoc.getText('fixture').toString());assert.deepEqual(Y.encodeStateVector(replay),Y.encodeStateVector(pageDoc));replay.destroy();console.log(JSON.stringify({nativePageSend:'Pass',wrongScopeReceiptRefused:true,lostResponseSameWireRetry:true,httpRequests:4,durableServerFrames:2,bodyAndVectorEqual:true}));}
 if(withPages){assert.equal(titleReads.length,3);assert.deepEqual(titleReads[0],titleReads[1]);assert.deepEqual(titleReads[1],titleReads[2]);assert.equal(titleRequests.length,3);assert.deepEqual(titleRequests[0],titleRequests[1]);assert.deepEqual(titleRequests[1],titleRequests[2]);console.log(JSON.stringify({nativeTitleSync:'Pass',wrongEpochRefused:true,lostResponseSameWireRetry:true,durableTitleReceipt:true,largeValidConflicts:50}));}
 if(withRead){assert.equal(readSetupRequests.length,2);assert.equal(readRequests.length,5);for(const request of readRequests)assert.deepEqual(request,readRequests[0]);const replay=new Y.Doc(),expected=new Y.Doc();Y.applyUpdate(expected,Y.encodeStateAsUpdate(pageDoc));Y.applyUpdate(expected,Y.encodeStateAsUpdate(localDoc));for(const update of JSON.parse(fs.readFileSync(path.join(temp,'read-result.json'),'utf8')))Y.applyUpdate(replay,Uint8Array.from(update));assert.equal(replay.getText('fixture').toString(),expected.getText('fixture').toString());assert.deepEqual(Y.encodeStateVector(replay),Y.encodeStateVector(expected));replay.destroy();expected.destroy();console.log(JSON.stringify({nativePageRead:'Pass',wrongScopeAndDigestRefused:true,lostReadResponseRetriedExplicitly:true,httpReadRequests:5,localPending:1,bodyAndVectorEqual:true}));}
 if(withCatalog){assert.equal(catalogRequests.length,4);assert.equal(JSON.parse(catalogRequests[0].body).cursor,null);assert.deepEqual(catalogRequests[0],catalogRequests[1]);assert.deepEqual(catalogRequests[2],catalogRequests[3]);assert.ok(JSON.parse(catalogRequests[2].body).cursor);console.log(JSON.stringify({nativePageCatalog:'Pass',seededPages:21,pageSize:20,wrongEpochRefused:true,lostResponseSameCursorRetry:true,queryDidNotReceiveBody:true}));}
 if(withOffline){assert.equal(offlineRequests.length,4);const replay=new Y.Doc(),expected=new Y.Doc();Y.applyUpdate(expected,Uint8Array.from(pageFrames[0]));Y.applyUpdate(expected,Uint8Array.from(localFrames[0]));for(const bytes of JSON.parse(fs.readFileSync(path.join(temp,'offline-result.json'),'utf8')))Y.applyUpdate(replay,Uint8Array.from(bytes));assert.equal(replay.getText('fixture').toString(),expected.getText('fixture').toString());assert.deepEqual(Y.encodeStateVector(replay),Y.encodeStateVector(expected));replay.destroy();expected.destroy();console.log(JSON.stringify({nativeOfflineResume:'Pass',sameSignedContext:true,offlinePending:2,originalWirePreserved:true,bodyAndVectorEqual:true,remoteOperationRefused:true}));console.log(JSON.stringify({nativeOfflinePreparation:'Pass',httpRequests:4,freshNativeChallenges:true,lostResponseNotAdopted:true,statusCheckWithoutHttp:true,reauthInvalidatesLease:true}));}
 console.log(JSON.stringify({result:'Pass',fixtureOnly:true,actualTls:true,actualApiSignedVerification:true,jwks:'public fixture transport',redirectTrapRequests:trap,untrustedTlsSent:false,registration,counts},null,2));exit=0;
}finally{
 provider.closeAllConnections();proxy.closeAllConnections();await Promise.all([new Promise(r=>provider.close(r)),new Promise(r=>proxy.close(r)),privateApp?.close()]);
 if(pool){await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await pool.end();}
 fs.rmSync(temp,{recursive:true,force:true});
 pageDoc.destroy();
 localDoc.destroy();
}
process.exitCode=exit;
