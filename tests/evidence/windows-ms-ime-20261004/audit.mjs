import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as Y from '/workspace/node_modules/yjs/dist/yjs.mjs';
const db=new DatabaseSync('/tmp/ime620-ms-final.sqlite',{readOnly:true});
assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
const updates=db.prepare('SELECT seq,update_bytes,digest FROM page_updates ORDER BY seq').all(),document=new Y.Doc();
for(const row of updates){assert.equal(createHash('sha256').update(row.update_bytes).digest('hex'),Buffer.from(row.digest).toString('hex'));Y.applyUpdate(document,row.update_bytes);}
const body=document.getXmlFragment('body');assert.equal(body.length,1000);
assert.equal(body.get(0).toString(),'<paragraph>WIN620 local 日本語日本語</paragraph>');
assert.equal(body.get(1).toString(),'<paragraph>［遠隔3］［遠隔2］［遠隔1］WIN620 remote 日本語</paragraph>');
for(let index=2;index<1000;index++)assert.equal(body.get(index).toString(),`<paragraph>Block ${String(index).padStart(4,'0')}</paragraph>`);
const peer=JSON.parse(fs.readFileSync('/tmp/ime620-ms-peer.json'));assert.equal(body.toString(),peer.bodyXml);
const clocks=Array.from(Y.decodeStateVector(Y.encodeStateVector(document))).sort(([a],[b])=>a-b);assert.deepEqual(clocks,peer.clocks);
const metadata=db.prepare('SELECT id,title FROM pages').all();assert.equal(metadata.length,1);assert.equal(metadata[0].title,'WIN620-IME1000');
const result={result:'Pass',at:new Date().toISOString(),product:'0.6.20',pageId:metadata[0].id,title:metadata[0].title,provider:'Microsoft IME, user confirmed selection; actual native conversion visually observed',updates:updates.length,blocks:body.length,paragraphs:body.toArray().slice(0,2).map(node=>node.toString()),other998ParagraphsUnchanged:true,digestsValid:true,peerXmlAndClocksEqual:true,clocks,limits:['One new local conversion plus one conversion with three remote updates; first existing 日本語 is from the preceding provider-unidentified preparation','No trusted-event instrumentation or native per-key/continuous-typing SLO measurements','Page-only experiment; structured API unavailable']};
fs.writeFileSync('/tmp/ime620-ms-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));db.close();document.destroy();
