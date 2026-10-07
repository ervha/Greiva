import { useCallback,useEffect, useState } from 'react';
import {PrivateStructuredPanel} from '../structured/PrivateStructuredPanel';
import { PrivatePageEditor } from '../editor/PrivatePageEditor';
import type { PrivateLoginController } from '../auth/private-login';
import type { PrivateWorkspaceController } from './private-workspace-controller';

export function PrivateWorkspaceScreen({login,workspace,nativeAvailable}:{login:PrivateLoginController;workspace:PrivateWorkspaceController;nativeAvailable:boolean}){
  const [auth,setAuth]=useState(login.snapshot),[state,setState]=useState(workspace.snapshot);
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[title,setTitle]=useState('');
  useEffect(()=>login.subscribe(setAuth),[login]);useEffect(()=>workspace.subscribe(setState),[workspace]);
  const structuredDraft=useCallback((blocked:boolean)=>workspace.setStructuredDraft(blocked),[workspace]);
  const connection=login.activeConnection,lease=connection?.generationSignal;
  useEffect(()=>{if(connection)void workspace.connect(connection);else void workspace.close();},[connection,lease,workspace]);
  const busy=auth.busy||state.busy,blocked=busy||state.navigationBlocked;
  const labels={signed_out:'ログインしていません',logging_in:'ログインを確認中…',preparing_device:'端末の登録情報を確認中…',verified:'認証を確認しました',registering:'workspaceを確認中…',ready:'ログイン済み',refreshing:'認証を更新中…',expired:'認証の有効期限が切れました',signing_out:'ログアウト中…',configuration:'接続設定を確認してください'};
  const logout=async()=>{await workspace.close();await login.logout();setEmail('');setTitle('');};
  const refresh=async()=>{await workspace.close();await login.refresh();if(login.snapshot.phase==='verified')await login.register();};
  return <main className="workspace-shell"><header><h1>Greiva</h1><span className="scope-note">個人workspace 接続プレビュー</span></header>
    <section aria-label="アカウント" className="workspace-account"><output aria-label="認証状態" aria-live="polite">{labels[auth.phase]}</output>
      {!nativeAvailable&&<p role="status">端末への保存に対応したアプリで開いてください。</p>}
      {auth.message&&<p role="alert">{auth.message}</p>}
      {auth.phase!=='ready'&&auth.phase!=='expired'&&<form onSubmit={event=>{event.preventDefault();const secret=password;setPassword('');void login.login(email,secret);}}>
        <label>メールアドレス<input type="email" autoComplete="username" value={email} onChange={event=>setEmail(event.target.value)} disabled={!nativeAvailable||auth.busy||auth.phase==='configuration'} required/></label>
        <label>パスワード<input type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} disabled={!nativeAvailable||auth.busy||auth.phase==='configuration'} required/></label>
        <button disabled={!nativeAvailable||auth.busy||auth.phase==='configuration'}>ログイン</button>
      </form>}
      <div className="connection-tools">
        {auth.phase==='verified'&&<button type="button" disabled={busy} onClick={()=>{void login.register();}}>workspaceを開く</button>}
        {(auth.phase==='ready'||auth.phase==='expired')&&<button type="button" disabled={blocked} onClick={()=>{void refresh();}}>認証を更新</button>}
        {(auth.identity||auth.phase==='expired')&&<button type="button" disabled={blocked} onClick={()=>{void logout();}}>ログアウト</button>}
        <button type="button" disabled={state.navigationBlocked} onClick={()=>{login.close();void workspace.close();setPassword('');}}>接続を閉じる</button>
      </div>
    </section>
    {state.phase==='opening'&&<p role="status">端末のworkspaceを開いています…</p>}
    {state.error&&<p role="alert">{state.error==='transport'?'サーバーへ接続できませんでした。端末に保存済みのPageは残っています。':state.error==='storage'?'端末の保存情報を確認できませんでした。保存先を変更せず、もう一度お試しください。':'接続情報を確認できませんでした。接続を閉じてログインし直してください。'}</p>}
    {state.phase==='error'&&connection&&<button type="button" disabled={busy} onClick={()=>{void workspace.connect(connection);}}>端末保存を再確認</button>}
    {state.phase==='ready'&&<div className="workspace-layout"><aside aria-label="Page一覧">
      <section><h2>端末に保存済み</h2><button type="button" disabled={blocked} onClick={()=>{void workspace.loadLocal();}}>端末一覧を更新</button>
        {state.localPages.length===0&&<p>保存済みのPageはありません。</p>}
        <ul>{state.localPages.map(({metadata,pending})=><li key={metadata.id}><button type="button" disabled={blocked} aria-current={state.selectedPageId===metadata.id?'page':undefined} onClick={()=>{void workspace.openPage(metadata.id);}}>{metadata.title||'無題のPage'}</button><span>{pending?`未確認の更新 ${pending}件`:'端末に保存済み'}</span></li>)}</ul>
        {state.localAfter&&<button type="button" disabled={blocked} onClick={()=>{void workspace.loadLocal(true);}}>端末一覧をさらに表示</button>}
      </section>
      <section><h2>サーバーのPage</h2><button type="button" disabled={blocked} onClick={()=>{void workspace.loadRemote();}}>サーバー一覧を取得</button>
        {state.remoteStatus==='unloaded'&&<p>サーバーの一覧はまだ取得していません。</p>}
        {state.remoteStatus==='error'&&<p>一覧を取得できませんでした。表示中の一覧があれば、以前の取得結果です。</p>}
        {state.remoteStatus==='ready'&&state.remotePages.length===0&&<p>サーバーにPageはありません。</p>}
        <ul>{state.remotePages.map(metadata=><li key={metadata.id}><button type="button" disabled={blocked} aria-current={state.selectedPageId===metadata.id?'page':undefined} onClick={()=>{void workspace.openPage(metadata.id);}}>{metadata.title||'無題のPage'}</button></li>)}</ul>
        {state.remoteCursor&&<button type="button" disabled={blocked} onClick={()=>{void workspace.loadRemote(true);}}>サーバー一覧をさらに表示</button>}
      </section>
      <form onSubmit={event=>{event.preventDefault();void workspace.createPage(title);}}><label>新しいPageのタイトル<input value={title} onChange={event=>setTitle(event.target.value)} maxLength={65536} disabled={blocked||state.retryCreate}/></label>
        <button disabled={blocked}>{state.retryCreate?'同じPageの作成を再確認':'新しいPageを作成'}</button>
      </form>
    </aside><section aria-label="Page編集" className="workspace-editor">{workspace.editor?<PrivatePageEditor session={workspace.editor}/>:<p>Pageを選ぶか、新しく作成してください。</p>}</section></div>}
    {state.phase==='ready'&&workspace.structured&&<PrivateStructuredPanel session={workspace.structured} pages={[...state.localPages.map(row=>row.metadata),...state.remotePages.filter(row=>!state.localPages.some(local=>local.metadata.id===row.id))]} onDraftChange={structuredDraft}/>}
    <p className="editor-hint">ログアウトしても、この端末に保存済みのPage・Task・Relationと未送信更新は保持します。ログイン前の閲覧は提供していません。</p>
  </main>;
}
