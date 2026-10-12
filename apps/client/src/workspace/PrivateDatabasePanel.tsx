import {useEffect,useMemo,useRef,useState} from 'react';
import {newId} from '@greiva/shared';
import {queryLoadedDatabaseView,type DatabaseProperty,type DatabaseValue,type LoadedDatabaseRow} from '@greiva/domain';
import type {Page} from '@greiva/protocol';
import type {PrivateDatabaseBrowser} from './private-database-browser.js';
function display(property:DatabaseProperty,value:DatabaseValue){if(value===null)return '未設定';if(property.type==='checkbox')return value?'チェックあり':'チェックなし';if(property.type==='select')return property.options.find(option=>option.id===value)?.name??'未取得';if(value==='')return '空のテキスト';return String(value);}
export function PrivateDatabasePanel({browser,pages,onOpenPage,blocked}:{browser:PrivateDatabaseBrowser;pages:readonly Page[];onOpenPage:(id:string)=>void;blocked:boolean}){
 const [state,setState]=useState(browser.snapshot),[layout,setLayout]=useState<'table'|'list'|null>(null),[composing,setComposing]=useState(false);
 useEffect(()=>browser.subscribe(setState),[browser]);useEffect(()=>setLayout(null),[state.selected?.source.id,state.view?.snapshot?.view.id,state.view?.snapshot?.version]);
 const titles=useRef(new Map<string,string>());const nextTitles=new Map(pages.map(page=>[page.id,page.title]));if(nextTitles.size!==titles.current.size||[...nextTitles].some(([id,title])=>titles.current.get(id)!==title))titles.current=nextTitles;
 const source=state.selected?.source;
 const fallback=useMemo(()=>source?{id:newId(),sourceId:source.id,name:'読み込み範囲',layout:'table' as const,visiblePropertyIds:source.properties.map(property=>property.id),filter:null,sorts:[]}:null,[source]);
 const view=state.view?.snapshot?.view??fallback;
 const result=useMemo(()=>source&&view?queryLoadedDatabaseView(source,view,state.records.map(row=>({record:row.record!,pageTitle:titles.current.get(row.record!.pageId)??null}))):null,[source,view,state.records,titles.current]);
 const properties=source&&view?view.visiblePropertyIds.map(id=>source.properties.find(property=>property.id===id)!):[];
 const disabled=blocked||composing||state.busy,locked=disabled||state.selectionLocked;
 const action=(work:()=>Promise<void>)=>{void Promise.resolve().then(work).catch(()=>{/* fixed runtime error status owns reporting */});};
 const cell=(row:LoadedDatabaseRow,property:DatabaseProperty)=>property.type==='name'?row.pageTitle===null?<span>Name未取得</span>:<button type="button" disabled={locked} onClick={()=>onOpenPage(row.record.pageId)}>{row.pageTitle||'無題のPage'}</button>:display(property,row.record.values[property.id]??null);
 const candidates=(id:string)=>{const row=state.records.find(row=>row.record?.id===id);return row?.conflicts.some(conflict=>conflict.resolvedBy===null)?'競合候補あり':row?.nextAfter?'候補・履歴に続きあり':row?.conflicts.length?'解決履歴あり':'取得した範囲に競合候補なし';};
 const renderRows=(rows:readonly LoadedDatabaseRow[],label:string)=>layout==='list'||(layout===null&&view?.layout==='list')?<ul className="database-cards" aria-label={label}>{rows.map(row=><li key={row.record.id}><dl>{properties.map(property=><div key={property.id}><dt>{property.name}</dt><dd>{cell(row,property)}</dd></div>)}</dl><p className="editor-hint">版 {row.record.version} / {candidates(row.record.id)}</p></li>)}</ul>:<div className="database-table-scroll" role="region" aria-label={label} tabIndex={0}><table><thead><tr>{properties.map(property=><th scope="col" key={property.id}>{property.name}</th>)}<th scope="col">確認状態</th></tr></thead><tbody>{rows.map(row=><tr key={row.record.id}>{properties.map(property=><td key={property.id}>{cell(row,property)}</td>)}<td>版 {row.record.version} / {candidates(row.record.id)}</td></tr>)}</tbody></table></div>;
 const progress=state.changes;
 return <section className="database-panel" aria-label="基本DB" onCompositionStartCapture={()=>setComposing(true)} onCompositionEndCapture={()=>setComposing(false)}>
  <h2>基本DB</h2><output aria-label="DB確認状態" aria-live="polite">{state.busy?'DBを読み込み・保存中…':state.selectionLocked?'受信した内容の保存結果を再確認してください':state.error?'DBを確認できませんでした。表示中の情報を保持しています。':'端末にある情報を表示しています。全件の同期確認ではありません。'}</output>
  {state.error&&<p role="alert">{state.error==='transport'?'サーバーへ接続できませんでした。':state.error==='storage'?'端末の保存情報を確認できませんでした。':'DBの接続情報を確認できませんでした。'}</p>}
  <div className="connection-tools"><button type="button" disabled={locked} onClick={()=>action(()=>browser.reloadSources())}>端末DB一覧を先頭へ</button>{state.sourceAfter&&<button type="button" disabled={locked} onClick={()=>action(()=>browser.reloadSources(true))}>端末DB一覧の次の範囲</button>}<button type="button" disabled={locked} onClick={()=>action(()=>browser.catalog())}>サーバーDB一覧を取得</button>{state.catalog?.cursor&&<button type="button" disabled={locked} onClick={()=>action(()=>browser.catalog(true))}>サーバーDB一覧の続きを取得</button>}{state.retrySource&&<button type="button" disabled={disabled} onClick={()=>action(()=>browser.retrySource())}>DB定義の保存を再確認</button>}</div>
  {!state.sourceFresh&&<p role="status">端末DB一覧は以前の読取結果です。</p>}
  <label>端末のDB<select value={source?.id??''} disabled={locked} onChange={event=>{const id=event.target.value;action(()=>browser.selectSource(id));}}><option value="" disabled>DBを選択</option>{state.selected&&!state.sources.some(row=>row.source.id===source?.id)&&<option value={source!.id}>{source!.name}（選択中・この一覧範囲外）</option>}{state.sources.map(row=><option key={row.source.id} value={row.source.id}>{row.source.name}</option>)}</select></label>
  {state.sources.length===0&&<p>この読み込み範囲に確認済みDBはありません。</p>}
  {state.catalog&&<section aria-label="取得したサーバーDB"><p>{state.catalogFresh?'取得した一覧の範囲です。':'以前取得した一覧です。'}{state.catalog.hasMore?'一覧に続きがあります。':''}定義と内容は別に取得します。</p><ul>{state.catalog.sources.map(row=><li key={row.id}><span>{row.name}</span><button type="button" disabled={locked} onClick={()=>action(()=>browser.receiveSource(row.id))}>{row.name}の定義を取得</button></li>)}</ul></section>}
  {source&&<>
   <h3>{source.name}</h3><p className="editor-hint">RecordとViewは確認済みの端末データです。未送信の編集はこの表示に含みません。Nameは端末のPage情報から参照します。</p>
   <div className="connection-tools"><button type="button" disabled={locked} onClick={()=>action(()=>browser.sync())}>{progress?.data?.hasMore?'DB変更の続きを取得':'DB変更を取得'}</button>{progress?.retryReceive&&<button type="button" disabled={disabled} onClick={()=>action(()=>browser.sync(true))}>DB変更の保存を再確認</button>}<button type="button" disabled={locked} onClick={()=>action(()=>browser.reloadRecords())}>行の読み込みを先頭へ</button>{state.recordAfter&&<button type="button" disabled={locked} onClick={()=>action(()=>browser.reloadRecords(true))}>行の次の範囲を表示</button>}</div>
   <p role="status">{progress?.retryReceive?'DB変更の保存結果が不明です。':progress?.data?.received?progress.data.hasMore?'受信した変更に続きがあります。':'前回取得した変更の範囲を端末に保存しています。':'DB変更はまだ取得していません。'}</p>
   <label>保存済みビュー<select disabled={locked} value={state.view?.snapshot?.view.id??''} onChange={event=>{const id=event.target.value||null;action(()=>browser.selectView(id));}}><option value="">既定の表示（未保存）</option>{state.view?.snapshot&&!state.views.some(row=>row.id===state.view!.snapshot!.view.id)&&<option value={state.view.snapshot.view.id}>{state.view.snapshot.view.name}（選択中・この一覧範囲外）</option>}{state.views.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
   <div className="connection-tools"><button type="button" disabled={locked} onClick={()=>action(()=>browser.reloadViews())}>ビュー一覧を先頭へ</button>{state.viewAfter&&<button type="button" disabled={locked} onClick={()=>action(()=>browser.reloadViews(true))}>ビュー一覧の次の範囲</button>}<button type="button" disabled={locked} aria-pressed={(layout??view?.layout)==='table'} onClick={()=>setLayout('table')}>Table表示</button><button type="button" disabled={locked} aria-pressed={(layout??view?.layout)==='list'} onClick={()=>setLayout('list')}>List表示</button></div>
   {layout&&<p className="editor-hint">表示だけを切り替えています。保存済みビューの設定は変更していません。</p>}
   {state.view?.snapshot&&<p>ビュー版 {state.view.snapshot.version} / {state.view.conflicts.some(row=>row.resolvedBy===null)?'設定の競合候補あり':state.view.nextAfter?'候補・履歴に続きあり':'取得した範囲に設定の競合候補なし'}</p>}
   {(!state.recordFresh||!state.viewFresh)&&<p role="status">行またはビューは以前の読取結果です。</p>}
   <p>この読み込み範囲の結果 {result?.rows.length??0}件。全件の検索結果ではありません。{state.recordAfter?'未表示の行に続きがあります。':''}</p>
   {result&&renderRows(result.rows,'読み込み範囲の行')}
   {result?.rows.length===0&&<p>この範囲で条件に一致すると確認できた行はありません。</p>}
   {Boolean(result?.unresolved.length)&&<section aria-label="条件未判定の行"><h3>Name取得待ちの行</h3><p>未取得のNameがあるため、フィルターまたは並び順を評価できません。空タイトルとして判定していません。</p>{renderRows(result!.unresolved.map(item=>item.row),'条件未判定の行一覧')}</section>}
  </>}
 </section>;
}
