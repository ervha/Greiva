// Page CRDT persistence and structured operation sync are separate paths.
export { AuthSession, AuthSessionError } from './auth-session.js';
export type { AuthIdentity, AuthSessionPorts } from './auth-session.js';
export { supabaseAuthSession } from './supabase-auth.js';
export { PrivateWorkspaceConnection, PrivateConnectionError } from './private-workspace-connection.js';
export type { SyncOperation, SyncState } from '@greiva/protocol';
export { emptyPageUpdate } from './page-bootstrap.js';
export { StructuredSyncEngine, StructuredTransportError, httpStructuredTransport } from './structured-engine.js';
export type { StructuredStore, StructuredTransport, StructuredPhase, StructuredReport } from './structured-engine.js';
export { WorkspaceSyncSession, WorkspaceSessionError } from './workspace-session.js';
export type { WorkspaceSyncContext, WorkspaceSessionTransport, WorkspaceSessionStore } from './workspace-session.js';
export interface TransactionBoundary<TTransaction> {
  transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
}

export {PageSyncSession,PageSessionError} from './page-session.js';
export type {PageSyncContext,PageReceipt,PageSessionTransport,PageSessionStore} from './page-session.js';

export {pageBase64,pageBytes,pageDigest,pageUpdateBytes,pageVectorBytes} from './page-binary.js';
export {PageTitleSyncSession,PageTitleSessionError} from './page-title-session.js';
export type {PageTitleContext,PageTitleTransport,PageTitleStore} from './page-title-session.js';
