import { z } from 'zod';
import { dateOnlySchema, idSchema } from '@greiva/shared';
export * from './private-workspace.js';

// Domain intent rules only. Wire envelopes, storage, clocks and UI stay outside.
// Preserve the existing PoC contract, including whitespace/empty title handling.
export const taskStatusSchema = z.enum(['todo', 'in_progress', 'done']);
export const taskCreateSchema = z.strictObject({
  title: z.string(), status: taskStatusSchema,
  due: dateOnlySchema.refine(value => !value.startsWith('0000-'), 'Calendar year must be at least 1').nullable(),
});
export const taskUpdateSchema = taskCreateSchema.partial().refine(value => Object.keys(value).length > 0, 'Empty update');
export const relationCreateSchema = z.strictObject({
  fromType: z.enum(['page', 'task']), fromId: idSchema,
  toType: z.enum(['page', 'task']), toId: idSchema,
});
export const relationUpdateSchema = relationCreateSchema.partial().refine(value => Object.keys(value).length > 0, 'Empty update');
export type TaskCreate = z.infer<typeof taskCreateSchema>;
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;
export type RelationCreate = z.infer<typeof relationCreateSchema>;
export type RelationUpdate = z.infer<typeof relationUpdateSchema>;
