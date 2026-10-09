import type pg from 'pg';
import {isDeepStrictEqual} from 'node:util';
import {parseDatabaseRecord} from '@greiva/domain';
import {privateDatabaseSourceSnapshotSchema} from '@greiva/protocol/private-database-source';
import {privateSchemaName} from './private-schema-name.js';
// Legacy seed order is deterministic ID order, not recovered creation time.
export async function installPrivateDatabaseRecordCatalogSchema(pool:pg.Pool,candidate:string){
 const schema=privateSchemaName(candidate),client=await pool.connect();
 try{
  await client.query('BEGIN');
  const gate=await client.query(`SELECT version FROM "${schema}".private_schema_version WHERE singleton=true FOR UPDATE`);
  if(gate.rowCount!==1||gate.rows[0]!.version!==7)throw Error('Explicit private schema seven required');
  const definitions=await client.query(`SELECT id,workspace_id,definition,version::text,creation_order::text FROM "${schema}".private_database_sources`),sources=new Map();
  for(const row of definitions.rows){const snapshot=privateDatabaseSourceSnapshotSchema.parse({source:row.definition,version:Number(row.version),creationOrder:row.creation_order});if(snapshot.source.id!==row.id||snapshot.source.workspaceId!==row.workspace_id)throw Error('Invalid Source seed');sources.set(row.id,snapshot.source);}
  const records=await client.query(`SELECT r.id,r.workspace_id,r.source_id,r.page_id,r.version::text,r.snapshot,h.snapshot AS history FROM "${schema}".private_database_records r LEFT JOIN "${schema}".private_database_record_history h ON h.record_id=r.id AND h.version=r.version`);
  for(const row of records.rows){const source=sources.get(row.source_id);if(!source)throw Error('Invalid Record seed');const record=parseDatabaseRecord(source,row.snapshot);if(record.id!==row.id||record.workspaceId!==row.workspace_id||record.pageId!==row.page_id||record.version!==Number(row.version)||!isDeepStrictEqual(record,row.history))throw Error('Invalid Record history seed');}
  await client.query(`ALTER TABLE "${schema}".private_database_records ADD COLUMN creation_order bigint`);
  await client.query(`WITH ranked AS (SELECT id,row_number() OVER(PARTITION BY source_id ORDER BY id) AS position FROM "${schema}".private_database_records) UPDATE "${schema}".private_database_records r SET creation_order=ranked.position FROM ranked WHERE ranked.id=r.id`);
  await client.query(`ALTER TABLE "${schema}".private_database_records ALTER COLUMN creation_order SET NOT NULL,ADD CHECK(creation_order>0),ADD UNIQUE(source_id,creation_order)`);
  await client.query(`CREATE TABLE "${schema}".private_database_record_heads(source_id uuid PRIMARY KEY,workspace_id uuid NOT NULL,head_order bigint NOT NULL CHECK(head_order>=0),FOREIGN KEY(source_id,workspace_id) REFERENCES "${schema}".private_database_sources(id,workspace_id))`);
  await client.query(`INSERT INTO "${schema}".private_database_record_heads SELECT s.id,s.workspace_id,COALESCE(max(r.creation_order),0) FROM "${schema}".private_database_sources s LEFT JOIN "${schema}".private_database_records r ON r.source_id=s.id GROUP BY s.id,s.workspace_id`);
  await client.query(`UPDATE "${schema}".private_schema_version SET version=8 WHERE singleton=true`);
  await client.query('COMMIT');
 }catch(error){try{await client.query('ROLLBACK');}catch{/* fixed operator boundary */}throw error;}finally{client.release();}
}
export async function verifyPrivateDatabaseRecordCatalogSchema(client:pg.PoolClient,schema:string){
 await client.query(`SELECT source_id,workspace_id,head_order FROM "${schema}".private_database_record_heads LIMIT 0`);
 await client.query(`SELECT id,source_id,creation_order FROM "${schema}".private_database_records LIMIT 0`);
}
