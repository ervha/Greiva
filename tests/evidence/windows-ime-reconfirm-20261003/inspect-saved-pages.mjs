import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as Y from '/workspace/node_modules/yjs/dist/yjs.mjs';
const db=new DatabaseSync(process.argv[2],{readOnly:true});
const pages=[];
try {
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  for(const [fixture,title] of [['A','PIME69-A'],['B','IME69-B']]) {
    const rows=db.prepare('SELECT id,title FROM pages WHERE title=?').all(title);assert.equal(rows.length,1,title);
    const page=rows[0];const document=new Y.Doc();const history=[];
    for(const row of db.prepare('SELECT seq,update_bytes,digest FROM page_updates WHERE page_id=? ORDER BY seq').all(page.id)) {
      const hash=createHash('sha256').update(row.update_bytes).digest('hex');
      assert.equal(hash,Buffer.from(row.digest).toString('hex'));
      const decoded=Y.decodeUpdate(row.update_bytes);
      Y.applyUpdate(document,row.update_bytes);
      history.push({seq:row.seq,sha256:hash,bytes:row.update_bytes.length,
        deletedRanges:Array.from(decoded.ds.clients,([client,ranges])=>({client,ranges})),
        bodyXml:document.getXmlFragment('body').toString()});
    }
    const xml=document.getXmlFragment('body').toString();
    assert.equal(xml,fixture==='A'?'<paragraph>MS65 local 日本語</paragraph>':'<paragraph>MS65 loc日本語</paragraph>');
    pages.push({fixture,pageId:page.id,title,bodyXml:xml,clocks:Array.from(Y.decodeStateVector(Y.encodeStateVector(document))),
      observedOutcome:fixture==='A'?'Fixture text retained':'Fixture al-space missing',history});document.destroy();
  }
} finally {db.close();}
const report={inspectedAt:new Date().toISOString(),execution:'Docker; stopped Windows DB copy; read-only SQLite/Yjs replay',
  nativeVersion:'0.6.9',loadedWebView2Version:'154.0.4258.53',operator:'User manual IME; Codex saved-data audit',
  nativeEventsRecorded:false,remoteUpdatesSent:false,pages,
  scope:'Persisted fixture comparison only; no independent GUI/candidate observation or proof of the OS input-layer cause. B remains a text-retention failure.'};
writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(pages.map(({title,pageId,bodyXml,history})=>({title,pageId,bodyXml,updates:history.length})),null,2));
