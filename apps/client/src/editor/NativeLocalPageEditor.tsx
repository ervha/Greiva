import {useEffect,useState} from 'react';
import {PageEditor} from './PageEditor';
import type {NativePageSession} from './native-page-session';
export function NativeLocalPageEditor({session,locked}:{session:NativePageSession;locked:boolean}){
 const [state,setState]=useState(session.snapshot);useEffect(()=>session.subscribe(setState),[session]);
 const failed=state.storageError!==null;
 return <section className="native-editor-wrap" aria-label="端末Page編集">
  <output className="page-sync-status" aria-live="polite" aria-label="本文の保存状態">{state.saving>0?'端末に保存中…':failed?`保存未確認 ${state.unsaved}件`:state.pending>0?`端末に保存しました · 未送信 ${state.pending}件`:'端末に保存済み'}</output>
  {failed&&!locked&&<p role="alert" className="auth-message">保存を確認できませんでした。入力はこの画面に保持しています。再接続して同じPageを開くと、保持した入力を戻せます。</p>}
  <PageEditor session={session} title={state.title} storageError={!state.composing&&(failed||locked)?'保存を確認できません':null}/>
  {locked&&<div className="native-editor-lock" role="status">接続が閉じています。変換を確定すると、入力を保持して編集画面を閉じます。</div>}
 </section>;
}
