import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {DatabaseSync,backup} from 'node:sqlite';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
import {emptyPageUpdate} from '../packages/sync/dist/index.js';
import {newId} from '../packages/shared/dist/index.js';
assert(fs.existsSync('/.dockerenv'),'Create this synthetic fixture in Docker');
const directory=path.resolve(process.argv[2]??'/tmp/windows-profile-seed');
assert(!fs.existsSync(directory),'Refusing existing fixture directory');fs.mkdirSync(directory,{recursive:true});
const pageId='01a10530-0000-7000-8000-000000000001',clientId=newId();
const executable=path.resolve(process.env.GREIVA_STORE_DRIVER??'.data/native-target/debug/examples/store-driver');
const child=spawn(executable,[path.join(directory,'greiva.sqlite')],{stdio:['pipe','pipe','pipe']});
const pending=new Map();let sequence=0,stderr='';
child.stderr.on('data',bytes=>stderr+=bytes.toString());
child.on('error',error=>{for(const item of pending.values())item.reject(error);pending.clear();});
const exited=new Promise(resolve=>child.once('exit',(code,signal)=>{for(const item of pending.values())item.reject(Error('Fixture driver exited: '+stderr));pending.clear();resolve({code,signal});}));
createInterface({input:child.stdout}).on('line',line=>{const result=JSON.parse(line),item=pending.get(result.id);assert(item);pending.delete(result.id);result.error?item.reject(Error(result.error)):item.resolve(result.value);});
function rpc(command,fields={}){const id=++sequence;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({id,command,...fields})+'\n');});}
const doc=new Y.Doc();
try{
 Y.applyUpdate(doc,emptyPageUpdate());const body=doc.getXmlFragment('body');body.delete(0,body.length);
 await rpc('load',{pageId});await rpc('append',{pageId,update:Array.from(Y.encodeStateAsUpdate(doc))});
 let update;doc.on('update',bytes=>update=bytes);
 for(let index=0;index<1000;index++){
  const paragraph=new Y.XmlElement('paragraph'),text=new Y.XmlText();text.insert(0,`Block ${String(index).padStart(4,'0')} — synthetic saved content ${index}`);paragraph.insert(0,[text]);body.push([paragraph]);
  await rpc('append',{pageId,update:Array.from(update)});
 }
 await rpc('title',{pageId,title:'WIN625-PROFILE'});await rpc('structured-client-id',{candidate:clientId});
 for(let index=0;index<250;index++)await rpc('structured-mutate',{operation:{operationId:newId(),clientId,entityId:newId(),entityType:'task',kind:'create',payload:{title:`Profile Task ${index}`,status:'todo',due:null},baseVersion:null}});
 const reader=new DatabaseSync(path.join(directory,'greiva.sqlite'),{readOnly:true});await backup(reader,path.join(directory,'complete.sqlite'));reader.close();
 const db=new DatabaseSync(path.join(directory,'complete.sqlite'),{readOnly:true});assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 const tables=Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(({name})=>[name,db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]));db.close();
 assert.equal(tables.page_updates.length,1001);assert.equal(tables.tasks.length,250);assert.equal(tables.sync_operations.length,250);
 fs.writeFileSync(path.join(directory,'tables.json'),JSON.stringify(tables)+'\n');
 fs.writeFileSync(path.join(directory,'fixture.json'),JSON.stringify({pageId,blocks:1000,updates:1001,tasks:250,pending:250,xmlSha256:createHash('sha256').update(body.toString()).digest('hex'),clocks:Array.from(Y.decodeStateVector(Y.encodeStateVector(doc))).sort(([a],[b])=>a-b),completeSqliteSha256:createHash('sha256').update(fs.readFileSync(path.join(directory,'complete.sqlite'))).digest('hex'),scope:'Synthetic fixture, online SQLite backup including all WAL updates; no user data'},null,2)+'\n');
 child.stdin.end();assert.equal((await exited).code,0);
 console.log('Complete synthetic fixture: 1000 blocks / 1001 updates / 250 pending Tasks');
}finally{
 doc.destroy();if(child.exitCode===null&&child.signalCode===null){child.kill('SIGKILL');await exited;}
}
