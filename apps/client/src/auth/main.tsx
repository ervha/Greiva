import { useEffect, useState } from 'react';
import {PrivateAuthForm} from './PrivateAuthForm';
import { createRoot } from 'react-dom/client';
import { PrivateLoginController, type PrivateLoginConfiguration } from './private-login';
import { isTauri } from '@tauri-apps/api/core';
import { nativeWorkspaceDevice } from '../workspace/native-workspace-device';
import './style.css';

const configuration = Object.freeze({ projectUrl: import.meta.env.VITE_GREIVA_SUPABASE_URL ?? '', publishableKey: import.meta.env.VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY ?? '',
  algorithm: import.meta.env.VITE_GREIVA_SUPABASE_ALGORITHM ?? '', apiUrl: import.meta.env.VITE_GREIVA_PRIVATE_API_ORIGIN ?? '' }) as PrivateLoginConfiguration;
const native = isTauri();
const controller = new PrivateLoginController(configuration, globalThis.fetch, native ? nativeWorkspaceDevice : undefined);
const labels = { signed_out: 'ログインしていません', signing_up:'登録の受付を確認中…',signup_requested:'登録依頼を受け付けました', logging_in: 'ログインを確認中…', preparing_device: '端末の登録情報を確認中…', verified: '認証を確認しました', registering: 'workspace登録を確認中…',
  ready: 'workspace登録を確認しました', refreshing: '認証を更新中…', expired: '認証の有効期限が切れました', signing_out: 'ログアウト中…', configuration: '接続設定を確認してください' };

function LoginScreen() {
  const [state, setState] = useState(controller.snapshot);
  useEffect(() => controller.subscribe(setState), []);
  useEffect(() => { const leaving = () => { controller.dispose(); }; window.addEventListener('pagehide', leaving); return () => window.removeEventListener('pagehide', leaving); }, []);
  useEffect(() => { const returning = (event: PageTransitionEvent) => { if (event.persisted) location.reload(); }; window.addEventListener('pageshow', returning); return () => window.removeEventListener('pageshow', returning); }, []);
  const signedIn = Boolean(state.identity) || state.phase === 'expired';
  return <main className="auth-shell"><header><a className="auth-brand" href="/auth.html">Greiva</a><span className="auth-badge">接続確認</span></header>
    <section className="auth-card" aria-labelledby="login-heading"><div className="auth-intro"><span className="auth-eyebrow">あなたの端末をつなぐ</span><h1 id="login-heading">個人workspaceへ</h1>
      <p>ログインとworkspace登録の確認用です。画面を閉じるとログイン状態が失われます。</p></div>
      <div className="auth-status" data-phase={state.phase}><span className="auth-dot" aria-hidden="true" /><output aria-label="接続確認の状態" aria-live="polite">{labels[state.phase]}</output></div>
      {state.message && <p role={state.phase==='signup_requested'?'status':'alert'} className="auth-message">{state.message}</p>}
      {!signedIn && state.phase !== 'refreshing' && state.phase !== 'signing_out' && <PrivateAuthForm controller={controller} disabled={state.busy||state.phase==='configuration'} loginLabel="ログインを確認"/>}
      {state.identity && <div className="auth-details"><span>認証の有効期限</span><time dateTime={new Date(state.identity.expiresAt * 1000).toISOString()}>{new Date(state.identity.expiresAt * 1000).toLocaleString('ja-JP')}</time></div>}
      <div className="auth-actions">
        {state.identity && !state.context && <button className="auth-primary" type="button" disabled={state.busy} onClick={() => { void controller.register(); }}>workspace登録を確認</button>}
        {signedIn && <button type="button" disabled={state.busy} onClick={() => { void controller.refresh(); }}>認証を更新</button>}
        {signedIn && <button type="button" disabled={state.busy} onClick={() => { void controller.logout(); }}>ログアウト</button>}
        <button type="button" onClick={() => controller.close()}>接続を閉じる</button></div>
      {state.context && <p className="auth-success">個人workspaceの登録を確認しました。データ同期はまだ開始していません。</p>}
      <p className="auth-help">{native ? 'このアカウント用の端末IDを端末内に保持します。メールや認証トークンは保存しません。' : '初回のworkspace確認では検証用の端末を登録します。'}本文やタスクを同期する画面は開発中です。</p>
    </section><footer><span>接続先</span><span>{state.phase === 'configuration' ? '未設定' : configuration.projectUrl}</span></footer></main>;
}
createRoot(document.getElementById('root')!).render(<LoginScreen />);
