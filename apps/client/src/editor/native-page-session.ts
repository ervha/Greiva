import * as Y from 'yjs';
import {idSchema,newId} from '@greiva/shared';
import {emptyPageUpdate} from '@greiva/sync';
import {privatePageLocalLoadSchema} from '@greiva/protocol/private-page';
import {NativeSessionPortError,type NativeWorkspaceHandle,type NativePageSendStatus,type NativePageReadStatus} from '../auth/native-session-port.js';
export type NativePagePort={readonly handle:NativeWorkspaceHandle|null;executeFor(handle:NativeWorkspaceHandle,request:Record<string,unknown>):Promise<unknown>;sendPageFor?(handle:NativeWorkspaceHandle,pageId:string):Promise<NativePageSendStatus>;readPageFor?(handle:NativeWorkspaceHandle,pageId:string):Promise<NativePageReadStatus>};
export class NativePageError extends Error {constructor(readonly stage:'closed'|'busy'|'protocol'|'storage'|'read_unknown'|'store_pending'){super(`Native Page ${stage}`);this.name='NativePageError';}}
export type NativePageState=Readonly<{phase:'opening'|'ready'|'closed';title:string;saving:number;pending:number;pendingFresh:boolean;sending:boolean;sendStatus:NativePageSendStatus|null;reading:boolean;readStatus:NativePageReadStatus|null;readError:'load'|'protocol'|null;remoteWaiting:boolean;unsaved:number;composing:boolean;storageError:'storage'|'protocol'|'closed'|null}>;
export type NativePageDraft=Readonly<{context:NativeWorkspaceHandle['context'];pageId:string;title:string;update:Uint8Array}>;
// All operations capture the original handle. Remote replay never echoes into
// the local append queue and waits until native composition has finished.
export class NativePageSession {
 readonly document=new Y.Doc({gc:false});readonly clientId:string;
 #state:NativePageState={phase:'opening',title:'',saving:0,pending:0,pendingFresh:true,sending:false,sendStatus:null,reading:false,readStatus:null,readError:null,remoteWaiting:false,unsaved:0,composing:false,storageError:null};
 #remote:{update:Uint8Array;title:string|null}|null=null;
 #serverHead:string|null=null;
 #preBootstrapTitle:string|null=null;
 #editVersion=0;
 #initialTitle='';
 #listeners=new Set<(state:NativePageState)=>void>();#tail:Promise<void>=Promise.resolve();#loadOrigin=Symbol('native journal');#closing:Promise<NativePageDraft|null>|undefined;
 private constructor(private readonly port:NativePagePort,readonly bound:NativeWorkspaceHandle,readonly pageId:string){this.clientId=bound.context.clientId;}
 get snapshot(){return this.#state;}
 get isComposing(){return this.#state.composing;}
 subscribe(listener:(state:NativePageState)=>void){this.#listeners.add(listener);listener(this.#state);return()=>{this.#listeners.delete(listener);};}
 #patch(patch:Partial<NativePageState>){this.#state=Object.freeze({...this.#state,...patch});for(const listener of this.#listeners){try{listener(this.#state);}catch{/* Never interrupt a write. */}}}
 #check(){if(this.#state.phase==='closed' || this.port.handle!==this.bound)throw new NativePageError('closed');}
 #failure(error:unknown):NativePageError {return error instanceof NativePageError?error:new NativePageError(error instanceof NativeSessionPortError && error.stage==='closed'?'closed':'storage');}
 static async open(port:NativePagePort,pageId:string,source:{kind:'local'}|{kind:'remote'}|{kind:'create';title:string}={kind:'local'}):Promise<NativePageSession>{
  const bound=port.handle;if(!bound)throw new NativePageError('closed');try{idSchema.parse(pageId);if(source.kind==='create' && (!source.title.trim() || source.title.length>4096))throw Error();}catch{throw new NativePageError('protocol');}
  const session=new NativePageSession(port,bound,pageId);
  try{
   if(source.kind==='create'){const result=await port.executeFor(bound,{command:'page_create',pageId,title:source.title,update:Array.from(emptyPageUpdate())});if(result!==null)throw new NativePageError('protocol');session.#check();}
   if(source.kind==='remote'){if(!port.readPageFor)throw new NativePageError('closed');const status=await port.readPageFor(bound,pageId);session.#check();if(status!=='received')throw new NativePageError(status);}
   const parsed=privatePageLocalLoadSchema.safeParse(await port.executeFor(bound,{command:'page_load',pageId}));session.#check();
   if(!parsed.success || parsed.data.page.metadata.id!==pageId)throw new NativePageError('protocol');
   try{for(const update of parsed.data.page.updates)Y.applyUpdate(session.document,Uint8Array.from(update),session.#loadOrigin);}catch{throw new NativePageError('protocol');}
   session.#initialTitle=parsed.data.page.metadata.title;
   session.#serverHead=parsed.data.serverHead;
   session.#patch({phase:'ready',title:parsed.data.page.metadata.title,pending:parsed.data.pending});session.document.on('update',session.#changed);return session;
  }catch(error){session.document.destroy();throw session.#failure(error);}
 }
 setTitle=(title:string)=>{
  if(this.#state.phase!=='ready'||this.#state.storageError)return;
  if(typeof title!=='string'||title.length>4096||new TextEncoder().encode(title).byteLength>4096||/\p{Control}/u.test(title))return;
  if(title===this.#state.title)return;
  ++this.#editVersion;
  this.#patch({title});
  this.#tail=this.#tail.then(async()=>{
   try{
    const result=await this.port.executeFor(this.bound,{command:'title_enqueue',pageId:this.pageId,intent:{operationId:newId(),title}});
    if(result!==null)throw new NativePageError('protocol');
    this.#initialTitle=title;
    this.#preBootstrapTitle=null;
   }catch(error){
    const failure=this.#failure(error);
    if(failure.stage==='closed'){this.#patch({storageError:'closed'});throw failure;}
    const msg=error instanceof Error?error.message:String(error);
    const causeMsg=error instanceof Error&&error.cause?(error.cause instanceof Error?error.cause.message:String(error.cause)):'';
    const isPreBootstrap=
      msg.includes('Versioned title base required')||msg.includes('Page bootstrap receipt required')||msg.includes('Unknown base/bootstrap')||
      causeMsg.includes('Versioned title base required')||causeMsg.includes('Page bootstrap receipt required')||causeMsg.includes('Unknown base/bootstrap');
    if(isPreBootstrap){
     this.#preBootstrapTitle=title;
    }else{
     this.#patch({storageError:failure.stage==='protocol'?'protocol':'storage'});
     throw failure;
    }
   }
  });
 };
 #retryPreBootstrapTitle(){
  if(this.#preBootstrapTitle===null||this.#state.storageError||this.#state.phase!=='ready')return;
  const title=this.#preBootstrapTitle;
  this.#tail=this.#tail.then(async()=>{
   if(this.#preBootstrapTitle!==title)return;
   try{
    const result=await this.port.executeFor(this.bound,{command:'title_enqueue',pageId:this.pageId,intent:{operationId:newId(),title}});
    if(result!==null)throw new NativePageError('protocol');
    this.#initialTitle=title;
    if(this.#preBootstrapTitle===title)this.#preBootstrapTitle=null;
   }catch(error){
    const failure=this.#failure(error);
    if(failure.stage==='closed'){this.#patch({storageError:'closed'});throw failure;}
    const msg=error instanceof Error?error.message:String(error);
    const causeMsg=error instanceof Error&&error.cause?(error.cause instanceof Error?error.cause.message:String(error.cause)):'';
    const isPreBootstrap=msg.includes('Versioned title base required')||msg.includes('Page bootstrap receipt required')||msg.includes('Unknown base/bootstrap')||
      causeMsg.includes('Versioned title base required')||causeMsg.includes('Page bootstrap receipt required')||causeMsg.includes('Unknown base/bootstrap');
    if(!isPreBootstrap){
     this.#patch({storageError:failure.stage==='protocol'?'protocol':'storage'});
     throw failure;
    }
   }
  });
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
 setComposing=(value:boolean)=>{this.#patch({composing:value});if(!value)this.#flushRemote();};
 #flushRemote(){
  if(!this.#remote||this.#state.composing||this.#state.phase!=='ready'||this.#state.storageError)return;
  try{
   this.#check();const candidate=this.#remote;this.#remote=null;Y.applyUpdate(this.document,candidate.update,this.#loadOrigin);
   if(candidate.title!==null){
    this.#initialTitle=candidate.title;this.#preBootstrapTitle=null;this.#patch({title:candidate.title,remoteWaiting:false});
   }else{
    this.#patch({remoteWaiting:false});
   }
  }catch(error){this.#remote=null;this.#patch({readError:error instanceof NativePageError&&error.stage==='closed'?'load':'protocol',remoteWaiting:false});}
 }
 lock(){if(this.#state.phase==='ready')this.#patch({storageError:'closed'});}
 durable(){return this.#tail;}
 async send(){
  if(!this.port.sendPageFor)throw new NativePageError('closed');
  this.#check();if(this.isComposing||this.#state.saving||this.#state.sending||this.#state.reading||this.#state.remoteWaiting||this.#state.storageError)throw new NativePageError('busy');
  const limit=Math.min(32,Math.max(1,this.#state.pending));this.#patch({sending:true,pendingFresh:false,sendStatus:null});
  try{
   for(let index=0;index<limit;index++){
    this.#check();const result=await this.port.sendPageFor(this.bound,this.pageId);this.#check();this.#patch({sendStatus:result});
    if(result==='acked')this.#retryPreBootstrapTitle();
    if(result!=='acked')break;
   }
  }catch{if(this.#state.phase==='ready')this.#patch({sendStatus:'send_unknown'});}
  finally{
   if(this.#state.phase==='ready'){
    try{await this.durable();this.#check();const version=this.#editVersion;const value=privatePageLocalLoadSchema.parse(await this.port.executeFor(this.bound,{command:'page_load',pageId:this.pageId}));this.#check();if(value.page.metadata.id!==this.pageId)throw new NativePageError('protocol');
     this.#serverHead=value.serverHead;
     if(version===this.#editVersion&&this.#state.saving===0)this.#patch({pending:value.pending,pendingFresh:true});
    }catch{/* Keep the known send result separate from a failed local recheck. */}
    this.#patch({sending:false});
   }
  }
 }
 async read(){
  if(!this.port.readPageFor)throw new NativePageError('closed');
  this.#check();if(this.isComposing||this.#state.saving||this.#state.sending||this.#state.reading||this.#state.remoteWaiting||this.#state.storageError)throw new NativePageError('busy');
  const localOnly=this.#state.readStatus==='received'&&Boolean(this.#state.readError);this.#patch({reading:true,...(!localOnly?{readStatus:null}:{}),readError:null});
  try{
   const result=localOnly?'received':await this.port.readPageFor(this.bound,this.pageId);this.#check();this.#patch({readStatus:result});if(result!=='received')return;
   await this.durable();this.#check();const version=this.#editVersion;const response=await this.port.executeFor(this.bound,{command:'page_load',pageId:this.pageId});this.#check();
   const parsed=privatePageLocalLoadSchema.safeParse(response);if(!parsed.success||parsed.data.page.metadata.id!==this.pageId)throw new NativePageError('protocol');
   this.#serverHead=parsed.data.serverHead;
   const probe=new Y.Doc({gc:false});let update:Uint8Array;
   try{Y.applyUpdate(probe,Y.encodeStateAsUpdate(this.document));for(const bytes of parsed.data.page.updates)Y.applyUpdate(probe,Uint8Array.from(bytes));update=Y.encodeStateAsUpdate(probe,Y.encodeStateVector(this.document));}
   catch{throw new NativePageError('protocol');}finally{probe.destroy();}
   this.#check();const adoptTitle=version===this.#editVersion;this.#remote={update,title:adoptTitle?parsed.data.page.metadata.title:null};
   this.#patch({remoteWaiting:true,...(version===this.#editVersion&&this.#state.saving===0?{pending:parsed.data.pending,pendingFresh:true}: {pendingFresh:false})});this.#flushRemote();
   this.#retryPreBootstrapTitle();
  }catch(error){if(this.#state.phase==='ready')this.#patch(this.#state.readStatus==='received'?{readError:error instanceof NativePageError&&error.stage==='protocol'?'protocol':'load'}:{readStatus:'read_unknown'});}
  finally{if(this.#state.phase==='ready')this.#patch({reading:false});}
 }
 draft():NativePageDraft|null {
  if(this.#state.unsaved===0 && this.#state.title===this.#initialTitle && this.#preBootstrapTitle===null)return null;
  return Object.freeze({context:this.bound.context,pageId:this.pageId,title:this.#state.title,update:Uint8Array.from(Y.encodeStateAsUpdate(this.document))});
 }
 async restoreDraft(draft:NativePageDraft){
  this.#check();if(this.isComposing)throw new NativePageError('busy');
  if(draft.pageId!==this.pageId || Object.entries(this.bound.context).some(([key,value])=>draft.context[key as keyof typeof draft.context]!==value))throw new NativePageError('protocol');
  if(draft.title && draft.title!==this.#state.title){this.setTitle(draft.title);}
  try{Y.applyUpdate(this.document,Uint8Array.from(draft.update));}catch{throw new NativePageError('protocol');}await this.durable();
 }
 close():Promise<NativePageDraft|null>{
  if(this.#closing)return this.#closing;if(this.isComposing)return Promise.reject(new NativePageError('busy'));
  this.#remote=null;this.#patch({phase:'closed',remoteWaiting:false});this.document.off('update',this.#changed);
  this.#closing=this.#tail.catch(()=>{}).then(()=>{const draft=this.draft();this.document.destroy();this.#listeners.clear();return draft;});return this.#closing;
 }
}
