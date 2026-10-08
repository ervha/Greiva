import type pg from 'pg';
import {privateSchemaName} from './private-schema-name.js';

// Explicit six -> seven. Existing Source/Page/history/config rows are untouched.
export async function installPrivateDatabaseRecordSchema(pool:pg.Pool,candidate:string){
 const schema=privateSchemaName(candidate),client=await pool.connect();
 try{
  await client.query('BEGIN');
  const gate=await client.query(`SELECT version FROM "${schema}".private_schema_version WHERE singleton=true FOR UPDATE`);
  if(gate.rowCount!==1||gate.rows[0]!.version!==6)throw Error('Explicit private schema six required');
  await client.query(`CREATE TABLE "${schema}".private_database_records(id uuid PRIMARY KEY,workspace_id uuid NOT NULL,source_id uuid NOT NULL,page_id uuid NOT NULL,version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),snapshot jsonb NOT NULL,deleted boolean NOT NULL DEFAULT false,UNIQUE(id,workspace_id),UNIQUE(source_id,page_id),FOREIGN KEY(source_id,workspace_id) REFERENCES "${schema}".private_database_sources(id,workspace_id),FOREIGN KEY(workspace_id,page_id) REFERENCES "${schema}".private_page_documents(workspace_id,page_id))`);
  await client.query(`CREATE TABLE "${schema}".private_database_record_history(record_id uuid NOT NULL REFERENCES "${schema}".private_database_records(id),version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),snapshot jsonb NOT NULL,PRIMARY KEY(record_id,version))`);
  await client.query(`CREATE TABLE "${schema}".private_database_record_operations(workspace_id uuid NOT NULL,operation_id uuid NOT NULL,record_id uuid NOT NULL,client_id uuid NOT NULL REFERENCES "${schema}".private_devices(id),request jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(workspace_id,operation_id),FOREIGN KEY(record_id,workspace_id) REFERENCES "${schema}".private_database_records(id,workspace_id))`);
  await client.query(`CREATE TABLE "${schema}".private_database_record_conflicts(id uuid PRIMARY KEY,record_id uuid NOT NULL REFERENCES "${schema}".private_database_records(id),workspace_id uuid NOT NULL,operation_id uuid NOT NULL,record jsonb NOT NULL,resolved_by uuid,FOREIGN KEY(workspace_id,operation_id) REFERENCES "${schema}".private_database_record_operations(workspace_id,operation_id) DEFERRABLE INITIALLY DEFERRED,FOREIGN KEY(workspace_id,resolved_by) REFERENCES "${schema}".private_database_record_operations(workspace_id,operation_id) DEFERRABLE INITIALLY DEFERRED)`);
  await client.query(`CREATE INDEX private_database_conflicts_active ON "${schema}".private_database_record_conflicts(record_id,id) WHERE resolved_by IS NULL`);
  await client.query(`UPDATE "${schema}".private_schema_version SET version=7 WHERE singleton=true`);
  await client.query('COMMIT');
 }catch(error){try{await client.query('ROLLBACK');}catch{/* fixed boundary */}throw error;}finally{client.release();}
}
export async function verifyPrivateDatabaseRecordSchema(client:pg.PoolClient,schema:string){
 await client.query(`SELECT id,workspace_id,source_id,page_id,version,snapshot,deleted FROM "${schema}".private_database_records LIMIT 0`);
 await client.query(`SELECT record_id,version,snapshot FROM "${schema}".private_database_record_history LIMIT 0`);
 await client.query(`SELECT workspace_id,operation_id,record_id,client_id,request,result FROM "${schema}".private_database_record_operations LIMIT 0`);
 await client.query(`SELECT id,record_id,workspace_id,operation_id,record,resolved_by FROM "${schema}".private_database_record_conflicts LIMIT 0`);
}
