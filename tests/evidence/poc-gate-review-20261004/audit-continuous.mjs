import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as Y from '/workspace/node_modules/yjs/dist/yjs.mjs';
const hash=text=>createHash('sha256').update(text).digest('hex');
function load(path){
  const db=new DatabaseSync(path,{readOnly:true});
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  const rows=db.prepare('SELECT seq,update_bytes,digest FROM page_updates ORDER BY seq').all(),document=new Y.Doc();
  for(const row of rows){assert.equal(hash(row.update_bytes),Buffer.from(row.digest).toString('hex'));Y.applyUpdate(document,row.update_bytes);}
  const metadata=db.prepare('SELECT id,title,y_doc_id FROM pages').all().map(row=>({...row}));db.close();
  return {rows,document,metadata,body:document.getXmlFragment('body')};
}
const baseline=load('/tmp/ime620-baseline30.sqlite'),current=load('/tmp/ime620-continuous.sqlite');
assert.equal(baseline.rows.length,30);assert(current.rows.length>30);
assert.deepEqual(current.metadata,baseline.metadata);
for(let index=0;index<baseline.rows.length;index++){
  assert.equal(current.rows[index].seq,baseline.rows[index].seq);
  assert.equal(hash(current.rows[index].update_bytes),hash(baseline.rows[index].update_bytes));
}
const before=baseline.body.toArray(),after=current.body.toArray();
assert(after.length>=before.length);
assert.deepEqual(after.slice(-999).map(node=>node.toString()),before.slice(1).map(node=>node.toString()));
const beforeFirst=before[0].get(0).toString(),afterFirst=after[0].get(0).toString();
assert(afterFirst.startsWith(beforeFirst));
const addedBlocks=after.slice(0,after.length-999),newText=addedBlocks.map(node=>node.toArray().map(child=>child.toString()).join('')).join('\n');
assert(newText.length>beforeFirst.length);
const peer=JSON.parse(fs.readFileSync('/tmp/ime620-peer/final.json'));
assert.equal(current.body.toString(),peer.bodyXml);
const clocks=Array.from(Y.decodeStateVector(Y.encodeStateVector(current.document))).sort(([a],[b])=>a-b);
assert.deepEqual(clocks,peer.clocks);
const result={result:'Pass within stated scope',at:new Date().toISOString(),product:'0.6.20',pageId:current.metadata[0].id,title:current.metadata[0].title,operatorReport:'User reported continuous Microsoft IME input completed without problems',baselineUpdates:30,finalUpdates:current.rows.length,blocks:after.length,baseline30UpdateBytesRetained:true,originalFirstParagraphPrefixRetained:true,other999ParagraphsUnchanged:true,additionalTextUtf16Length:newText.length-beforeFirst.length,additionalTextSha256:hash(newText.slice(beforeFirst.length)),bodyXmlSha256:hash(current.body.toString()),peerXmlAndClocksEqual:true,clocks,limits:['Operator qualitative continuous-input report, not native per-key/frame SLO','Save/sync accessibility text read returned empty; durability established directly from SQLite online backup and peer convergence','Operator-entered free text retained privately; public evidence records hashes and lengths']};
fs.writeFileSync('/tmp/ime620-continuous-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));baseline.document.destroy();current.document.destroy();
