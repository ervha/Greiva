import fs from 'node:fs';import crypto from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import pg from 'pg';import * as Y from 'yjs';
const config=JSON.parse(fs.readFileSync('/tmp/greiva-live-private75.json'));if(!/^greiva_private_[a-z0-9_]+$/.test(config.schema))throw Error('Unexpected owned schema');
const db=new DatabaseSync('.data/signup-20261013/native-final-copy/workspace.sqlite'),context=JSON.parse(db.prepare('SELECT context FROM workspace_binding WHERE singleton=1').get().context),page=db.prepare('SELECT id FROM pages WHERE title=?').get('Native signup check 2026-10-13');if(!page)throw Error('Missing synthetic Page');
const pool=new pg.Pool({connectionString:config.databaseUrl}),local=new Y.Doc(),remote=new Y.Doc();
try {
  for(const row of db.prepare('SELECT update_bytes FROM page_updates WHERE page_id=? ORDER BY seq').all(page.id))Y.applyUpdate(local,row.update_bytes);
  const rows=(await pool.query(`SELECT server_order,digest,update FROM "${config.schema}".private_page_updates WHERE workspace_id=$1 AND page_id=$2 ORDER BY server_order`,[context.workspaceId,page.id])).rows;
  for(const row of rows){if(crypto.createHash('sha256').update(row.update).digest('hex')!==row.digest)throw Error('Server digest mismatch');Y.applyUpdate(remote,row.update);}
  const localXml=local.getXmlFragment('body').toString(),remoteXml=remote.getXmlFragment('body').toString();
  if(localXml!==remoteXml||!remoteXml.includes('Native local save and sync check.')||!Buffer.from(Y.encodeStateVector(local)).equals(Buffer.from(Y.encodeStateVector(remote))))throw Error('Native/server mismatch');
  const before=JSON.parse(fs.readFileSync('.data/signup-20261013/native-kill-audit.json')),after=JSON.parse(fs.readFileSync('.data/signup-20261013/native-final-audit.json'));
  if(before.pendingUnacknowledged!==2||after.pendingUnacknowledged!==0||after.receiptCount!==2||before.bodyXmlSha256!==after.bodyXmlSha256||JSON.stringify(before.operationHistory.map(r=>r.wireSha256))!==JSON.stringify(after.operationHistory.map(r=>r.wireSha256)))throw Error('Original pending/wire mismatch');
  const result={version:'0.82.0',nativeServerXmlEqual:true,stateVectorsEqual:true,expectedBodyMatched:true,serverUpdates:rows.length,serverDigestsUnique:new Set(rows.map(r=>r.digest)).size===rows.length,pendingBefore:2,pendingAfter:0,receiptsAfter:2,originalWireHashesPreserved:true,bodyXmlSha256:crypto.createHash('sha256').update(localXml).digest('hex')};
  fs.writeFileSync('.data/signup-20261013/native-server-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{local.destroy();remote.destroy();db.close();await pool.end();}
