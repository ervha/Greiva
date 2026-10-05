import { z } from 'zod';
import { idSchema, utcTimestampSchema, dateOnlySchema } from '@greiva/shared';
import { taskStatusSchema, taskCreateSchema, taskUpdateSchema, relationCreateSchema, relationUpdateSchema } from '@greiva/domain';
export { taskStatusSchema, taskCreateSchema, taskUpdateSchema, relationCreateSchema, relationUpdateSchema } from '@greiva/domain';

// POC_SPEC Sections 4 / 8. Only this package defines wire data.
export const versionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
// Cursor is opaque; clients must not order it using clocks or numeric conversion.
export const cursorSchema = z.string().min(1);
const timestamps = { createdAt: utcTimestampSchema, updatedAt: utcTimestampSchema };
export const pageSchema = z.strictObject({
  id: idSchema, title: z.string(), yDocId: z.string(), ...timestamps,
}).refine(page => page.yDocId === `page:${page.id}`, {
  path: ['yDocId'], message: 'yDocId must equal page:{pageId}',
});
export const taskSchema = z.strictObject({
  id: idSchema, title: z.string(), status: taskStatusSchema,
  due: dateOnlySchema.nullable(), version: versionSchema,
  ...timestamps, deletedAt: utcTimestampSchema.nullable(),
});
export const entityTypeSchema = z.enum(['page', 'task']);
export const relationSchema = z.strictObject({
  id: idSchema, fromType: entityTypeSchema, fromId: idSchema,
  toType: entityTypeSchema, toId: idSchema, version: versionSchema,
  ...timestamps, deletedAt: utcTimestampSchema.nullable(),
});
export const deletePayloadSchema = z.strictObject({});
export const pushOperationSchema = z.strictObject({
  operationId: idSchema, entityType: z.enum(['task', 'relation']), entityId: idSchema,
  kind: z.enum(['create', 'update', 'delete']), baseVersion: versionSchema.nullable(),
  // Parse the envelope first so Step 7 can return permanent rejection for a bad payload.
  payload: z.unknown(), clientId: idSchema,
  predecessorOperationId: idSchema.optional(),
  resolution: z.strictObject({ conflictIds: z.array(idSchema).min(1).max(7).refine(ids => new Set(ids).size === ids.length,'Duplicate conflict ID'), choice: z.enum(['local', 'remote']) }).optional(),
});
export function parseOperationPayload(operation: PushOperation) {
  if (operation.resolution && operation.kind !== 'update') throw new Error('Resolution requires update');
  if (operation.kind === 'create' && operation.baseVersion !== null) throw new Error('Create requires null baseVersion');
  if (operation.kind !== 'create' && operation.baseVersion === null) throw new Error('Mutation requires baseVersion');
  if (operation.kind === 'delete') return deletePayloadSchema.parse(operation.payload);
  return (operation.entityType === 'task'
    ? operation.kind === 'create' ? taskCreateSchema : taskUpdateSchema
    : operation.kind === 'create' ? relationCreateSchema : relationUpdateSchema).parse(operation.payload);
}
export const syncOperationSchema = pushOperationSchema.extend({
  createdAt: utcTimestampSchema, status: z.enum(['pending', 'acknowledged', 'rejected']),
});
export const syncStateSchema = z.strictObject({
  stream: z.literal('structured'), cursor: cursorSchema.nullable(),
  headCursor: cursorSchema.nullable().default(null),
  lastSuccessfulSyncAt: utcTimestampSchema.nullable(),
});
export const pullRequestSchema = z.strictObject({ cursor: cursorSchema.nullable(), limit: z.number().int().min(1).max(500).default(100) });
export const structuredEntitySchema = z.union([taskSchema, relationSchema]);
export const conflictFieldSchema = z.enum(['title', 'status', 'due', 'fromType', 'fromId', 'toType', 'toId']);
export const conflictSchema = z.strictObject({
  id: idSchema, operationId: idSchema, entityType: z.enum(['task','relation']), entityId: idSchema,
  field: conflictFieldSchema, base: z.unknown(), local: z.unknown(), remote: z.unknown(),
  createdAt: utcTimestampSchema, status: z.enum(['open','resolved']), resolvedBy: idSchema.nullable(),
}).refine(record => (record.status==='open') === (record.resolvedBy===null),'Conflict resolution state mismatch');
const resultFields = {
  operationId: idSchema, clientId: idSchema, entityType: z.enum(['task','relation']), entityId: idSchema,
  serverOrder: z.string().regex(/^[1-9][0-9]*$/), conflicts: z.array(conflictSchema),
};
export const pushResultSchema = z.discriminatedUnion('status', [
  z.strictObject({ ...resultFields, status: z.literal('acknowledged'), entity: structuredEntitySchema }),
  z.strictObject({ ...resultFields, status: z.literal('conflict'), entity: structuredEntitySchema }),
  z.strictObject({ ...resultFields, status: z.literal('rejected'), entity: structuredEntitySchema.nullable(),
    error: z.strictObject({ code: z.string().min(1), message: z.string().min(1), retryable: z.literal(false) }),
  }),
]).refine(result => !result.entity || (result.entity.id === result.entityId && ('title' in result.entity ? 'task' : 'relation') === result.entityType), 'Result entity identity mismatch')
  .refine(result => result.conflicts.every(record => record.entityType===result.entityType && record.entityId===result.entityId), 'Conflict entity identity mismatch')
  .refine(result => result.status==='conflict' ? result.conflicts.some(record=>record.status==='open') : result.conflicts.every(record=>record.status==='resolved'), 'Conflict result state mismatch');
export const pushRequestSchema = z.strictObject({ operations: z.array(pushOperationSchema).min(1).max(100) });
export const pushResponseSchema = z.strictObject({ results: z.array(pushResultSchema) });
export const pullResponseSchema = z.strictObject({
  operations: z.array(pushResultSchema), cursor: cursorSchema, headCursor: cursorSchema, hasMore: z.boolean(), serverTime: utcTimestampSchema,
});
export type Conflict = z.infer<typeof conflictSchema>;
export type PushResult = z.infer<typeof pushResultSchema>;
export type PushRequest = z.infer<typeof pushRequestSchema>;
export type PullResponse = z.infer<typeof pullResponseSchema>;
export const structuredSnapshotSchema = z.strictObject({
  tasks: z.array(taskSchema), relations: z.array(relationSchema), operations: z.array(syncOperationSchema),
  state: syncStateSchema, clientId: idSchema.nullable(),
  conflicts: z.array(conflictSchema),
  errors: z.array(z.strictObject({operationId:idSchema,error:z.string()})),
});
export type StructuredSnapshot = z.infer<typeof structuredSnapshotSchema>;
export type Page = z.infer<typeof pageSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Relation = z.infer<typeof relationSchema>;
export type SyncOperation = z.infer<typeof syncOperationSchema>;
export type SyncState = z.infer<typeof syncStateSchema>;
export type PushOperation = z.infer<typeof pushOperationSchema>;
export type PullRequest = z.infer<typeof pullRequestSchema>;
export type Cursor = z.infer<typeof cursorSchema>;
export type Version = z.infer<typeof versionSchema>;
export type StructuredEntity = Task | Relation;
