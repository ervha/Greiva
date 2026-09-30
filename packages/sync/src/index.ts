// Persistence boundary only. The sync engine is intentionally deferred to Steps 5–7.
export type { SyncOperation, SyncState } from '@greiva/protocol';
export interface TransactionBoundary<TTransaction> {
  transaction<T>(work: (transaction: TTransaction) => Promise<T>): Promise<T>;
}
