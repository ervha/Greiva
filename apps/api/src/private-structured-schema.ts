import type pg from 'pg';
import { randomBytes } from 'node:crypto';
import { privateSchemaName } from './private-schema-name.js';

// Explicit operator upgrade of metadata v1, never an API startup migration.
// Existing Task/Relation metadata has no attributable entity/history: refuse
// to invent it. Page metadata and registered owners/devices remain unchanged.
export async function installPrivateStructuredSchema(pool: pg.Pool, candidate: string) {
  const schema=privateSchemaName(candidate),client=await pool.connect();
  try {
    await client.query('BEGIN');
    const version=await client.query(`SELECT version FROM "${schema}".private_schema_version WHERE singleton=true FOR UPDATE`);
    if(version.rowCount!==1 || version.rows[0].version!==1)throw new Error('Explicit metadata version one required');
    // Permission transactions acquire the version SHARE lock first. This
    // upgrade waits for them and blocks new ones before altering metadata.
    await client.query(`LOCK TABLE "${schema}".private_workspaces,"${schema}".private_devices,"${schema}".private_resources IN ACCESS EXCLUSIVE MODE`);
    if((await client.query(`SELECT 1 FROM "${schema}".private_resources WHERE type IN ('task','relation') LIMIT 1`)).rowCount)throw new Error('Unattributed structured metadata');
    await client.query(`CREATE TABLE "${schema}".private_structured_config (
      singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),secret bytea NOT NULL CHECK(octet_length(secret)=32))`);
    await client.query(`INSERT INTO "${schema}".private_structured_config VALUES(true,$1)`,[randomBytes(32)]);
    await client.query(`CREATE TABLE "${schema}".private_structured_streams (
      workspace_id uuid PRIMARY KEY REFERENCES "${schema}".private_workspaces(id),last_order bigint NOT NULL DEFAULT 0 CHECK(last_order>=0))`);
    await client.query(`CREATE TABLE "${schema}".private_structured_entities (
      type text NOT NULL CHECK(type IN ('task','relation')),id uuid NOT NULL,workspace_id uuid NOT NULL REFERENCES "${schema}".private_workspaces(id),
      version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),entity jsonb NOT NULL,
      PRIMARY KEY(type,id),FOREIGN KEY(type,id) REFERENCES "${schema}".private_resources(type,id),UNIQUE(workspace_id,type,id))`);
    await client.query(`CREATE TABLE "${schema}".private_structured_operations (
      workspace_id uuid NOT NULL REFERENCES "${schema}".private_workspaces(id),server_order bigint NOT NULL CHECK(server_order>0),
      operation_id uuid NOT NULL UNIQUE,client_id uuid NOT NULL REFERENCES "${schema}".private_devices(id),
      request jsonb NOT NULL,result jsonb NOT NULL,local_after jsonb,PRIMARY KEY(workspace_id,server_order))`);
    await client.query(`CREATE TABLE "${schema}".private_structured_history (
      workspace_id uuid NOT NULL,type text NOT NULL,id uuid NOT NULL,version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),entity jsonb NOT NULL,
      PRIMARY KEY(workspace_id,type,id,version),FOREIGN KEY(workspace_id,type,id) REFERENCES "${schema}".private_structured_entities(workspace_id,type,id))`);
    await client.query(`CREATE TABLE "${schema}".private_structured_conflicts (
      id uuid PRIMARY KEY,workspace_id uuid NOT NULL,type text NOT NULL,entity_id uuid NOT NULL,status text NOT NULL CHECK(status IN ('open','resolved')),record jsonb NOT NULL,
      FOREIGN KEY(workspace_id,type,entity_id) REFERENCES "${schema}".private_structured_entities(workspace_id,type,id))`);
    await client.query(`UPDATE "${schema}".private_schema_version SET version=2 WHERE singleton=true`);
    await client.query('COMMIT');
  } catch(error) {try{await client.query('ROLLBACK');}catch{/* fixed CLI error only */}throw error;} finally {client.release();}
}

// Readiness is read-only and never creates keys or repairs missing ledgers.
export async function verifyPrivateStructuredSchema(client: pg.PoolClient, schema: string) {
  const config=await client.query(`SELECT secret FROM "${schema}".private_structured_config WHERE singleton=true`);
  if(config.rowCount!==1 || !Buffer.isBuffer(config.rows[0].secret) || config.rows[0].secret.length!==32)throw new Error('Private structured configuration unavailable');
  for(const sql of [
    `SELECT workspace_id,last_order FROM "${schema}".private_structured_streams LIMIT 0`,
    `SELECT type,id,workspace_id,version,entity FROM "${schema}".private_structured_entities LIMIT 0`,
    `SELECT workspace_id,server_order,operation_id,client_id,request,result,local_after FROM "${schema}".private_structured_operations LIMIT 0`,
    `SELECT workspace_id,type,id,version,entity FROM "${schema}".private_structured_history LIMIT 0`,
    `SELECT id,workspace_id,type,entity_id,status,record FROM "${schema}".private_structured_conflicts LIMIT 0`,
  ])await client.query(sql);
}
