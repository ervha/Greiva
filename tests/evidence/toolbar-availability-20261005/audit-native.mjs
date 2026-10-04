import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import * as Y from '/workspace/node_modules/yjs/dist/yjs.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
function read(path){
 const db=new DatabaseSync(path,{readOnly:true});assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 const metadata=db.prepare('SELECT id,title,y_doc_id FROM pages').all().map(row=>({...row}));
 const updates=db.prepare('SELECT seq,update_bytes,digest FROM page_updates ORDER BY seq').all();
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('pages','page_updates','sqlite_sequence') ORDER BY name").all();
 const structured=Object.fromEntries(tables.map(({name})=>[name,db.prepare(`SELECT * FROM "${name}"`).all().map(row=>({...row}))]));
 db.close();return {metadata,updates,structured};
}
const baseline=read('/tmp/toolbar624-baseline.sqlite');assert.equal(baseline.updates.length,1);
const copies=['roaming','packaged'].map(name=>({name,...read(`/tmp/toolbar624-native-${name}.sqlite`)}));
const changed=copies.filter(copy=>copy.updates.length>1);assert.equal(changed.length,1);
const current=changed[0];assert.equal(current.updates.length,4);
assert.deepEqual(current.metadata,baseline.metadata);
const {structured_client:beforeClient,...beforeTables}=baseline.structured;
const {structured_client:afterClient,...afterTables}=current.structured;
assert.deepEqual(beforeTables,afterTables);
assert.deepEqual(beforeClient,[]);assert.equal(afterClient.length,1);assert.equal(afterClient[0].singleton,1);
assert.match(afterClient[0].client_id,/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.equal(hash(current.updates[0].update_bytes),hash(baseline.updates[0].update_bytes));
const doc=new Y.Doc(),history=[];
for(const update of current.updates){
 assert.equal(hash(update.update_bytes),Buffer.from(update.digest).toString('hex'));Y.applyUpdate(doc,update.update_bytes);
 const body=doc.getXmlFragment('body');assert.equal(body.length,1000);
 const texts=body.toArray().map(node=>node.get(0).toString());
 history.push({seq:update.seq,firstTwo:texts.slice(0,2),xmlSha256:hash(body.toString())});
 if(update.seq===1)assert.deepEqual(texts.slice(0,2),['WIN624 local ','WIN624 remote ']);
 if(update.seq===2)assert.deepEqual(texts.slice(0,2),['WIN624 remote ','WIN624 local ']);
 if(update.seq===3)assert.deepEqual(texts.slice(0,2),['WIN624 local ','WIN624 remote ']);
 if(update.seq===4)assert.deepEqual(texts.slice(0,2),['WIN624 local ','WIN624 remote x']);
 assert.deepEqual(texts.slice(2),Array.from({length:998},(_,index)=>`Block ${String(index+2).padStart(4,'0')}`));
}
assert.equal(history[0].xmlSha256,history[2].xmlSha256);
const result={result:'Pass within stated scope',at:new Date().toISOString(),product:'0.6.24',activeCopy:current.name,page:current.metadata[0],baselineUpdates:1,finalUpdates:4,blocks:1000,history,baselineUpdateRetained:true,all998OtherParagraphsUnchanged:true,structuredEntityQueueReceiptStateUnchanged:true,newStructuredClientInitialized:afterClient[0],digestsValid:true,integrityCheck:'ok',clocks:Array.from(Y.decodeStateVector(Y.encodeStateVector(doc))).sort(([a],[b])=>a-b),scope:'Normal Windows toolbar move and Ctrl+Z, actual ASCII x key, save label observed, Alt+F4 and process absence verified. Not physical drag, Japanese IME, native latency or peer convergence evidence.'};
fs.writeFileSync('/tmp/toolbar624-native-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:result.result,activeCopy:current.name,updates:4,blocks:1000}));doc.destroy();
