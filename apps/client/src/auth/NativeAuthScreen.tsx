import {useEffect,useRef,useState} from 'react';
import {PrivateAuthForm} from './PrivateAuthForm';
import type {NativeLoginController} from './native-login-controller';
import {NativeLocalPageEditor} from '../editor/NativeLocalPageEditor';
const labels={checking:'接続を確認中…',signed_out:'ログインしていません',restoring:'前回の接続を復元中…',logging_in:'ログインを確認中…',verified:'認証を確認しました',opening:'workspaceを開いています…',ready:'端末のworkspaceを開きました',loading:'一覧の続きを確認中…',signing_out:'ログアウト中…',unavailable:'この画面では接続できません',signing_up:'登録の受付を確認中…',signup_requested:'登録依頼を受け付けました'};
export function NativeAuthScreen({controller}:{controller:NativeLoginController|null}){
 if(!controller)return <main className="auth-shell"><h1>Greiva</h1><p role="status">この画面はWindowsアプリから開いてください。</p></main>;
 return <Connected controller={controller}/>;
}
function Connected({controller}:{controller:NativeLoginController}){
 const [state,setState]=useState(controller.snapshot);
 const titleComposition=useRef(false),[titleComposing,setTitleComposing]=useState(false);
 useEffect(()=>controller.subscribe(setState),[controller]);
 useEffect(()=>{void controller.start();const leaving=()=>controller.dispose();window.addEventListener('pagehide',leaving);return()=>window.removeEventListener('pagehide',leaving);},[controller]);
 useEffect(()=>{const returning=(event:PageTransitionEvent)=>{if(event.persisted)location.reload();};window.addEventListener('pageshow',returning);return()=>window.removeEventListener('pageshow',returning);},[]);
 const connected=['verified','opening','ready','loading'].includes(state.phase);
 return <main className={`auth-shell ${['ready','loading'].includes(state.phase)?'native-workspace-shell':''}`}><header><span className="auth-brand">Greiva</span><span className="auth-badge">端末のworkspace</span></header>
  <section className="auth-card" aria-labelledby="native-heading"><div className="auth-intro"><h1 id="native-heading">個人workspaceへ</h1><p>前回の接続をこの端末で復元します。ログアウトしても、端末の保存済みデータと未送信の変更は保持します。</p></div>
   <div className="auth-status" data-phase={state.phase}><span className="auth-dot" aria-hidden="true"/><output aria-label="端末接続の状態" aria-live="polite">{labels[state.phase]}</output></div>
   {state.message&&<p role={state.phase==='signup_requested'||state.notice?'status':'alert'} className={state.notice?'auth-help':'auth-message'}>{state.message}</p>}
   {['signed_out','signup_requested','logging_in','signing_up'].includes(state.phase)&&<PrivateAuthForm controller={controller} disabled={state.busy||state.composing}/>}
   {state.phase==='verified'&&<button type="button" className="auth-primary" onClick={()=>{void controller.open();}}>workspaceを開く</button>}
   {connected&&<div className="native-actions"><button type="button" disabled={state.busy||titleComposing} onClick={()=>{void controller.restore();}}>認証を更新</button><button type="button" disabled={state.composing||state.saving>0||titleComposing} onClick={()=>{void controller.logout();}}>ログアウト</button></div>}
   {state.logoutUnconfirmed&&<button type="button" onClick={()=>{void controller.logout();}}>ログアウトを再確認</button>}
   <div className="native-workspace-layout">{['ready','loading'].includes(state.phase)&&<section aria-label="端末Page一覧"><h2>端末の保存済みPage</h2><form aria-label="新しい端末Page" onCompositionStart={()=>{titleComposition.current=true;setTitleComposing(true);}} onCompositionEnd={()=>{titleComposition.current=false;setTitleComposing(false);}} onSubmit={event=>{event.preventDefault();if(state.busy||titleComposition.current)return;const form=event.currentTarget,title=String(new FormData(form).get('title')??'');void controller.createPage(title).then(saved=>{if(saved&&form.isConnected)form.reset();});}}>
     <label>新しいPageのタイトル<input name="title" maxLength={4096} required disabled={state.busy}/></label><button type="submit" disabled={state.busy}>Pageを作成</button></form>
    {state.pages.length===0?<p>この端末に保存済みのPageはありません。</p>:<ul className="native-page-list">{state.pages.map(page=><li key={page.metadata.id}><button type="button" disabled={state.busy||titleComposing} onClick={()=>{void controller.selectPage(page.metadata.id);}}>{page.metadata.title||'無題のPage'}</button><span className="auth-help">{page.metadata.id===controller.editor?.pageId&&controller.editor.snapshot.storageError?'保存未確認':page.pending>0?`未送信 ${page.pending}件`:'端末に保存済み'}</span></li>)}</ul>}
    {state.hasMore&&<button type="button" disabled={state.busy||titleComposing} onClick={()=>{void controller.more();}}>さらに表示</button>}<button type="button" disabled={state.busy||titleComposing} onClick={()=>{void controller.close();}}>workspaceを閉じる</button>
    <p className="auth-help">本文は端末へ保存します。サーバーへの送信は準備中です。</p></section>}
    <div>{controller.editor&&<>{state.hasDraft&&<button type="button" disabled={state.busy||Boolean(controller.editor.snapshot.storageError)} onClick={()=>{void controller.restoreInput();}}>保持した入力を戻す</button>}<NativeLocalPageEditor key={controller.editor.document.guid} session={controller.editor} locked={state.editorLocked}/></>}</div>
   </div>
  </section>
 </main>;
}
