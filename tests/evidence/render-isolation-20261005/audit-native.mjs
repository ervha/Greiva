import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as Y from '/workspace/node_modules/yjs/dist/yjs.mjs';
const read=name=>JSON.parse(fs.readFileSync('/tmp/render625-native-audit/'+name));
const before=read('completed-seed-1.json'),closed=read('final-closed-1.json'),reopened=read('reopened-closed-1.json');
for(const table of Object.keys(before))if(!['pages','page_updates','client_page_state'].includes(table))assert.deepEqual(closed[table],before[table],table);
for(const table of Object.keys(closed))assert.deepEqual(reopened[table],closed[table],table);
assert.equal(closed.tasks.length,250);assert.equal(closed.sync_operations.length,250);assert(closed.sync_operations.every(o=>o.status==='pending'));
const doc=new Y.Doc(),history=[];
for(const row of closed.page_updates){
 const bytes=Uint8Array.from(Object.values(row.update_bytes));assert.equal(createHash('sha256').update(bytes).digest('hex'),Buffer.from(Object.values(row.digest)).toString('hex'));
 Y.applyUpdate(doc,bytes);const fragment=doc.getXmlFragment('body');history.push({sequence:row.seq,blocks:fragment.length,first:fragment.get(0).toString(),last:fragment.get(999).toString()});
}
assert.equal(history.length,7);assert.deepEqual(history.slice(3).map(r=>r.first),['<paragraph>z</paragraph>','<paragraph>WIN625 local x</paragraph>','<paragraph>z</paragraph>','<paragraph>WIN625 local x</paragraph>']);
const original=new Y.Doc();Y.applyUpdate(original,Uint8Array.from(Object.values(closed.page_updates[0].update_bytes)));const fragment=doc.getXmlFragment('body');
assert.equal(fragment.length,1000);for(let i=1;i<999;i++)assert.equal(fragment.get(i).toString(),original.getXmlFragment('body').get(i).toString());
assert.equal(fragment.get(999).toString(),'<paragraph>Block 0999x</paragraph>');assert.equal(reopened.pages[0].title,'WIN625-RENDERx');
const result={result:'Pass',at:new Date().toISOString(),product:'0.6.25',artifactSha256:'e09ac644d9b7c1b3971e223fa0d46a52afbd2235f978d4f76b72ec2d519dbbad',pageUpdates:7,blocks:1000,unchangedOtherParagraphs:998,tasks:250,pending:250,structuredTablesUnchanged:true,reopenStoredTablesUnchanged:true,title:'WIN625-RENDERx',history,xmlSha256:createHash('sha256').update(fragment.toString()).digest('hex'),clocks:Array.from(Y.decodeStateVector(Y.encodeStateVector(doc))).sort(([a],[b])=>a-b),scope:'Final normal Windows release. Home/Shift+End/z/Undo/Redo/Undo and second restart, read-only online SQLite backups, all Page digests and exact structured tables. Independent peer audit separately matches XML and clocks. No actual Japanese/provider, physical drag or native latency measurement.'};
fs.writeFileSync('/tmp/render625-final-native-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:'Pass',updates:7,blocks:1000,tasks:250,pending:250}));original.destroy();doc.destroy();
