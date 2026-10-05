import type pg from 'pg';
import { verifyPrivateStructuredSchema } from './private-structured-schema.js';
import { verifyPrivatePageSchema } from './private-page-schema.js';
import { privateSchemaName } from './private-schema-name.js';
export { privateSchemaName } from './private-schema-name.js';

// Readiness check only: no DDL, auto repair, bootstrap or ownership mutation.
export async function verifyPrivateWorkspaceSchema(pool: pg.Pool, candidate: string) {
  const schema = privateSchemaName(candidate), client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const version = await client.query(`SELECT version FROM "${schema}".private_schema_version WHERE singleton=true`);
    if (version.rowCount !== 1 || ![1,2,3].includes(version.rows[0].version)) throw new Error('Unsupported private schema');
    for (const query of [
      `SELECT id,owner_issuer,owner_subject_id,epoch,deleted FROM "${schema}".private_workspaces LIMIT 0`,
      `SELECT id,workspace_id,revoked FROM "${schema}".private_devices LIMIT 0`,
      `SELECT type,id,workspace_id,deleted FROM "${schema}".private_resources LIMIT 0`,
      `SELECT id,owner_subject_id,owner_issuer FROM "${schema}".workspace_access LIMIT 0`,
      `SELECT type,id,workspace_id,deleted FROM "${schema}".resource_access LIMIT 0`,
    ]) await client.query(query);
    if(version.rows[0].version>=2)await verifyPrivateStructuredSchema(client,schema);
    if(version.rows[0].version===3)await verifyPrivatePageSchema(client,schema);
    await client.query('COMMIT');
    return version.rows[0].version as 1 | 2 | 3;
  } catch {
    try { await client.query('ROLLBACK'); } catch { /* fixed error only */ }
    throw new Error('Private workspace schema unavailable');
  } finally { client.release(); }
}

// Explicit fresh namespace installer only. No IF NOT EXISTS, old DB import,
// destructive repair, auto-start migration or guessed workspace ownership.
export async function installPrivateWorkspaceSchema(pool: pg.Pool, candidate: string) {
  const schema = privateSchemaName(candidate), client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`CREATE TABLE "${schema}".private_schema_version (
      singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), version integer NOT NULL CHECK(version>0))`);
    await client.query(`INSERT INTO "${schema}".private_schema_version VALUES(true,1)`);
    await client.query(`CREATE TABLE "${schema}".private_workspaces (
      id uuid PRIMARY KEY, owner_issuer text NOT NULL CHECK(length(btrim(owner_issuer))>0),
      owner_subject_id text NOT NULL CHECK(length(btrim(owner_subject_id))>0),
      epoch uuid NOT NULL UNIQUE, deleted boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_issuer,owner_subject_id))`);
    await client.query(`CREATE TABLE "${schema}".private_devices (
      id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES "${schema}".private_workspaces(id),
      revoked boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(`CREATE TABLE "${schema}".private_resources (
      type text NOT NULL CHECK(type IN ('page','task','relation')), id uuid NOT NULL,
      workspace_id uuid NOT NULL REFERENCES "${schema}".private_workspaces(id),
      deleted boolean NOT NULL DEFAULT false, PRIMARY KEY(type,id))`);
    await client.query(`CREATE INDEX private_resources_workspace ON "${schema}".private_resources(workspace_id,type,id)`);
    await client.query(`CREATE VIEW "${schema}".workspace_access AS
      SELECT id,owner_subject_id,owner_issuer FROM "${schema}".private_workspaces WHERE NOT deleted`);
    await client.query(`CREATE VIEW "${schema}".resource_access AS
      SELECT type,id,workspace_id,deleted FROM "${schema}".private_resources`);
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve original installation failure */ }
    throw error;
  } finally { client.release(); }
}
