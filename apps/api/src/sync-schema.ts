import { bigint, jsonb, pgSchema, text, uuid } from 'drizzle-orm/pg-core';
import type { Conflict, PushOperation, PushResult, StructuredEntity } from '@greiva/protocol';
export function syncModels(name: string) {
  const schema = pgSchema(name);
  return {
    operations: schema.table('server_operations', {
      serverOrder: bigint('server_order', {mode:'bigint'}).primaryKey(), operationId: uuid('operation_id').notNull().unique(),
      request: jsonb('request').$type<PushOperation | null>(), result: jsonb('result').$type<PushResult>().notNull(),
      localAfter: jsonb('local_after').$type<Record<string,unknown> | null>(),
    }),
    history: schema.table('entity_history', {
      entityType: text('entity_type').notNull(), entityId: uuid('entity_id').notNull(), version: bigint('version', {mode:'number'}).notNull(),
      entity: jsonb('entity').$type<StructuredEntity>().notNull(),
    }),
    conflicts: schema.table('conflicts', {
      id: uuid('id').primaryKey(), entityType: text('entity_type').notNull(), entityId: uuid('entity_id').notNull(),
      status: text('status').notNull(), record: jsonb('record').$type<Conflict>().notNull(),
    }),
  };
}
