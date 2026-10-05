import { it,expect } from 'vitest';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { newId } from '@greiva/shared';
import { installPrivateWorkspaceSchema } from '../../apps/api/src/private-workspace-schema.js';
import { installPrivateStructuredSchema } from '../../apps/api/src/private-structured-schema.js';
import { PostgresPrivateBootstrapStore } from '../../apps/api/src/private-bootstrap-store.js';
import { PostgresPrivateStructuredStore } from '../../apps/api/src/private-structured-store.js';

it.skipIf(process.env.GREIVA_TEST_POSTGRES!=='1').each(['before-commit','after-commit'] as const)('PRIVATE-STREAM-SIGKILL-%s: actual worker termination recovers the same operation once with durable key/epoch',async boundary=>{
  const pool=new pg.Pool({connectionString:process.env.DATABASE_URL}),schema='greiva_private_'+newId().replaceAll('-',''),owner={issuer:'https://auth.fixture.invalid/auth/v1',subjectId:'owner',expiresAt:Math.floor(Date.now()/1000)+300};let child:ReturnType<typeof spawn>|undefined;
  try{
    await installPrivateWorkspaceSchema(pool,schema);await installPrivateStructuredSchema(pool,schema);const binding=await new PostgresPrivateBootstrapStore(pool,schema).bootstrap(owner,{clientId:newId()});
    const operation={operationId:newId(),clientId:binding.clientId,entityType:'task',entityId:newId(),kind:'create',baseVersion:null,payload:{title:'server crash',status:'todo',due:null}},request={protocolVersion:1,workspaceId:binding.workspaceId,clientId:binding.clientId,operations:[operation]},wire=JSON.stringify(request);
    const secret=(await pool.query(`SELECT secret FROM "${schema}".private_structured_config`)).rows[0].secret;
    child=spawn(process.execPath,['tests/fixtures/private-stream-crash.mjs',schema,boundary,wire],{env:process.env,stdio:['ignore','ignore','pipe','ipc']});child.stderr!.on('data',()=>{/* no environment/cause into test report */});
    const exited=new Promise<NodeJS.Signals|null>((resolve,reject)=>{child!.once('exit',(_code,signal)=>resolve(signal));child!.once('error',reject);});
    await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Private crash boundary timeout')),7000);child!.once('message',message=>{clearTimeout(timer);if((message as {event?:string,boundary?:string}).event==='boundary' && (message as {boundary?:string}).boundary===boundary)resolve();else reject(new Error('Private crash worker failed'));});void exited.then(()=>{clearTimeout(timer);reject(new Error('Worker exited before boundary'));});});
    child.kill('SIGKILL');expect(await exited).toBe('SIGKILL');
    await expect.poll(async()=>(await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_structured_operations`)).rows[0].n).toBe(boundary==='before-commit'?0:1);
    const recovered=new PostgresPrivateStructuredStore(pool,schema),first=await recovered.push(owner,binding.workspaceId,JSON.parse(wire));expect(await recovered.push(owner,binding.workspaceId,JSON.parse(wire))).toEqual(first);
    const response=await recovered.pull(owner,binding.workspaceId,{protocolVersion:1,workspaceId:binding.workspaceId,clientId:binding.clientId,cursor:null});expect(response.operations.map(row=>row.operationId)).toEqual([operation.operationId]);expect(response.operations[0]?.serverOrder).toBe('1');expect(response.streamEpoch).toBe(binding.epoch);
    expect((await pool.query(`SELECT secret FROM "${schema}".private_structured_config`)).rows[0].secret).toEqual(secret);
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_structured_history`)).rows[0].n).toBe(1);
  }finally{if(child && child.exitCode===null && child.signalCode===null){const exit=new Promise(done=>child!.once('exit',done));child.kill('SIGKILL');await exit;}try{await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);}finally{await pool.end();}}
});
