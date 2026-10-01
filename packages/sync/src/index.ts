// Page CRDT persistence and structured operation sync are separate paths.
export type { SyncOperation, SyncState } from '@greiva/protocol';
export { emptyPageUpdate } from './page-bootstrap.js';
export { StructuredSyncEngine, StructuredTransportError, httpStructuredTransport } from './structured-engine.js';
export type { StructuredStore, StructuredTransport, StructuredPhase, StructuredReport } from './structured-engine.js';
export interface TransactionBoundary<TTransaction> {
  transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
}
