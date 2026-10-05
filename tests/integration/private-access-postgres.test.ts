import { it, expect } from 'vitest';
import pg from 'pg';
import { newId } from '@greiva/shared';
import { privateWorkspaceAccess, PrivateWorkspaceAccessDenied } from '@greiva/application';
import { PostgresPrivateAccessStore } from '../../apps/api/src/private-access-store.js';

it.skipIf(process.env.GREIVA_TEST_POSTGRES !== '1')('PRIVATE-ACCESS-PG: one real SQL snapshot rejects cross-owner/workspace/type/deleted resources and cleans its isolated schema', async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000, max: 2 });
  const schema = `greiva_access_${newId().replaceAll('-', '')}`, workspaceA = newId(), workspaceB = newId(), page = newId(), foreign = newId(), deleted = newId();
  let created = false;
  expect(() => new PostgresPrivateAccessStore(pool, 'public";DROP SCHEMA public')).toThrow();
  try {
    await pool.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    // Fixture read-model tables only. No production migration/view is implied.
    await pool.query(`CREATE TABLE "${schema}".workspace_access(id uuid PRIMARY KEY,owner_subject_id text NOT NULL)`);
    await pool.query(`CREATE TABLE "${schema}".resource_access(type text NOT NULL,id uuid NOT NULL,workspace_id uuid NOT NULL,deleted boolean NOT NULL,PRIMARY KEY(type,id))`);
    await pool.query(`INSERT INTO "${schema}".workspace_access VALUES($1,'subject-A'),($2,'subject-B')`, [workspaceA, workspaceB]);
    await pool.query(`INSERT INTO "${schema}".resource_access VALUES('page',$1,$4,false),('task',$1,$4,false),('page',$2,$5,false),('page',$3,$4,true)`, [page, foreign, deleted, workspaceA, workspaceB]);
    const store = new PostgresPrivateAccessStore(pool, schema), owner = privateWorkspaceAccess('subject-A', store), other = privateWorkspaceAccess('subject-B', store);
    await expect(owner.workspace(workspaceA)).resolves.toMatchObject({ workspaceId: workspaceA });
    await expect(owner.resources(workspaceA, [{ type: 'page', id: page }, { type: 'task', id: page }])).resolves.toMatchObject({ workspaceId: workspaceA });
    await expect(owner.pageDocument(workspaceA, `page:${page}`)).resolves.toMatchObject({ workspaceId: workspaceA });
    await expect(other.pageDocument(workspaceA, `page:${page}`)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    for (const id of [foreign, deleted, newId()]) await expect(owner.pageDocument(workspaceA, `page:${id}`)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    await expect(owner.workspace(workspaceB)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    // Even owning both workspaces does not grant access through the wrong scope.
    await pool.query(`UPDATE "${schema}".workspace_access SET owner_subject_id='subject-A' WHERE id=$1`, [workspaceB]);
    await expect(owner.workspace(workspaceB)).resolves.toMatchObject({ workspaceId: workspaceB });
    await expect(owner.pageDocument(workspaceA, `page:${foreign}`)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    // Repeated access rereads revocation; this is not a connection-long lease.
    await pool.query(`UPDATE "${schema}".workspace_access SET owner_subject_id='subject-B' WHERE id=$1`, [workspaceA]);
    await expect(owner.pageDocument(workspaceA, `page:${page}`)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
  } finally {
    try {
      if (created) {
        await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
        const remaining = await pool.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema]);
        expect(remaining.rowCount).toBe(0);
      }
    } finally { await pool.end(); }
  }
});
