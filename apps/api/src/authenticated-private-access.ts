import { privateWorkspaceAccess, type PrivateWorkspaceAccessStore } from '@greiva/application';
import { resourceReferenceSchema } from '@greiva/domain';
import type { SessionVerifier } from './session-verifier.js';

// Shared boundary for future HTTP/CRDT handlers. No current PoC route is rewired.
export function authenticatedPrivateAccess(verifier: SessionVerifier, store: PrivateWorkspaceAccessStore) {
  return Object.freeze({
    async workspace(authorization: unknown, workspaceId: unknown) {
      const session = await verifier.verify(authorization);
      return privateWorkspaceAccess(session.subjectId, store, session.issuer).workspace(workspaceId);
    },
    async resources(authorization: unknown, workspaceId: unknown, targets: readonly unknown[]) {
      const captured = Object.freeze(targets.map(target => Object.freeze(resourceReferenceSchema.parse(target))));
      const session = await verifier.verify(authorization);
      return privateWorkspaceAccess(session.subjectId, store, session.issuer).resources(workspaceId, captured);
    },
    async pageDocument(authorization: unknown, workspaceId: unknown, documentName: unknown) {
      const session = await verifier.verify(authorization);
      return privateWorkspaceAccess(session.subjectId, store, session.issuer).pageDocument(workspaceId, documentName);
    },
  });
}
