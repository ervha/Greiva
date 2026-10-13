import {newId} from '@greiva/shared';
import {supabaseSignup} from '@greiva/sync';
import {privateLocalPageCatalogResponseSchema,type PrivateLocalPageCatalogResponse} from '@greiva/protocol/private-page-catalog';
import {NativeSessionPort,type NativeAuthSnapshot} from './native-session-port.js';
type Phase='checking'|'signed_out'|'restoring'|'logging_in'|'verified'|'opening'|'ready'|'loading'|'signing_out'|'unavailable'|'signing_up'|'signup_requested';
export type NativeLoginSnapshot=Readonly<{phase:Phase;busy:boolean;message:string|null;notice:boolean;pages:PrivateLocalPageCatalogResponse['pages'];hasMore:boolean;logoutUnconfirmed:boolean}>;
const busy=['checking','restoring','logging_in','opening','loading','signing_out','signing_up'];
export class NativeLoginController {
 #phase:Phase='checking';#message:string|null=null;#notice=false;#revision=0;#started=false;#disposed=false;#pages:PrivateLocalPageCatalogResponse['pages']=[];#after:string|null=null;#logoutUnconfirmed=false;
 #listeners=new Set<(state:NativeLoginSnapshot)=>void>();#expiry:ReturnType<typeof setTimeout>|undefined;#signup:AbortController|undefined;
 constructor(private readonly port:NativeSessionPort,private readonly registration:Parameters<typeof supabaseSignup>[0],private readonly fetchPort:typeof fetch=globalThis.fetch){}
 get snapshot():NativeLoginSnapshot{return Object.freeze({phase:this.#phase,busy:busy.includes(this.#phase),message:this.#message,notice:this.#notice,pages:['ready','loading'].includes(this.#phase)?this.#pages:[],hasMore:this.#after!==null,logoutUnconfirmed:this.#logoutUnconfirmed});}
 subscribe(listener:(state:NativeLoginSnapshot)=>void){this.#listeners.add(listener);listener(this.snapshot);return()=>{this.#listeners.delete(listener);};}
 #publish(){for(const listener of this.#listeners){try{listener(this.snapshot);}catch{/* Observer cannot alter authentication. */}}}
 #current(revision:number){return !this.#disposed && revision===this.#revision;}
 #begin(phase:Phase){if(this.#disposed)return null;clearTimeout(this.#expiry);this.#signup?.abort();this.#phase=phase;this.#message=null;this.#notice=false;const revision=++this.#revision;this.#publish();return revision;}
 #clear(){this.#pages=[];this.#after=null;}
 #watch(auth:NativeAuthSnapshot){
  clearTimeout(this.#expiry);if(auth.phase!=='verified' || auth.expiresAt===null)return;const revision=this.#revision;
  this.#expiry=setTimeout(()=>{void this.#checkExpiry(revision);},Math.min(2147483647,Math.max(1,auth.expiresAt*1000-Date.now())));
 }
 async #checkExpiry(revision:number){
  try{const status=await this.port.status();if(!this.#current(revision))return;if(status.phase==='verified'){this.#watch(status);return;}}
  catch{if(!this.#current(revision))return;}
  this.#clear();this.#phase='signed_out';this.#message='接続を確認できなくなりました。ログインし直してください。';this.#publish();
 }
 async start(){
  if(this.#started || this.#disposed)return;this.#started=true;const revision=this.#revision;
  try{const status=await this.port.status();if(!this.#current(revision))return;if(!status.available){this.#phase='unavailable';this.#publish();return;}
   if(status.phase==='verified'){this.#phase='verified';this.#watch(status);this.#publish();return;}
  }catch{if(this.#current(revision)){this.#phase='unavailable';this.#publish();}return;}
  await this.restore(true);
 }
 async #authenticate(command:'login'|'restore',email='',password='',automatic=false){
  if(this.snapshot.busy && this.#phase!=='checking')return;const revision=this.#begin(command==='login'?'logging_in':'restoring');if(revision===null)return;this.#clear();this.#logoutUnconfirmed=false;
  try{const status=await (command==='login'?this.port.login(email,password):this.port.restore());if(!this.#current(revision))return;this.#phase='verified';this.#watch(status);}
  catch{if(!this.#current(revision))return;this.#phase='signed_out';this.#notice=automatic;this.#message=automatic?'ログインして端末のworkspaceを開いてください。':'接続を確認できませんでした。入力内容とネットワークを確認してください。';}
  this.#publish();
 }
 async login(email:string,password:string){await this.#authenticate('login',email,password);}
 async restore(automatic=false){await this.#authenticate('restore','','',automatic);}
 async signup(email:string,password:string){
  if(!['signed_out','signup_requested'].includes(this.#phase))return;const revision=this.#begin('signing_up');if(revision===null)return;const abort=new AbortController();this.#signup=abort;
  try{await supabaseSignup(this.registration,email,password,abort.signal,this.fetchPort);if(!this.#current(revision))return;this.#phase='signup_requested';this.#message='登録依頼を受け付けました。確認メールが届いた場合はリンクを開き、この画面へ戻ってログインしてください。';}
  catch{if(!this.#current(revision))return;this.#phase='signed_out';this.#message='登録の結果を確認できませんでした。確認メールが届いていれば確認後にログインしてください。';}
  this.#signup=undefined;this.#publish();
 }
 async #list(after:string|null){
  const handle=this.port.handle;if(!handle)throw Error();const response=privateLocalPageCatalogResponseSchema.parse(await this.port.execute({command:'page_list',after,limit:50}));
  if(Object.entries(handle.context).some(([key,value])=>response.context[key as keyof typeof response.context]!==value) || after!==null && response.pages.some(page=>page.metadata.id<=after))throw Error();
  return response;
 }
 async open(){
  if(this.#phase!=='verified')return;const revision=this.#begin('opening');if(revision===null)return;this.#clear();
  try{await this.port.open(newId());const response=await this.#list(null);if(!this.#current(revision))return;this.#pages=response.pages;this.#after=response.nextAfter;this.#phase='ready';this.#watch(this.port.current);}
  catch{if(!this.#current(revision))return;await this.port.cancel().catch(()=>{});if(!this.#current(revision))return;this.#clear();this.#phase=this.port.current.phase==='verified'?'verified':'signed_out';this.#message='端末の保存先を確認できませんでした。もう一度接続を確認してください。';this.#watch(this.port.current);}
  this.#publish();
 }
 async more(){
  if(this.#phase!=='ready' || this.#after===null)return;const after=this.#after;const revision=this.#begin('loading');if(revision===null)return;
  try{const response=await this.#list(after);if(!this.#current(revision))return;this.#pages=[...this.#pages,...response.pages];this.#after=response.nextAfter;this.#phase='ready';}
  catch{if(!this.#current(revision))return;if(this.port.current.phase==='verified'){this.#phase='ready';this.#message='続きの一覧を確認できませんでした。表示済みの一覧は保持しています。';}else{this.#clear();this.#phase='signed_out';this.#message='接続を確認できなくなりました。ログインし直してください。';}}
  this.#watch(this.port.current);this.#publish();
 }
 async close(){
  const revision=this.#begin('verified');if(revision===null)return;this.#clear();await this.port.cancel().catch(()=>{});if(!this.#current(revision))return;this.#phase=this.port.current.phase==='verified'?'verified':'signed_out';this.#watch(this.port.current);this.#publish();
 }
 async logout(){
  const revision=this.#begin('signing_out');if(revision===null)return;this.#clear();this.#logoutUnconfirmed=false;
  try{const result=await this.port.logout();if(!this.#current(revision))return;this.#phase='signed_out';this.#logoutUnconfirmed=!result.persistentLocked;
   this.#message=!result.persistentLocked?'端末へのログアウト記録を確認できませんでした。再起動前にもう一度ログアウトを確認してください。':!result.providerConfirmed?'この端末の接続を閉じました。サーバーへのログアウト結果は確認できていません。':'ログアウトしました。端末の保存済みデータは保持しています。';
  }catch{if(!this.#current(revision))return;this.#phase='signed_out';this.#logoutUnconfirmed=true;this.#message='ログアウト結果を確認できませんでした。再起動前にもう一度ログアウトを確認してください。';}
  this.#publish();
 }
 dispose(){if(this.#disposed)return;this.#disposed=true;++this.#revision;clearTimeout(this.#expiry);this.#signup?.abort();this.#clear();this.port.dispose();this.#listeners.clear();}
}
