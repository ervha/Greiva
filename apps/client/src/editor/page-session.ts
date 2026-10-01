import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';

export const defaultPageId = '019a0070-0000-7000-8000-000000000001';
export const pageId = new URLSearchParams(location.search).get('page') ?? defaultPageId;
export const clientId = crypto.randomUUID();
export type PageSession = { document: Y.Doc; provider: HocuspocusProvider; clientId: string; pageId: string };
export type ConnectionState = { status: string; synced: boolean; pending: number; ready: boolean; paused: boolean; error: string | null };

export function createPageSession(report: (state: ConnectionState) => void): PageSession {
  const document = new Y.Doc();
  let state: ConnectionState = { status: 'connecting', synced: false, pending: 0, ready: false, paused: false, error: null };
  const update = (patch: Partial<ConnectionState>) => { state = { ...state, ...patch }; report(state); };
  const provider = new HocuspocusProvider({
    url: `ws://127.0.0.1:1234?clientId=${clientId}`, name: `page:${pageId}`, document,
    onStatus: ({ status }) => update({ status, ...(status !== 'connected' ? { synced: false } : {}) }),
    onSynced: ({ state: synced }) => update({ synced, ready: state.ready || synced }),
    onUnsyncedChanges: ({ number }) => update({ pending: number }),
    onAuthenticationFailed: ({ reason }) => update({ error: reason }),
  });
  return { document, provider, clientId, pageId };
}

export function connectionLabel(state: ConnectionState) {
  if (state.error) return '接続エラー';
  if (state.paused || state.status === 'disconnected') return 'オフライン';
  if (state.status !== 'connected') return state.ready ? '再接続中…' : '接続中…';
  if (!state.synced || state.pending > 0) return '同期中…';
  return 'サーバーと同期済み';
}
