import type pg from 'pg';
import {privateSchemaName} from './private-schema-name.js';
export async function installPrivateDatabaseSourceSchema(pool:pg.Pool,candidate:string){
 const schema=privateSchemaName(candidate),client=await pool.connect();
 try{await client.query('BEGIN');const gate=await client.query(`SELECT version FROM "${schema}".private_schema_version WHERE singleton=true FOR UPDATE`);if(gate.rowCount!==1||gate.rows[0]!.version!==5)throw Error('Explicit private schema five required');
  await client.query(`CREATE TABLE "${schema}".private_database_source_heads(workspace_id uuid PRIMARY KEY REFERENCES "${schema}".private_workspaces(id),head_order bigint NOT NULL CHECK(head_order>=0))`);
  await client.query(`INSERT INTO "${schema}".private_database_source_heads SELECT id,0 FROM "${schema}".private_workspaces`);
  await client.query(`CREATE TABLE "${schema}".private_database_sources(id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES "${schema}".private_workspaces(id),creation_order bigint NOT NULL CHECK(creation_order>0),version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),definition jsonb NOT NULL,deleted boolean NOT NULL DEFAULT false,UNIQUE(id,workspace_id),UNIQUE(workspace_id,creation_order))`);
  await client.query(`CREATE TABLE "${schema}".private_database_source_operations(workspace_id uuid NOT NULL,operation_id uuid NOT NULL,source_id uuid NOT NULL,client_id uuid NOT NULL REFERENCES "${schema}".private_devices(id),request jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(workspace_id,operation_id),FOREIGN KEY(source_id,workspace_id) REFERENCES "${schema}".private_database_sources(id,workspace_id))`);
  await client.query(`UPDATE "${schema}".private_schema_version SET version=6 WHERE singleton=true`);await client.query('COMMIT');
 }catch(error){try{await client.query('ROLLBACK');}catch{/* fixed operator boundary */}throw error;}finally{client.release();}
}
export async function verifyPrivateDatabaseSourceSchema(client:pg.PoolClient,schema:string){
 await client.query(`SELECT workspace_id,head_order FROM "${schema}".private_database_source_heads LIMIT 0`);
 await client.query(`SELECT id,workspace_id,creation_order,version,definition,deleted FROM "${schema}".private_database_sources LIMIT 0`);
 await client.query(`SELECT workspace_id,operation_id,source_id,client_id,request,result FROM "${schema}".private_database_source_operations LIMIT 0`);
}
