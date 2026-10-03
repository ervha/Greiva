// Docker audit of stopped Windows DB copies; read-only originals and fresh peers.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {v7 as uuidv7} from '/workspace/node_modules/uuid/dist/index.js';
import {cpSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import * as Y from '/workspace/node_modules/yjs/dist/yjs.mjs';
import {HocuspocusProvider} from '/workspace/node_modules/@hocuspocus/provider/dist/hocuspocus-provider.esm.js';
import pg from '/workspace/node_modules/pg/lib/index.js';
import {StructuredDevice} from '/workspace/tests/support/structured-device.ts';
import {StructuredSyncEngine,httpStructuredTransport} from '/workspace/packages/sync/dist/index.js';
const output='/tmp/native-network-verification.json';
const baseline=JSON.parse(readFileSync('/tmp/native-network-baseline.json','utf8'));
function inspect(path) {
 const db=new DatabaseSync(path,{readOnly:true});
 try {
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  const pages=db.prepare("SELECT id,title FROM pages WHERE title IN ('WIN611-OPS','AUTO611-BLOCKS') ORDER BY title").all().map(page=>{
   const doc=new Y.Doc();const updates=[];
   for(const row of db.prepare('SELECT seq,update_bytes,digest FROM page_updates WHERE page_id=? ORDER BY seq').all(page.id)){
    const hash=createHash('sha256').update(row.update_bytes).digest('hex');assert.equal(hash,Buffer.from(row.digest).toString('hex'));Y.applyUpdate(doc,row.update_bytes);updates.push({seq:row.seq,sha256:hash});
   }
   const value={pageId:page.id,title:page.title,bodyXml:doc.getXmlFragment('body').toString(),clocks:Array.from(Y.decodeStateVector(Y.encodeStateVector(doc))).sort(([a],[b])=>a-b),updates};doc.destroy();return value;
  });
  return {integrity:'ok',pages,operations:db.prepare('SELECT * FROM sync_operations ORDER BY seq').all(),received:db.prepare('SELECT * FROM structured_received ORDER BY server_order').all(),state:db.prepare('SELECT * FROM sync_state').get()};
 } finally {db.close();}
}
const crash=inspect('/tmp/native-network-ack-copy/greiva.sqlite');
const final=inspect('/tmp/native-network-final-copy/greiva.sqlite');
assert.deepEqual(crash.operations.map(o=>o.status),['acknowledged','pending']);assert.equal(crash.received.length,1);assert.equal(crash.state.last_server_order,1);
assert.equal(crash.operations[1].local_result,null);assert.ok(crash.operations[1].prepared_wire);
assert.deepEqual(final.operations.map(o=>o.status),['acknowledged','acknowledged']);assert.equal(final.received.length,2);assert.equal(final.state.last_server_order,2);assert.equal(final.state.cursor,final.state.head_cursor);assert.ok(final.state.last_successful_sync_at);
for(const [i,op] of final.operations.entries())assert.equal(op.prepared_wire,crash.operations[i].prepared_wire);
assert.equal(final.pages.length,2);
for(const page of final.pages){const original=baseline.pages.find(p=>p.pageId===page.pageId);assert.equal(page.bodyXml,original.bodyXml);assert.deepEqual(page.clocks,[...original.clocks].sort(([a],[b])=>a-b));assert.deepEqual(page.updates.slice(0,original.updates.length),original.updates);}
mkdirSync('/tmp/native-network-rust-final',{recursive:true});cpSync('/tmp/native-network-final-copy','/tmp/native-network-rust-final',{recursive:true});
const commands=[{id:1,command:'structured-snapshot'},...final.pages.map((p,i)=>({id:i+2,command:'load',pageId:p.pageId}))];
const load=spawnSync('.data/native-target/debug/examples/store-driver',['/tmp/native-network-rust-final/greiva.sqlite'],{encoding:'utf8',input:commands.map(c=>JSON.stringify(c)).join('\n')+'\n'});assert.equal(load.status,0,load.stderr);
const replies=load.stdout.trim().split('\n').map(l=>JSON.parse(l));for(const reply of replies)assert.equal(reply.error,undefined);
const native=replies[0].value;assert.equal(native.operations.length,2);assert.ok(native.operations.every(o=>o.status==='acknowledged'));assert.deepEqual(native.conflicts,[]);assert.deepEqual(native.errors,[]);
for(const [i,page] of final.pages.entries()){const doc=new Y.Doc();for(const bytes of replies[i+1].value.updates)Y.applyUpdate(doc,Uint8Array.from(bytes));assert.equal(doc.getXmlFragment('body').toString(),page.bodyXml);assert.deepEqual(Array.from(Y.decodeStateVector(Y.encodeStateVector(doc))).sort(([a],[b])=>a-b),page.clocks);doc.destroy();}
async function until(predicate){const end=Date.now()+20000;while(!predicate()){if(Date.now()>end)throw new Error('Peer convergence timed out');await new Promise(done=>setTimeout(done,50));}}
const pagePeers=[];
for(const page of final.pages){
 const doc=new Y.Doc();const clientId=randomUUID();const provider=new HocuspocusProvider({url:`ws://greiva-native-network-0611:1234?clientId=${clientId}`,name:`page:${page.pageId}`,document:doc,WebSocketPolyfill:WebSocket});
 try{await until(()=>provider.isSynced&&provider.unsyncedChanges===0&&doc.getXmlFragment('body').toString().length>0);const bodyXml=doc.getXmlFragment('body').toString();const clocks=Array.from(Y.decodeStateVector(Y.encodeStateVector(doc))).sort(([a],[b])=>a-b);assert.equal(bodyXml,page.bodyXml);assert.deepEqual(clocks,page.clocks);pagePeers.push({pageId:page.pageId,clientId,bodyXml,clocks,acknowledged:true});}finally{provider.destroy();doc.destroy();}
}
const device=new StructuredDevice(`/tmp/native-network-peer-${randomUUID()}.sqlite`);await device.request('structured-client-id',{candidate:uuidv7()});let report;
const engine=new StructuredSyncEngine(device,httpStructuredTransport('http://greiva-native-network-0611:3000'),value=>{report=value;},{pollMs:10000});
let peer;
try{engine.start();await until(()=>report?.phase==='synced');engine.stop();peer=await device.snapshot();assert.notEqual(peer.clientId,native.clientId);assert.deepEqual(peer.tasks,native.tasks);assert.deepEqual(peer.relations,native.relations);assert.deepEqual(peer.conflicts,[]);assert.deepEqual(peer.errors,[]);assert.equal(peer.state.cursor,native.state.cursor);assert.equal(peer.state.headCursor,native.state.headCursor);assert.equal(peer.operations.length,0);}finally{engine.stop();await device.close();}
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});let ledger;
try{ledger=(await pool.query('SELECT server_order::text,operation_id,request,result FROM greiva_native_20261003_0611.server_operations ORDER BY server_order')).rows;assert.equal(ledger.length,2);assert.equal(new Set(ledger.map(r=>r.operation_id)).size,2);for(const [i,row] of ledger.entries()){assert.equal(row.operation_id,final.operations[i].operation_id);assert.deepEqual(row.result,JSON.parse(final.operations[i].local_result));assert.deepEqual(row.request,JSON.parse(final.operations[i].prepared_wire));}}finally{await pool.end();}
writeFileSync(output,JSON.stringify({verifiedAt:new Date().toISOString(),version:'0.6.11',scope:'Normal Windows Tauri ACK-in-flight Force stop, offline restart, reconnect. Docker independently audits stopped DB and observes fresh peers. No native transaction-hook or duplicate POST claim.',unchangedBodiesAndClocks:true,prefixUpdatesPreserved:true,rustRepositoryAgrees:true,crash,final,native,peer,pagePeers,ledger},null,2)+'\n');
console.log(JSON.stringify({integrity:'ok',pages:final.pages.map(p=>({title:p.title,updates:p.updates.length})),nativePending:0,received:2,serverOperations:ledger.length,independentStructuredPeerMatches:true,independentPagePeersMatch:true}));
