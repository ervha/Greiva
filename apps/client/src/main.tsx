import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { SyncState } from '@greiva/protocol';
import { PageEditor } from './editor/PageEditor';
import './style.css';
const initialState: SyncState = { stream: 'structured', cursor: null, lastSuccessfulSyncAt: null };
function App() {
  return <main><header><h1>Greiva PoC</h1>
    <output aria-label="同期状態">未検証（{initialState.stream}）</output></header>
    <p className="scope-note">Editor検証：編集内容はこの画面を閉じると失われます。永続化・同期は未実装です。</p>
    <PageEditor /></main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
