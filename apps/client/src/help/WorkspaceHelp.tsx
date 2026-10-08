import {useEffect,useRef,useState,type MouseEvent} from 'react';
import {helpArticle,helpArticles,helpCategories,searchHelp,type HelpArticleId,type HelpCategory} from './articles';
import './style.css';
declare const __GREIVA_VERSION__:string;
type Origin={element:HTMLElement|null;range:Range|null;input:{start:number;end:number;direction:'forward'|'backward'|'none'}|null;x:number;y:number};
function capture():Origin{
 const element=document.activeElement instanceof HTMLElement?document.activeElement:null,selection=window.getSelection();let input:Origin['input']=null;
 if(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement){if(element.selectionStart!==null&&element.selectionEnd!==null)input={start:element.selectionStart,end:element.selectionEnd,direction:element.selectionDirection??'none'};}
 return{element,range:selection?.rangeCount?selection.getRangeAt(0).cloneRange():null,input,x:window.scrollX,y:window.scrollY};
}
// Product help never reads application stores. The origin remains mounted and
// restoring a connected selection does not invoke editor commands or sync.
export function useWorkspaceHelp(blocked:boolean){
 const [request,setRequest]=useState<{id:HelpArticleId|null}|null>(null),origin=useRef<Origin|null>(null),pointer=useRef(false),closing=useRef(false),fallback=useRef<HTMLButtonElement>(null);
 const dismiss=()=>{if(closing.current)return;closing.current=true;const saved=origin.current;origin.current=null;setRequest(null);requestAnimationFrame(()=>{
  const target=saved?.element?.isConnected?saved.element:fallback.current;target?.focus({preventScroll:true});
  if(saved?.input&&(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement))try{target.setSelectionRange(saved.input.start,saved.input.end,saved.input.direction);}catch{/* input type has no selection */}
  else if(saved?.range?.startContainer.isConnected&&saved.range.endContainer.isConnected){const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(saved.range);}
  if(saved)window.scrollTo(saved.x,saved.y);
 });};
 const entry=(id:HelpArticleId|null=null)=>({disabled:blocked,onPointerDown:()=>{origin.current=capture();pointer.current=true;},onClick:(event:MouseEvent<HTMLButtonElement>)=>{
  if(blocked)return;if(!pointer.current||event.detail===0)origin.current=capture();pointer.current=false;closing.current=false;setRequest({id});
 }});
 return{entry,launcherRef:fallback,panel:request?<WorkspaceHelp initial={request.id} onClose={dismiss}/>:null};
}
function WorkspaceHelp({initial,onClose}:{initial:HelpArticleId|null;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),search=useRef<HTMLInputElement>(null),heading=useRef<HTMLHeadingElement>(null),composing=useRef(false),first=useRef(true);
 const [query,setQuery]=useState(''),[category,setCategory]=useState<HelpCategory|'all'>('all'),[selected,setSelected]=useState<string>(initial??'start'),[inComposition,setInComposition]=useState(false);
 const article=helpArticle(selected),results=searchHelp(query,category);
 useEffect(()=>{const node=dialog.current;if(!node)return;node.showModal();(initial?heading.current:search.current)?.focus();return()=>{if(node.open)node.close();};},[initial]);
 useEffect(()=>{if(first.current){first.current=false;return;}heading.current?.focus();},[selected]);
 const choose=(id:string)=>{if(!composing.current)setSelected(id);};
 return <dialog ref={dialog} className="workspace-help" aria-labelledby="workspace-help-heading" onCancel={event=>{event.preventDefault();if(!composing.current)onClose();}}>
  <header><h2 id="workspace-help-heading">ヘルプ・アプリ情報</h2><button type="button" disabled={inComposition} onClick={onClose}>ヘルプを閉じる</button></header>
  <p className="editor-hint">接続プレビューの同梱ガイドです。ヘルプの検索は端末内で行います。</p>
  <div className="help-layout"><nav aria-label="ヘルプの記事"><label>ヘルプ内を検索<input ref={search} type="search" maxLength={120} value={query} onChange={event=>setQuery(event.target.value)} onCompositionStart={()=>{composing.current=true;setInComposition(true);}} onCompositionEnd={()=>{composing.current=false;setInComposition(false);}} onKeyDown={event=>{if(event.key==='Enter'&&(event.nativeEvent.isComposing||composing.current||event.keyCode===229))event.preventDefault();}}/></label>
   <label>ヘルプカテゴリ<select value={category} disabled={inComposition} onChange={event=>setCategory(event.target.value as HelpCategory|'all')}><option value="all">すべての記事</option>{helpCategories.map(row=><option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
   {query&&<button type="button" disabled={inComposition} onClick={()=>{setQuery('');search.current?.focus();}}>検索をクリア</button>}
   <output aria-label="ヘルプ検索結果" aria-live="polite">{inComposition?'検索の入力変換中…':`${results.length}件の記事`}</output>
   {results.length===0&&<p role="status">一致する記事はありません。検索語を変えるか、検索をクリアしてカテゴリから探してください。</p>}
   <ul>{results.map(row=><li key={row.id}><button type="button" disabled={inComposition} aria-current={selected===row.id?'page':undefined} onClick={()=>choose(row.id)}>{row.title}</button><p>{row.summary}</p></li>)}</ul>
  </nav><article aria-label="ヘルプ本文" className="help-article"><h3 ref={heading} tabIndex={-1}>{article?.title??'この説明は利用できません'}</h3>
   {article?<><p>{article.summary}</p>{article.sections.map(section=><section key={section.heading}><h4>{section.heading}</h4>{section.paragraphs?.map(text=><p key={text}>{text}</p>)}{section.steps&&<ol>{section.steps.map(text=><li key={text}>{text}</li>)}</ol>}</section>)}<section aria-label="関連するヘルプ"><h4>関連する説明</h4>{article.related.map(id=><button type="button" key={id} disabled={inComposition} onClick={()=>choose(id)}>{helpArticle(id)!.title}</button>)}</section></>:<p>現在の版で利用できる記事を一覧から選んでください。</p>}
   <p className="editor-hint">同梱記事 {helpArticles.length}件 / 日本語{article?` / 記事改訂 ${article.revision}`:''}</p>
  </article></div>
  <footer><output aria-label="アプリ版">Greiva {__GREIVA_VERSION__}</output><p>未ログインでもこの案内は読めます。記事を読むだけでは保存・再試行・送信を実行しません。</p></footer>
 </dialog>;
}
