import {useEffect,useState} from 'react';
import {PageEditor} from './PageEditor';
import type {NativePageSession} from './native-page-session';
export function NativeLocalPageEditor({session,locked,offline=false,onSend,onRead}:{session:NativePageSession;locked:boolean;offline?:boolean;onSend:()=>void;onRead:()=>void}){
 const [state,setState]=useState(session.snapshot);useEffect(()=>session.subscribe(setState),[session]);
 const failed=state.storageError!==null;
 const busy=locked||failed||state.composing||state.saving>0||state.sending||state.reading||state.remoteWaiting||state.titleBusy;
 return <section className="native-editor-wrap" aria-label="端末Page編集">
  {!offline&&<p>本文は「このPageを送信」、タイトルは「タイトルを送信」で同期します。</p>}
  <output className="page-sync-status" aria-live="polite" aria-label="本文の保存状態">{state.saving>0?'端末に保存中…':failed?`保存未確認 ${state.unsaved}件`:!state.pendingFresh?'端末に保存済み · 未送信数は再確認が必要':state.pending>0?`端末に保存しました · 未送信 ${state.pending}件`:'端末に保存済み'}</output>
  {!offline&&<div className="native-actions"><button type="button" disabled={busy} onClick={onSend}>{state.sendStatus==='ack_pending'?'受領記録を再確認':state.sendStatus==='send_unknown'?'送信結果を再確認':'このPageを送信'}</button><output aria-label="Pageの送信状態" aria-live="polite">{state.sending?'送信・受領記録を確認中…':state.sendStatus==='ack_pending'?'サーバーの受領を確認しました。端末の受領記録は未確認です。':state.sendStatus==='send_unknown'?'送信・受領結果は未確認です。自動再送は行いません。':state.sendStatus==='acked'?'送信分の受領記録を端末に保存しました。':state.sendStatus==='idle'?'このPageの未送信変更はありません。':'この画面では送信結果をまだ確認していません。'}</output></div>}
  {failed&&!locked&&<p role="alert" className="auth-message">保存を確認できませんでした。入力はこの画面に保持しています。再接続して同じPageを開くと、保持した入力を戻せます。</p>}
  {!offline&&<div className="native-actions"><button type="button" disabled={busy} onClick={onRead}>{state.readStatus==='store_pending'?'取得内容の保存を再確認':state.readError?'取得本文の表示を再確認':'このPageの変更を取得'}</button><output aria-label="Pageの取得状態" aria-live="polite">{state.reading?'変更の取得・保存を確認中…':state.readError?'取得した本文の表示を確認できません。表示中の本文と入力は保持しています。':state.remoteWaiting?(state.composing?'取得内容を端末に保存しました。変換の確定後に表示へ反映します。':'取得内容は端末に保存済みです。入力の保存確認後に表示へ反映します。'):state.readStatus==='received'?'取得内容を端末に保存し、本文へ反映しました。':state.readStatus==='store_pending'?'取得内容の端末保存は未確認です。自動で再取得しません。':state.readStatus==='read_unknown'?'取得結果は未確認です。自動で再取得しません。':'この画面では他端末の変更をまだ取得していません。'}</output></div>}
  <output aria-label="タイトルの保存状態" aria-live="polite">{state.saving?'端末に保存中…':state.titleDraft?'タイトルはこの画面だけに保持しています。本文を送信後、タイトルを取得して端末に保存してください。':failed?'タイトルの保存は未確認です。':state.titlePending===null?'タイトルの未送信数は未確認です。':`タイトル未送信 ${state.titlePending}件`}</output>
  {!offline&&<div className="native-actions">
   <button type="button" disabled={busy} onClick={()=>{void session.titleAction('read').catch(()=>{});}}>タイトルを取得</button>
   <button type="button" disabled={busy||state.titleDraft} onClick={()=>{void session.titleAction('send').catch(()=>{});}}>タイトルを送信</button>
   <output aria-label="タイトルの同期状態" aria-live="polite">{state.titleBusy?'タイトルを確認中…':state.titleStatus==='conflict'?'タイトルが競合しました。サーバーの内容を上書きせず保持しています。':state.titleStatus==='rejected'?'タイトル変更は拒否されました。変更履歴を保持しています。':state.titleStatus==='ack_pending'?'タイトルの受領を確認しました。端末の記録は未確認です。':state.titleStatus==='send_unknown'?'タイトルの送信結果は未確認です。自動再送しません。':state.titleReadStatus==='store_pending'?'取得したタイトルの端末保存は未確認です。':state.titleReadStatus==='read_unknown'?'タイトルの取得結果は未確認です。':state.titleStatus==='applied'?'タイトルの受領記録を端末に保存しました。':state.titleStatus==='idle'?'タイトルの未送信変更はありません。':state.titleReadStatus==='received'?'タイトルを端末に保存しました。':'タイトルの同期結果は未確認です。'}</output>
  </div>}
  {state.titleConflicts.map(conflict=><details key={conflict.id}><summary>タイトルの競合（未解決）</summary>
   <p>変更前: {conflict.base||'空のタイトル'}</p>
   <p>この端末の候補: {conflict.local||'空のタイトル'}</p>
   <p>サーバーの候補: {conflict.remote||'空のタイトル'}</p>
   <div className="native-actions">
    <button type="button" disabled={busy||state.titlePending!==0||state.titleResolutionId!==null} onClick={()=>{void session.resolveTitleConflict(conflict.id,'local').catch(()=>{});}}>この端末の候補を選ぶ</button>
    <button type="button" disabled={busy||state.titlePending!==0||state.titleResolutionId!==null} onClick={()=>{void session.resolveTitleConflict(conflict.id,'remote').catch(()=>{});}}>サーバーの候補を選ぶ</button>
   </div>
   {state.titleResolutionId===conflict.id&&<p role="status">選択した解決を端末に保存しました。タイトルを送信すると確定します。</p>}
  </details>)}
  {state.titleOperations.length>0&&<section aria-label="タイトルの変更履歴"><h3>タイトルの変更履歴</h3><ul>{state.titleOperations.map(op=><li key={op.sequence}>{op.title||'空のタイトル'} — {op.status==='applied'?'反映済み':op.status==='pending'?'未送信':op.status==='conflict'?'競合':`拒否 (${op.code})`}</li>)}</ul></section>}
  {state.titleRejected.length>0&&<section aria-label="拒否されたタイトル変更"><h3>受け付けられなかった変更</h3>{state.titleRejected.map((r,i)=><p key={i}>{r.title||'空のタイトル'} — {r.code==='resolution_stale'?'タイトルが先に更新されています。候補を確認してください。':'この変更は受け付けられませんでした。保存した入力は残っています。'}</p>)}</section>}
  <div className="native-actions">
   {state.titleHasMore&&<button type="button" disabled={busy} onClick={()=>{void session.titleHistory(true).catch(()=>{});}}>保存済み候補・履歴の続き</button>}
   <button type="button" disabled={busy} onClick={()=>{void session.titleHistory(false).catch(()=>{});}}>候補・履歴を先頭へ</button>
  </div>
  <PageEditor session={session} title={state.title} storageError={!state.composing&&(failed||locked)?'保存を確認できません':null}/>
  {locked&&<div className="native-editor-lock" role="status">接続が閉じています。変換を確定すると、入力を保持して編集画面を閉じます。</div>}
 </section>;
}
