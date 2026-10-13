import fs from 'node:fs';import crypto from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import pg from 'pg';import * as Y from 'yjs';
const db=new DatabaseSync('.data/ime-20261013/native-copy/workspace.sqlite'),context=JSON.parse(db.prepare('SELECT context FROM workspace_binding WHERE singleton=1').get().context),page=db.prepare('SELECT id FROM pages WHERE title=?').get('Native signup check 2026-10-13');if(!page)throw Error('Missing synthetic Page');
const local=new Y.Doc(),remote=new Y.Doc(),config=JSON.parse(fs.readFileSync('/tmp/greiva-live-private75.json'));if(!/^greiva_private_[a-z0-9_]+$/.test(config.schema))throw Error('Invalid owned schema');
const pool=new pg.Pool({connectionString:config.databaseUrl}),expected=['Native local save and sync check.','日本語の入力確認です。変換しても本文を保持します。'];
function text(node){return node instanceof Y.XmlText?node.toString():node.toArray().map(text).join('');}
try {
  const updates=db.prepare('SELECT update_bytes FROM page_updates WHERE page_id=? ORDER BY seq').all(page.id);for(const row of updates)Y.applyUpdate(local,row.update_bytes);
  const actual=local.getXmlFragment('body').toArray().map(text);if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('IME paragraphs differ from exact fixture');
  const rows=(await pool.query(`SELECT server_order,digest,update FROM "${config.schema}".private_page_updates WHERE workspace_id=$1 AND page_id=$2 ORDER BY server_order`,[context.workspaceId,page.id])).rows;
  for(const row of rows){if(crypto.createHash('sha256').update(row.update).digest('hex')!==row.digest)throw Error('Server digest mismatch');Y.applyUpdate(remote,row.update);}
  const xml=local.getXmlFragment('body').toString();if(xml!==remote.getXmlFragment('body').toString()||!Buffer.from(Y.encodeStateVector(local)).equals(Buffer.from(Y.encodeStateVector(remote))))throw Error('Native/server mismatch');
  const history=db.prepare('SELECT p.kind,p.wire,r.response FROM workspace_page_pending p LEFT JOIN workspace_page_receipts r ON r.pending_seq=p.seq WHERE p.page_id=? ORDER BY p.seq').all(page.id),baseline=JSON.parse(fs.readFileSync('/tmp/ime-baseline.json'));
  const hash=v=>crypto.createHash('sha256').update(v).digest('hex');if(JSON.stringify(history.slice(0,baseline.operationHistory.length).map(r=>hash(r.wire)))!==JSON.stringify(baseline.operationHistory.map(r=>r.wireSha256)))throw Error('Original wire history changed');
  const pending=history.filter(r=>r.response===null).length;if(pending!==0)throw Error('Pending updates remain');
  const result={artifactVersion:'0.82.0',provider:'Microsoft IME (user confirmed)',inputMethod:'physical key input, conversion and commit reported by user',exactTwoParagraphs:true,originalEnglishUnchanged:true,expectedJapaneseExact:true,nativeServerXmlEqual:true,stateVectorsEqual:true,localUpdates:updates.length,serverUpdates:rows.length,ackHistory:history.length,pending,originalWireHistoryUnchanged:true,serverDigestsUnique:new Set(rows.map(r=>r.digest)).size===rows.length,bodyXmlSha256:hash(xml),sqliteIntegrity:db.prepare('PRAGMA integrity_check').get().integrity_check,scope:{remoteDuringComposition:false,reconversion:false,offlineRestart:false,performance:false}};
  fs.writeFileSync('.data/ime-20261013/audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{local.destroy();remote.destroy();db.close();await pool.end();}
