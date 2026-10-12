import {useEffect,useRef,useState} from 'react';
import {DatabaseValueFields,readDatabaseValueDraft,type DatabaseValueDraft as Draft} from './DatabaseValueFields';
import {newId} from '@greiva/shared';
import {parseDatabaseRecordIntent,type DatabaseSource,type DatabaseValue} from '@greiva/domain';
import type {Page} from '@greiva/protocol';
import type {PrivateDatabaseRecordWriteSession} from './private-database-record-write-session.js';
export function PrivateDatabaseRecordCreatePanel({session,source,pages,existingPageIds,onDraftChange,onReadRows,blocked,compositionActive}:{session:PrivateDatabaseRecordWriteSession;source:DatabaseSource;pages:readonly Page[];existingPageIds:readonly string[];onDraftChange:(blocked:boolean)=>void;onReadRows:()=>void;blocked:boolean;compositionActive:boolean}){
 const [state,setState]=useState(session.snapshot),[pageId,setPageId]=useState(''),[drafts,setDrafts]=useState<Record<string,Draft>>({}),[message,setMessage]=useState<string|null>(null),[composing,setComposing]=useState(false);
 const composition=useRef(false),captured=useRef(false);useEffect(()=>session.subscribe(setState),[session]);
 const pendingPages=state.data?.create.operations.filter(row=>row.intent.source.id===source.id).map(row=>row.intent.intent.pageId)??[];
 const choices=pages.filter(page=>!existingPageIds.includes(page.id)&&!pendingPages.includes(page.id));
 const dirty=pageId!==''||Object.keys(drafts).length>0,unknown=state.retryEnqueue||state.retryAck,readOnly=blocked||state.busy||unknown;
 useEffect(()=>{onDraftChange(dirty||composing||unknown);},[dirty,composing,unknown,onDraftChange]);useEffect(()=>()=>onDraftChange(false),[onDraftChange]);
 const fields=source.properties.filter(property=>property.type!=='name'),clear=()=>{captured.current=false;setPageId('');setDrafts({});setMessage(null);};
 const action=(work:()=>Promise<unknown>)=>{if(blocked||state.busy||compositionActive||composition.current)return;void work().catch(()=>{});};
 const save=async()=>{
  if(readOnly||compositionActive||composition.current||captured.current)return;
  let candidate;
  try{if(!choices.some(page=>page.id===pageId))throw Error();const values:Record<string,DatabaseValue>={};for(const property of fields){const draft=drafts[property.id];if(draft&&draft.mode!=='omit')values[property.id]=readDatabaseValueDraft(property,draft);}candidate={operationId:newId(),source,intent:parseDatabaseRecordIntent(source,{kind:'create',sourceId:source.id,schemaVersion:source.schemaVersion,recordId:newId(),pageId,baseVersion:null,values})};}catch{setMessage('Pageと各プロパティの値を確認してください。数値・日付・選択肢は型に合う値で入力します。');return;}
  captured.current=true;setMessage(null);try{const result=await session.enqueueCreate(candidate);if(result.status==="busy"){captured.current=false;setMessage("このPageはすでにこのDBの行または保存操作に関連付いています。入力を保持しています。別のPageを選んでください。");return;}clear();}catch{if(!session.snapshot.retryEnqueue)captured.current=false;setMessage('行の端末保存を確認できませんでした。入力を保持しています。');}
 };
 const retrySave=async()=>{if(blocked||state.busy||compositionActive||composition.current)return;try{const result=await session.retryEnqueue();if(result.status==="busy"){captured.current=false;setMessage("このPageは別の行に関連付いているため保存できません。入力を保持しています。");return;}clear();}catch{setMessage('同じ行の保存を確認できませんでした。入力を保持しています。');}};
 const set=(id:string,draft:Draft)=>setDrafts(prior=>({...prior,[id]:draft}));
 return <section className="database-record-create-panel" aria-label="DB行作成" onCompositionStartCapture={()=>{composition.current=true;setComposing(true);}} onCompositionEndCapture={()=>{composition.current=false;setComposing(false);}}>
  <h3>{source.name}に行を追加</h3><p className="editor-hint">本文を端末に保存したPageを選びます。NameはそのPageのタイトルを参照し、本文を複製しません。</p>
  <output aria-label="DB行保存状態" aria-live="polite">{state.busy?'行の保存・送信を確認中…':state.retryEnqueue?'行の保存結果が不明です。同じ操作で再確認してください。':state.retryAck?'応答の保存結果が不明です。同じ応答で再確認してください。':dirty?'入力内容はまだ保存していません。':'行の端末保存と送信確認は別に行います。'}</output>
  <form onSubmit={event=>{event.preventDefault();void save();}}>
   <label>行のPage<select value={pageId} disabled={readOnly||compositionActive} onChange={event=>setPageId(event.target.value)}><option value="">Pageを選択</option>{pageId&&!choices.some(page=>page.id===pageId)&&<option value={pageId}>{pages.find(page=>page.id===pageId)?.title||'選択中のPage'}</option>}{choices.map(page=><option key={page.id} value={page.id}>{page.title||'無題のPage'}</option>)}</select></label>
   <DatabaseValueFields properties={fields} drafts={drafts} onChange={set} readOnly={readOnly} compositionActive={compositionActive} unchangedLabel="値なし（未設定）"/>
   {message&&<p role="alert">{message}</p>}
   <div className="connection-tools"><button disabled={readOnly||compositionActive||composing||!pageId}>行を端末に保存</button><button type="button" disabled={readOnly||compositionActive||composing||!dirty} onClick={()=>{if(!composition.current)clear();}}>行入力を取り消す</button>{state.retryEnqueue&&<button type="button" disabled={blocked||state.busy||compositionActive||composing} onClick={()=>{void retrySave();}}>同じ行の保存を再確認</button>}</div>
  </form>
  <div className="connection-tools"><button type="button" disabled={readOnly||compositionActive||composing||dirty} onClick={()=>action(()=>session.send('create'))}>行の作成を送信・確認</button>{state.retryAck&&<button type="button" disabled={blocked||state.busy||compositionActive||composing} onClick={()=>action(()=>session.retryAck())}>行の応答保存を再確認</button>}<button type="button" disabled={blocked||state.busy||compositionActive||composing} onClick={()=>action(()=>session.reload())}>行作成一覧を先頭へ</button>{state.data?.create.nextAfter&&<button type="button" disabled={blocked||state.busy||compositionActive||composing} onClick={()=>action(()=>session.reload('create',true))}>行作成一覧の次の範囲</button>}</div>
  <p>{state.queueFresh.create?'確認した時点の':'以前の一覧の'}未確認の行作成 {state.data?.create.pending??'未取得'}件（workspace全体）。</p>
  <ul>{state.data?.create.operations.filter(row=>row.intent.source.id===source.id).map(row=><li key={row.intent.operationId}>{pages.find(page=>page.id===row.intent.intent.pageId)?.title||'Pageタイトル未取得'} — {state.lastSend?.status==="ack"&&state.lastSend.kind==="create"&&state.lastSend.response.operationId===row.intent.operationId?"反映は確認済み。一覧の再読込を待っています。":"作成結果は未確認。"}{source.properties.filter(property=>property.type!=='name').map(property=><span key={property.id}> {property.name}: {Object.hasOwn(row.intent.intent.values,property.id)?JSON.stringify(row.intent.intent.values[property.id]):'値なし'}</span>)}</li>)}</ul>
  {state.lastSend?.status==='blocked'&&<p role="status">{state.lastSend.blocked.reason==='page'?'関連するPageの作成確認が必要です。Page本文の同期を確認してください。':'DBの作成確認が必要です。DB作成の送信を確認してください。'}</p>}
  {state.lastSend?.status==='empty'&&<p>送信確認時点で未確認の行作成はありませんでした。</p>}
  {state.lastSend?.status==='ack'&&<p>最後に確認した行の結果：{state.lastSend.response.result.status==='applied'?'反映を確認':state.lastSend.response.result.status==='conflict'?'競合候補あり':'拒否されました'}<button type="button" disabled={blocked||state.busy||unknown||dirty||compositionActive||composing} onClick={onReadRows}>確認済みの行表示を更新</button></p>}
  {state.error&&<p role="alert">{state.error==='transport'?'送信結果を確認できませんでした。保存済みの行作成は端末に残っています。':'行の保存結果または一覧を確認できませんでした。元の操作と表示を保持しています。'}</p>}
 </section>;
}
