import pg from 'pg';
import { and, asc, eq, gt, isNull, lte, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { bigint, date, pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { parseOperationPayload, pushOperationSchema, pushResultSchema, pullResponseSchema, taskSchema, relationSchema, type PushOperation, type PushResult, type PullResponse, type Conflict, type StructuredEntity, type Task, type Relation } from '@greiva/protocol';
import { newId, utcNow } from '@greiva/shared';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { syncModels } from './sync-schema.js';
type Db = ReturnType<typeof drizzle>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

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
  private constructor(private readonly pool: pg.Pool, private readonly name: string) {
    this.schema = { ...models(name), ...syncModels(name) }; this.db = drizzle({ client: pool });
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
      if (![0,1,2,3].includes(version)) throw new Error(`Unsupported structured schema version: ${version}`);
      if (version === 0) {
        // No DROP/rebuild: an unexpected existing model makes initialization fail.
        const common = 'id uuid PRIMARY KEY,version bigint NOT NULL CHECK(version BETWEEN 1 AND 9007199254740991),created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,deleted_at timestamptz';
        await client.query(`CREATE TABLE "${name}".tasks (${common},title text NOT NULL,status text NOT NULL CHECK(status IN ('todo','in_progress','done')),due date)`);
        await client.query(`CREATE TABLE "${name}".relations (${common},from_type text NOT NULL CHECK(from_type IN ('page','task')),from_id uuid NOT NULL,to_type text NOT NULL CHECK(to_type IN ('page','task')),to_id uuid NOT NULL)`);
        await client.query(`INSERT INTO "${name}".schema_version VALUES (1,1)`);
      }
      await client.query(`SELECT id,title,status,due,version,created_at,updated_at,deleted_at FROM "${name}".tasks LIMIT 0`);
      await client.query(`SELECT id,from_type,from_id,to_type,to_id,version,created_at,updated_at,deleted_at FROM "${name}".relations LIMIT 0`);
      if (version < 2) await migrateSync(client,name);
      if (version < 3) await migrateCausalFrames(client,name);
      const streamState = await client.query(`SELECT last_sequence,epoch,secret FROM "${name}".stream_state WHERE singleton=1`);
      if (streamState.rows.length !== 1) throw new Error('Structured stream state is missing');
      await client.query(`SELECT server_order,operation_id,request,result,local_after FROM "${name}".server_operations LIMIT 0`);
      await client.query(`SELECT entity_type,entity_id,version,entity FROM "${name}".entity_history LIMIT 0`);
      await client.query(`SELECT id,entity_type,entity_id,status,record FROM "${name}".conflicts LIMIT 0`);
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
  // Kept for repository callers: every write now uses the same durable ledger.
  async mutate(input: PushOperation): Promise<Task | Relation> {
    const result = await this.push(input);
    if (result.status === 'conflict') throw new EntityWriteError('version_conflict',result.entity);
    if (result.status === 'rejected') throw new Error(result.error.code);
    return result.entity;
  }
  async push(input: PushOperation): Promise<PushResult> {
    const operation = pushOperationSchema.parse(JSON.parse(JSON.stringify(input)));
    return this.db.transaction(async tx => {
      // A transactional counter, not a sequence allocated before commit:
      // pull can never advance past a later-committing lower operation number.
      const stream = (await tx.execute<{last_sequence:string}>(sql`SELECT last_sequence FROM ${sql.identifier(this.name)}.stream_state WHERE singleton=1 FOR UPDATE`)).rows[0];
      if (!stream) throw new Error('Structured stream state is missing');
      const [existing] = await tx.select().from(this.schema.operations).where(eq(this.schema.operations.operationId,operation.operationId));
      if (existing) {
        if (isDeepStrictEqual(existing.request,operation)) return pushResultSchema.parse(existing.result);
        return rejected(operation,existing.serverOrder.toString(),'operation_id_reused',null);
      }
      const order = BigInt(stream.last_sequence) + 1n;
      const current = await this.readEntity(tx,operation);
      let payload: Record<string,unknown>;
      try { payload = parseOperationPayload(operation); }
      catch { return this.finish(tx,operation,rejected(operation,order.toString(),'invalid_payload',current)); }
      let causalBase: Record<string,unknown> | null = null;
      if (operation.predecessorOperationId) {
        const [predecessor] = await tx.select().from(this.schema.operations).where(eq(this.schema.operations.operationId,operation.predecessorOperationId));
        if (operation.kind==='create' || !predecessor?.request || !predecessor.localAfter || predecessor.result.status==='rejected' ||
          predecessor.request.clientId!==operation.clientId || predecessor.request.entityType!==operation.entityType || predecessor.request.entityId!==operation.entityId ||
          predecessor.result.entity?.version!==operation.baseVersion) {
          return this.finish(tx,operation,rejected(operation,order.toString(),'invalid_predecessor',current));
        }
        causalBase = predecessor.localAfter;
      }
      const now = utcNow();
      const common = { operationId:operation.operationId, clientId:operation.clientId, entityType:operation.entityType, entityId:operation.entityId, serverOrder:order.toString() };
      let next: StructuredEntity | null = null;
      let conflicts: Conflict[] = [];
      let changed = false;
      let rejectCode: string | null = null;
      let localAfter: Record<string,unknown> | null = null;
      const fields = operation.entityType === 'task' ? ['title','status','due'] : ['fromType','fromId','toType','toId'];
      const historyTable = this.schema.history;
      if (operation.kind === 'create') {
        localAfter = payload;
        if (current) {
          const [first] = await tx.select().from(historyTable).where(and(eq(historyTable.entityType,operation.entityType),eq(historyTable.entityId,operation.entityId))).orderBy(historyTable.version).limit(1);
          const original = first?.entity ?? current;
          if (fields.every(field => isDeepStrictEqual((original as unknown as Record<string,unknown>)[field],payload[field]))) next = current;
          else rejectCode = 'entity_id_collision';
        } else {
          next = parseEntity(operation.entityType,{ id:operation.entityId,...payload,version:1,createdAt:now,updatedAt:now,deletedAt:null }); changed = true;
        }
      } else if (!current) rejectCode = 'entity_not_found';
      else if (current.deletedAt) {
        // Keep a frame even for ignored updates so later queued operations still
        // acknowledge the tombstone rather than failing their causal dependency.
        next = current; localAfter = {...(causalBase ?? writableFields(current)),...payload};
      }
      else if (current.version === Number.MAX_SAFE_INTEGER) rejectCode = 'version_exhausted';
      else {
        const [base] = await tx.select().from(historyTable).where(and(eq(historyTable.entityType,operation.entityType),eq(historyTable.entityId,operation.entityId),eq(historyTable.version,operation.baseVersion!)));
        if (!base) rejectCode = 'base_unavailable';
        else {
          const effectiveBase = causalBase ?? writableFields(base.entity);
          localAfter = {...effectiveBase,...payload};
          if (operation.kind === 'delete') {
            next = parseEntity(operation.entityType,{...current,version:current.version+1,updatedAt:now,deletedAt:now}); changed = true;
          } else {
            const resolutionRecords: Conflict[] = [];
            if (operation.resolution) {
              for (const id of operation.resolution.conflictIds) {
                const [row] = await tx.select().from(this.schema.conflicts).where(eq(this.schema.conflicts.id,id));
                const record = row?.record;
                if (!record || record.status !== 'open' || record.entityType !== operation.entityType || record.entityId !== operation.entityId ||
                  !Object.hasOwn(payload,record.field) || !isDeepStrictEqual(payload[record.field],record[operation.resolution.choice])) { rejectCode = 'invalid_resolution'; break; }
                resolutionRecords.push(record);
              }
            }
            if (!rejectCode) {
              const patch: Record<string,unknown> = {};
              for (const [field,local] of Object.entries(payload)) {
                const previous = effectiveBase[field];
                const remote = (current as unknown as Record<string,unknown>)[field];
                // Full forms can include unchanged fields: these must not undo a peer's edit.
                if (isDeepStrictEqual(previous,local)) continue;
                if (!isDeepStrictEqual(previous,remote) && !isDeepStrictEqual(local,remote)) {
                  conflicts.push({ id:newId(),operationId:operation.operationId,entityType:operation.entityType,entityId:operation.entityId,
                    field:field as Conflict['field'],base:previous,local,remote,createdAt:now,status:'open',resolvedBy:null });
                } else patch[field] = local;
              }
              changed = Object.keys(patch).length > 0 || conflicts.length === 0;
              next = changed ? parseEntity(operation.entityType,{...current,...patch,version:current.version+1,updatedAt:now}) : current;
              if (conflicts.length === 0) {
                for (const record of resolutionRecords) conflicts.push({...record,status:'resolved',resolvedBy:operation.operationId});
              }
            }
          }
        }
      }
      if (rejectCode) return this.finish(tx,operation,rejected(operation,order.toString(),rejectCode,current));
      if (!next) throw new Error('Structured result has no entity');
      if (next.deletedAt) {
        const open = await tx.select().from(this.schema.conflicts).where(and(eq(this.schema.conflicts.entityType,operation.entityType),eq(this.schema.conflicts.entityId,operation.entityId),eq(this.schema.conflicts.status,'open')));
        conflicts.push(...open.map(row => ({...row.record,status:'resolved' as const,resolvedBy:operation.operationId})));
      }
      if (changed) await this.writeEntity(tx,operation.entityType,next,!current);
      for (const record of conflicts) await tx.insert(this.schema.conflicts).values({id:record.id,entityType:record.entityType,entityId:record.entityId,status:record.status,record}).onConflictDoUpdate({target:this.schema.conflicts.id,set:{status:record.status,record}});
      const result = pushResultSchema.parse({ ...common,status:conflicts.some(record=>record.status==='open') ? 'conflict' : 'acknowledged',entity:next,conflicts });
      return this.finish(tx,operation,result,localAfter);
    });
  }
  private async readEntity(tx: Tx,operation: PushOperation): Promise<StructuredEntity | null> {
    if (operation.entityType === 'task') {
      const [row] = await tx.select().from(this.schema.tasks).where(eq(this.schema.tasks.id,operation.entityId));
      return row ? taskSchema.parse(utc(row)) : null;
    }
    const [row] = await tx.select().from(this.schema.relations).where(eq(this.schema.relations.id,operation.entityId));
    return row ? relationSchema.parse(utc(row)) : null;
  }
  private async writeEntity(tx: Tx,type: PushOperation['entityType'],entity: StructuredEntity,insert: boolean) {
    if (type === 'task') {
      const value = taskSchema.parse(entity);
      if (insert) await tx.insert(this.schema.tasks).values(value); else await tx.update(this.schema.tasks).set(value).where(eq(this.schema.tasks.id,value.id));
    } else {
      const value = relationSchema.parse(entity);
      if (insert) await tx.insert(this.schema.relations).values(value); else await tx.update(this.schema.relations).set(value).where(eq(this.schema.relations.id,value.id));
    }
    await tx.insert(this.schema.history).values({entityType:type,entityId:entity.id,version:entity.version,entity});
  }
  private async finish(tx: Tx,operation: PushOperation,result: PushResult,localAfter: Record<string,unknown> | null = null) {
    await tx.insert(this.schema.operations).values({ serverOrder:BigInt(result.serverOrder), operationId:operation.operationId,request:operation,result,localAfter });
    await tx.execute(sql`UPDATE ${sql.identifier(this.name)}.stream_state SET last_sequence=${result.serverOrder}::bigint WHERE singleton=1`);
    return result;
  }
  async pull(cursor: string | null,limit = 100): Promise<PullResponse> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error('Invalid pull limit');
    return this.db.transaction(async tx => {
      const stream = (await tx.execute<{last_sequence:string;epoch:string;secret:Buffer}>(sql`SELECT last_sequence,epoch,secret FROM ${sql.identifier(this.name)}.stream_state WHERE singleton=1`)).rows[0];
      if (!stream) throw new Error('Structured stream state is missing');
      const head = BigInt(stream.last_sequence);
      const after = decodeCursor(cursor,stream.epoch,stream.secret,head);
      const rows = await tx.select().from(this.schema.operations).where(and(gt(this.schema.operations.serverOrder,after),lte(this.schema.operations.serverOrder,head))).orderBy(asc(this.schema.operations.serverOrder)).limit(limit);
      const applied = rows.at(-1)?.serverOrder ?? after;
      return pullResponseSchema.parse({ operations:rows.map(row => row.result),cursor:encodeCursor(applied,stream.epoch,stream.secret),headCursor:encodeCursor(head,stream.epoch,stream.secret),hasMore:applied<head,serverTime:utcNow() });
    });
  }
}
function parseEntity(type: PushOperation['entityType'],value: unknown): StructuredEntity { return (type === 'task' ? taskSchema : relationSchema).parse(value); }
function writableFields(entity: StructuredEntity): Record<string,unknown> {
  if ('title' in entity) return {title:entity.title,status:entity.status,due:entity.due};
  return {fromType:entity.fromType,fromId:entity.fromId,toType:entity.toType,toId:entity.toId};
}
function rejected(operation: PushOperation,serverOrder: string,code: string,entity: StructuredEntity | null): PushResult {
  return pushResultSchema.parse({operationId:operation.operationId,clientId:operation.clientId,entityType:operation.entityType,entityId:operation.entityId,serverOrder,status:'rejected',entity,conflicts:[],error:{code,message:`Operation rejected: ${code}`,retryable:false}});
}
function encodeCursor(sequence: bigint,epoch: string,secret: Buffer) {
  const content = `${epoch}.${sequence}`;
  return `g1.${content}.${createHmac('sha256',secret).update(content).digest('base64url')}`;
}
export class InvalidCursorError extends Error { constructor() { super('Invalid structured cursor'); } }
function decodeCursor(cursor: string | null,epoch: string,secret: Buffer,head: bigint) {
  if (cursor === null) return 0n;
  const parts = cursor.split('.');
  if (parts.length !== 4 || parts[0] !== 'g1' || parts[1] !== epoch || !/^(0|[1-9][0-9]{0,18})$/.test(parts[2]!)) throw new InvalidCursorError();
  const sequence = BigInt(parts[2]!); const signature = Buffer.from(parts[3]!,'base64url');
  const expected = createHmac('sha256',secret).update(`${epoch}.${sequence}`).digest();
  if (sequence>head || signature.length !== expected.length || !timingSafeEqual(signature,expected)) throw new InvalidCursorError();
  return sequence;
}
async function migrateSync(client: pg.PoolClient,name: string) {
  await client.query(`CREATE TABLE "${name}".stream_state (singleton integer PRIMARY KEY CHECK(singleton=1),last_sequence bigint NOT NULL CHECK(last_sequence>=0),epoch uuid NOT NULL,secret bytea NOT NULL CHECK(octet_length(secret)=32))`);
  await client.query(`CREATE TABLE "${name}".server_operations (server_order bigint PRIMARY KEY CHECK(server_order>0),operation_id uuid NOT NULL UNIQUE,request jsonb,result jsonb NOT NULL)`);
  await client.query(`CREATE TABLE "${name}".entity_history (entity_type text NOT NULL CHECK(entity_type IN ('task','relation')),entity_id uuid NOT NULL,version bigint NOT NULL,entity jsonb NOT NULL,PRIMARY KEY(entity_type,entity_id,version))`);
  await client.query(`CREATE TABLE "${name}".conflicts (id uuid PRIMARY KEY,entity_type text NOT NULL CHECK(entity_type IN ('task','relation')),entity_id uuid NOT NULL,status text NOT NULL CHECK(status IN ('open','resolved')),record jsonb NOT NULL)`);
  const epoch = newId(); let sequence = 0n;
  await client.query(`INSERT INTO "${name}".stream_state VALUES (1,0,$1,$2)`,[epoch,randomBytes(32)]);
  // Seed existing Step 6 models into the stream without rewriting their data.
  for (const [type,table] of [['task','tasks'],['relation','relations']] as const) {
    const rows = await client.query(`SELECT *${type==='task' ? ',due::text AS due' : ''} FROM "${name}"."${table}" ORDER BY created_at,id`);
    for (const row of rows.rows) {
      const common = { id:row.id,version:Number(row.version),createdAt:row.created_at.toISOString(),updatedAt:row.updated_at.toISOString(),deletedAt:row.deleted_at?.toISOString() ?? null };
      const entity = type==='task' ? taskSchema.parse({...common,title:row.title,status:row.status,due:row.due})
        : relationSchema.parse({...common,fromType:row.from_type,fromId:row.from_id,toType:row.to_type,toId:row.to_id});
      const operationId = newId(); sequence++;
      const result = pushResultSchema.parse({operationId,clientId:epoch,entityType:type,entityId:entity.id,serverOrder:sequence.toString(),status:'acknowledged',entity,conflicts:[]});
      await client.query(`INSERT INTO "${name}".entity_history VALUES ($1,$2,$3,$4)`,[type,entity.id,entity.version,JSON.stringify(entity)]);
      await client.query(`INSERT INTO "${name}".server_operations VALUES ($1,$2,NULL,$3)`,[sequence.toString(),operationId,JSON.stringify(result)]);
    }
  }
  await client.query(`UPDATE "${name}".stream_state SET last_sequence=$1 WHERE singleton=1`,[sequence.toString()]);
  await client.query(`UPDATE "${name}".schema_version SET version=2 WHERE singleton=1`);
}
async function migrateCausalFrames(client: pg.PoolClient,name: string) {
  await client.query(`ALTER TABLE "${name}".server_operations ADD COLUMN local_after jsonb`);
  const rows = await client.query<{server_order:string;request:PushOperation | null;result:PushResult}>(`SELECT server_order,request,result FROM "${name}".server_operations ORDER BY server_order`);
  for (const row of rows.rows) {
    let localAfter: Record<string,unknown> | null = null;
    if (row.result.status==='rejected') continue;
    if (!row.request) localAfter = writableFields(row.result.entity);
    else if (row.request.kind==='create') localAfter = parseOperationPayload(row.request);
    else {
      const base = await client.query<{entity:StructuredEntity}>(`SELECT entity FROM "${name}".entity_history WHERE entity_type=$1 AND entity_id=$2 AND version=$3`,[row.request.entityType,row.request.entityId,row.request.baseVersion]);
      if (base.rows[0]) localAfter = {...writableFields(base.rows[0].entity),...parseOperationPayload(row.request)};
      else if (row.result.entity.deletedAt) localAfter = {...writableFields(row.result.entity),...parseOperationPayload(row.request)};
      else throw new Error('Causal migration has no acknowledged base');
    }
    await client.query(`UPDATE "${name}".server_operations SET local_after=$1 WHERE server_order=$2`,[JSON.stringify(localAfter),row.server_order]);
  }
  await client.query(`UPDATE "${name}".schema_version SET version=3 WHERE singleton=1`);
}
