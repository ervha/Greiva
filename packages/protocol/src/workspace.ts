import { z } from 'zod';
import { idSchema } from '@greiva/shared';
import { pushRequestSchema, pushResponseSchema, pullRequestSchema, pullResponseSchema } from './index.js';

const scope = { protocolVersion: z.literal(1), workspaceId: idSchema };
export const privateBootstrapRequestSchema = z.strictObject({ clientId: idSchema });
export const privateBootstrapResponseSchema = z.strictObject({ ...scope, clientId: idSchema, epoch: idSchema });
export const workspacePushRequestSchema = pushRequestSchema.extend({ ...scope, clientId: idSchema })
  .refine(request => request.operations.every(operation => operation.clientId === request.clientId), 'Mixed client batch')
  .refine(request => new Set(request.operations.map(operation => operation.operationId)).size === request.operations.length, 'Duplicate operation ID in batch');
export const workspacePushResponseSchema = pushResponseSchema.extend({ ...scope, streamEpoch: idSchema })
  .refine(response => response.results.every(result => structuredOrderSchema.safeParse(result.serverOrder).success), 'Invalid structured order');
export const workspacePullRequestSchema = pullRequestSchema.extend({ ...scope, clientId: idSchema });
export const workspacePullResponseSchema = pullResponseSchema.extend({ ...scope, streamEpoch: idSchema })
  .refine(response => response.operations.every(result => structuredOrderSchema.safeParse(result.serverOrder).success), 'Invalid structured order');
// Exact PostgreSQL bigint range; never convert server order into a JS Number.
const orderPattern = /^(0|[1-9][0-9]{0,18})$/;
export const structuredOrderSchema = z.string().regex(orderPattern)
  .refine(value => orderPattern.test(value) && BigInt(value) <= 9223372036854775807n, 'Structured order exceeds bigint range');
export class WorkspaceSyncContextMismatch extends Error {
  constructor() { super('Workspace sync response context mismatch'); this.name = 'WorkspaceSyncContextMismatch'; }
}
function checkScope(expected: { workspaceId: string; streamEpoch: string }, actual: { workspaceId: string; streamEpoch: string }) {
  idSchema.parse(expected.workspaceId); idSchema.parse(expected.streamEpoch);
  if (actual.workspaceId !== expected.workspaceId || actual.streamEpoch !== expected.streamEpoch) throw new WorkspaceSyncContextMismatch();
}
export function verifyWorkspacePullResponse(expected: { workspaceId: string; streamEpoch: string }, candidate: unknown) {
  const response = workspacePullResponseSchema.parse(candidate); checkScope(expected, response); return response;
}
export function verifyWorkspacePushResponse(candidateRequest: unknown, streamEpoch: string, candidate: unknown) {
  const request = workspacePushRequestSchema.parse(candidateRequest), response = workspacePushResponseSchema.parse(candidate);
  checkScope({ workspaceId: request.workspaceId, streamEpoch }, response);
  const expected = new Map(request.operations.map(operation => [operation.operationId, operation]));
  const received = new Set<string>();
  if (response.results.length !== expected.size) throw new WorkspaceSyncContextMismatch();
  for (const result of response.results) {
    const operation = expected.get(result.operationId);
    if (!operation || received.has(result.operationId) || result.clientId !== operation.clientId
      || result.entityType !== operation.entityType || result.entityId !== operation.entityId) throw new WorkspaceSyncContextMismatch();
    received.add(result.operationId);
  }
  return response;
}
export type WorkspacePushRequest = z.infer<typeof workspacePushRequestSchema>;
export type WorkspacePullResponse = z.infer<typeof workspacePullResponseSchema>;
