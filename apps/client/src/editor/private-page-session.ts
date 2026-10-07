import * as Y from 'yjs';
import { emptyPageUpdate, pageBase64, PageSessionError, type PrivateWorkspaceConnection, type PageSyncSession, type PageSessionStore } from '@greiva/sync';
import { NativeWorkspaceError, type NativeWorkspaceStore } from '../workspace/native-workspace-store.js';

export class PrivatePageEditorError extends Error {
  constructor(readonly stage: 'closed' | 'busy' | 'protocol' | 'storage' | 'transport') {
    super(`Private Page editor ${stage}`); this.name = 'PrivatePageEditorError';
  }
}
export type PrivatePageState = Readonly<{
  phase: 'opening' | 'ready' | 'closed'; title: string; saving: number; pending: number;
  syncing: boolean; synced: boolean; remoteWaiting: boolean;
  storageError: 'storage' | 'protocol' | null; syncError: 'storage' | 'protocol' | 'transport' | null;
}>;

// Owns one live Doc and captured native Page port. No implicit Page creation,
// timer, Web fallback, metadata editing or offline authentication grant.
export class PrivatePageEditorSession {
  readonly document = new Y.Doc({ gc: false });
  readonly clientId: string;
  private readonly syncSession: PageSyncSession;
  private readonly append: (update: Uint8Array) => Promise<void>;
  private readonly load: ReturnType<NativeWorkspaceStore['page']>['load'];
  private readonly prepare: ReturnType<NativeWorkspaceStore['page']>['prepare'];
  private readonly listeners = new Set<(state: PrivatePageState) => void>();
  private tail: Promise<void> = Promise.resolve();
  private closeWork: Promise<void> | null = null;
  private composing = false;
  private remote: Uint8Array[] = [];
  private revision = 0;
  private confirmedRevision: number | null = null;
  private readonly remoteOrigin = Symbol('durable remote');
  private state: Omit<PrivatePageState, 'synced' | 'remoteWaiting'> = {
    phase: 'opening', title: '', saving: 0, pending: 0, syncing: false, storageError: null, syncError: null,
  };
  private constructor(connection: PrivateWorkspaceConnection, private readonly store: NativeWorkspaceStore, readonly pageId: string) {
    try {
    store.assertConnection(connection);
    this.clientId = store.context.clientId;
    const page = store.page(pageId);
    this.append = page.append.bind(page); this.load = page.load.bind(page); this.prepare = page.prepare.bind(page);
    const receive = page.receive.bind(page), acknowledge = page.acknowledge.bind(page);
    const ports: PageSessionStore = {
      acknowledge,
      receive: async (...args) => {
        await receive(...args); this.check();
        // Opening replays the committed native journal below. Live remote
        // updates do not echo back into the outgoing queue.
        if (this.state.phase === 'ready') {
          this.remote.push(Uint8Array.from(args[3])); this.flushRemote(); this.publish();
        }
      },
    };
    this.syncSession = connection.openPage(pageId, ports);
    this.syncSession.signal.addEventListener('abort', this.invalidated, { once: true });
    const lease = connection.generationSignal;
    if (!lease || lease.aborted) { this.syncSession.close(); throw new PrivatePageEditorError('closed'); }
    lease.addEventListener('abort', this.invalidated, { once: true });
    this.detachLease = () => lease.removeEventListener('abort', this.invalidated);
    } catch (error) {
      this.document.destroy();
      if (error instanceof PrivatePageEditorError) throw error;
      throw new PrivatePageEditorError(error instanceof NativeWorkspaceError && error.stage === 'closed' ? 'closed' : 'protocol');
    }
  }
  private detachLease: () => void = () => {};
  private invalidated = () => { void this.close().catch(() => {}); };
  private check() {
    if (this.state.phase === 'closed' || this.syncSession.signal.aborted) throw new PrivatePageEditorError('closed');
    try { this.store.assertActive(); } catch { throw new PrivatePageEditorError('closed'); }
  }
  private failure(error: unknown): PrivatePageEditorError {
    if (this.state.phase === 'closed' || this.syncSession.signal.aborted) return new PrivatePageEditorError('closed');
    if (error instanceof PrivatePageEditorError) return error;
    if (error instanceof NativeWorkspaceError || error instanceof PageSessionError) return new PrivatePageEditorError(error.stage === 'configuration' ? 'protocol' : error.stage);
    return new PrivatePageEditorError('protocol');
  }
  get snapshot(): PrivatePageState {
    return Object.freeze({ ...this.state, remoteWaiting: this.remote.length > 0,
      synced: this.state.phase === 'ready' && !this.state.syncing && !this.state.storageError && !this.state.syncError &&
        this.state.saving === 0 && this.state.pending === 0 && this.remote.length === 0 && this.confirmedRevision === this.revision,
    });
  }
  subscribe(listener: (state: PrivatePageState) => void) {
    this.listeners.add(listener); listener(this.snapshot); return () => { this.listeners.delete(listener); };
  }
  private publish() { for (const listener of this.listeners) { try { listener(this.snapshot); } catch { /* An observer cannot interrupt a commit. */ } } }
  private patch(value: Partial<typeof this.state>) { this.state = { ...this.state, ...value }; this.publish(); }
  static async open(connection: PrivateWorkspaceConnection, store: NativeWorkspaceStore, pageId: string,
    source: { kind: 'local' | 'remote' } | { kind: 'create'; title: string }): Promise<PrivatePageEditorSession> {
    const session = new PrivatePageEditorSession(connection, store, pageId);
    try {
      if (source.kind === 'create') { await store.page(pageId).create(source.title, emptyPageUpdate()); session.check(); }
      if (source.kind === 'remote') { await session.syncSession.pull(session.readRequest()); session.check(); }
      const saved = await session.load(); session.check();
      for (const update of saved.page.updates) Y.applyUpdate(session.document, Uint8Array.from(update), session.remoteOrigin);
      session.document.on('update', session.changed);
      session.patch({ phase: 'ready', title: saved.page.metadata.title, pending: saved.pending });
      // Restore/download alone never claims synchronization: pending frames and
      // a concurrent local change must be considered by an explicit sync cycle.
      return session;
    } catch (error) { const failure = session.failure(error); await session.close().catch(() => {}); throw failure; }
  }
  private changed = (candidate: Uint8Array, origin: unknown) => {
    if (origin === this.remoteOrigin || this.state.phase !== 'ready') return;
    ++this.revision; this.confirmedRevision = null;
    if (this.state.storageError) { this.publish(); return; }
    const update = Uint8Array.from(candidate);
    this.patch({ saving: this.state.saving + 1 });
    // Admitted local writes finish on the original Page during a Page switch.
    // Auth invalidation still rejects them at the captured native handle.
    this.tail = this.tail.then(() => this.append(update)).then(() => {
      this.state = { ...this.state, pending: this.state.pending + 1 };
    }).catch(error => {
      const failure = this.failure(error);
      if (this.state.phase !== 'closed') this.state = { ...this.state, storageError: failure.stage === 'protocol' ? 'protocol' : 'storage' };
      throw failure;
    }).finally(() => { this.patch({ saving: this.state.saving - 1 }); });
    void this.tail.catch(() => {});
  };
  durable(): Promise<void> { return this.tail; }
  get isComposing():boolean {return this.composing;}
  pendingUpdates = () => this.state.pending;
  setComposing = (value: boolean) => { this.composing = value; if (!value) this.flushRemote(); this.publish(); };
  private flushRemote() {
    if (this.composing || this.state.phase !== 'ready') return;
    const updates = this.remote; this.remote = [];
    if (updates.length) Y.applyUpdate(this.document, Y.mergeUpdates(updates), this.remoteOrigin);
  }
  private readRequest() { return { protocolVersion: 1, clientId: this.clientId, editorSchemaVersion: 1, stateVector: pageBase64(Y.encodeStateVector(this.document)) }; }
  async sync(): Promise<void> {
    this.check();
    if (this.state.syncing) throw new PrivatePageEditorError('busy');
    if (this.state.storageError) throw new PrivatePageEditorError(this.state.storageError);
    this.patch({ syncing: true, syncError: null });
    try {
      await this.durable(); this.check(); const revision = this.revision;
      const before = await this.load(); this.check();
      // Bound this cycle to the durable queue observed at its start. Continuous
      // typing cannot keep an HTTP cycle running indefinitely.
      for (let index = 0; index < before.pending; ++index) {
        const prepared = await this.prepare(); this.check(); if (!prepared) break;
        await this.syncSession.push(prepared); this.check();
        this.patch({ pending: Math.max(0, this.state.pending - 1) });
      }
      await this.syncSession.pull(this.readRequest()); this.check();
      await this.durable(); this.check(); const loadedRevision = this.revision;
      const after = await this.load(); this.check();
      if (loadedRevision === this.revision && this.state.saving === 0) this.patch({ pending: after.pending });
      if (revision === this.revision && this.state.pending === 0 && this.state.saving === 0) this.confirmedRevision = revision;
    } catch (error) {
      const failure = this.failure(error); this.confirmedRevision = null;
      if (failure.stage === 'closed') { void this.close().catch(() => {}); }
      else this.patch({ syncError: failure.stage === 'busy' ? 'protocol' : failure.stage });
      throw failure;
    } finally { this.patch({ syncing: false }); }
  }
  close(): Promise<void> {
    if (this.closeWork) return this.closeWork;
    this.state = { ...this.state, phase: 'closed', syncing: false };
    this.document.off('update', this.changed); this.detachLease();
    this.syncSession.signal.removeEventListener('abort', this.invalidated); this.syncSession.close();
    this.remote = []; this.confirmedRevision = null; this.publish();
    this.closeWork = this.tail.finally(() => { this.document.destroy(); this.listeners.clear(); });
    return this.closeWork;
  }
}
