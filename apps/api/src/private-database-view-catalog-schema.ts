import type pg from 'pg';
import {isDeepStrictEqual} from 'node:util';
import {parseDatabaseViewSnapshot,type DatabaseSource} from '@greiva/domain';
import {privateDatabaseSourceSnapshotSchema} from '@greiva/protocol/private-database-source';
import {privateDatabaseViewSnapshotSchema} from '@greiva/protocol/private-database-view';
import {privateSchemaName} from './private-schema-name.js';
// Existing View ID order is a deterministic seed, not recovered creation time.
export async function installPrivateDatabaseViewCatalogSchema(pool:pg.Pool,candidate:string){
 const schema=privateSchemaName(candidate),client=await pool.connect();
 try{
  await client.query('BEGIN');const gate=await client.query(`SELECT version FROM "${schema}".private_schema_version WHERE singleton=true FOR UPDATE`);if(gate.rowCount!==1||gate.rows[0]!.version!==9)throw Error('Explicit private schema nine required');
  const definitions=await client.query(`SELECT id,workspace_id,definition,version::text,creation_order::text FROM "${schema}".private_database_sources`),sources=new Map<string,DatabaseSource>();
  for(const row of definitions.rows){const snapshot=privateDatabaseSourceSnapshotSchema.parse({source:row.definition,version:Number(row.version),creationOrder:row.creation_order});if(snapshot.source.id!==row.id||snapshot.source.workspaceId!==row.workspace_id)throw Error('Invalid Source seed');sources.set(row.id,snapshot.source);}
  const views=await client.query(`SELECT v.id,v.workspace_id,v.source_id,v.version::text,v.snapshot,h.snapshot AS history FROM "${schema}".private_database_views v LEFT JOIN "${schema}".private_database_view_history h ON h.view_id=v.id AND h.version=v.version`);
  for(const row of views.rows){const source=sources.get(row.source_id);if(!source||source.workspaceId!==row.workspace_id)throw Error('Invalid View seed');const snapshot=parseDatabaseViewSnapshot(source,privateDatabaseViewSnapshotSchema.parse(row.snapshot));if(snapshot.view.id!==row.id||snapshot.version!==Number(row.version)||!isDeepStrictEqual(snapshot,row.history))throw Error('Invalid View history seed');}
  await client.query(`ALTER TABLE "${schema}".private_database_views ADD COLUMN creation_order bigint`);
  await client.query(`WITH ranked AS (SELECT id,row_number() OVER(PARTITION BY source_id ORDER BY id) AS position FROM "${schema}".private_database_views) UPDATE "${schema}".private_database_views v SET creation_order=ranked.position FROM ranked WHERE ranked.id=v.id`);
  await client.query(`ALTER TABLE "${schema}".private_database_views ALTER COLUMN creation_order SET NOT NULL,ADD CHECK(creation_order>0),ADD UNIQUE(source_id,creation_order)`);
  await client.query(`CREATE TABLE "${schema}".private_database_view_heads(source_id uuid PRIMARY KEY,workspace_id uuid NOT NULL,head_order bigint NOT NULL CHECK(head_order>=0),FOREIGN KEY(source_id,workspace_id) REFERENCES "${schema}".private_database_sources(id,workspace_id))`);
  await client.query(`INSERT INTO "${schema}".private_database_view_heads SELECT s.id,s.workspace_id,COALESCE(max(v.creation_order),0) FROM "${schema}".private_database_sources s LEFT JOIN "${schema}".private_database_views v ON v.source_id=s.id GROUP BY s.id,s.workspace_id`);
  await client.query(`UPDATE "${schema}".private_schema_version SET version=10 WHERE singleton=true`);await client.query('COMMIT');
 }catch(error){try{await client.query('ROLLBACK');}catch{/* fixed boundary */}throw error;}finally{client.release();}
}
export async function verifyPrivateDatabaseViewCatalogSchema(client:pg.PoolClient,schema:string){await client.query(`SELECT source_id,workspace_id,head_order FROM "${schema}".private_database_view_heads LIMIT 0`);await client.query(`SELECT id,source_id,creation_order FROM "${schema}".private_database_views LIMIT 0`);}
