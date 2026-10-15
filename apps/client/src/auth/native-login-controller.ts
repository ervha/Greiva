import {newId} from '@greiva/shared';
import {supabaseSignup} from '@greiva/sync';
import {privateLocalPageCatalogResponseSchema,type PrivateLocalPageCatalogResponse} from '@greiva/protocol/private-page-catalog';
import {NativeSessionPort,type NativeAuthSnapshot,type NativePageCatalog} from './native-session-port.js';
import {NativePageSession,NativePageError,type NativePageDraft} from '../editor/native-page-session.js';
import * as Y from 'yjs';
type Phase='checking'|'signed_out'|'restoring'|'logging_in'|'verified'|'opening'|'ready'|'loading'|'signing_out'|'unavailable'|'signing_up'|'signup_requested';
export type NativeLoginSnapshot=Readonly<{phase:Phase;busy:boolean;message:string|null;notice:boolean;pages:PrivateLocalPageCatalogResponse['pages'];hasMore:boolean;remotePages:NativePageCatalog['pages'];remoteHasMore:boolean;remoteLoaded:boolean;remoteBusy:boolean;remoteError:boolean;logoutUnconfirmed:boolean;composing:boolean;saving:number;editorLocked:boolean;hasDraft:boolean}>;
const busy=['checking','restoring','logging_in','opening','loading','signing_out','signing_up'];
export class NativeLoginController {
 #phase:Phase='checking';#message:string|null=null;#notice=false;#revision=0;#started=false;#disposed=false;#pages:PrivateLocalPageCatalogResponse['pages']=[];#after:string|null=null;#logoutUnconfirmed=false;
 #remotePages:NativePageCatalog['pages']=[];#remoteHasMore=false;#remoteLoaded=false;#remoteBusy=false;#remoteError=false;
 #listeners=new Set<(state:NativeLoginSnapshot)=>void>();#expiry:ReturnType<typeof setTimeout>|undefined;#signup:AbortController|undefined;
 #editor:NativePageSession|null=null;#detachEditor:(()=>void)|undefined;#drafts:NativePageDraft[]=[];#pageBusy=false;#editorLocked=false;#endingEditor:Promise<void>|null=null;
 constructor(private readonly port:NativeSessionPort,private readonly registration:Parameters<typeof supabaseSignup>[0],private readonly fetchPort:typeof fetch=globalThis.fetch){}
 get editor(){return this.#editor;}
 get snapshot():NativeLoginSnapshot{return Object.freeze({phase:this.#phase,busy:this.#remoteBusy||busy.includes(this.#phase)||this.#pageBusy||Boolean(this.#editor?.isComposing)||Boolean(this.#editor?.snapshot.saving)||Boolean(this.#editor?.snapshot.sending)||Boolean(this.#editor?.snapshot.reading),message:this.#message,notice:this.#notice,pages:['ready','loading'].includes(this.#phase)?this.#pages:[],hasMore:this.#after!==null,remotePages:['ready','loading'].includes(this.#phase)?this.#remotePages:[],remoteHasMore:this.#remoteHasMore,remoteLoaded:this.#remoteLoaded,remoteBusy:this.#remoteBusy,remoteError:this.#remoteError,logoutUnconfirmed:this.#logoutUnconfirmed,composing:Boolean(this.#editor?.isComposing),saving:this.#editor?.snapshot.saving??0,editorLocked:this.#editorLocked,hasDraft:this.#editor!==null&&this.#drafts.some(d=>this.#sameDraft(d,this.#editor!))});}
 subscribe(listener:(state:NativeLoginSnapshot)=>void){this.#listeners.add(listener);listener(this.snapshot);return()=>{this.#listeners.delete(listener);};}
 #publish(){for(const listener of this.#listeners){try{listener(this.snapshot);}catch{/* Observer cannot alter authentication. */}}}
 #current(revision:number){return !this.#disposed && revision===this.#revision;}
 #begin(phase:Phase){if(this.#disposed)return null;clearTimeout(this.#expiry);this.#signup?.abort();this.#pageBusy=false;this.#phase=phase;this.#message=null;this.#notice=false;const revision=++this.#revision;this.#publish();return revision;}
 #sameDraft(draft:NativePageDraft,editor:NativePageSession){return draft.pageId===editor.pageId&&Object.entries(editor.bound.context).every(([key,value])=>draft.context[key as keyof typeof draft.context]===value);}
 #keepDraft(draft:NativePageDraft|null){if(!draft||this.#disposed)return;const current=draft;let stored=current;const old=this.#drafts.find(d=>d.pageId===current.pageId&&Object.entries(current.context).every(([key,value])=>d.context[key as keyof typeof d.context]===value));if(old){this.#drafts=this.#drafts.filter(d=>d!==old);stored=Object.freeze({...current,update:Y.mergeUpdates([old.update,current.update])});}this.#drafts.push(stored);}
 async #endEditor(){if(this.#endingEditor)return this.#endingEditor;const editor=this.#editor;if(!editor||editor.isComposing)return;this.#editor=null;this.#detachEditor?.();this.#detachEditor=undefined;this.#editorLocked=false;this.#publish();const work:Promise<void>=editor.close().then(draft=>{this.#keepDraft(draft);if(!this.#disposed)this.#publish();}).finally(()=>{if(this.#endingEditor===work)this.#endingEditor=null;});this.#endingEditor=work;return work;}
 #adopt(editor:NativePageSession){this.#editor=editor;this.#editorLocked=false;let checked=false;this.#detachEditor=editor.subscribe(state=>{if(this.#editor!==editor)return;this.#pages=this.#pages.map(page=>page.metadata.id===editor.pageId?{...page,pending:state.pending}:page);if(this.#editorLocked&&!state.composing){void this.#endEditor();return;}if(!this.#editorLocked&&state.storageError&&!checked){checked=true;void this.#verifyPagePermission(editor);}this.#publish();});}
 async #verifyPagePermission(editor:NativePageSession){const revision=this.#revision;try{const status=await this.port.status();if(!this.#current(revision)||this.#editor!==editor)return;if(status.phase==='verified'){this.#watch(status);return;}}catch{if(!this.#current(revision)||this.#editor!==editor)return;}clearTimeout(this.#expiry);this.#clear();this.#phase='signed_out';this.#message='接続を確認できなくなりました。ログインし直してください。';await this.#invalidateEditor();this.#publish();}
 async #invalidateEditor(){const editor=this.#editor;if(!editor)return;this.#editorLocked=true;editor.lock();if(!editor.isComposing)await this.#endEditor();}
 #clear(){this.#pages=[];this.#after=null;this.#remotePages=[];this.#remoteHasMore=false;this.#remoteLoaded=false;this.#remoteBusy=false;this.#remoteError=false;}
 #watch(auth:NativeAuthSnapshot){
  clearTimeout(this.#expiry);if(auth.phase!=='verified' || auth.expiresAt===null)return;const revision=this.#revision;
  this.#expiry=setTimeout(()=>{void this.#checkExpiry(revision);},Math.min(2147483647,Math.max(1,auth.expiresAt*1000-Date.now())));
 }
 async #checkExpiry(revision:number){
  if(!this.#current(revision))return;
  try{const status=await this.port.status();if(!this.#current(revision))return;if(status.phase==='verified'){this.#watch(status);return;}}
  catch{if(!this.#current(revision))return;}
  this.#clear();this.#phase='signed_out';this.#message='接続を確認できなくなりました。ログインし直してください。';await this.#invalidateEditor();this.#publish();
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
  try{await this.#endEditor();if(!this.#current(revision))return;const status=await (command==='login'?this.port.login(email,password):this.port.restore());if(!this.#current(revision))return;this.#phase='verified';this.#watch(status);}
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
  if(this.snapshot.busy || this.#phase!=='ready' || this.#after===null)return;const after=this.#after;const revision=this.#begin('loading');if(revision===null)return;
  try{const response=await this.#list(after);if(!this.#current(revision))return;this.#pages=[...this.#pages,...response.pages];this.#after=response.nextAfter;this.#phase='ready';}
  catch{if(!this.#current(revision))return;if(this.port.current.phase==='verified'){this.#phase='ready';this.#message='続きの一覧を確認できませんでした。表示済みの一覧は保持しています。';}else{this.#clear();this.#phase='signed_out';this.#message='接続を確認できなくなりました。ログインし直してください。';await this.#invalidateEditor();}}
  this.#watch(this.port.current);this.#publish();
 }
 async close(){
  if(this.snapshot.composing||this.snapshot.saving)return;const revision=this.#begin('verified');if(revision===null)return;this.#clear();await this.#endEditor();if(!this.#current(revision))return;await this.port.cancel().catch(()=>{});if(!this.#current(revision))return;this.#phase=this.port.current.phase==='verified'?'verified':'signed_out';this.#watch(this.port.current);this.#publish();
 }
 async #page(pageId:string,source:{kind:'local'}|{kind:'remote'}|{kind:'create';title:string}):Promise<boolean>{
  if(this.snapshot.busy||this.#phase!=='ready')return false;clearTimeout(this.#expiry);const revision=++this.#revision;this.#pageBusy=true;this.#message=null;this.#publish();
  try{await this.#endEditor();if(!this.#current(revision))return false;const editor=await NativePageSession.open(this.port,pageId,source);if(!this.#current(revision)){this.#keepDraft(await editor.close());return false;}this.#adopt(editor);
   if(source.kind!=='local'){try{const rows=await this.#list(null);if(!this.#current(revision))return false;this.#pages=rows.pages;this.#after=rows.nextAfter;}catch{if(this.#current(revision))this.#message='Pageは端末に保存しました。一覧の更新は確認できませんでした。';}}
   return true;
  }catch(error){if(source.kind==='remote')await this.#checkExpiry(revision);if(this.#current(revision)&&this.#phase==='ready')this.#message=error instanceof NativePageError&&error.stage==='read_unknown'?'本文の取得結果を確認できませんでした。もう一度明示的に取得してください。':error instanceof NativePageError&&error.stage==='store_pending'?'本文の受信は確認しましたが、端末の保存は未確認です。同じ接続で再確認してください。':source.kind==='create'?'Pageの作成結果を確認できませんでした。保存済み一覧を確認してください。':'本文の保存先を確認できませんでした。保持した入力はこの画面に残しています。';return false;}
  finally{if(this.#current(revision)){this.#pageBusy=false;this.#watch(this.port.current);this.#publish();}}
 }
 async loadRemote(more=false){
  if(this.snapshot.busy||this.#phase!=='ready'||more&&!this.#remoteHasMore)return;const revision=this.#revision,handle=this.port.handle;if(!handle)return;this.#remoteBusy=true;this.#remoteError=false;if(!more)this.#remoteHasMore=false;this.#publish();
  try{const response=await this.port.catalogFor(handle,more);if(!this.#current(revision)||this.port.handle!==handle)return;
   const last=this.#remotePages.at(-1)?.id;if(more&&last&&response.pages.some(page=>page.id<=last))throw Error();this.#remotePages=more?[...this.#remotePages,...response.pages]:response.pages;this.#remoteHasMore=response.hasMore;this.#remoteLoaded=true;
  }catch{if(this.#current(revision)){this.#remoteError=true;await this.#checkExpiry(revision);}}
  finally{if(this.#current(revision)){this.#remoteBusy=false;this.#publish();}}
 }
 async selectRemotePage(pageId:string){if(!this.#remotePages.some(page=>page.id===pageId))return false;return this.#page(pageId,{kind:'remote'});}
 async selectPage(pageId:string){return this.#page(pageId,{kind:'local'});}
 async sendPage(){const editor=this.#editor;if(!editor||this.snapshot.busy||this.#phase!=='ready')return;const revision=this.#revision;await editor.send();if(this.#current(revision)&&this.#editor===editor&&(editor.snapshot.sendStatus==='send_unknown'||editor.snapshot.sendStatus==='ack_pending'))await this.#verifyPagePermission(editor);}
 async readPage(){const editor=this.#editor;if(!editor||this.snapshot.busy||this.#phase!=='ready')return;const revision=this.#revision;await editor.read();if(this.#current(revision)&&this.#editor===editor&&(editor.snapshot.readStatus==='read_unknown'||editor.snapshot.readStatus==='store_pending'||editor.snapshot.readError))await this.#verifyPagePermission(editor);}
 async createPage(title:string){return this.#page(newId(),{kind:'create',title});}
 async restoreInput(){const editor=this.#editor;if(!editor||this.snapshot.busy||editor.snapshot.storageError)return;const draft=this.#drafts.find(d=>this.#sameDraft(d,editor));if(!draft)return;const revision=this.#revision;this.#pageBusy=true;this.#publish();try{await editor.restoreDraft(draft);if(this.#current(revision)&&this.#editor===editor)this.#drafts=this.#drafts.filter(d=>d!==draft);}catch{if(this.#current(revision))this.#message='保持した入力の保存を確認できませんでした。入力はこの画面に残しています。';}finally{if(this.#current(revision)){this.#pageBusy=false;this.#publish();}}}
 async logout(){
  if(this.snapshot.composing||this.#phase==='signing_out')return;const revision=this.#begin('signing_out');if(revision===null)return;this.#clear();this.#logoutUnconfirmed=false;
  try{const ending=this.#endEditor(),closing=this.port.logout();await ending;const result=await closing;if(!this.#current(revision))return;this.#phase='signed_out';this.#logoutUnconfirmed=!result.persistentLocked;
   this.#message=!result.persistentLocked?'端末へのログアウト記録を確認できませんでした。再起動前にもう一度ログアウトを確認してください。':!result.providerConfirmed?'この端末の接続を閉じました。サーバーへのログアウト結果は確認できていません。':'ログアウトしました。端末の保存済みデータは保持しています。';
  }catch{if(!this.#current(revision))return;this.#phase='signed_out';this.#logoutUnconfirmed=true;this.#message='ログアウト結果を確認できませんでした。再起動前にもう一度ログアウトを確認してください。';}
  this.#publish();
 }
 dispose(){if(this.#disposed)return;this.#disposed=true;++this.#revision;clearTimeout(this.#expiry);this.#signup?.abort();this.#clear();this.#detachEditor?.();void this.#editor?.close().catch(()=>{});this.#editor=null;this.#drafts=[];this.port.dispose();this.#listeners.clear();}
}
