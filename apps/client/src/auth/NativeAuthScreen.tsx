import {useEffect,useRef,useState} from 'react';
import {PrivateAuthForm} from './PrivateAuthForm';
import type {NativeLoginController} from './native-login-controller';
import {NativeLocalPageEditor} from '../editor/NativeLocalPageEditor';
const labels={choosing:'接続方法を選んでください',checking:'接続を確認中…',signed_out:'ログインしていません',restoring:'前回の接続を復元中…',reconnecting:'workspaceへ再接続中…',logging_in:'ログインを確認中…',verified:'認証を確認しました',opening:'workspaceを開いています…',ready:'端末のworkspaceを開きました',loading:'一覧の続きを確認中…',signing_out:'ログアウト中…',unavailable:'この画面では接続できません',signing_up:'登録の受付を確認中…',signup_requested:'登録依頼を受け付けました'};
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
 const connected=['verified','opening','ready','loading','reconnecting'].includes(state.phase);
 return <main className={`auth-shell ${['ready','loading','reconnecting'].includes(state.phase)?'native-workspace-shell':''}`}><header><span className="auth-brand">Greiva</span><span className="auth-badge">端末のworkspace</span></header>
  <section className="auth-card" aria-labelledby="native-heading"><div className="auth-intro"><h1 id="native-heading">個人workspaceへ</h1><p>前回の接続をこの端末で復元します。ログアウトしても、端末の保存済みデータと未送信の変更は保持します。</p></div>
   <div className="auth-status" data-phase={state.phase}><span className="auth-dot" aria-hidden="true"/><output aria-label="端末接続の状態" aria-live="polite">{state.mode==='offline'&&state.phase==='ready'?'offlineで端末のworkspaceを開きました':labels[state.phase]}</output></div>
   {state.message&&<p role={state.phase==='signup_requested'||state.notice?'status':'alert'} className={state.notice?'auth-help':'auth-message'}>{state.message}</p>}
   {['choosing','signed_out','verified'].includes(state.phase)&&state.canResumeOffline&&<section aria-label="接続方法"><p>onlineでは認証を更新します。offlineでは、この端末に保存した有効な許可とPageだけを使います。</p><div className="native-actions"><button type="button" disabled={state.busy||state.composing||titleComposing} onClick={()=>{void controller.restore();}}>onlineで接続</button><button type="button" disabled={state.busy||state.composing||titleComposing} onClick={()=>{void controller.resumeOffline();}}>offlineで開く</button></div></section>}
   {state.mode==='offline'&&state.offlineExpiresAt!==null&&<p role="status">前回確認したoffline許可の期限：{new Date(state.offlineExpiresAt*1000).toLocaleString()}。送受信するにはonlineへ接続してください。</p>}
   {['signed_out','signup_requested','logging_in','signing_up'].includes(state.phase)&&<PrivateAuthForm controller={controller} disabled={state.busy||state.composing}/>}
   {state.phase==='verified'&&<button type="button" className="auth-primary" onClick={()=>{void controller.open();}}>workspaceを開く</button>}
   {connected&&<div className="native-actions">{['ready','loading','reconnecting'].includes(state.phase)&&<button type="button" disabled={(state.busy&&state.phase!=='reconnecting')||titleComposing} aria-disabled={state.busy||titleComposing} onClick={()=>{if(!state.busy&&!titleComposing)void controller.reconnect();}}>{state.mode==='offline'?'onlineへ接続':'workspaceへ再接続'}</button>}{state.mode==='online'&&<button type="button" disabled={state.busy||titleComposing} onClick={()=>{void controller.restore();}}>認証を更新</button>}<button type="button" disabled={state.composing||state.saving>0||titleComposing} onClick={()=>{void controller.logout();}}>ログアウト</button></div>}
   {state.logoutUnconfirmed&&<button type="button" onClick={()=>{void controller.logout();}}>ログアウトを再確認</button>}
   {state.mode==='online'&&['ready','loading'].includes(state.phase)&&<section aria-label="offline許可の準備"><h2>offline許可の準備</h2>
    <p className="auth-help">onlineで準備した許可が有効な間、起動時にofflineを選んで端末内だけで編集できます。期限や保存先は開く際と各操作時に確認します。</p>
    <output aria-label="offline許可の状態" aria-live="polite">{state.offlineBusy?'端末の許可を確認中…':state.offlineUnknown?'準備結果は未確認です。端末の状態を再確認してください。':state.offline===null?'許可の状態はまだ確認していません。':!state.offline.available?'この候補では署名設定がないため準備できません。':state.offline.expiresAt===null?'有効な許可は確認できていません。':`前回確認した許可の期限：${new Date(state.offline.expiresAt*1000).toLocaleString()}`}</output>
    <div className="native-actions"><button type="button" disabled={state.busy||titleComposing} onClick={()=>{void controller.offline();}}>{state.offlineUnknown?'準備結果を再確認':'offline許可を確認'}</button>
     {state.offline?.available&&state.offline.expiresAt===null&&!state.offlineUnknown&&<button type="button" disabled={state.busy||titleComposing} onClick={()=>{void controller.offline(true);}}>offline許可を準備</button>}</div>
   </section>}
   <div className="native-workspace-layout">{(['ready','loading','reconnecting'].includes(state.phase)||titleComposing)&&<section aria-label="端末Page一覧"><h2>端末の保存済みPage</h2><form aria-label="新しい端末Page" onCompositionStart={()=>{titleComposition.current=true;setTitleComposing(true);}} onCompositionEnd={()=>{titleComposition.current=false;setTitleComposing(false);}} onSubmit={event=>{event.preventDefault();if(state.phase!=='ready'||state.busy||titleComposition.current)return;const form=event.currentTarget,title=String(new FormData(form).get('title')??'');void controller.createPage(title).then(saved=>{if(saved&&form.isConnected)controller.setTitleDraft('');});}}>
     <label>新しいPageのタイトル<input name="title" maxLength={4096} required value={controller.titleDraft} onChange={event=>controller.setTitleDraft(event.target.value)} disabled={!titleComposing&&(state.busy||state.phase!=='ready')}/></label><button type="submit" disabled={state.busy||titleComposing||state.phase!=='ready'}>Pageを作成</button></form>
    {state.pages.length===0?<p>この端末に保存済みのPageはありません。</p>:<ul className="native-page-list">{state.pages.map(page=><li key={page.metadata.id}><button type="button" disabled={state.busy||titleComposing} onClick={()=>{void controller.selectPage(page.metadata.id);}}>{page.metadata.title||'無題のPage'}</button><span className="auth-help">{page.metadata.id===controller.editor?.pageId&&controller.editor.snapshot.storageError?'保存未確認':page.metadata.id===controller.editor?.pageId&&!controller.editor.snapshot.pendingFresh?'未送信数を再確認':page.pending>0?`未送信 ${page.pending}件`:'端末に保存済み'}</span></li>)}</ul>}
    {state.hasMore&&<button type="button" disabled={state.busy||titleComposing} onClick={()=>{void controller.more();}}>さらに表示</button>}<button type="button" disabled={state.busy||titleComposing} onClick={()=>{void controller.close();}}>workspaceを閉じる</button>
    {state.mode==='offline'?<p className="auth-help">本文は端末だけへ保存します。未送信の変更はonlineへ接続するまで送信しません。</p>:<><p className="auth-help">本文は端末へ保存します。選択したPageの保存済み変更を最大32件ずつ送信できます。選択したPageは他端末の変更も取得できます。サーバー一覧から選ぶと、本文を取得して端末に保存してから開きます。</p><section aria-label="サーバーPage一覧"><h2>サーバーのPage</h2>
     <button type="button" disabled={state.busy||titleComposing} onClick={()=>{void controller.loadRemote();}}>サーバーの一覧を取得</button>
     {state.remoteBusy&&<p role="status">一覧を取得中…</p>}
     {state.remoteError&&<p role="alert">一覧の取得結果を確認できませんでした。表示済みの一覧は保持しています。本文の保存・同期状況とは別です。</p>}
     {!state.remoteLoaded?<p>一覧はまだ取得していません。</p>:<p>取得した範囲：{state.remotePages.length}件。取得の途中でサーバーが更新されることがあります。</p>}
     {state.remoteLoaded&&!state.remoteError&&state.remotePages.length===0&&<p>取得した一覧にPageはありません。</p>}
     <ul className="native-page-list">{state.remotePages.map(page=><li key={page.id}><button type="button" disabled={state.busy||titleComposing} onClick={()=>{void controller.selectRemotePage(page.id);}}>取得して開く：{page.title||'無題のPage'}</button></li>)}</ul>
     {state.remoteHasMore&&<button type="button" disabled={state.busy||titleComposing} onClick={()=>{void controller.loadRemote(true);}}>一覧の続きを取得</button>}
    </section></>}</section>}
    <div>{controller.editor&&<>{state.hasDraft&&<button type="button" disabled={state.busy||Boolean(controller.editor.snapshot.storageError)} onClick={()=>{void controller.restoreInput();}}>保持した入力を戻す</button>}<NativeLocalPageEditor key={controller.editor.document.guid} session={controller.editor} offline={state.mode==='offline'} locked={state.editorLocked} onSend={()=>{void controller.sendPage();}} onRead={()=>{void controller.readPage();}}/></>}</div>
   </div>
  </section>
 </main>;
}
