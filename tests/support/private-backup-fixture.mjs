// Docker restore rehearsal only. Refuses ordinary databases and uses synthetic
// records. Control data stays in ignored storage; only hashes/counts are evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import pg from 'pg';
import * as Y from 'yjs';
import { newId } from '@greiva/shared';
import { emptyPageUpdate } from '@greiva/sync';
import { installPrivateWorkspaceSchema, verifyPrivateWorkspaceSchema } from '../../apps/api/dist/private-workspace-schema.js';
import { PostgresPrivateBootstrapStore } from '../../apps/api/dist/private-bootstrap-store.js';
import { PostgresPrivatePageStore } from '../../apps/api/dist/private-page-store.js';
import { PostgresPrivateStructuredStore } from '../../apps/api/dist/private-structured-store.js';
import { PostgresPrivateDatabaseSourceStore } from '../../apps/api/dist/private-database-source-store.js';
import { PostgresPrivateDatabaseRecordStore } from '../../apps/api/dist/private-database-record-store.js';
import { PostgresPrivateDatabaseViewStore } from '../../apps/api/dist/private-database-view-store.js';
import { PostgresPrivateDatabaseChangesStore } from '../../apps/api/dist/private-database-changes-store.js';

const [mode, controlPath, reportPath] = process.argv.slice(2);
const schema = 'greiva_private_backup_fixture', run = process.env.GREIVA_BACKUP_FIXTURE_RUN;
assert(/^[0-9a-f]{12}$/.test(run ?? '') && ['seed','verify'].includes(mode));
const database = new URL(process.env.DATABASE_URL).pathname.slice(1);
assert.equal(database, `greiva_backup_${mode === 'seed' ? 'source' : 'restored'}_${run}`);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, statement_timeout: 10000 });
const owner = { issuer:'https://backup.fixture.invalid/auth/v1', subjectId:'synthetic-backup-owner', expiresAt:Math.floor(Date.now()/1000)+300 };
const stores = {
  source:new PostgresPrivateDatabaseSourceStore(pool,schema), record:new PostgresPrivateDatabaseRecordStore(pool,schema),
  view:new PostgresPrivateDatabaseViewStore(pool,schema), structured:new PostgresPrivateStructuredStore(pool,schema),
  page:new PostgresPrivatePageStore(pool,schema), changes:new PostgresPrivateDatabaseChangesStore(pool,schema),
};
async function fingerprint() {
  const names = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename",[schema])).rows.map(row=>row.tablename);
  const result=[];
  for(const name of names) {
    assert(/^[a-z_]+$/.test(name));
    const rows=(await pool.query(`SELECT to_jsonb(t)::text AS row FROM "${schema}"."${name}" t ORDER BY to_jsonb(t)::text COLLATE "C"`)).rows;
    result.push({table:name,count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows.map(row=>row.row))).digest('hex')});
  }
  return result;
}
async function replay(control) {
  const { binding, requests, responses }=control;
  for(let i=0;i<requests.length;i++) {
    const {kind,args}=requests[i];
    const result=await stores[kind][kind==='source'?'create':kind==='structured'?'push':'write'](owner,binding.workspaceId,...args);
    assert.deepEqual(result,responses[i]);
  }
}
try {
  let control;
  if(mode==='seed') {
    await installPrivateWorkspaceSchema(pool,schema);
    for(const [file,method] of [
      ['private-structured-schema','installPrivateStructuredSchema'],['private-page-schema','installPrivatePageSchema'],
      ['private-page-metadata-schema','installPrivatePageMetadataSchema'],['private-page-changes-schema','installPrivatePageChangesSchema'],
      ['private-database-source-schema','installPrivateDatabaseSourceSchema'],['private-database-record-schema','installPrivateDatabaseRecordSchema'],
      ['private-database-record-catalog-schema','installPrivateDatabaseRecordCatalogSchema'],['private-database-view-schema','installPrivateDatabaseViewSchema'],
      ['private-database-view-catalog-schema','installPrivateDatabaseViewCatalogSchema'],['private-database-changes-schema','installPrivateDatabaseChangesSchema'],
    ]) await (await import(`../../apps/api/dist/${file}.js`))[method](pool,schema);
    const binding=await new PostgresPrivateBootstrapStore(pool,schema).bootstrap(owner,{clientId:newId()});
    control={binding,requests:[],responses:[]};
    const send=async(kind,...args)=>{const result=await stores[kind][kind==='source'?'create':kind==='structured'?'push':'write'](owner,binding.workspaceId,...args);control.requests.push({kind,args});control.responses.push(result);return result;};
    const ids={name:newId(),text:newId(),number:newId()}, source={id:newId(),workspaceId:binding.workspaceId,name:'復元用の架空DB',schemaVersion:1,properties:Object.entries(ids).map(([type,id])=>({id,type,name:type}))};
    const request=intent=>({protocolVersion:1,clientId:binding.clientId,operationId:newId(),intent});
    await send('source',{protocolVersion:1,clientId:binding.clientId,operationId:newId(),source});
    const pageId=newId(),doc=new Y.Doc({gc:false});Y.applyUpdate(doc,emptyPageUpdate());doc.getMap('backup-fixture').set('body','架空の本文・復元確認');
    await stores.page.bootstrap(owner,binding.workspaceId,pageId,{protocolVersion:1,clientId:binding.clientId,editorSchemaVersion:1,title:'架空のPage',initialUpdate:Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64url')});doc.destroy();
    const recordId=newId(),record={sourceId:source.id,schemaVersion:1,recordId,pageId};
    await send('record',source.id,request({...record,kind:'create',baseVersion:null,values:{[ids.text]:'base',[ids.number]:0}}));
    await send('record',source.id,request({...record,kind:'update',baseVersion:1,values:{[ids.text]:'remote'}}));
    const conflict=await send('record',source.id,request({...record,kind:'update',baseVersion:1,values:{[ids.text]:'local'}}));assert.equal(conflict.result.status,'conflict');
    await send('view',source.id,request({kind:'create',sourceId:source.id,schemaVersion:1,viewId:newId(),baseVersion:null,settings:{name:'Table',layout:'table',visiblePropertyIds:Object.values(ids),filter:null,sorts:[]}}));
    const task={operationId:newId(),clientId:binding.clientId,entityType:'task',entityId:newId(),kind:'create',baseVersion:null,payload:{title:'復元用の架空Task',status:'todo',due:null}};
    await send('structured',{protocolVersion:1,workspaceId:binding.workspaceId,clientId:binding.clientId,operations:[task]});
    const pulled=await stores.changes.pull(owner,binding.workspaceId,source.id,{protocolVersion:1,clientId:binding.clientId,cursor:null,limit:1});assert.equal(pulled.hasMore,true);
    control.sourceId=source.id;control.cursor=pulled.cursor;
    control.remaining=await stores.changes.pull(owner,binding.workspaceId,source.id,{protocolVersion:1,clientId:binding.clientId,cursor:pulled.cursor,limit:100});
    control.fingerprint=await fingerprint();
    await fs.writeFile(controlPath,JSON.stringify(control),{flag:'wx',mode:0o600});
  } else {
    control=JSON.parse(await fs.readFile(controlPath,'utf8'));
    assert.deepEqual(await fingerprint(),control.fingerprint);
    await replay(control);
    const remaining=await stores.changes.pull(owner,control.binding.workspaceId,control.sourceId,{protocolVersion:1,clientId:control.binding.clientId,cursor:control.cursor,limit:100});
    assert.deepEqual(remaining,control.remaining);
    assert.deepEqual(await fingerprint(),control.fingerprint);
  }
  assert.equal(await verifyPrivateWorkspaceSchema(pool,schema),11);
  await fs.writeFile(reportPath,JSON.stringify({mode,schemaVersion:11,syntheticOnly:true,tables:control.fingerprint,immutableReceipts:control.requests.length,replayChecked:mode==='verify',preBackupCursorContinues:mode==='verify',databaseNamesLogged:false},null,2));
  console.log(JSON.stringify({event:mode==='seed'?'fixture_ready':'restore_verified',tables:control.fingerprint.length}));
} catch {
  console.error(JSON.stringify({event:'backup_fixture_failed',mode}));process.exitCode=1;
} finally { await pool.end(); }
