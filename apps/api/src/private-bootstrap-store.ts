import type pg from 'pg';
import { idSchema, newId } from '@greiva/shared';
import { privateBootstrapRequestSchema } from '@greiva/protocol/workspace';
import { subjectIdSchema } from '@greiva/domain';
import { PrivateWorkspaceAccessDenied } from '@greiva/application';
import { type VerifiedSession, SessionVerificationError } from './session-verifier.js';
import { privateSchemaName } from './private-workspace-schema.js';

export type PrivateBootstrapResult = Readonly<{ protocolVersion: 1; workspaceId: string; clientId: string; epoch: string }>;
export interface PrivateWorkspaceBootstrap { bootstrap(session: VerifiedSession, candidate: unknown): Promise<PrivateBootstrapResult>; }
export class PrivateBootstrapInvalidRequest extends Error { constructor() { super('Invalid private bootstrap request'); } }
export class PrivateBootstrapUnavailable extends Error {
  readonly outcome = 'unknown';
  constructor() { super('Private bootstrap unavailable; retry the same authenticated account and client ID'); }
}
const requestSchema = privateBootstrapRequestSchema;

// Receives a verified server session, never an actor from a request body.
// One initial private workspace per issuer/subject; client ID is a registration
// reference, not an authentication secret or proof of physical device identity.
export class PostgresPrivateBootstrapStore implements PrivateWorkspaceBootstrap {
  private readonly schema: string;
  constructor(private readonly pool: pg.Pool, schema: string) { this.schema = privateSchemaName(schema); }
  async bootstrap(session: VerifiedSession, candidate: unknown): Promise<PrivateBootstrapResult> {
    const request = requestSchema.safeParse(candidate);
    if (!request.success) throw new PrivateBootstrapInvalidRequest();
    const clientId = request.data.clientId, subject = subjectIdSchema.safeParse(session.subjectId), issuer = subjectIdSchema.safeParse(session.issuer);
    const expiresAt = session.expiresAt;
    if (!subject.success || !issuer.success || !Number.isSafeInteger(expiresAt)) throw new SessionVerificationError('invalid_session');
    const assertSession = () => { if (expiresAt <= Math.floor(Date.now()/1000)) throw new SessionVerificationError('invalid_session'); };
    assertSession();
    const subjectId = subject.data, ownerIssuer = issuer.data, schema = this.schema;
    let client: pg.PoolClient | undefined;
    try {
      client = await this.pool.connect(); assertSession(); await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const version = await client.query(`SELECT version FROM "${schema}".private_schema_version WHERE singleton=true FOR SHARE`);
      if (version.rowCount !== 1 || ![1,2,3].includes(version.rows[0].version)) throw new PrivateBootstrapUnavailable();
      await client.query(`INSERT INTO "${schema}".private_workspaces(id,owner_issuer,owner_subject_id,epoch)
        VALUES($1,$2,$3,$4) ON CONFLICT(owner_issuer,owner_subject_id) DO NOTHING`, [newId(),ownerIssuer,subjectId,newId()]);
      // Separate statement after the unique-index wait observes the committed
      // concurrent winner under READ COMMITTED. Lock before device registration.
      const workspaces = await client.query(`SELECT id,epoch,deleted FROM "${schema}".private_workspaces
        WHERE owner_issuer=$1 AND owner_subject_id=$2 FOR UPDATE`, [ownerIssuer,subjectId]);
      if (workspaces.rowCount !== 1 || workspaces.rows[0].deleted) throw new PrivateWorkspaceAccessDenied();
      const workspace = workspaces.rows[0], workspaceId = idSchema.parse(workspace.id), epoch = idSchema.parse(workspace.epoch);
      await client.query(`INSERT INTO "${schema}".private_devices(id,workspace_id) VALUES($1,$2) ON CONFLICT(id) DO NOTHING`, [clientId,workspaceId]);
      const devices = await client.query(`SELECT workspace_id,revoked FROM "${schema}".private_devices WHERE id=$1 FOR UPDATE`, [clientId]);
      if (devices.rowCount !== 1 || devices.rows[0].workspace_id !== workspaceId || devices.rows[0].revoked) throw new PrivateWorkspaceAccessDenied();
      assertSession();
      await client.query('COMMIT');
      return Object.freeze({ protocolVersion: 1, workspaceId, clientId, epoch });
    } catch (error) {
      try { await client?.query('ROLLBACK'); } catch { /* no SQL or credential cause exposed */ }
      if (error instanceof PrivateWorkspaceAccessDenied || error instanceof SessionVerificationError) throw error;
      // Even COMMIT response loss is not a durable failure proof. Natural owner
      // uniqueness + same client ID make retry safe without a new workspace.
      throw new PrivateBootstrapUnavailable();
    } finally { client?.release(); }
  }
}
