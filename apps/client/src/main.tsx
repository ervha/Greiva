import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PageEditor } from './editor/PageEditor';
import { connectionLabel, createPageSession, initialConnectionState, pageId, type ConnectionState, type PageSession } from './editor/page-session';
import './style.css';
import { newId } from '@greiva/shared';
import { TaskPanel } from './structured/TaskPanel';
import { setConnectionPaused } from './connection-preference';
function App() {
  const [session, setSession] = useState<PageSession | null>(null);
  const [state, setState] = useState<ConnectionState>(initialConnectionState);
  useEffect(() => {
    let cancelled = false;
    let current: PageSession | undefined;
    void createPageSession(next => { if (!cancelled) setState(previous => ({ ...next, paused: previous.paused })); }).then(value => {
      if (cancelled) { value.destroy(); return; }
      current = value; setSession(value);
    }).catch(error => console.error('Page session failed', error));
    return () => { cancelled = true; current?.destroy(); };
  }, []);
  const toggleConnection = () => {
    if (!session) return;
    if (state.paused) { setConnectionPaused(false); setState(current => ({ ...current, paused: false, synced: false, status: 'connecting' })); void session.connect(); }
    else { setConnectionPaused(true); setState(current => ({ ...current, paused: true, synced: false })); session.disconnect(); }
  };
  return <main><header><h1>Greiva PoC</h1>
    <div className="page-sync-status"><span>本文 </span><output aria-label="同期状態" aria-live="polite" data-status={state.paused ? 'disconnected' : state.status}>{connectionLabel(state)}</output></div></header>
    <p className="scope-note">{state.local ? '本文とタイトルを端末のSQLiteへ保存します。タイトルは端末内のみで、他の端末とは同期しません。' : 'ブラウザの補助プレビューです。端末への保存はありません。オフラインの変更は、この画面を閉じると失われます。タイトルはこの画面のみの仮入力です。'}</p>
    {state.local && <output aria-label="端末の保存状態" aria-live="polite">{state.storageError ? '保存できません。未保存の本文をコピーして保管してください。' : state.saving > 0 ? '端末へ保存中…' : state.ready ? '端末に保存済み' : '端末のPageを読み込み中…'}</output>}
    {state.storageError && <p role="alert">{state.storageError}</p>}
    <div className="connection-tools">
      {state.local && state.pages.length > 0 && <label>保存したPage <select aria-label="保存したPage" value={session?.pageId ?? pageId} onChange={event => location.assign(`/?page=${encodeURIComponent(event.target.value)}`)}>
        {state.pages.map(page => <option key={page.id} value={page.id}>{page.title || `無題のPage (${page.id.slice(-6)})`}</option>)}
      </select></label>}
      <button type="button" onClick={() => location.assign(`/?page=${newId()}`)}>新しいPage</button>
      <a href={`/?page=${encodeURIComponent(session?.pageId ?? pageId)}`} target="_blank" rel="noreferrer">同じPageを別画面で開く</a>
      <button type="button" onClick={toggleConnection} disabled={!session || Boolean(state.storageError)}>{state.paused ? '再接続' : '接続を一時停止'}</button>
      {state.pending > 0 && <span aria-label="未送信の変更">未確認の更新 {state.pending}件</span>}
    </div>
    {state.ready && session ? <PageEditor session={session} title={state.title} storageError={state.storageError} /> : !state.storageError && <p role="status">Pageを読み込んでいます…</p>}
    {state.ready && session && <TaskPanel pageId={session.pageId} pages={state.pages} paused={state.paused} />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
