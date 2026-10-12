import {useEffect,useRef,useState} from 'react';
import {newId} from '@greiva/shared';
import {databaseSourceSchema} from '@greiva/domain';
import type {PrivateDatabaseSourceIntent} from '@greiva/protocol/private-database-source';
import type {PrivateDatabaseSourceWriteSession} from './private-database-source-write-session.js';
const defaultOptions='選択肢1\n選択肢2';
export function PrivateDatabaseCreatePanel({session,onDraftChange,onOpenCreated,blocked,compositionActive}:{session:PrivateDatabaseSourceWriteSession;onDraftChange:(blocked:boolean)=>void;onOpenCreated:(id:string)=>void;blocked:boolean;compositionActive:boolean}){
 const [state,setState]=useState(session.snapshot),[name,setName]=useState(''),[options,setOptions]=useState(defaultOptions),[message,setMessage]=useState<string|null>(null),[composing,setComposing]=useState(false);
 const composition=useRef(false),intent=useRef<PrivateDatabaseSourceIntent|null>(null);
 useEffect(()=>session.subscribe(setState),[session]);const dirty=name!==''||options!==defaultOptions;
 useEffect(()=>{onDraftChange(dirty||composing||state.retryEnqueue||state.retryAck);},[dirty,composing,state.retryEnqueue,state.retryAck,onDraftChange]);useEffect(()=>()=>onDraftChange(false),[onDraftChange]);
 const unknown=state.retryEnqueue||state.retryAck,readOnly=blocked||state.busy||unknown,actionsBlocked=readOnly||compositionActive||composing;
 const clear=()=>{intent.current=null;setName('');setOptions(defaultOptions);setMessage(null);};
 const save=async()=>{
  if(actionsBlocked||composition.current||intent.current)return;
  let captured:PrivateDatabaseSourceIntent;
  try{const labels=options.split(/\r?\n/).filter(value=>value.trim().length>0);if(Array.from(name).length>120||labels.length>100||labels.some(value=>Array.from(value).length>120))throw Error();const types=['name','text','number','checkbox','select','date'] as const;captured={operationId:newId(),source:databaseSourceSchema.parse({id:newId(),workspaceId:session.workspaceId,name,schemaVersion:1,properties:types.map(type=>({id:newId(),name:type[0]!.toUpperCase()+type.slice(1),type,...(type==='select'?{options:labels.map(value=>({id:newId(),name:value}))}:{})}))})};}catch{setMessage('DB名は1〜120文字、選択肢は各120文字まで・100個以内で入力してください。');return;}
  intent.current=captured;setMessage(null);try{await session.enqueue(captured);clear();}catch{if(!session.snapshot.retryEnqueue)intent.current=null;setMessage('端末への保存を確認できませんでした。入力内容を保持しています。');}
 };
 const retrySave=async()=>{if(blocked||state.busy||compositionActive||composition.current)return;setMessage(null);try{await session.retryEnqueue();clear();}catch{setMessage('同じDBの保存を確認できませんでした。入力内容を保持しています。');}};
 const action=(work:()=>Promise<unknown>)=>{if(blocked||state.busy||compositionActive||composition.current)return;void work().catch(()=>{/* fixed runtime stage owns status */});};
 return <section className="database-create-panel" aria-label="DB作成" onCompositionStartCapture={()=>{composition.current=true;setComposing(true);}} onCompositionEndCapture={()=>{composition.current=false;setComposing(false);}}>
  <h2>新しいDB</h2><output aria-label="DB作成状態" aria-live="polite">{state.busy?'DBの保存・送信を確認中…':state.retryEnqueue?'端末への保存結果が不明です。同じDBで再確認してください。':state.retryAck?'作成応答の保存結果が不明です。同じ応答で再確認してください。':state.error?'DB作成を確認できませんでした。保存済みの操作は保持しています。':dirty?'入力中の内容はまだ保存していません。':'DB作成は端末保存と送信確認を別に行います。'}</output>
  <form onSubmit={event=>{event.preventDefault();void save();}}>
   <label>DB名<input value={name} maxLength={240} readOnly={readOnly} onChange={event=>setName(event.target.value)} required/></label>
   <label>Selectの選択肢（1行に1つ）<textarea value={options} maxLength={24100} rows={3} readOnly={readOnly} onChange={event=>setOptions(event.target.value)}/></label>
   <p className="editor-hint">Name・Text・Number・Checkbox・Select・Dateを作成します。NameはPageタイトルを参照します。選択肢は作成時に設定します。</p>
   {message&&<p role="alert">{message}</p>}
   <div className="connection-tools"><button disabled={actionsBlocked||!name.trim()||Array.from(name).length>120}>DBを端末に保存</button><button type="button" disabled={actionsBlocked||!dirty} onClick={()=>{if(!composition.current)clear();}}>DB入力を取り消す</button>{state.retryEnqueue&&<button type="button" disabled={blocked||state.busy||compositionActive||composing} onClick={()=>{void retrySave();}}>同じDBの保存を再確認</button>}</div>
  </form>
  <div className="connection-tools"><button type="button" disabled={actionsBlocked||dirty} onClick={()=>action(()=>session.send())}>DB作成を送信・確認</button>{state.retryAck&&<button type="button" disabled={blocked||state.busy||compositionActive||composing} onClick={()=>action(()=>session.retryAck())}>作成応答の保存を再確認</button>}<button type="button" disabled={blocked||state.busy||compositionActive||composing} onClick={()=>action(()=>session.reload())}>DB作成一覧を先頭へ</button>{state.data?.nextAfter&&<button type="button" disabled={blocked||state.busy||compositionActive||composing} onClick={()=>action(()=>session.reload(true))}>DB作成一覧の次の範囲</button>}</div>
  <p>{state.catalogFresh?'端末で確認した時点の':'以前読み込んだ'}未確認のDB作成 {state.data?.pending??'未取得'}件。{!state.catalogFresh?'一覧の確認は完了していません。':''}</p>
  <ul>{state.data?.operations.map(row=><li key={row.intent.operationId}>{row.intent.source.name} — {state.lastSend?.operationId===row.intent.operationId?'作成を確認済み・一覧の再読取待ち':state.catalogFresh?'端末に保存済み・作成結果は未確認':'以前の未確認一覧・再読取待ち'}</li>)}</ul>
  {state.lastSend&&<p>最後に確認できた作成：{state.lastSend.snapshot.source.name}<button type="button" disabled={blocked||state.busy||dirty||unknown||compositionActive||composing} onClick={()=>onOpenCreated(state.lastSend!.snapshot.source.id)}>確認済みのDBを開く</button></p>}
  {state.lastSendEmpty&&<p>送信確認時点では、未確認のDB作成がありませんでした。</p>}
  {state.error&&<p role="alert">{state.error==='transport'?'サーバーへ接続できませんでした。作成操作は端末に残っています。':state.error==='storage'?'端末の保存結果または一覧を確認できませんでした。':'DB作成の情報を確認できませんでした。接続を閉じて再確認してください。'}</p>}
 </section>;
}
