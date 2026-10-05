import { it, expect } from 'vitest';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import pg from 'pg';
import * as Y from 'yjs';
import { emptyPageUpdate } from '@greiva/sync';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { newId } from '@greiva/shared';
import { privateRuntimeConfiguration, startPrivateApi } from '../../apps/api/src/private-runtime.js';
import { installPrivateWorkspaceSchema } from '../../apps/api/src/private-workspace-schema.js';

async function freePort() {
  const server = createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No fixture port');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); return address.port;
}
function command(file: string, env: NodeJS.ProcessEnv, args: string[] = []) {
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [file,...args], { env, stdio: ['ignore', 'pipe', 'pipe'] }); let output = '';
    child.stdout.on('data', data => { output += String(data); }); child.stderr.on('data', data => { output += String(data); });
    child.on('error', reject); child.on('exit', code => resolve({ code, output }));
  });
}
const test = it.skipIf(process.env.GREIVA_TEST_POSTGRES !== '1');
test('PRIVATE-RUNTIME-PG: signed session/bootstrap uses actual startup/read-only schema; old aliases absent and close coalesced', async () => {
  const schema = 'greiva_private_runtime_' + newId().replaceAll('-', ''), pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const projectUrl = 'https://project.fixture.invalid', keys = await generateKeyPair('ES256'), jwk = { ...await exportJWK(keys.publicKey), kid: 'fixture', alg: 'ES256' };
  let runtime: Awaited<ReturnType<typeof startPrivateApi>> | undefined;
  try {
    await installPrivateWorkspaceSchema(pool, schema);
    const configuration = privateRuntimeConfiguration({ DATABASE_URL: process.env.DATABASE_URL, GREIVA_PRIVATE_SCHEMA: schema,
      GREIVA_SUPABASE_URL: projectUrl, GREIVA_SUPABASE_ALGORITHM: 'ES256', GREIVA_PRIVATE_PORT: String(await freePort()) });
    runtime = await startPrivateApi(configuration, { fetchJwks: async () => new Response(JSON.stringify({ keys: [jwk] })) });
    const token = await new SignJWT({ sub: 'owner-runtime', iss: projectUrl + '/auth/v1', aud: 'authenticated', exp: Math.floor(Date.now()/1000)+300 })
      .setProtectedHeader({ alg: 'ES256', kid: 'fixture' }).sign(keys.privateKey);
    expect((await fetch(runtime.address + '/v1/session')).status).toBe(401);
    const session = await fetch(runtime.address + '/v1/session', { headers: { authorization: 'Bearer ' + token } }); expect(session.status).toBe(200);
    const clientId = newId(), bootstrap = () => fetch(runtime!.address + '/v1/workspaces/bootstrap', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ clientId }) });
    const first = await bootstrap(); expect(first.status).toBe(200); const context = await first.json(); expect(await (await bootstrap()).json()).toEqual(context);
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_workspaces`)).rows[0].n).toBe(1);
    for (const path of ['/tasks', '/sync/pull', '/pages', '/health']) expect((await fetch(runtime.address + path)).status).toBe(404);
    const a = runtime.close(), b = runtime.close(); expect(a).toBe(b); await a; await expect(fetch(runtime.address + '/v1/session')).rejects.toThrow();
  } finally { await runtime?.close(); await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end(); }
});
test('PRIVATE-RUNTIME-PG: CLI initializer is explicit/non-destructive; missing or unknown schema prevents listening without credentials in output', async () => {
  const schema = 'greiva_private_cli_' + newId().replaceAll('-', ''), pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const env = { ...process.env, GREIVA_PRIVATE_SCHEMA: schema, GREIVA_SUPABASE_URL: 'https://project.fixture.invalid', GREIVA_SUPABASE_ALGORITHM: 'ES256', GREIVA_PRIVATE_PORT: String(await freePort()) };
  try {
    const absent = await command('apps/api/dist/private-main.js', env); expect(absent).toEqual({ code: 1, output: '{"service":"private-api","event":"failed","stage":"schema"}\n' });
    expect((await pool.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema])).rowCount).toBe(0);
    const created = await command('apps/api/dist/init-private.js', env); expect(created).toEqual({ code: 0, output: '{"service":"private-api","event":"schema_created"}\n' });
    const repeated = await command('apps/api/dist/init-private.js', env); expect(repeated).toEqual({ code: 1, output: '{"service":"private-api","event":"schema_install_failed"}\n' });
    expect((await pool.query(`SELECT version FROM "${schema}".private_schema_version`)).rows[0].version).toBe(1);
    await pool.query(`UPDATE "${schema}".private_schema_version SET version=999`);
    expect(await command('apps/api/dist/private-main.js', env)).toEqual(absent);
    expect((await pool.query(`SELECT version FROM "${schema}".private_schema_version`)).rows[0].version).toBe(999);
    await pool.query(`UPDATE "${schema}".private_schema_version SET version=1`);
    await pool.query(`DROP VIEW "${schema}".resource_access`);
    expect(await command('apps/api/dist/private-main.js', env)).toEqual(absent);
    const bad = await command('apps/api/dist/private-main.js', { ...env, GREIVA_SUPABASE_URL: 'https://fixture-secret@project.invalid' });
    expect(bad).toEqual({ code: 1, output: '{"service":"private-api","event":"failed","stage":"configuration"}\n' });
  } finally { await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end(); }
});
test('PRIVATE-RUNTIME-PG: actual process listens without legacy routes and SIGTERM closes listener/pool without schema mutation', async () => {
  const schema = 'greiva_private_signal_' + newId().replaceAll('-', ''), pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }), port = await freePort();
  let child: ReturnType<typeof spawn> | undefined;
  try {
    await installPrivateWorkspaceSchema(pool, schema);
    child = spawn(process.execPath, ['apps/api/dist/private-main.js'], { env: { ...process.env, GREIVA_PRIVATE_SCHEMA: schema,
      GREIVA_SUPABASE_URL: 'https://project.fixture.invalid', GREIVA_SUPABASE_ALGORITHM: 'ES256', GREIVA_PRIVATE_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      child!.once('error', reject); child!.once('exit', (code, signal) => resolve({ code, signal }));
    });
    const line = await Promise.race([new Promise<string>(resolve => child!.stdout!.once('data', data => resolve(String(data)))), exited.then(() => { throw new Error('Startup exited'); })]);
    expect(JSON.parse(line)).toEqual({ service: 'private-api', event: 'listening', address: `http://127.0.0.1:${port}` });
    expect((await fetch(`http://127.0.0.1:${port}/v1/session`)).status).toBe(401);
    child.kill('SIGTERM'); expect(await exited).toEqual({ code: 0, signal: null });
    await expect(fetch(`http://127.0.0.1:${port}/v1/session`)).rejects.toThrow();
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_workspaces`)).rows[0].n).toBe(0);
  } finally { if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end(); }
});
test('PRIVATE-RUNTIME-SYNC-PG: explicit CLI upgrade mounts signed private sync; restart preserves cursor and refuses missing key without repair',async()=>{
  const schema='greiva_private_'+newId().replaceAll('-',''),pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),projectUrl='https://project.fixture.invalid',issuer=projectUrl+'/auth/v1',keys=await generateKeyPair('ES256'),jwk={...await exportJWK(keys.publicKey),kid:'fixture',alg:'ES256'};
  let runtime:Awaited<ReturnType<typeof startPrivateApi>>|undefined;
  try{
    await installPrivateWorkspaceSchema(pool,schema);
    const env={...process.env,GREIVA_PRIVATE_SCHEMA:schema,GREIVA_SUPABASE_URL:projectUrl,GREIVA_SUPABASE_ALGORITHM:'ES256',GREIVA_PRIVATE_PORT:String(await freePort())};
    expect(await command('apps/api/dist/init-private.js',env,['--structured'])).toEqual({code:0,output:'{"service":"private-api","event":"structured_schema_installed"}\n'});
    expect(await command('apps/api/dist/init-private.js',env,['--structured'])).toEqual({code:1,output:'{"service":"private-api","event":"schema_install_failed"}\n'});
    const config=privateRuntimeConfiguration(env),options={fetchJwks:async()=>new Response(JSON.stringify({keys:[jwk]}))};runtime=await startPrivateApi(config,options);
    const token=await new SignJWT({sub:'owner-runtime',iss:issuer,aud:'authenticated',exp:Math.floor(Date.now()/1000)+300}).setProtectedHeader({alg:'ES256',kid:'fixture'}).sign(keys.privateKey),clientId=newId();
    const post=(path:string,body:unknown,bearer=token)=>fetch(runtime!.address+path,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:'Bearer '+bearer}:{})},body:JSON.stringify(body)});
    const registration=await post('/v1/workspaces/bootstrap',{clientId});expect(registration.status).toBe(200);const binding=await registration.json(),path=`/v1/workspaces/${binding.workspaceId}/sync`,operation={operationId:newId(),clientId,entityType:'task',entityId:newId(),kind:'create',baseVersion:null,payload:{title:'private HTTP',status:'todo',due:null}},push={protocolVersion:1,workspaceId:binding.workspaceId,clientId,operations:[operation]},pull={protocolVersion:1,workspaceId:binding.workspaceId,clientId,cursor:null};
    expect((await post(path+'/pull',pull,'')).status).toBe(401);const first=await post(path+'/push',push);expect(first.status).toBe(200);const result=await first.json();expect(await (await post(path+'/push',push)).json()).toEqual(result);
    const changed=await post(path+'/push',{...push,operations:[{...operation,payload:{...operation.payload,title:'reused'}}]});expect(changed.status).toBe(409);expect(await changed.json()).toEqual({error:'operation_id_reused'});
    const invalid=await post(path+'/pull',{...pull,cursor:'g1.old.cursor'});expect(invalid.status).toBe(400);expect(await invalid.json()).toEqual({error:'invalid_cursor'});
    const page=await post(path+'/pull',pull);expect(page.status).toBe(200);const response=await page.json();expect(response.operations).toEqual(result.results);
    expect((await fetch(runtime.address+'/sync/pull')).status).toBe(404);
    await runtime.close();runtime=await startPrivateApi(config,options);const resumed=await post(path+'/pull',{...pull,cursor:response.cursor});expect(resumed.status).toBe(200);expect(await resumed.json()).toMatchObject({operations:[],cursor:response.cursor,headCursor:response.headCursor,streamEpoch:binding.epoch});
    await runtime.close();runtime=undefined;await pool.query(`DELETE FROM "${schema}".private_structured_config`);await expect(startPrivateApi(config,options)).rejects.toMatchObject({stage:'schema'});expect((await pool.query(`SELECT version FROM "${schema}".private_schema_version`)).rows[0].version).toBe(2);expect((await pool.query(`SELECT secret FROM "${schema}".private_structured_config`)).rowCount).toBe(0);
  }finally{await runtime?.close();try{await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);}finally{await pool.end();}}
});

test('PRIVATE-RUNTIME-PAGE-PG: explicit schema3 CLI exposes signed binary routes, preserves structured stream and restores after restart',async()=>{
  const schema='greiva_private_'+newId().replaceAll('-',''),pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),projectUrl='https://project.fixture.invalid',keys=await generateKeyPair('ES256'),jwk={...await exportJWK(keys.publicKey),kid:'fixture',alg:'ES256'},doc=new Y.Doc({gc:false}),peer=new Y.Doc({gc:false});
  let runtime:Awaited<ReturnType<typeof startPrivateApi>>|undefined;
  try{
    await installPrivateWorkspaceSchema(pool,schema);
    const env={...process.env,GREIVA_PRIVATE_SCHEMA:schema,GREIVA_SUPABASE_URL:projectUrl,GREIVA_SUPABASE_ALGORITHM:'ES256',GREIVA_PRIVATE_PORT:String(await freePort())};
    expect(await command('apps/api/dist/init-private.js',env,['--pages'])).toEqual({code:1,output:'{"service":"private-api","event":"schema_install_failed"}\n'});
    expect(await command('apps/api/dist/init-private.js',env,['--structured'])).toMatchObject({code:0});
    const config=privateRuntimeConfiguration(env),options={fetchJwks:async()=>new Response(JSON.stringify({keys:[jwk]}))};runtime=await startPrivateApi(config,options);
    const token=await new SignJWT({sub:'page-owner',iss:projectUrl+'/auth/v1',aud:'authenticated',exp:Math.floor(Date.now()/1000)+300}).setProtectedHeader({alg:'ES256',kid:'fixture'}).sign(keys.privateKey),clientId=newId(),id=newId();
    const post=(path:string,body:unknown,bearer=token)=>fetch(runtime!.address+path,{method:'POST',headers:{'content-type':'application/json',...(bearer?{authorization:'Bearer '+bearer}:{})},body:JSON.stringify(body)});
    const binding=await (await post('/v1/workspaces/bootstrap',{clientId})).json(),path='/v1/workspaces/'+binding.workspaceId+'/pages/'+id+'/document';
    expect((await post(path+'/read',{})).status).toBe(404);await runtime.close();runtime=undefined;
    expect(await command('apps/api/dist/init-private.js',env,['--pages'])).toEqual({code:0,output:'{"service":"private-api","event":"page_schema_installed"}\n'});
    expect(await command('apps/api/dist/init-private.js',env,['--pages'])).toMatchObject({code:1});runtime=await startPrivateApi(config,options);
    Y.applyUpdate(doc,emptyPageUpdate());const text=new Y.XmlText('日本語');(doc.getXmlFragment('body').get(0) as Y.XmlElement).insert(0,[text]);
    const request={protocolVersion:1,clientId,editorSchemaVersion:1,title:'private Page',initialUpdate:Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64url')};
    expect((await post(path+'/bootstrap',request,'')).status).toBe(401);const first=await post(path+'/bootstrap',request);expect(first.status).toBe(200);const creation=await first.json();expect(await (await post(path+'/bootstrap',request)).json()).toEqual(creation);
    const changed=await post(path+'/bootstrap',{...request,title:'changed'});expect(changed.status).toBe(409);expect(await changed.json()).toEqual({error:'page_id_reused'});
    let update:Uint8Array|undefined;doc.on('update',value=>{update=value;});text.insert(text.length,' remote');const append={protocolVersion:1,clientId,editorSchemaVersion:1,update:Buffer.from(update!).toString('base64url')};
    const written=await post(path+'/append',append);expect(written.status).toBe(200);const receipt=await written.json();expect(receipt).toMatchObject({serverOrder:'2',headOrder:'2'});expect(await (await post(path+'/append',append)).json()).toEqual(receipt);
    const invalid=await post(path+'/append',{...append,update:'_w'});expect(invalid.status).toBe(400);expect(await invalid.json()).toEqual({error:'invalid_document_update'});
    const unknown=await post(path+'/read',{protocolVersion:1,clientId,editorSchemaVersion:2,stateVector:'AA'});expect(unknown.status).toBe(409);
    const foreign=await new SignJWT({sub:'foreign',iss:projectUrl+'/auth/v1',aud:'authenticated',exp:Math.floor(Date.now()/1000)+300}).setProtectedHeader({alg:'ES256',kid:'fixture'}).sign(keys.privateKey);const denied=await post(path+'/read',{protocolVersion:1,clientId,editorSchemaVersion:1,stateVector:'AA'},foreign);expect(denied.status).toBe(403);expect(await denied.json()).toEqual({error:'access_denied'});
    const structured=await post('/v1/workspaces/'+binding.workspaceId+'/sync/pull',{protocolVersion:1,workspaceId:binding.workspaceId,clientId,cursor:null});expect(structured.status).toBe(200);expect(await structured.json()).toMatchObject({operations:[],streamEpoch:binding.epoch});
    for(const alias of ['/pages','/sync/pull','/health'])expect((await fetch(runtime.address+alias)).status).toBe(404);
    await runtime.close();runtime=await startPrivateApi(config,options);const restored=await post(path+'/read',{protocolVersion:1,clientId,editorSchemaVersion:1,stateVector:'AA'});expect(restored.status).toBe(200);const response=await restored.json();Y.applyUpdate(peer,Buffer.from(response.update,'base64url'));expect(peer.getXmlFragment('body').toString()).toBe(doc.getXmlFragment('body').toString());expect(response.headOrder).toBe('2');
    await pool.query('UPDATE "'+schema+'".private_devices SET revoked=true WHERE id=$1',[clientId]);expect((await post(path+'/read',{protocolVersion:1,clientId,editorSchemaVersion:1,stateVector:'AA'})).status).toBe(403);expect((await post(path+'/append',append)).status).toBe(403);
    await runtime.close();runtime=undefined;await pool.query('DROP TABLE "'+schema+'".private_page_updates');await expect(startPrivateApi(config,options)).rejects.toMatchObject({stage:'schema'});expect((await pool.query('SELECT version FROM "'+schema+'".private_schema_version')).rows[0].version).toBe(3);
  }finally{doc.destroy();peer.destroy();await runtime?.close();try{await pool.query('DROP SCHEMA IF EXISTS "'+schema+'" CASCADE');}finally{await pool.end();}}
});
