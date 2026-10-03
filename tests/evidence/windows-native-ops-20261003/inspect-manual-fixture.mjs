import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as Y from '/workspace/node_modules/yjs/dist/yjs.mjs';
const db=new DatabaseSync(process.argv[2],{readOnly:true});
const pages=[];let integrity;
try{
 integrity=db.prepare('PRAGMA integrity_check').get().integrity_check;assert.equal(integrity,'ok');
 for(const page of db.prepare("SELECT id,title FROM pages WHERE title LIKE '%WIN611-OPS%'").all()){
  const doc=new Y.Doc(),history=[];
  for(const row of db.prepare('SELECT seq,update_bytes,digest FROM page_updates WHERE page_id=? ORDER BY seq').all(page.id)){
   const digest=createHash('sha256').update(row.update_bytes).digest('hex');assert.equal(digest,Buffer.from(row.digest).toString('hex'));
   Y.applyUpdate(doc,row.update_bytes);history.push({seq:row.seq,sha256:digest,bytes:row.update_bytes.length,bodyXml:doc.getXmlFragment('body').toString()});
  }
  pages.push({pageId:page.id,title:page.title,bodyXml:doc.getXmlFragment('body').toString(),history,clocks:Array.from(Y.decodeStateVector(Y.encodeStateVector(doc)))});doc.destroy();
 }
 assert.equal(pages.length,1,'Expected one WIN611-OPS fixture');
}finally{db.close();}
writeFileSync(process.argv[3],JSON.stringify({inspectedAt:new Date().toISOString(),integrity,nativeVersion:'0.6.11',allUpdateDigestsVerified:true,pages,scope:'Stopped Windows DB copy; Docker read-only SQLite/Yjs replay. Manual operation results are separate; no independent GUI observation.'},null,2)+'\n');
console.log(JSON.stringify(pages.map(p=>({title:p.title,pageId:p.pageId,bodyXml:p.bodyXml,updates:p.history.length})),null,2));
