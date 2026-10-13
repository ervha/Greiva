import {useEffect,useRef,useState} from 'react';
import type {PrivateLoginController} from './private-login';

export function PrivateAuthForm({controller,disabled,loginLabel='ログイン'}:{controller:PrivateLoginController;disabled:boolean;loginLabel?:string}) {
  const [signup,setSignup]=useState(false),form=useRef<HTMLFormElement>(null),composing=useRef(false);
  const clear=()=>{const input=form.current?.elements.namedItem('password');if(input instanceof HTMLInputElement)input.value='';};
  useEffect(()=>{const leaving=()=>form.current?.reset();window.addEventListener('pagehide',leaving);return()=>window.removeEventListener('pagehide',leaving);},[]);
  useEffect(()=>controller.subscribe(snapshot=>{if(snapshot.phase==='signed_out')clear();}),[controller]);
  return <><form ref={form} aria-label={signup?'新規登録':'ログイン'} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}}
    onSubmit={event=>{event.preventDefault();if(disabled||composing.current)return;const fields=new FormData(event.currentTarget),email=String(fields.get('email')??''),password=String(fields.get('password')??'');clear();void (signup?controller.signup(email,password):controller.login(email,password));}}>
    <label>メールアドレス<input name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={320} required disabled={disabled}/></label>
    <label>パスワード<input name="password" type="password" autoComplete={signup?'new-password':'current-password'} minLength={signup?8:undefined} maxLength={4096} required disabled={disabled}/></label>
    <button type="submit" className="auth-primary" disabled={disabled}>{signup?'確認メールを送って登録':loginLabel}</button>
  </form><button type="button" disabled={disabled} onClick={()=>{if(composing.current)return;clear();setSignup(!signup);}}>{signup?'ログインに戻る':'アカウントを新規登録'}</button>
  {signup&&<p className="auth-help">メール・パスワードはSupabase Authへ送信します。GreivaのDBやログには保存しません。確認メールのリンクを開いた後、この画面へ戻ってログインしてください。</p>}</>;
}
