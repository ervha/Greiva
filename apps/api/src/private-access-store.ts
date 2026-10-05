import type pg from 'pg';
import type { PrivateWorkspaceAccessStore } from '@greiva/application';
import { privateAccessSnapshotSchema, type ResourceReference } from '@greiva/domain';

// Read-only adapter. Views must derive ownership/tombstones from authoritative
// production tables. No migration/DDL or materialized-cache refresh happens here.
export class PostgresPrivateAccessStore implements PrivateWorkspaceAccessStore {
  constructor(private readonly pool: pg.Pool, private readonly schema: string) {
    if (!/^greiva_[a-z0-9_]{1,48}$/.test(schema)) throw new Error('Invalid owned schema name');
  }
  async read(workspaceId: string, targets: readonly ResourceReference[]) {
    const result = await this.pool.query(`
      SELECT jsonb_build_object('id', w.id, 'ownerSubjectId', w.owner_subject_id) AS workspace,
        COALESCE(jsonb_agg(jsonb_build_object('type', r.type, 'id', r.id, 'workspaceId', r.workspace_id, 'deleted', r.deleted))
          FILTER (WHERE r.id IS NOT NULL), '[]'::jsonb) AS resources
      FROM "${this.schema}".workspace_access w
      LEFT JOIN "${this.schema}".resource_access r ON (r.type, r.id) IN
        (SELECT type, id FROM jsonb_to_recordset($2::jsonb) AS target(type text, id uuid))
      WHERE w.id = $1::uuid GROUP BY w.id, w.owner_subject_id`, [workspaceId, JSON.stringify(targets)]);
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw new Error('Ambiguous workspace ownership metadata');
    return privateAccessSnapshotSchema.parse(result.rows[0]);
  }
}
