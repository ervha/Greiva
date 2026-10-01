import pg from 'pg';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { bigint, date, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { parseOperationPayload, pushOperationSchema, taskSchema, relationSchema, type PushOperation, type Task, type Relation } from '@greiva/protocol';

function models(name: string) {
  const schema = pgSchema(name);
  const common = () => ({ id: uuid('id').primaryKey(), version: bigint('version', { mode: 'number' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }) });
  return {
    tasks: schema.table('tasks', { ...common(), title: text('title').notNull(), status: text('status').notNull(), due: date('due', { mode: 'string' }) }),
    relations: schema.table('relations', { ...common(), fromType: text('from_type').notNull(), fromId: uuid('from_id').notNull(), toType: text('to_type').notNull(), toId: uuid('to_id').notNull() }),
  };
}
function utc<T extends { createdAt: string; updatedAt: string; deletedAt: string | null }>(value: T) {
  return { ...value, createdAt: new Date(value.createdAt).toISOString(), updatedAt: new Date(value.updatedAt).toISOString(), deletedAt: value.deletedAt ? new Date(value.deletedAt).toISOString() : null };
}
export class EntityWriteError extends Error {
  constructor(readonly code: 'not_found'|'already_exists'|'version_conflict'|'deleted', readonly entity: Task | Relation | null = null) { super(code); }
}
export class StructuredRepository {
  private readonly schema;
  private readonly db;
  private constructor(private readonly pool: pg.Pool, name: string) {
    this.schema = models(name); this.db = drizzle({ client: pool });
  }
  static async open(connectionString: string, name = 'greiva_structured') {
    // Names are application-owned, never supplied by an HTTP request.
    if (!/^greiva_[a-z0-9_]{1,48}$/.test(name)) throw new Error('Invalid owned schema name');
    const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000, max: 4 });
    let client: pg.PoolClient;
    try { client = await pool.connect(); } catch (error) { await pool.end(); throw error; }
    let failed = false;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`greiva-schema:${name}`]);
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${name}"`);
      await client.query(`CREATE TABLE IF NOT EXISTS "${name}".schema_version (singleton integer PRIMARY KEY CHECK(singleton=1),version integer NOT NULL)`);
      const result = await client.query<{ version: number }>(`SELECT version FROM "${name}".schema_version WHERE singleton=1`);
      const version = result.rows[0]?.version ?? 0;
      if (version !== 0 && version !== 1) throw new Error(`Unsupported structured schema version: ${version}`);
      if (version === 0) {
        // No DROP/rebuild: an unexpected existing model makes initialization fail.
        const common = 'id uuid PRIMARY KEY,version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,deleted_at timestamptz';
        await client.query(`CREATE TABLE "${name}".tasks (${common},title text NOT NULL,status text NOT NULL CHECK(status IN ('todo','in_progress','done')),due date)`);
        await client.query(`CREATE TABLE "${name}".relations (${common},from_type text NOT NULL CHECK(from_type IN ('page','task')),from_id uuid NOT NULL,to_type text NOT NULL CHECK(to_type IN ('page','task')),to_id uuid NOT NULL)`);
        await client.query(`INSERT INTO "${name}".schema_version VALUES (1,1)`);
      }
      await client.query(`SELECT id,title,status,due,version,created_at,updated_at,deleted_at FROM "${name}".tasks LIMIT 0`);
      await client.query(`SELECT id,from_type,from_id,to_type,to_id,version,created_at,updated_at,deleted_at FROM "${name}".relations LIMIT 0`);
      await client.query('COMMIT');
      return new StructuredRepository(pool, name);
    } catch (error) {
      failed = true; await client.query('ROLLBACK'); throw error;
    } finally { client.release(); if (failed) await pool.end(); }
  }
  async close() { await this.pool.end(); }
  async onModuleDestroy() { await this.close(); }
  async tasks(includeDeleted = false): Promise<Task[]> {
    const table = this.schema.tasks;
    const rows = await this.db.select().from(table).where(includeDeleted ? undefined : isNull(table.deletedAt)).orderBy(table.createdAt, table.id);
    return rows.map(row => taskSchema.parse(utc(row)));
  }
  async relations(includeDeleted = false): Promise<Relation[]> {
    const table = this.schema.relations;
    const rows = await this.db.select().from(table).where(includeDeleted ? undefined : isNull(table.deletedAt)).orderBy(table.createdAt, table.id);
    return rows.map(row => relationSchema.parse(utc(row)));
  }
  // Step 6 model storage. Not a sync/ACK API: Step 7 adds a durable operation
  // ledger, stream ordering, causal merging, conflicts and cursor transactions.
  async mutate(input: PushOperation): Promise<Task | Relation> {
    const operation = pushOperationSchema.parse(input);
    const payload = parseOperationPayload(operation);
    return this.db.transaction(async tx => {
      // Serialize competing creates too, where no entity row exists to lock.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${operation.entityType}:${operation.entityId}`},0))`);
      if (operation.entityType === 'task') {
        const table = this.schema.tasks;
        const [raw] = await tx.select().from(table).where(eq(table.id, operation.entityId));
        const current = raw ? taskSchema.parse(utc(raw)) : null;
        checkMutation(operation, current);
        const now = new Date().toISOString();
        const next = taskSchema.parse({ ...(current ?? { id: operation.entityId, createdAt: now, deletedAt: null }), ...payload,
          version: (current?.version ?? 0) + 1, updatedAt: now, ...(operation.kind === 'delete' ? { deletedAt: now } : {}) });
        if (current) await tx.update(table).set(next).where(and(eq(table.id,next.id),eq(table.version,current.version)));
        else await tx.insert(table).values(next);
        return next;
      }
      const table = this.schema.relations;
      const [raw] = await tx.select().from(table).where(eq(table.id,operation.entityId));
      const current = raw ? relationSchema.parse(utc(raw)) : null;
      checkMutation(operation,current);
      const now = new Date().toISOString();
      const next = relationSchema.parse({ ...(current ?? { id: operation.entityId, createdAt: now, deletedAt: null }), ...payload,
        version: (current?.version ?? 0) + 1, updatedAt: now, ...(operation.kind === 'delete' ? { deletedAt: now } : {}) });
      if (current) await tx.update(table).set(next).where(and(eq(table.id,next.id),eq(table.version,current.version)));
      else await tx.insert(table).values(next);
      return next;
    });
  }
}
function checkMutation(operation: PushOperation, current: Task | Relation | null) {
  if (operation.kind === 'create') { if (current) throw new EntityWriteError('already_exists',current); return; }
  if (!current) throw new EntityWriteError('not_found');
  if (current.deletedAt) throw new EntityWriteError('deleted',current);
  if (operation.baseVersion !== current.version) throw new EntityWriteError('version_conflict',current);
}
