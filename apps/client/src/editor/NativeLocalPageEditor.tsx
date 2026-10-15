import {useEffect,useState} from 'react';
import {PageEditor} from './PageEditor';
import type {NativePageSession} from './native-page-session';
export function NativeLocalPageEditor({session,locked,onSend}:{session:NativePageSession;locked:boolean;onSend:()=>void}){
 const [state,setState]=useState(session.snapshot);useEffect(()=>session.subscribe(setState),[session]);
 const failed=state.storageError!==null;
 return <section className="native-editor-wrap" aria-label="端末Page編集">
  <output className="page-sync-status" aria-live="polite" aria-label="本文の保存状態">{state.saving>0?'端末に保存中…':failed?`保存未確認 ${state.unsaved}件`:!state.pendingFresh?'端末に保存済み · 未送信数は再確認が必要':state.pending>0?`端末に保存しました · 未送信 ${state.pending}件`:'端末に保存済み'}</output>
  <div className="native-actions"><button type="button" disabled={locked||failed||state.composing||state.saving>0||state.sending} onClick={onSend}>{state.sendStatus==='ack_pending'?'受領記録を再確認':state.sendStatus==='send_unknown'?'送信結果を再確認':'このPageを送信'}</button><output aria-label="Pageの送信状態" aria-live="polite">{state.sending?'送信・受領記録を確認中…':state.sendStatus==='ack_pending'?'サーバーの受領を確認しました。端末の受領記録は未確認です。':state.sendStatus==='send_unknown'?'送信・受領結果は未確認です。自動再送は行いません。':state.sendStatus==='acked'?'送信分の受領記録を端末に保存しました。':state.sendStatus==='idle'?'このPageの未送信変更はありません。':'この画面では送信結果をまだ確認していません。'}</output></div>
  {failed&&!locked&&<p role="alert" className="auth-message">保存を確認できませんでした。入力はこの画面に保持しています。再接続して同じPageを開くと、保持した入力を戻せます。</p>}
  <PageEditor session={session} title={state.title} storageError={!state.composing&&(failed||locked)?'保存を確認できません':null}/>
  {locked&&<div className="native-editor-lock" role="status">接続が閉じています。変換を確定すると、入力を保持して編集画面を閉じます。</div>}
 </section>;
}
