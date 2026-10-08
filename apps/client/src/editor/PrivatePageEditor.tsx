import { useEffect, useState } from 'react';
import { PageEditor } from './PageEditor';
import { type PrivatePageEditorSession, type PrivatePageState } from './private-page-session';

export function privatePageSyncLabel(state: PrivatePageState) {
  if (state.phase === 'closed') return '接続を閉じました';
  if (state.storageError) return '端末への保存エラー';
  if (state.syncError) return '同期エラー';
  if (state.syncing) return '同期中…';
  if (state.remoteWaiting) return '変換終了後に遠隔の変更を反映します';
  return state.synced ? 'サーバーと同期済み' : '同期はまだ確認していません';
}
// Mounted by a verified workspace composition. This view does not acquire
// credentials, choose a DB, register a device, or fall back to the old PoC.
export function PrivatePageEditor({ session,displayTitle }: { session: PrivatePageEditorSession;displayTitle?:string|undefined }) {
  const [observed, setObserved] = useState({ session, state: session.snapshot });
  const state = observed.session === session ? observed.state : session.snapshot;
  useEffect(() => session.subscribe(state => setObserved({ session, state })), [session]);
  const storageError = state.storageError ? '保存できません。未保存の本文をコピーして保管してください。' : null;
  return <div>
    <div className="page-sync-status"><span>本文 </span><output aria-label="同期状態" aria-live="polite">{privatePageSyncLabel(state)}</output></div>
    {state.phase === 'closed' ? <p role="status">このPageの接続は閉じています。workspaceから開き直してください。</p> : <>
      <output aria-label="端末の保存状態" aria-live="polite">{storageError ?? (state.saving > 0 ? '端末へ保存中…' : '端末に保存済み')}</output>
      <p className="editor-hint">保存中の入力は、強制終了すると失われることがあります。</p>
      <div className="connection-tools">
        <button type="button" disabled={state.syncing || Boolean(state.storageError)} onClick={() => { void session.sync().catch(() => {}); }}>同期する</button>
        {state.pending > 0 && <span aria-label="未送信の変更">未確認の更新 {state.pending}件</span>}
      </div>
      {storageError && <p role="alert">{storageError}</p>}
      {state.syncError && <p role="alert">同期できませんでした。保存済みの内容はこの端末に残っています。接続を確認して、もう一度お試しください。</p>}
      <PageEditor key={session.document.guid} session={session} title={displayTitle??state.title} storageError={storageError} />
    </>}
  </div>;
}
