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
export {PageChangesSyncSession,PageChangesSessionError} from './page-changes-session.js';
export type {PageChangesTransport,PageChangesStore} from './page-changes-session.js';
export {DatabaseSourceSyncSession,DatabaseSourceSessionError} from './database-source-session.js';
export type {DatabaseSourceTransport,DatabaseSourceStore} from './database-source-session.js';
export {DatabaseContentSyncSession,DatabaseContentSessionError} from './database-content-session.js';
export type {DatabaseContentTransport,DatabaseContentStore} from './database-content-session.js';
export {DatabaseChangesSyncSession,DatabaseChangesSessionError} from './database-changes-session.js';
export type {DatabaseChangesTransport,DatabaseChangesStore,DatabaseChangesProgress,DatabaseChangesObservation} from './database-changes-session.js';
export {DatabaseSourceWriteSyncSession,DatabaseSourceWriteSessionError} from './database-source-write-session.js';
export type {DatabaseSourceWriteTransport,DatabaseSourceWriteStore} from './database-source-write-session.js';

export {DatabaseRecordWriteSyncSession,DatabaseRecordWriteSessionError} from './database-record-write-session.js';
export type {DatabaseRecordWriteKind,DatabaseRecordWriteTransport,DatabaseRecordWriteStore} from './database-record-write-session.js';

export {DatabaseViewWriteSyncSession,DatabaseViewWriteSessionError} from './database-view-write-session.js';
export type {DatabaseViewWriteTransport,DatabaseViewWriteStore} from './database-view-write-session.js';