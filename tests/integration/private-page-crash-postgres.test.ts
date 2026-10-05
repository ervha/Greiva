import { it,expect } from 'vitest';
import { spawn } from 'node:child_process';
import pg from 'pg';
import * as Y from 'yjs';
import { newId } from '@greiva/shared';
import { emptyPageUpdate } from '@greiva/sync';
import { installPrivateWorkspaceSchema } from '../../apps/api/src/private-workspace-schema.js';
import { installPrivateStructuredSchema } from '../../apps/api/src/private-structured-schema.js';
import { installPrivatePageSchema } from '../../apps/api/src/private-page-schema.js';
import { PostgresPrivateBootstrapStore } from '../../apps/api/src/private-bootstrap-store.js';
import { PostgresPrivatePageStore } from '../../apps/api/src/private-page-store.js';

it.skipIf(process.env.GREIVA_TEST_POSTGRES!=='1').each(['before-commit','after-commit'] as const)('PRIVATE-PAGE-SIGKILL-%s: binary/head commit atomically and the same update is appended once after ACK loss',async boundary=>{
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),schema='greiva_private_'+newId().replaceAll('-',''),owner={issuer:'https://auth.fixture.invalid/auth/v1',subjectId:'owner',expiresAt:Math.floor(Date.now()/1000)+300},doc=new Y.Doc({gc:false});let child:ReturnType<typeof spawn>|undefined;
  try{
    await installPrivateWorkspaceSchema(pool,schema);await installPrivateStructuredSchema(pool,schema);await installPrivatePageSchema(pool,schema);const binding=await new PostgresPrivateBootstrapStore(pool,schema).bootstrap(owner,{clientId:newId()}),id=newId(),store=new PostgresPrivatePageStore(pool,schema);Y.applyUpdate(doc,emptyPageUpdate());
    await store.bootstrap(owner,binding.workspaceId,id,{protocolVersion:1,clientId:binding.clientId,editorSchemaVersion:1,title:'crash Page',initialUpdate:Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64url')});let update:Uint8Array|undefined;doc.on('update',value=>{update=value;});(doc.getXmlFragment('body').get(0) as Y.XmlElement).insert(0,[new Y.XmlText('停止後も保持')]);
    const body={protocolVersion:1,clientId:binding.clientId,editorSchemaVersion:1,update:Buffer.from(update!).toString('base64url')},wire=JSON.stringify({workspaceId:binding.workspaceId,pageId:id,body});
    child=spawn(process.execPath,['tests/fixtures/private-page-crash.mjs',schema,boundary,wire],{env:process.env,stdio:['ignore','ignore','pipe','ipc']});child.stderr!.on('data',()=>{/* no credential-bearing driver cause */});
    const exited=new Promise<NodeJS.Signals|null>((resolve,reject)=>{child!.once('exit',(_code,signal)=>resolve(signal));child!.once('error',reject);});await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Page crash boundary timeout')),7000);child!.once('message',message=>{clearTimeout(timer);if((message as {event?:string,boundary?:string}).event==='boundary' && (message as {boundary?:string}).boundary===boundary)resolve();else reject(new Error('Page worker failed'));});void exited.then(()=>{clearTimeout(timer);reject(new Error('Worker exited before boundary'));});});child.kill('SIGKILL');expect(await exited).toBe('SIGKILL');
    await expect.poll(async()=>(await pool.query(`SELECT head_order FROM "${schema}".private_page_documents WHERE page_id=$1`,[id])).rows[0].head_order).toBe(boundary==='before-commit'?'1':'2');
    const recovered=new PostgresPrivatePageStore(pool,schema),receipt=await recovered.append(owner,binding.workspaceId,id,body);expect(receipt.serverOrder).toBe('2');expect(await recovered.append(owner,binding.workspaceId,id,body)).toEqual(receipt);expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_page_updates`)).rows[0].n).toBe(2);
    const result=await recovered.read(owner,binding.workspaceId,id,{protocolVersion:1,clientId:binding.clientId,editorSchemaVersion:1,stateVector:'AA'}),peer=new Y.Doc({gc:false});try{Y.applyUpdate(peer,Buffer.from(result.update,'base64url'));expect(peer.getXmlFragment('body').toString()).toBe(doc.getXmlFragment('body').toString());expect(Buffer.from(Y.encodeStateVector(peer)).toString('base64url')).toBe(result.stateVector);}finally{peer.destroy();}
  }finally{if(child && child.exitCode===null && child.signalCode===null){const exit=new Promise(done=>child!.once('exit',done));child.kill('SIGKILL');await exit;}doc.destroy();try{await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);}finally{await pool.end();}}
});
