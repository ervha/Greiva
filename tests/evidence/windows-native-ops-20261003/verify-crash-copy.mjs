import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import * as Y from '/workspace/node_modules/yjs/dist/yjs.mjs';
const dbPath='/tmp/native611-after-crash/greiva.sqlite';
const db=new DatabaseSync(dbPath,{readOnly:true});const pages=[];
try{
 assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 for(const page of db.prepare("SELECT id,title FROM pages WHERE title IN ('WIN611-OPS','AUTO611-BLOCKS') ORDER BY title").all()){
  const doc=new Y.Doc();const hashes=[];
  for(const row of db.prepare('SELECT seq,update_bytes,digest FROM page_updates WHERE page_id=? ORDER BY seq').all(page.id)){
   const digest=createHash('sha256').update(row.update_bytes).digest('hex');assert.equal(digest,Buffer.from(row.digest).toString('hex'));
   Y.applyUpdate(doc,row.update_bytes);hashes.push({seq:row.seq,sha256:digest});
  }
  pages.push({pageId:page.id,title:page.title,bodyXml:doc.getXmlFragment('body').toString(),clocks:Array.from(Y.decodeStateVector(Y.encodeStateVector(doc))),updates:hashes});doc.destroy();
 }
}finally{db.close();}
assert.equal(pages.length,2);
const manual=JSON.parse(readFileSync('/tmp/native611-manual-inspection.json','utf8')).pages[0];
const restoredManual=pages.find(p=>p.title==='WIN611-OPS');assert.equal(restoredManual.bodyXml,manual.bodyXml);assert.deepEqual(restoredManual.clocks,manual.clocks);assert.deepEqual(restoredManual.updates,manual.history.map(r=>({seq:r.seq,sha256:r.sha256})));
const auto=pages.find(p=>p.title==='AUTO611-BLOCKS');
// Preserve the exact observed XML below; semantic checks also detect lost blocks/text.
for(const text of ['anchor','bullet item','ordered item','quote text','const n = 1;','サンプルPage'])assert.ok(auto.bodyXml.includes(text),text);
for(const tag of ['bulletlist','orderedlist','blockquote','codeblock','mention','horizontalrule'])assert.ok(auto.bodyXml.includes(`<${tag}`),tag);
assert.ok(auto.bodyXml.indexOf('<mention')<auto.bodyXml.indexOf('<horizontalrule'),'Redo retained movement');
const requests=[{id:1,command:'structured-snapshot'},...pages.map((p,i)=>({id:i+2,command:'load',pageId:p.pageId}))];
const run=spawnSync('.data/native-target/debug/examples/store-driver',['/tmp/native611-driver-copy/greiva.sqlite'],{input:requests.map(r=>JSON.stringify(r)).join('\n')+'\n',encoding:'utf8'});assert.equal(run.status,0);
const replies=run.stdout.trim().split('\n').map(line=>JSON.parse(line));assert.equal(replies.length,requests.length);for(const r of replies)assert.equal(r.error,undefined);
const snapshot=replies[0].value;assert.equal(snapshot.tasks.length,1);assert.equal(snapshot.tasks[0].title,'AUTO611-TASK');assert.equal(snapshot.relations.length,1);assert.equal(snapshot.operations.length,2);assert.ok(snapshot.operations.every(o=>o.status==='pending'));
const relation=snapshot.relations[0];assert.equal(relation.fromId,auto.pageId);assert.equal(relation.toId,snapshot.tasks[0].id);
for(const [i,page] of pages.entries()){
 const load=replies[i+1].value;assert.equal(load.metadata.title,page.title);const doc=new Y.Doc();for(const bytes of load.updates)Y.applyUpdate(doc,Uint8Array.from(bytes));assert.equal(doc.getXmlFragment('body').toString(),page.bodyXml);assert.deepEqual(Array.from(Y.decodeStateVector(Y.encodeStateVector(doc))),page.clocks);doc.destroy();
}
writeFileSync('/tmp/native611-crash-verification.json',JSON.stringify({verifiedAt:new Date().toISOString(),integrity:'ok',allUpdateDigestsVerified:true,manualFixtureUnchanged:true,rustRepositoryLoadMatchesSqliteReplay:true,pages,structuredSnapshot:snapshot,scope:'Actual Windows native UI + Force stop followed by Docker audit of stopped DB copy using actual Rust repository. One offline after-local-commit boundary only; no server reconnect, in-flight ACK or native release performance claim.'},null,2)+'\n');
console.log(JSON.stringify({pages:pages.map(p=>({title:p.title,bodyXml:p.bodyXml,updates:p.updates.length})),tasks:snapshot.tasks.length,relations:snapshot.relations.length,pending:snapshot.operations.length},null,2));
