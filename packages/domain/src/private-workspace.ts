import { z } from 'zod';
import { idSchema } from '@greiva/shared';

export const subjectIdSchema = z.string().refine(value => value.trim().length > 0, 'Missing authenticated subject');
export const privateWorkspaceSchema = z.strictObject({ id: idSchema, ownerSubjectId: subjectIdSchema, ownerIssuer: subjectIdSchema });
export const resourceReferenceSchema = z.strictObject({ type: z.enum(['page', 'task', 'relation']), id: idSchema });
export const workspaceResourceSchema = resourceReferenceSchema.extend({ workspaceId: idSchema, deleted: z.boolean() });
export const privateAccessSnapshotSchema = z.strictObject({ workspace: privateWorkspaceSchema, resources: z.array(workspaceResourceSchema) });
export type ResourceReference = z.infer<typeof resourceReferenceSchema>;
export type PrivateAccessSnapshot = z.infer<typeof privateAccessSnapshotSchema>;

// The snapshot must come from authoritative server metadata, never request data.
export function ownsPrivateWorkspace(subjectId: string, issuer: string, workspaceId: string, snapshot: PrivateAccessSnapshot): boolean {
  return snapshot.workspace.id === workspaceId && snapshot.workspace.ownerSubjectId === subjectId && snapshot.workspace.ownerIssuer === issuer;
}
export function canAccessPrivateResources(subjectId: string, issuer: string, workspaceId: string, targets: readonly ResourceReference[], snapshot: PrivateAccessSnapshot): boolean {
  if (!ownsPrivateWorkspace(subjectId, issuer, workspaceId, snapshot) || targets.length === 0) return false;
  const key = (value: ResourceReference) => `${value.type}:${value.id}`;
  const requested = new Set(targets.map(key));
  const found = new Map(snapshot.resources.map(resource => [key(resource), resource]));
  // Missing, duplicated, unexpected or stale/deleted metadata fails closed.
  if (requested.size !== targets.length || found.size !== snapshot.resources.length || found.size !== requested.size) return false;
  return targets.every(target => { const resource = found.get(key(target)); return resource?.workspaceId === workspaceId && resource.deleted === false; });
}
