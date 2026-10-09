import type pg from 'pg';
import {isDeepStrictEqual} from 'node:util';
import {newId} from '@greiva/shared';
import {parseDatabaseRecord,parseDatabaseViewSnapshot} from '@greiva/domain';
import {privateDatabaseSourceSnapshotSchema} from '@greiva/protocol/private-database-source';
import {privateDatabaseRecordSnapshotSchema} from '@greiva/protocol/private-database-record';
import {privateDatabaseViewSnapshotSchema} from '@greiva/protocol/private-database-view';
import {parsePrivateDatabaseChange} from '@greiva/protocol/private-database-changes';
import {privateSchemaName} from './private-schema-name.js';
import {verifyDatabaseChangeCandidate,type DatabaseChangePayload} from './private-database-changes-journal.js';
import type {PrivateTransaction} from './private-transactions.js';
// The version UPDATE lock drains transactions whose first lock is version SHARE.
// Seed order is deterministic, not a reconstruction of old commit timestamps.
export async function installPrivateDatabaseChangesSchema(pool:pg.Pool,candidate:string){
 const schema=privateSchemaName(candidate),client=await pool.connect();
 try{
  await client.query('BEGIN');const gate=await client.query(`SELECT version FROM "${schema}".private_schema_version WHERE singleton=true FOR UPDATE`);if(gate.rowCount!==1||gate.rows[0]!.version!==10)throw Error('Explicit private schema ten required');
  const definitions=await client.query(`SELECT s.id,s.workspace_id,s.definition,s.version::text,s.creation_order::text,w.epoch FROM "${schema}".private_database_sources s JOIN "${schema}".private_workspaces w ON w.id=s.workspace_id ORDER BY s.workspace_id,s.id`);
  await client.query(`CREATE TABLE "${schema}".private_database_change_heads(source_id uuid PRIMARY KEY,workspace_id uuid NOT NULL,journal_epoch uuid NOT NULL UNIQUE,head_order bigint NOT NULL CHECK(head_order>=0),FOREIGN KEY(source_id,workspace_id) REFERENCES "${schema}".private_database_sources(id,workspace_id))`);
  await client.query(`CREATE TABLE "${schema}".private_database_change_events(workspace_id uuid NOT NULL,source_id uuid NOT NULL,server_order bigint NOT NULL CHECK(server_order>0),kind text NOT NULL CHECK(kind IN ('record','view')),entity_id uuid NOT NULL,event jsonb NOT NULL,PRIMARY KEY(source_id,server_order),FOREIGN KEY(source_id,workspace_id) REFERENCES "${schema}".private_database_sources(id,workspace_id))`);
  const port:Pick<PrivateTransaction,'query'>={query:(sql,values=[])=>client.query(sql,[...values])};
  for(const row of definitions.rows){
   const definition=privateDatabaseSourceSnapshotSchema.parse({source:row.definition,version:Number(row.version),creationOrder:row.creation_order}),source=definition.source;if(source.id!==row.id||source.workspaceId!==row.workspace_id)throw Error('Invalid database Source seed');
   await client.query(`INSERT INTO "${schema}".private_database_change_heads VALUES($1,$2,$3,0)`,[source.id,source.workspaceId,newId()]);
   const append=async(value:DatabaseChangePayload)=>{const next=await client.query(`UPDATE "${schema}".private_database_change_heads SET head_order=head_order+1 WHERE source_id=$1 AND head_order<9223372036854775807 RETURNING head_order::text`,[source.id]);if(next.rowCount!==1)throw Error('Database seed overflow');const event=parsePrivateDatabaseChange(source,{...value,order:next.rows[0]!.head_order});await verifyDatabaseChangeCandidate(port,schema,source,row.epoch,event);await client.query(`INSERT INTO "${schema}".private_database_change_events VALUES($1,$2,$3,$4,$5,$6)`,[source.workspaceId,source.id,event.order,event.kind,event.kind==='record'?event.record.id:event.snapshot.view.id,JSON.stringify(event)]);};
   const records=await client.query(`SELECT r.id,r.workspace_id,r.source_id,r.page_id,r.version::text,r.snapshot,h.snapshot AS history FROM "${schema}".private_database_records r LEFT JOIN "${schema}".private_database_record_history h ON h.record_id=r.id AND h.version=r.version WHERE r.source_id=$1 ORDER BY r.id`,[source.id]);
   for(const entry of records.rows){const record=parseDatabaseRecord(source,privateDatabaseRecordSnapshotSchema.parse(entry.snapshot));if(record.id!==entry.id||record.workspaceId!==entry.workspace_id||record.sourceId!==entry.source_id||record.pageId!==entry.page_id||record.version!==Number(entry.version)||!isDeepStrictEqual(record,entry.history))throw Error('Invalid Record history seed');await append({kind:'record',record,conflict:null});
    const conflicts=await client.query(`SELECT id,workspace_id,record_id,record,resolved_by FROM "${schema}".private_database_record_conflicts WHERE record_id=$1 ORDER BY id`,[record.id]);for(const item of conflicts.rows){if(item.record.id!==item.id||item.workspace_id!==source.workspaceId||item.record_id!==record.id||item.record.resolvedBy!==null)throw Error('Invalid Record candidate seed');await append({kind:'record',record,conflict:{...item.record,resolvedBy:item.resolved_by}});}
   }
   const views=await client.query(`SELECT v.id,v.workspace_id,v.source_id,v.version::text,v.snapshot,h.snapshot AS history FROM "${schema}".private_database_views v LEFT JOIN "${schema}".private_database_view_history h ON h.view_id=v.id AND h.version=v.version WHERE v.source_id=$1 ORDER BY v.id`,[source.id]);
   for(const entry of views.rows){const snapshot=parseDatabaseViewSnapshot(source,privateDatabaseViewSnapshotSchema.parse(entry.snapshot));if(snapshot.view.id!==entry.id||entry.workspace_id!==source.workspaceId||snapshot.view.sourceId!==entry.source_id||snapshot.version!==Number(entry.version)||!isDeepStrictEqual(snapshot,entry.history))throw Error('Invalid View history seed');await append({kind:'view',snapshot,conflict:null});
    const conflicts=await client.query(`SELECT id,workspace_id,view_id,record,resolved_by FROM "${schema}".private_database_view_conflicts WHERE view_id=$1 ORDER BY id`,[snapshot.view.id]);for(const item of conflicts.rows){if(item.record.id!==item.id||item.workspace_id!==source.workspaceId||item.view_id!==snapshot.view.id||item.record.resolvedBy!==null)throw Error('Invalid View candidate seed');await append({kind:'view',snapshot,conflict:{...item.record,resolvedBy:item.resolved_by}});}
   }
  }
  await client.query(`UPDATE "${schema}".private_schema_version SET version=11 WHERE singleton=true`);await client.query('COMMIT');
 }catch(error){try{await client.query('ROLLBACK');}catch{/* fixed operator boundary */}throw error;}finally{client.release();}
}
export async function verifyPrivateDatabaseChangesSchema(client:pg.PoolClient,schema:string){await client.query(`SELECT source_id,workspace_id,journal_epoch,head_order FROM "${schema}".private_database_change_heads LIMIT 0`);await client.query(`SELECT workspace_id,source_id,server_order,kind,entity_id,event FROM "${schema}".private_database_change_events LIMIT 0`);}
