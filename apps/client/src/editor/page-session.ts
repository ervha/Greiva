import { HocuspocusProvider, HocuspocusProviderWebsocket } from '@hocuspocus/provider';
import { emptyPageUpdate } from '@greiva/sync';
import * as Y from 'yjs';
import { DurabilityBoundary, localPageStore, type LocalPageStore, type PageMetadata } from './local-page-store';
import { connectionPaused } from '../connection-preference';

export const defaultPageId = '019a0070-0000-7000-8000-000000000001';
const requestedPageId = new URLSearchParams(location.search).get('page');
export const pageId = requestedPageId ?? defaultPageId;
export const clientId = crypto.randomUUID();
export type ConnectionState = { status: string; synced: boolean; pending: number; ready: boolean; paused: boolean; error: string | null;
  local: boolean; saving: number; storageError: string | null; title: string; pages: PageMetadata[] };
export const initialConnectionState: ConnectionState = { status: 'connecting', synced: false, pending: 0, ready: false, paused: connectionPaused(), error: null, local: false, saving: 0, storageError: null, title: '', pages: [] };
export type PageSession = { document: Y.Doc; provider: HocuspocusProvider; clientId: string; pageId: string;
  local: boolean; setTitle: (title: string) => void; destroy: () => void; durable: () => Promise<void>;
  connect: () => Promise<unknown>; disconnect: () => void };

export async function createPageSession(report: (state: ConnectionState) => void, store: LocalPageStore | null = localPageStore()): Promise<PageSession> {
  let selectedPageId = pageId;
  const document = new Y.Doc();
  let active = true;
  let state: ConnectionState = { ...initialConnectionState, local: Boolean(store) };
  const update = (patch: Partial<ConnectionState>) => { state = { ...state, ...patch }; if (active) report(state); };
  try {
    if (store) {
      const pages = await store.list();
      selectedPageId = requestedPageId ?? pages[0]?.id ?? defaultPageId;
      const saved = await store.load(selectedPageId);
      if (saved.metadata.id !== selectedPageId || saved.metadata.yDocId !== `page:${selectedPageId}`) throw new Error('Local Page identity mismatch');
      for (const bytes of saved.updates) { const updateBytes = Uint8Array.from(bytes); Y.decodeUpdate(updateBytes); Y.applyUpdate(document, updateBytes, 'restore'); }
      update({ title: saved.metadata.title, ready: saved.updates.length > 0, pages: [saved.metadata, ...pages.filter(page => page.id !== selectedPageId)] });
    }
  } catch (error) {
    document.destroy();
    update({ storageError: String(error), status: 'disconnected' });
    console.error('Page restore failed', error);
    throw error;
  }
  let socket: HocuspocusProviderWebsocket;
  const boundary = new DurabilityBoundary((saving, storageError) => {
    update({ saving, ...(storageError ? { storageError } : {}) });
    if (storageError) { console.error('Page persistence failed', storageError); socket?.disconnect(); }
  });
  const persist = (bytes: Uint8Array) => { if (store) { const copy = bytes.slice(); boundary.enqueue(() => store.append(selectedPageId, copy)); } };
  // Persist listener precedes provider's listener and its encoded outgoing frame.
  document.on('update', persist);
  socket = new HocuspocusProviderWebsocket({ url: `ws://127.0.0.1:1234?clientId=${clientId}`, autoConnect: false });
  const send = socket.send.bind(socket);
  let sending = Promise.resolve();
  socket.send = (message: Uint8Array) => {
    const bytes = message.slice();
    const committed = boundary.tail; // Includes all updates represented in this encoded frame.
    sending = sending.then(() => committed).then(() => { if (active && !state.storageError) send(bytes); });
    void sending.catch(() => { /* Persistence reported the error; never send past a failed commit. */ });
  };
  const provider = new HocuspocusProvider({
    websocketProvider: socket, name: `page:${selectedPageId}`, document,
    onStatus: ({ status }) => update({ status, ...(status !== 'connected' ? { synced: false } : {}) }),
    onSynced: ({ state: synced }) => update({ synced, ready: state.ready || synced }),
    onUnsyncedChanges: ({ number }) => update({ pending: number }),
    onAuthenticationFailed: ({ reason }) => update({ error: reason }),
  });
  provider.attach();
  // Saved Pages open immediately offline. New Pages prefer the existing server
  // document; without one, use the shared CRDT seed and become editable locally.
  const timer = store ? setTimeout(() => {
    if (!active || state.ready || state.storageError) return;
    if (document.getXmlFragment('body').length === 0) Y.applyUpdate(document, emptyPageUpdate(), 'offline-bootstrap');
    update({ ready: true });
  }, 500) : undefined;
  if (!state.paused) void socket.connect().catch(error => console.error('Page connection failed', error));
  return { document, provider, clientId, pageId: selectedPageId, local: Boolean(store), durable: () => boundary.tail,
    connect: () => socket.connect(), disconnect: () => socket.disconnect(),
    setTitle: title => { update({ title, pages: state.pages.map(page => page.id === selectedPageId ? { ...page, title } : page) }); if (store) boundary.enqueue(() => store.setTitle(selectedPageId, title)); },
    destroy: () => { active = false; clearTimeout(timer); document.off('update', persist); provider.destroy(); socket.destroy(); document.destroy(); },
  };
}

export function connectionLabel(state: ConnectionState) {
  if (state.storageError) return '端末への保存エラー';
  if (state.error) return '接続エラー';
  if (state.paused || state.status === 'disconnected') return 'オフライン';
  if (state.status !== 'connected') return state.ready ? '再接続中…' : '接続中…';
  if (!state.synced || state.pending > 0 || state.saving > 0) return '同期中…';
  return 'サーバーと同期済み';
}
