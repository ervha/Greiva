import * as Y from 'yjs';
import {idSchema} from '@greiva/shared';
import {emptyPageUpdate} from '@greiva/sync';
import {privatePageLocalLoadSchema} from '@greiva/protocol/private-page';
import {NativeSessionPort,NativeSessionPortError,type NativeWorkspaceHandle,type NativePageSendStatus} from '../auth/native-session-port.js';
export class NativePageError extends Error {constructor(readonly stage:'closed'|'busy'|'protocol'|'storage'){super(`Native Page ${stage}`);this.name='NativePageError';}}
export type NativePageState=Readonly<{phase:'opening'|'ready'|'closed';title:string;saving:number;pending:number;pendingFresh:boolean;sending:boolean;sendStatus:NativePageSendStatus|null;unsaved:number;composing:boolean;storageError:'storage'|'protocol'|'closed'|null}>;
export type NativePageDraft=Readonly<{context:NativeWorkspaceHandle['context'];pageId:string;title:string;update:Uint8Array}>;
// All writes/sends capture the original handle. Remote reads are not connected.
export class NativePageSession {
 readonly document=new Y.Doc({gc:false});readonly clientId:string;
 #state:NativePageState={phase:'opening',title:'',saving:0,pending:0,pendingFresh:true,sending:false,sendStatus:null,unsaved:0,composing:false,storageError:null};
 #editVersion=0;
 #listeners=new Set<(state:NativePageState)=>void>();#tail:Promise<void>=Promise.resolve();#loadOrigin=Symbol('native journal');#closing:Promise<NativePageDraft|null>|undefined;
 private constructor(private readonly port:NativeSessionPort,readonly bound:NativeWorkspaceHandle,readonly pageId:string){this.clientId=bound.context.clientId;}
 get snapshot(){return this.#state;}
 get isComposing(){return this.#state.composing;}
 subscribe(listener:(state:NativePageState)=>void){this.#listeners.add(listener);listener(this.#state);return()=>{this.#listeners.delete(listener);};}
 #patch(patch:Partial<NativePageState>){this.#state=Object.freeze({...this.#state,...patch});for(const listener of this.#listeners){try{listener(this.#state);}catch{/* Never interrupt a write. */}}}
 #check(){if(this.#state.phase==='closed' || this.port.handle!==this.bound)throw new NativePageError('closed');}
 #failure(error:unknown):NativePageError {return error instanceof NativePageError?error:new NativePageError(error instanceof NativeSessionPortError && error.stage==='closed'?'closed':'storage');}
 static async open(port:NativeSessionPort,pageId:string,source:{kind:'local'}|{kind:'create';title:string}={kind:'local'}):Promise<NativePageSession>{
  const bound=port.handle;if(!bound)throw new NativePageError('closed');try{idSchema.parse(pageId);if(source.kind==='create' && (!source.title.trim() || source.title.length>4096))throw Error();}catch{throw new NativePageError('protocol');}
  const session=new NativePageSession(port,bound,pageId);
  try{
   if(source.kind==='create'){const result=await port.executeFor(bound,{command:'page_create',pageId,title:source.title,update:Array.from(emptyPageUpdate())});if(result!==null)throw new NativePageError('protocol');session.#check();}
   const parsed=privatePageLocalLoadSchema.safeParse(await port.executeFor(bound,{command:'page_load',pageId}));session.#check();
   if(!parsed.success || parsed.data.page.metadata.id!==pageId)throw new NativePageError('protocol');
   try{for(const update of parsed.data.page.updates)Y.applyUpdate(session.document,Uint8Array.from(update),session.#loadOrigin);}catch{throw new NativePageError('protocol');}
   session.#patch({phase:'ready',title:parsed.data.page.metadata.title,pending:parsed.data.pending});session.document.on('update',session.#changed);return session;
  }catch(error){session.document.destroy();throw session.#failure(error);}
 }
 #changed=(candidate:Uint8Array,origin:unknown)=>{
  if(origin===this.#loadOrigin || this.#state.phase!=='ready')return;
  ++this.#editVersion;const update=Uint8Array.from(candidate);this.#patch({unsaved:this.#state.unsaved+1});
  if(this.#state.storageError)return;
  this.#patch({saving:this.#state.saving+1});
  this.#tail=this.#tail.then(async()=>{
   // No check of closing phase: already admitted updates may finish on their
   // old captured handle during Page switch. Auth/handle drift still refuses.
   const result=await this.port.executeFor(this.bound,{command:'page_append',pageId:this.pageId,update:Array.from(update)});
   if(result!==null)throw new NativePageError('protocol');this.#patch({pending:this.#state.pending+1,unsaved:Math.max(0,this.#state.unsaved-1)});
  }).catch(error=>{const failure=this.#failure(error);this.#patch({storageError:failure.stage==='closed'?'closed':failure.stage==='protocol'?'protocol':'storage'});throw failure;})
   .finally(()=>{this.#patch({saving:this.#state.saving-1});});
  void this.#tail.catch(()=>{});
 };
 pendingUpdates=()=>this.#state.pending;
 setComposing=(value:boolean)=>{this.#patch({composing:value});};
 lock(){if(this.#state.phase==='ready')this.#patch({storageError:'closed'});}
 durable(){return this.#tail;}
 async send(){
  this.#check();if(this.isComposing||this.#state.saving||this.#state.sending||this.#state.storageError)throw new NativePageError('busy');
  const limit=Math.min(32,Math.max(1,this.#state.pending));this.#patch({sending:true,pendingFresh:false,sendStatus:null});
  try{
   for(let index=0;index<limit;index++){
    this.#check();const result=await this.port.sendPageFor(this.bound,this.pageId);this.#check();this.#patch({sendStatus:result});if(result!=='acked')break;
   }
  }catch{if(this.#state.phase==='ready')this.#patch({sendStatus:'send_unknown'});}
  finally{
   if(this.#state.phase==='ready'){
    try{await this.durable();this.#check();const version=this.#editVersion;const value=privatePageLocalLoadSchema.parse(await this.port.executeFor(this.bound,{command:'page_load',pageId:this.pageId}));this.#check();if(value.page.metadata.id!==this.pageId)throw new NativePageError('protocol');
     if(version===this.#editVersion&&this.#state.saving===0)this.#patch({pending:value.pending,pendingFresh:true});
    }catch{/* Keep the known send result separate from a failed local recheck. */}
    this.#patch({sending:false});
   }
  }
 }
 draft():NativePageDraft|null {
  if(this.#state.unsaved===0)return null;
  return Object.freeze({context:this.bound.context,pageId:this.pageId,title:this.#state.title,update:Uint8Array.from(Y.encodeStateAsUpdate(this.document))});
 }
 async restoreDraft(draft:NativePageDraft){
  this.#check();if(this.isComposing)throw new NativePageError('busy');
  if(draft.pageId!==this.pageId || Object.entries(this.bound.context).some(([key,value])=>draft.context[key as keyof typeof draft.context]!==value))throw new NativePageError('protocol');
  try{Y.applyUpdate(this.document,Uint8Array.from(draft.update));}catch{throw new NativePageError('protocol');}await this.durable();
 }
 close():Promise<NativePageDraft|null>{
  if(this.#closing)return this.#closing;if(this.isComposing)return Promise.reject(new NativePageError('busy'));
  this.#patch({phase:'closed'});this.document.off('update',this.#changed);
  this.#closing=this.#tail.catch(()=>{}).then(()=>{const draft=this.draft();this.document.destroy();this.#listeners.clear();return draft;});return this.#closing;
 }
}
