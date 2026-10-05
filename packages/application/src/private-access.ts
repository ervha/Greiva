import { idSchema } from '@greiva/shared';
import { subjectIdSchema, resourceReferenceSchema, privateAccessSnapshotSchema, ownsPrivateWorkspace, canAccessPrivateResources, type ResourceReference, type PrivateAccessSnapshot } from '@greiva/domain';

export interface PrivateWorkspaceAccessStore {
  // One consistent read from server-owned workspace/resource metadata.
  // Global typed-ID lookup retains foreign resources so policy can reject them.
  read(workspaceId: string, targets: readonly ResourceReference[]): Promise<PrivateAccessSnapshot | null>;
}
export class PrivateWorkspaceAccessDenied extends Error {
  constructor() { super('Private workspace access denied'); this.name = 'PrivateWorkspaceAccessDenied'; }
}

// verifiedSubjectId is supplied by the server's verified session adapter.
// This factory does not verify a token or accept an actor from an HTTP body.
export function privateWorkspaceAccess(verifiedSubjectId: string, store: PrivateWorkspaceAccessStore) {
  const subjectId = subjectIdSchema.parse(verifiedSubjectId);
  async function check(candidateWorkspaceId: unknown, candidateTargets: readonly unknown[], wholeWorkspace: boolean) {
    const workspace = idSchema.safeParse(candidateWorkspaceId);
    const parsed = candidateTargets.map(target => resourceReferenceSchema.safeParse(target));
    if (!workspace.success || parsed.some(target => !target.success)) throw new PrivateWorkspaceAccessDenied();
    const targets: ResourceReference[] = parsed.map(target => { if (!target.success) throw new PrivateWorkspaceAccessDenied(); return target.data; });
    if (!wholeWorkspace && targets.length === 0) throw new PrivateWorkspaceAccessDenied();
    const captured = Object.freeze(targets.map(target => Object.freeze(target)));
    const snapshot = privateAccessSnapshotSchema.safeParse(await store.read(workspace.data, captured));
    if (!snapshot.success || !(wholeWorkspace
      ? ownsPrivateWorkspace(subjectId, workspace.data, snapshot.data) && snapshot.data.resources.length === 0
      : canAccessPrivateResources(subjectId, workspace.data, captured, snapshot.data))) throw new PrivateWorkspaceAccessDenied();
    // A check is not a durable permission lease. Writes recheck inside commit.
    // Callers load these captured targets, not a mutable original request body.
    return Object.freeze({ subjectId, workspaceId: workspace.data, resources: captured });
  }
  return Object.freeze({
    workspace: (workspaceId: unknown) => check(workspaceId, [], true),
    resources: (workspaceId: unknown, targets: readonly unknown[]) => check(workspaceId, targets, false),
    pageDocument: (workspaceId: unknown, documentName: unknown) => {
      if (typeof documentName !== 'string' || !documentName.startsWith('page:')) return Promise.reject(new PrivateWorkspaceAccessDenied());
      return check(workspaceId, [{ type: 'page', id: documentName.slice(5) }], false);
    },
  });
}
