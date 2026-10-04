import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
assert.equal(process.platform,'win32','This test must run on the Windows host');
const root=path.resolve(process.argv[4]??('.data/native-store-'+Date.now()));assert(!fs.existsSync(root),'Refusing existing native fixture root');fs.mkdirSync(root,{recursive:true});
assert(process.argv[2],'Pass the Docker-cross-built diagnostic store-driver.exe');
const executable=path.resolve(process.argv[2]),fixture=JSON.parse(fs.readFileSync(process.argv[3]??'tests/native/windows-store-fixture.json'));
const pageId='01a10510-0000-7000-8000-000000000001',clientId='01a10510-0000-7000-8000-000000000002',taskId='01a10510-0000-7000-8000-000000000003';
const operation=(suffix,entityType,entityId,kind,payload)=>({operationId:`01a10510-0000-7000-8000-${String(suffix).padStart(12,'0')}`,clientId,entityType,entityId,kind,payload,baseVersion:kind==='create'?null:0});
function driver(directory){
 const pending=new Map();let sequence=0;const errors=[];
 const child=spawn(executable,[path.join(directory,'greiva.sqlite')],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,GREIVA_CRASH_BARRIER_ROOT:path.join(directory,'barrier')}});
 child.stderr.on('data',bytes=>errors.push(bytes.toString()));
 createInterface({input:child.stdout}).on('line',line=>{const value=JSON.parse(line),item=pending.get(value.id);assert(item,'Unknown driver response');pending.delete(value.id);value.error?item.reject(Error(value.error)):item.resolve(value.value);});
 const exited=new Promise(resolve=>child.once('exit',(code,signal)=>{for(const item of pending.values())item.reject(Error('Owned driver exited'));pending.clear();resolve({code,signal,pid:child.pid,stderr:errors.join('')});}));
 return {child,exited,rpc:(command,fields={})=>{const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({id,command,...fields})+'\n');});},stop:async()=>{assert(child.pid);child.kill('SIGKILL');return exited;}};
}
function inspect(directory){
 const db=new DatabaseSync(path.join(directory,'greiva.sqlite'),{readOnly:true});assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name!='sqlite_sequence' ORDER BY name").all();
 const snapshot=Object.fromEntries(tables.map(({name})=>[name,db.prepare(`SELECT * FROM "${name}"`).all().map(row=>({...row}))]));db.close();
 for(const row of snapshot.page_updates)assert.equal(createHash('sha256').update(row.update_bytes).digest('hex'),Buffer.from(row.digest).toString('hex'));
 return snapshot;
}
async function baseline(d){
 await d.rpc('load',{pageId});await d.rpc('append',{pageId,update:fixture.initial});await d.rpc('title',{pageId,title:'Native transaction fixture'});
 await d.rpc('structured-client-id',{candidate:clientId});
 await d.rpc('structured-mutate',{operation:operation(10,'task',taskId,'create',{title:'Native task',status:'todo',due:null})});
 await d.rpc('structured-mutate',{operation:operation(11,'task',taskId,'update',{status:'in_progress',due:'2028-02-29'})});
 await d.rpc('structured-mutate',{operation:operation(12,'relation','01a10510-0000-7000-8000-000000000004','create',{fromType:'page',fromId:pageId,toType:'task',toId:taskId})});
 const snapshot=await d.rpc('structured-snapshot');assert.equal(snapshot.operations.length,3);assert(snapshot.operations.every(o=>o.status==='pending'));return snapshot;
}
async function reached(directory,stage,pid){
 const start=Date.now();while(Date.now()-start<10000){
  try{const marker=JSON.parse(fs.readFileSync(path.join(directory,'barrier.reached')));assert.equal(marker.stage,stage);assert.equal(marker.pid,pid);return marker;}catch(error){if(fs.existsSync(path.join(directory,'barrier.reached'))&&error.code!=='ENOENT'&&!(error instanceof SyntaxError))throw error;}
  await new Promise(resolve=>setTimeout(resolve,20));
 }throw Error('Native barrier not reached: '+stage);
}
const results=[];
for(const name of ['page-precommit','pull-before-cursor','local-committed-stop','prepared-wire-stop']){
 const directory=path.join(root,name);fs.mkdirSync(directory);let d=driver(directory),stopRecord=null;
 try{
  const before=await baseline(d),diskBefore=inspect(directory);let staged=null,prepared=null;
  const now=new Date().toISOString();
  const remoteId='01a10510-0000-7000-8000-000000000005';
  const remote={operationId:'01a10510-0000-7000-8000-000000000020',clientId:'01a10510-0000-7000-8000-000000000006',entityId:remoteId,entityType:'task',serverOrder:'1',status:'acknowledged',conflicts:[],entity:{id:remoteId,title:'Remote fixture task',status:'done',due:null,version:1,createdAt:now,updatedAt:now,deletedAt:null}};
  const batch={operations:[remote],cursor:'native-cursor-1',headCursor:'native-cursor-1',hasMore:false,serverTime:now};
  if(name==='page-precommit'||name==='pull-before-cursor'){
   const stage=name==='page-precommit'?'page-append-before-commit':'structured-pull-before-cursor';fs.writeFileSync(path.join(directory,'barrier.armed'),stage);
   void d.rpc(name==='page-precommit'?'append':'structured-pull',name==='page-precommit'?{pageId,update:fixture.delta}:{baseCursor:null,batch}).catch(()=>{});
   staged=await reached(directory,stage,d.child.pid);assert.deepEqual(inspect(directory),diskBefore);
  }else if(name==='prepared-wire-stop'){prepared=await d.rpc('structured-prepare');assert.equal(prepared.operationId,before.operations[0].operationId);}
  stopRecord=await d.stop();
  const armed=path.join(directory,'barrier.armed');if(fs.existsSync(armed))fs.unlinkSync(armed);
  d=driver(directory);const recovered=await d.rpc('structured-snapshot');assert.deepEqual(recovered,before);
  assert.deepEqual((await d.rpc('load',{pageId})).updates,[fixture.initial]);
  let recoveredWire=null,after=null;
  if(name==='page-precommit'){await d.rpc('append',{pageId,update:fixture.delta});assert.deepEqual((await d.rpc('load',{pageId})).updates,[fixture.initial,fixture.delta]);}
  if(name==='pull-before-cursor'){
   await d.rpc('structured-pull',{baseCursor:null,batch});after=await d.rpc('structured-snapshot');assert.equal(after.tasks.length,2);assert.equal(after.state.cursor,batch.cursor);assert.equal(inspect(directory).sync_state[0].last_server_order,1);
   await d.rpc('structured-pull',{baseCursor:null,batch});assert.deepEqual(await d.rpc('structured-snapshot'),after);
  }
  if(name==='prepared-wire-stop'){recoveredWire=await d.rpc('structured-prepare');assert.deepEqual(recoveredWire,prepared);}
  const diskFinal=inspect(directory),page=await d.rpc('load',{pageId});
  results.push({name,result:'Pass',marker:staged,stopRecord,recoveredSnapshot:recovered,prepared,recoveredWire,after,pageUpdates:page.updates,pageUpdateCount:diskFinal.page_updates.length,integrity:'ok',allDigestsValid:true});
 }finally{if(d.child.exitCode===null&&d.child.signalCode===null)await d.stop();}
}
const report={at:new Date().toISOString(),hostPlatform:process.platform,hostNode:process.version,driverSha256:createHash('sha256').update(fs.readFileSync(executable)).digest('hex'),results,scope:'Windows diagnostic actual Rust/SQLite repository. Two precommit transaction barriers plus committed/persisted-wire termination. Controlled pull result is a fixture; no actual API/network/UI/MS IME or normal Tauri fault injection claim.'};
fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({platform:report.hostPlatform,cases:results.map(({name,result})=>({name,result}))}));
