import type pg from 'pg';
import { privateSchemaName } from './private-schema-name.js';

// Explicit v2 -> v3; no invented empty body for preexisting Page metadata.
export async function installPrivatePageSchema(pool: pg.Pool, candidate: string) {
  const schema=privateSchemaName(candidate),client=await pool.connect();
  try {
    await client.query('BEGIN');
    const version=await client.query(`SELECT version FROM "${schema}".private_schema_version WHERE singleton=true FOR UPDATE`);
    if(version.rowCount!==1 || version.rows[0].version!==2)throw new Error('Explicit structured version two required');
    await client.query(`LOCK TABLE "${schema}".private_workspaces,"${schema}".private_devices,"${schema}".private_resources IN ACCESS EXCLUSIVE MODE`);
    if((await client.query(`SELECT 1 FROM "${schema}".private_resources WHERE type='page' LIMIT 1`)).rowCount)throw new Error('Unattributed Page metadata');
    await client.query(`CREATE TABLE "${schema}".private_page_documents (
      page_id uuid PRIMARY KEY,resource_type text NOT NULL DEFAULT 'page' CHECK(resource_type='page'),
      workspace_id uuid NOT NULL REFERENCES "${schema}".private_workspaces(id),editor_schema_version integer NOT NULL CHECK(editor_schema_version=1),
      creation_request jsonb NOT NULL,metadata jsonb NOT NULL,head_order bigint NOT NULL CHECK(head_order>0),
      FOREIGN KEY(resource_type,page_id) REFERENCES "${schema}".private_resources(type,id),UNIQUE(workspace_id,page_id))`);
    await client.query(`CREATE TABLE "${schema}".private_page_updates (
      workspace_id uuid NOT NULL,page_id uuid NOT NULL,server_order bigint NOT NULL CHECK(server_order>0),
      digest text NOT NULL CHECK(digest~'^[0-9a-f]{64}$'),update bytea NOT NULL CHECK(octet_length(update)>0),
      first_client_id uuid NOT NULL REFERENCES "${schema}".private_devices(id),
      PRIMARY KEY(page_id,server_order),UNIQUE(page_id,digest),
      FOREIGN KEY(workspace_id,page_id) REFERENCES "${schema}".private_page_documents(workspace_id,page_id))`);
    await client.query(`UPDATE "${schema}".private_schema_version SET version=3 WHERE singleton=true`);
    await client.query('COMMIT');
  } catch(error) {try{await client.query('ROLLBACK');}catch{/* fixed CLI error only */}throw error;} finally {client.release();}
}
export async function verifyPrivatePageSchema(client: pg.PoolClient, schema: string) {
  await client.query(`SELECT page_id,workspace_id,editor_schema_version,creation_request,metadata,head_order FROM "${schema}".private_page_documents LIMIT 0`);
  await client.query(`SELECT workspace_id,page_id,server_order,digest,update,first_client_id FROM "${schema}".private_page_updates LIMIT 0`);
}
