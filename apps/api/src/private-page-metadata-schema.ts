import type pg from 'pg';
import {pageSchema} from '@greiva/protocol';
import {privateSchemaName} from './private-schema-name.js';

// Explicit v3 -> v4. Existing canonical titles become version zero; no body
// import/reset, inferred ownership or automatic startup migration.
export async function installPrivatePageMetadataSchema(pool:pg.Pool,candidate:string){
  const schema=privateSchemaName(candidate),client=await pool.connect();
  try{
    await client.query('BEGIN');
    const version=await client.query(`SELECT version FROM "${schema}".private_schema_version WHERE singleton=true FOR UPDATE`);
    if(version.rowCount!==1||version.rows[0].version!==3)throw new Error('Explicit Page schema three required');
    await client.query(`LOCK TABLE "${schema}".private_page_documents,"${schema}".private_page_updates,"${schema}".private_resources IN ACCESS EXCLUSIVE MODE`);
    const documents=await client.query(`SELECT d.page_id,d.workspace_id,d.metadata,r.workspace_id AS owner FROM "${schema}".private_page_documents d LEFT JOIN "${schema}".private_resources r ON r.type='page' AND r.id=d.page_id`);
    for(const row of documents.rows){const metadata=pageSchema.parse(row.metadata);if(metadata.id!==row.page_id||metadata.yDocId!=='page:'+row.page_id||row.workspace_id!==row.owner||metadata.title.length>65536)throw new Error('Invalid canonical metadata');}
    if((await client.query(`SELECT 1 FROM "${schema}".private_resources r LEFT JOIN "${schema}".private_page_documents d ON d.page_id=r.id AND d.workspace_id=r.workspace_id WHERE r.type='page' AND d.page_id IS NULL LIMIT 1`)).rowCount)throw new Error('Orphan Page');
    await client.query(`CREATE TABLE "${schema}".private_page_title_state(page_id uuid PRIMARY KEY REFERENCES "${schema}".private_page_documents(page_id),version bigint NOT NULL CHECK(version BETWEEN 0 AND 9007199254740991))`);
    await client.query(`CREATE TABLE "${schema}".private_page_title_history(page_id uuid NOT NULL REFERENCES "${schema}".private_page_documents(page_id),version bigint NOT NULL CHECK(version BETWEEN 0 AND 9007199254740991),title text NOT NULL,PRIMARY KEY(page_id,version))`);
    await client.query(`CREATE TABLE "${schema}".private_page_title_operations(workspace_id uuid NOT NULL,page_id uuid NOT NULL,operation_id uuid NOT NULL,client_id uuid NOT NULL REFERENCES "${schema}".private_devices(id),request jsonb NOT NULL,result jsonb NOT NULL,PRIMARY KEY(workspace_id,operation_id),FOREIGN KEY(workspace_id,page_id) REFERENCES "${schema}".private_page_documents(workspace_id,page_id))`);
    await client.query(`CREATE TABLE "${schema}".private_page_title_conflicts(page_id uuid NOT NULL REFERENCES "${schema}".private_page_documents(page_id),id uuid NOT NULL,record jsonb NOT NULL,resolved_by uuid,PRIMARY KEY(page_id,id))`);
    await client.query(`CREATE INDEX private_page_title_open ON "${schema}".private_page_title_conflicts(page_id,id) WHERE resolved_by IS NULL`);
    await client.query(`INSERT INTO "${schema}".private_page_title_state SELECT page_id,0 FROM "${schema}".private_page_documents`);
    await client.query(`INSERT INTO "${schema}".private_page_title_history SELECT page_id,0,metadata->>'title' FROM "${schema}".private_page_documents`);
    await client.query(`UPDATE "${schema}".private_schema_version SET version=4 WHERE singleton=true`);
    await client.query('COMMIT');
  }catch(error){try{await client.query('ROLLBACK');}catch{/* sanitized CLI */}throw error;}finally{client.release();}
}
export async function verifyPrivatePageMetadataSchema(client:pg.PoolClient,schema:string){
  await client.query(`SELECT page_id,version FROM "${schema}".private_page_title_state LIMIT 0`);
  await client.query(`SELECT page_id,version,title FROM "${schema}".private_page_title_history LIMIT 0`);
  await client.query(`SELECT workspace_id,page_id,operation_id,client_id,request,result FROM "${schema}".private_page_title_operations LIMIT 0`);
  await client.query(`SELECT page_id,id,record,resolved_by FROM "${schema}".private_page_title_conflicts LIMIT 0`);
}
