import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PageEditor } from './editor/PageEditor';
import { connectionLabel, createPageSession, pageId, type ConnectionState, type PageSession } from './editor/page-session';
import './style.css';
function App() {
  const [session, setSession] = useState<PageSession | null>(null);
  const [state, setState] = useState<ConnectionState>({ status: 'connecting', synced: false, pending: 0, ready: false, paused: false, error: null });
  useEffect(() => {
    const current = createPageSession(next => setState(previous => ({ ...next, paused: previous.paused })));
    setSession(current);
    return () => { current.provider.destroy(); current.document.destroy(); };
  }, []);
  const toggleConnection = () => {
    if (!session) return;
    if (state.paused) { setState(current => ({ ...current, paused: false, synced: false, status: 'connecting' })); void session.provider.connect(); }
    else { setState(current => ({ ...current, paused: true, synced: false })); session.provider.disconnect(); }
  };
  return <main><header><h1>Greiva PoC</h1>
    <output aria-label="同期状態" aria-live="polite" data-status={state.paused ? 'disconnected' : state.status}>{connectionLabel(state)}</output></header>
    <p className="scope-note">本文を共同編集できます。端末への保存は未実装です。オフラインの変更は、この画面を閉じると失われます。タイトルはこの画面のみの仮入力です。</p>
    <div className="connection-tools">
      <a href={`/?page=${encodeURIComponent(pageId)}`} target="_blank" rel="noreferrer">同じPageを別画面で開く</a>
      <button type="button" onClick={toggleConnection} disabled={!session}>{state.paused ? '再接続' : '接続を一時停止'}</button>
      {state.pending > 0 && <span aria-label="未送信の変更">未確認の更新 {state.pending}件</span>}
    </div>
    {state.ready && session ? <PageEditor session={session} /> : <p role="status">サーバーのPageを読み込んでいます…</p>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
