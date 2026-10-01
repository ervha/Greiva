import { z } from 'zod';
import { idSchema, utcTimestampSchema, dateOnlySchema } from '@greiva/shared';

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
export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done']);
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
export const taskCreateSchema = taskSchema.pick({ title: true, status: true, due: true });
export const taskUpdateSchema = taskCreateSchema.partial().refine(value => Object.keys(value).length > 0, 'Empty update');
export const relationCreateSchema = relationSchema.pick({ fromType: true, fromId: true, toType: true, toId: true });
export const relationUpdateSchema = relationCreateSchema.partial().refine(value => Object.keys(value).length > 0, 'Empty update');
export const deletePayloadSchema = z.strictObject({});
export const pushOperationSchema = z.strictObject({
  operationId: idSchema, entityType: z.enum(['task', 'relation']), entityId: idSchema,
  kind: z.enum(['create', 'update', 'delete']), baseVersion: versionSchema.nullable(),
  // Parse the envelope first so Step 7 can return permanent rejection for a bad payload.
  payload: z.unknown(), clientId: idSchema,
});
export function parseOperationPayload(operation: PushOperation) {
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
  lastSuccessfulSyncAt: utcTimestampSchema.nullable(),
});
export const pullRequestSchema = z.strictObject({ cursor: cursorSchema.nullable() });
export const structuredSnapshotSchema = z.strictObject({
  tasks: z.array(taskSchema), relations: z.array(relationSchema), operations: z.array(syncOperationSchema),
  state: syncStateSchema, clientId: idSchema.nullable(),
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
