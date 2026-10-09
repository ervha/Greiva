import type pg from 'pg';
import { idSchema } from '@greiva/shared';
import { resourceReferenceSchema, subjectIdSchema, type ResourceReference } from '@greiva/domain';
import { PrivateWorkspaceAccessDenied } from '@greiva/application';
import { SessionVerificationError, type VerifiedSession } from './session-verifier.js';
import { privateSchemaName } from './private-workspace-schema.js';

export type PrivateTransactionContext = Readonly<{
  protocolVersion: 1; issuer: string; subjectId: string; workspaceId: string; clientId: string; epoch: string;
}>;
export type PrivateQueryValue = string | number | boolean | null;
export interface PrivateTransaction {
  readonly context: PrivateTransactionContext;
  query<Row extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, values?: readonly PrivateQueryValue[]): Promise<pg.QueryResult<Row>>;
}
export interface PrivateDeviceAccess {
  access(session: VerifiedSession, workspaceId: string, clientId: string): Promise<Readonly<{ protocolVersion: 1; workspaceId: string; clientId: string; epoch: string }>>;
}
export class PrivateTransactionInvalidRequest extends Error { constructor() { super('Invalid private transaction request'); } }
export class PrivateTransactionUnavailable extends Error {
  // A lost COMMIT reply cannot prove rollback. A future operation ledger must
  // settle retries; this boundary never retries business work automatically.
  readonly outcome = 'unknown';
  constructor() { super('Private transaction unavailable'); }
}

// Trusted server business code only; SQL is never accepted from an HTTP body.
// This is a transaction/permission lease, not a SQL sandbox or a sync server.
// Business queries must still scope their data to context.workspaceId, and
// must not issue transaction control, change workspace/device/schema
// authorization, or retain ports. Resource writes need scoped repository logic.
export class PostgresPrivateTransactions implements PrivateDeviceAccess {
  private readonly schema: string;
  constructor(private readonly pool: pg.Pool, schema: string, private readonly now: () => number = Date.now) {
    this.schema = privateSchemaName(schema);
  }

  access(session: VerifiedSession, workspaceId: string, clientId: string) {
    return this.run(session, workspaceId, clientId, [], async ({ context }) => Object.freeze({
      protocolVersion: context.protocolVersion, workspaceId: context.workspaceId, clientId: context.clientId, epoch: context.epoch,
    }));
  }

  async run<T>(session: VerifiedSession, workspaceId: string, clientId: string, targets: readonly ResourceReference[], work: (transaction: PrivateTransaction) => Promise<T>, options:Readonly<{metadataJournal?:boolean}>={}): Promise<T> {
    const metadataJournal=options.metadataJournal===true;
    const workspace = idSchema.safeParse(workspaceId), device = idSchema.safeParse(clientId);
    const parsedTargets = targets.map(target => resourceReferenceSchema.safeParse(target));
    if (!workspace.success || !device.success || targets.length > 100 || parsedTargets.some(target => !target.success)) throw new PrivateTransactionInvalidRequest();
    const refs = parsedTargets.map(target => { if (!target.success) throw new PrivateTransactionInvalidRequest(); return Object.freeze({ ...target.data }); })
      .sort((a,b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id));
    if (new Set(refs.map(ref => `${ref.type}:${ref.id}`)).size !== refs.length) throw new PrivateTransactionInvalidRequest();
    const subject = subjectIdSchema.safeParse(session.subjectId), issuer = subjectIdSchema.safeParse(session.issuer), expiresAt = session.expiresAt;
    if (!subject.success || !issuer.success || !Number.isSafeInteger(expiresAt)) throw new SessionVerificationError('invalid_session');
    const subjectId = subject.data, ownerIssuer = issuer.data, schema = this.schema;
    const assertSession = () => { if (expiresAt <= Math.floor(this.now()/1000)) throw new SessionVerificationError('invalid_session'); };
    assertSession();
    let client: pg.PoolClient | undefined, active = false, fault: unknown, destroy = false;
    const pending = new Set<Promise<unknown>>();
    try {
      client = await this.pool.connect(); assertSession();
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const version = await client.query(`SELECT version FROM "${schema}".private_schema_version WHERE singleton=true FOR SHARE`);
      if (version.rowCount !== 1 || ![1,2,3,4,5,6,7,8].includes(version.rows[0].version)) throw new PrivateTransactionUnavailable();
      // SHARE blocks non-key updates (deleted/revoked) too. KEY SHARE would
      // permit them. The lock order is workspace, device, sorted resources.
      const rows = await client.query(`SELECT owner_issuer,owner_subject_id,epoch,deleted FROM "${schema}".private_workspaces WHERE id=$1 FOR SHARE`, [workspace.data]);
      const row = rows.rows[0];
      if (rows.rowCount !== 1 || row.deleted || row.owner_issuer !== ownerIssuer || row.owner_subject_id !== subjectId) throw new PrivateWorkspaceAccessDenied();
      const devices = await client.query(`SELECT workspace_id,revoked FROM "${schema}".private_devices WHERE id=$1 FOR SHARE`, [device.data]);
      if (devices.rowCount !== 1 || devices.rows[0].revoked || devices.rows[0].workspace_id !== workspace.data) throw new PrivateWorkspaceAccessDenied();
      // Writers reserve commit order before any resource/document lock. The
      // same order covers creation and rename, including bootstrap retries.
      if(metadataJournal&&version.rows[0].version>=5){
        await client.query(`INSERT INTO "${schema}".private_page_metadata_heads VALUES($1,0) ON CONFLICT(workspace_id) DO NOTHING`,[workspace.data]);
        const head=await client.query(`SELECT head_order FROM "${schema}".private_page_metadata_heads WHERE workspace_id=$1 FOR UPDATE`,[workspace.data]);
        if(head.rowCount!==1)throw new PrivateTransactionUnavailable();
        const last=await client.query(`SELECT server_order FROM "${schema}".private_page_metadata_events WHERE workspace_id=$1 ORDER BY server_order DESC LIMIT 1`,[workspace.data]);
        if((last.rows[0]?.server_order??'0')!==head.rows[0].head_order)throw new PrivateTransactionUnavailable();
      }
      for (const ref of refs) {
        const resources = await client.query(`SELECT workspace_id,deleted FROM "${schema}".private_resources WHERE type=$1 AND id=$2 FOR SHARE`, [ref.type,ref.id]);
        if (resources.rowCount !== 1 || resources.rows[0].deleted || resources.rows[0].workspace_id !== workspace.data) throw new PrivateWorkspaceAccessDenied();
      }
      assertSession();
      const context: PrivateTransactionContext = Object.freeze({ protocolVersion: 1, issuer: ownerIssuer, subjectId, workspaceId: workspace.data, clientId: device.data, epoch: idSchema.parse(row.epoch) });
      const capturedClient = client;
      active = true;
      const transaction: PrivateTransaction = Object.freeze({ context, query: <Row extends pg.QueryResultRow>(sql: string, values: readonly PrivateQueryValue[] = []) => {
        const query = (async (): Promise<pg.QueryResult<Row>> => {
          try {
            if (!active || fault) throw new PrivateTransactionUnavailable();
            assertSession();
            // Copy primitives before handing them to the driver; no mutable
            // request objects, buffers, custom toPostgres hooks or config ports.
            const capturedValues = values.map(value => {
              if (value !== null && !['string','number','boolean'].includes(typeof value)) throw new PrivateTransactionInvalidRequest();
              if (typeof value === 'number' && !Number.isFinite(value)) throw new PrivateTransactionInvalidRequest();
              return value;
            });
            const result = await capturedClient.query<Row>(sql, capturedValues);
            if (!active) throw new PrivateTransactionUnavailable();
            assertSession();
            return result;
          } catch (error) { fault ??= error; throw error; }
        })();
        pending.add(query);
        // Attach a rejection handler even if trusted work accidentally forgets
        // to await. An unfinished/failed query forces the outer rollback.
        void query.then(() => pending.delete(query), () => pending.delete(query));
        return query;
      } });
      const result = await work(transaction);
      active = false;
      if (pending.size || fault) throw fault ?? new PrivateTransactionUnavailable();
      assertSession();
      await client.query('COMMIT');
      return result;
    } catch (error) {
      active = false;
      await Promise.allSettled([...pending]);
      try { await client?.query('ROLLBACK'); } catch { destroy = true; }
      if (error instanceof SessionVerificationError || error instanceof PrivateWorkspaceAccessDenied || error instanceof PrivateTransactionInvalidRequest) throw error;
      throw new PrivateTransactionUnavailable();
    } finally { client?.release(destroy); }
  }
}
