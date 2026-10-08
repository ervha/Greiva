import {useEffect,useRef,useState} from 'react';
import {newId} from '@greiva/shared';
import type {PrivateTitleSession} from './private-title-session';

export function PrivateTitlePanel({session,onDraftChange,onSync,blocked}:{session:PrivateTitleSession;onDraftChange:(blocked:boolean)=>void;onSync:()=>Promise<void>;blocked:boolean}){
  const [state,setState]=useState(session.snapshot),[draft,setDraft]=useState(session.snapshot.data?.localTitle??''),[dirty,setDirty]=useState(false),[composing,setComposing]=useState(false),[formError,setFormError]=useState(false);
  const composingRef=useRef(false),input=useRef<HTMLInputElement>(null);
  useEffect(()=>session.subscribe(setState),[session]);
  useEffect(()=>{onDraftChange(dirty||composing);return()=>onDraftChange(false);},[dirty,composing,onDraftChange]);
  useEffect(()=>{if(!dirty&&!composing&&state.data)setDraft(state.data.localTitle);},[state.data,dirty,composing]);
  if(state.phase!=='ready'||!state.data)return null;
  const data=state.data,locked=state.busy||state.retryMutation,guard=locked||composing||blocked;
  const candidates=data.conflicts.filter(row=>row.resolvedBy===null),rejected=data.operations.filter(row=>row.response?.result.status==='rejected');
  const status=composing?'入力変換中…':state.busy?'タイトルを保存・確認中…':state.retryMutation?'タイトルの保存結果を再確認してください':dirty?'タイトルはまだ保存していません':state.error?'タイトルを確認できませんでした':state.pending?`未確認のタイトル変更 ${state.pending}件`:candidates.length?'競合候補を確認してください':rejected.length?'受け付けられなかった変更があります':state.hasMoreRemote?'サーバーの候補に続きがあります':state.queryComplete?'取得したタイトルを確認しました':'タイトルはまだ確認していません';
  function done(){setDraft(session.snapshot.data?.localTitle??draft);setDirty(false);setFormError(false);onDraftChange(false);}
  async function save(){if(guard||!dirty||data.base===null)return;setFormError(false);try{await session.mutate({operationId:newId(),title:draft});done();}catch{setFormError(true);}}
  async function resolve(record:typeof candidates[number]['record'],choice:'local'|'remote'){if(guard||dirty||state.pending)return;setFormError(false);try{await session.mutate({operationId:newId(),title:record[choice],resolution:{conflictId:record.id,choice}});}catch{setFormError(true);}}
  return <section aria-label="タイトル編集" className="private-title-panel" onCompositionStart={()=>{composingRef.current=true;setComposing(true);onDraftChange(true);}} onCompositionEnd={()=>{composingRef.current=false;setComposing(false);}}>
    <h2>タイトル</h2><output aria-label="タイトルの確認状態" aria-live="polite">{status}</output>
    <form onSubmit={event=>{event.preventDefault();if(!composingRef.current)void save();}}>
      <label>タイトルを編集<input ref={input} value={draft} maxLength={65536} readOnly={locked&&!composing} onKeyDown={event=>{if(event.key==='Enter'&&(event.nativeEvent.isComposing||composingRef.current||event.keyCode===229))event.preventDefault();}} onChange={event=>{setDraft(event.target.value);setDirty(true);onDraftChange(true);}}/></label>
      <div className="connection-tools"><button disabled={guard||!dirty||data.base===null}>タイトルを端末に保存</button><button type="button" disabled={guard||!dirty} onClick={()=>{done();input.current?.focus();}}>タイトル入力を取り消す</button></div>
    </form>
    <div className="connection-tools"><button type="button" disabled={guard||dirty} onClick={()=>{void onSync().catch(()=>setFormError(true));}}>{state.hasMoreRemote?'タイトル候補の続きも確認':'タイトルを送信・確認'}</button>
      {state.retryMutation&&<button type="button" disabled={state.busy||composing||blocked} onClick={()=>{void session.retryMutation().then(done,()=>setFormError(true));}}>同じタイトルの保存を再確認</button>}
    </div>
    {data.base===null&&<p role="status">編集する前にタイトルを確認してください。新しいPageは本文の作成も確認します。</p>}
    {dirty&&!state.retryMutation&&<p role="status">未保存のタイトルがあります。保存または取り消してからPageや接続を切り替えてください。</p>}
    {(formError||state.error)&&<p role="alert">{state.retryMutation?'保存結果が不明です。入力をコピーできる状態で保持しています。同じタイトルの保存を再確認してください。':'タイトルを確認できませんでした。入力と端末に保存した変更は保持しています。'}</p>}
    {candidates.length>0&&<section aria-label="タイトルの競合候補"><h3>確認が必要な候補</h3><p>保存済みの候補です。別端末で解決されている場合、選択が受け付けられないことがあります。</p>{candidates.map(({record})=><article key={record.id} aria-label={'タイトル候補 '+record.id}><dl><dt>編集の基準</dt><dd>{record.base||'空のタイトル'}</dd><dt>この端末の入力</dt><dd>{record.local||'空のタイトル'}</dd><dt>取得したサーバーの値</dt><dd>{record.remote||'空のタイトル'}</dd></dl><div className="connection-tools"><button type="button" disabled={guard||dirty||state.pending>0} onClick={()=>{void resolve(record,'local');}}>このタイトル入力を選ぶ</button><button type="button" disabled={guard||dirty||state.pending>0} onClick={()=>{void resolve(record,'remote');}}>取得したタイトルを選ぶ</button></div></article>)}</section>}
    {rejected.length>0&&<section aria-label="拒否されたタイトル変更"><h3>受け付けられなかった変更</h3>{rejected.map(row=><p key={row.intent.operationId}>{row.intent.title||'空のタイトル'} — {row.response?.result.status==='rejected'&&row.response.result.code==='resolution_stale'?'タイトルが先に更新されています。候補を確認してください。':'この変更は受け付けられませんでした。保存した入力は残っています。'}</p>)}</section>}
    <div className="connection-tools">{state.hasMoreLocal&&<button type="button" disabled={guard||dirty} onClick={()=>{void session.history(true).catch(()=>{});}}>保存済み候補・履歴の続き</button>}<button type="button" disabled={guard||dirty} onClick={()=>{void session.history().catch(()=>{});}}>候補・履歴を先頭へ</button></div>
    <p className="editor-hint">候補と履歴は各100件まで表示します。本文の同期状態とタイトルの確認状態は別です。</p>
  </section>;
}
