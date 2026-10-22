import * as Y from 'yjs';
import {idSchema,newId} from '@greiva/shared';
import {emptyPageUpdate} from '@greiva/sync';
import {privatePageTitleLocalResponseSchema} from '@greiva/protocol/private-page-metadata';
import {privatePageLocalLoadSchema} from '@greiva/protocol/private-page';
import {NativeSessionPortError,type NativeWorkspaceHandle,type NativePageSendStatus,type NativePageReadStatus,type NativeTitleSendStatus} from '../auth/native-session-port.js';
export type NativePagePort={sendTitleFor?(handle:NativeWorkspaceHandle,pageId:string):Promise<NativeTitleSendStatus>;readTitleFor?(handle:NativeWorkspaceHandle,pageId:string):Promise<NativePageReadStatus>;readonly handle:NativeWorkspaceHandle|null;executeFor(handle:NativeWorkspaceHandle,request:Record<string,unknown>):Promise<unknown>;sendPageFor?(handle:NativeWorkspaceHandle,pageId:string):Promise<NativePageSendStatus>;readPageFor?(handle:NativeWorkspaceHandle,pageId:string):Promise<NativePageReadStatus>};
export class NativePageError extends Error {constructor(readonly stage:'closed'|'busy'|'protocol'|'storage'|'read_unknown'|'store_pending'){super(`Native Page ${stage}`);this.name='NativePageError';}}
export type NativePageTitleOperation=Readonly<{sequence:string;title:string;status:'pending'|'applied'|'conflict'|'rejected';code?:string|undefined}>;
export type NativePageState=Readonly<{titleConflicts:readonly {id:string;base:string;local:string;remote:string}[];titleDraft:boolean;titlePending:number|null;titleStatus:NativeTitleSendStatus|null;titleReadStatus:NativePageReadStatus|null;titleBusy:boolean;titleHasMore:boolean;titleOperations:readonly NativePageTitleOperation[];titleRejected:readonly {title:string;code:string}[];titleResolutionId:string|null;phase:'opening'|'ready'|'closed';title:string;saving:number;pending:number;pendingFresh:boolean;sending:boolean;sendStatus:NativePageSendStatus|null;reading:boolean;readStatus:NativePageReadStatus|null;readError:'load'|'protocol'|null;remoteWaiting:boolean;unsaved:number;composing:boolean;storageError:'storage'|'protocol'|'closed'|null}>;
export type NativePageDraft=Readonly<{context:NativeWorkspaceHandle['context'];pageId:string;title:string;titleChanged:boolean;update:Uint8Array}>;
// All operations capture the original handle. Remote replay never echoes into
// the local append queue and waits until native composition has finished.
export class NativePageSession {
 readonly document=new Y.Doc({gc:false});readonly clientId:string;
 #state:NativePageState={titleConflicts:[],titleDraft:false,titlePending:null,titleStatus:null,titleReadStatus:null,titleBusy:false,titleHasMore:false,titleOperations:[],titleRejected:[],titleResolutionId:null,phase:'opening',title:'',saving:0,pending:0,pendingFresh:true,sending:false,sendStatus:null,reading:false,readStatus:null,readError:null,remoteWaiting:false,unsaved:0,composing:false,storageError:null};
 #remote:{update:Uint8Array;title:string|null;version:number}|null=null;
 #titleVersion=0;
 #titleEdited=false;
 #compositionTitle:{title:string;draft:string|null;dirty:boolean}|null=null;
 #preBootstrapTitle:string|null=null;
 #editVersion=0;
 #initialTitle='';
 #historyOperation:string|null=null;
 #historyConflict:string|null=null;
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
   if(source.kind==='remote'){if(!port.readPageFor)throw new NativePageError('closed');const status=await port.readPageFor(bound,pageId);session.#check();if(status!=='received')throw new NativePageError(status); session.#check();}
   const parsed=privatePageLocalLoadSchema.safeParse(await port.executeFor(bound,{command:'page_load',pageId}));session.#check();
   if(!parsed.success || parsed.data.page.metadata.id!==pageId)throw new NativePageError('protocol');
   try{for(const update of parsed.data.page.updates)Y.applyUpdate(session.document,Uint8Array.from(update),session.#loadOrigin);}catch{throw new NativePageError('protocol');}
   session.#initialTitle=parsed.data.page.metadata.title;
   session.#patch({phase:'ready',title:parsed.data.page.metadata.title,pending:parsed.data.pending});await session.#loadTitle(0);session.document.on('update',session.#changed);return session;
  }catch(error){session.document.destroy();throw session.#failure(error);}
 }
 setTitle=(title:string)=>{
  if(this.#state.phase!=='ready')return;
  if(typeof title!=='string'||title.length>4096||new TextEncoder().encode(title).byteLength>4096||/\p{Control}/u.test(title)||title===this.#state.title)return;
  ++this.#editVersion;++this.#titleVersion;this.#preBootstrapTitle=title;
  this.#patch({title,titleDraft:true,titleStatus:null});if(!this.isComposing){this.#titleEdited=true;if(!this.#state.storageError)this.#queueTitle(title);}
 };
 #queueTitle(title:string){
  this.#patch({saving:this.#state.saving+1});
  this.#tail=this.#tail.then(async()=>{
   const ready=await this.port.executeFor(this.bound,{command:'title_ready',pageId:this.pageId});
   if(typeof ready!=='boolean')throw new NativePageError('protocol');
   if(!ready)return; // Explicit memory-only draft until bootstrap + versioned read.
   const result=await this.port.executeFor(this.bound,{command:'title_enqueue',pageId:this.pageId,intent:{operationId:newId(),title}});
   if(result!==null)throw new NativePageError('protocol');
   this.#initialTitle=title;
   if(this.#preBootstrapTitle===title){this.#preBootstrapTitle=null;this.#patch({titleDraft:false});}
   this.#patch({titlePending:this.#state.titlePending===null?null:this.#state.titlePending+1});
  }).catch(error=>{const failure=this.#failure(error);this.#patch({storageError:failure.stage==='closed'?'closed':failure.stage==='protocol'?'protocol':'storage'});throw failure;})
   .finally(()=>this.#patch({saving:this.#state.saving-1}));
  void this.#tail.catch(()=>{});
 }
 async #loadTitle(version:number,more=false){
  if(!more){this.#historyOperation=null;this.#historyConflict=null;}
  const value=privatePageTitleLocalResponseSchema.parse(await this.port.executeFor(this.bound,{command:'title_load',pageId:this.pageId,afterOperation:more?this.#historyOperation:null,afterConflict:more?this.#historyConflict:null,limit:50}));this.#check();
  if(value.pageId!==this.pageId||Object.entries(this.bound.context).some(([key,item])=>value.context[key as keyof typeof value.context]!==item))throw new NativePageError('protocol');
  this.#historyOperation=value.operations.at(-1)?.sequence??this.#historyOperation;
  this.#historyConflict=value.conflicts.at(-1)?.record.id??this.#historyConflict;
  const titleHasMore=Boolean(value.nextOperation!==null||value.nextConflict!==null);
  const titleConflicts=value.conflicts.filter(row=>row.resolvedBy===null).map(row=>row.record);
  const titleOperations:NativePageTitleOperation[]=value.operations.map(row=>{
   const status=row.response?row.response.result.status:'pending';
   const code=row.response?.result.status==='rejected'?(row.response.result as {status:'rejected';code:string}).code:undefined;
   return code!==undefined?{sequence:row.sequence,title:row.intent.title,status,code}:{sequence:row.sequence,title:row.intent.title,status};
  });
  const titleRejected=titleOperations.filter(row=>row.status==='rejected').map(row=>({title:row.title,code:row.code??'rejected'}));
  const pendingResolution=value.operations.find(row=>row.response===null&&row.intent.resolution)?.intent.resolution?.conflictId;
  const titleResolutionId=pendingResolution??(value.pending>0?this.#state.titleResolutionId:null);
  this.#patch({titleHasMore,titleOperations,titleRejected,titleResolutionId,titlePending:version===this.#titleVersion&&this.#state.saving===0?value.pending:null,titleConflicts});
  if(version===this.#titleVersion&&!this.#state.composing&&this.#preBootstrapTitle===null&&!more){this.#initialTitle=value.localTitle;this.#patch({title:value.localTitle});}
 }
 async titleHistory(more=false){
  this.#check();if(this.isComposing||this.#state.saving||this.#state.sending||this.#state.reading||this.#state.remoteWaiting||this.#state.titleBusy||this.#state.storageError)throw new NativePageError('busy');
  this.#patch({titleBusy:true});const version=this.#titleVersion;
  try{await this.#loadTitle(version,more);}
  catch{if(this.#state.phase==='ready')this.#patch({titlePending:null});}
  finally{if(this.#state.phase==='ready')this.#patch({titleBusy:false});}
 }
 async resolveTitleConflict(conflictId:string,choice:'local'|'remote'){
  this.#check();if(this.isComposing||this.#state.saving>0||this.#state.sending||this.#state.reading||this.#state.remoteWaiting||this.#state.titleBusy||this.#state.storageError||this.#state.titlePending!==0||this.#state.titleResolutionId!==null)throw new NativePageError('busy');
  const conflict=this.#state.titleConflicts.find(c=>c.id===conflictId);if(!conflict)throw new NativePageError('protocol');
  const chosenTitle=conflict[choice];
  ++this.#editVersion;++this.#titleVersion;const version=this.#titleVersion;
  this.#patch({saving:this.#state.saving+1,title:chosenTitle,titleDraft:false,titleStatus:null,titleResolutionId:conflictId,titlePending:(this.#state.titlePending??0)+1});
  this.#tail=this.#tail.then(async()=>{
   const ready=await this.port.executeFor(this.bound,{command:'title_ready',pageId:this.pageId});
   if(typeof ready!=='boolean'||!ready)throw new NativePageError('protocol');
   const result=await this.port.executeFor(this.bound,{command:'title_enqueue',pageId:this.pageId,intent:{operationId:newId(),title:chosenTitle,resolution:{conflictId,choice}}});
   if(result!==null)throw new NativePageError('protocol');
   this.#initialTitle=chosenTitle;
   if(this.#preBootstrapTitle===chosenTitle){this.#preBootstrapTitle=null;this.#patch({titleDraft:false});}
   this.#titleEdited=true;
  }).catch(error=>{const failure=this.#failure(error);this.#patch({storageError:failure.stage==='closed'?'closed':failure.stage==='protocol'?'protocol':'storage',titleResolutionId:null});throw failure;})
   .finally(async()=>{
    this.#patch({saving:this.#state.saving-1});
    try{await this.#loadTitle(version);}catch{/* Keep known receipt / avoid unhandled rejection */}
   });
  await this.#tail;
 }
 async titleAction(kind:'send'|'read'){
  this.#check();if(this.isComposing||this.#state.saving||this.#state.sending||this.#state.reading||this.#state.remoteWaiting||this.#state.titleBusy||this.#state.storageError)throw new NativePageError('busy');
  if(kind==='send'&&!this.port.sendTitleFor||kind==='read'&&!this.port.readTitleFor)throw new NativePageError('closed');
  this.#patch({titleBusy:true,...(kind==='read'?{titleReadStatus:null}:{titleStatus:null})});const version=this.#titleVersion;
  try{
   if(kind==='read'){
    const status=await this.port.readTitleFor!(this.bound,this.pageId);this.#check();this.#patch({titleReadStatus:status});
    if(status!=='received')return;
    await this.durable();
    if(this.#preBootstrapTitle!==null){this.#queueTitle(this.#preBootstrapTitle);await this.durable();}
   }else{
    await this.durable();
    // Each click is bounded, and unknown delivery or conflicts stop the batch.
    for(let n=0;n<32;n++){const status=await this.port.sendTitleFor!(this.bound,this.pageId);this.#check();this.#patch({titleStatus:status});if(status!=='applied')break;}
   }
   // A failed local display recheck never changes a known native receipt.
   try{await this.#loadTitle(version);}catch{this.#patch({titlePending:null});}
  }catch{if(this.#state.phase==='ready')this.#patch(kind==='send'?{titleStatus:'send_unknown'}:this.#state.titleReadStatus==='received'?{titlePending:null}:{titleReadStatus:'read_unknown'});}
  finally{this.#patch({titleBusy:false});}
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
 setComposing=(value:boolean)=>{
  if(value===this.isComposing)return;
  if(value)this.#compositionTitle={title:this.#state.title,draft:this.#preBootstrapTitle,dirty:this.#state.titleDraft};
  else if(this.#compositionTitle){const start=this.#compositionTitle;this.#compositionTitle=null;
   if(start.title!==this.#state.title){this.#titleEdited=true;if(!this.#state.storageError)this.#queueTitle(this.#state.title);}
   else{this.#preBootstrapTitle=this.#initialTitle===start.title?null:start.draft;this.#patch({titleDraft:this.#preBootstrapTitle!==null});}
  }
  this.#patch({composing:value});if(!value)this.#flushRemote();
 };
 #flushRemote(){
  if(!this.#remote||this.#state.composing||this.#state.phase!=='ready'||this.#state.storageError)return;
  try{
   this.#check();const candidate=this.#remote;this.#remote=null;Y.applyUpdate(this.document,candidate.update,this.#loadOrigin);
   if(candidate.title!==null&&candidate.version===this.#titleVersion&&this.#preBootstrapTitle===null){
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
  this.#check();if(this.isComposing||this.#state.saving||this.#state.sending||this.#state.reading||this.#state.remoteWaiting||this.#state.titleBusy||this.#state.storageError)throw new NativePageError('busy');
  const limit=Math.min(32,Math.max(1,this.#state.pending));this.#patch({sending:true,pendingFresh:false,sendStatus:null});
  try{
   for(let index=0;index<limit;index++){
    this.#check();const result=await this.port.sendPageFor(this.bound,this.pageId);this.#check();this.#patch({sendStatus:result});
    if(result!=='acked')break;
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
 async read(){
  if(!this.port.readPageFor)throw new NativePageError('closed');
  this.#check();if(this.isComposing||this.#state.saving||this.#state.sending||this.#state.reading||this.#state.remoteWaiting||this.#state.titleBusy||this.#state.storageError)throw new NativePageError('busy');
  const localOnly=this.#state.readStatus==='received'&&Boolean(this.#state.readError);this.#patch({reading:true,...(!localOnly?{readStatus:null}:{}),readError:null});
  try{
   const result=localOnly?'received':await this.port.readPageFor(this.bound,this.pageId);this.#check();this.#patch({readStatus:result});if(result!=='received')return;
   await this.durable();this.#check();const version=this.#editVersion;const response=await this.port.executeFor(this.bound,{command:'page_load',pageId:this.pageId});this.#check();
   const parsed=privatePageLocalLoadSchema.safeParse(response);if(!parsed.success||parsed.data.page.metadata.id!==this.pageId)throw new NativePageError('protocol');
   const probe=new Y.Doc({gc:false});let update:Uint8Array;
   try{Y.applyUpdate(probe,Y.encodeStateAsUpdate(this.document));for(const bytes of parsed.data.page.updates)Y.applyUpdate(probe,Uint8Array.from(bytes));update=Y.encodeStateAsUpdate(probe,Y.encodeStateVector(this.document));}
   catch{throw new NativePageError('protocol');}finally{probe.destroy();}
   this.#check();const adoptTitle=version===this.#editVersion;this.#remote={update,title:adoptTitle?parsed.data.page.metadata.title:null,version:this.#titleVersion};
   this.#patch({remoteWaiting:true,...(version===this.#editVersion&&this.#state.saving===0?{pending:parsed.data.pending,pendingFresh:true}: {pendingFresh:false})});this.#flushRemote();
  }catch(error){if(this.#state.phase==='ready')this.#patch(this.#state.readStatus==='received'?{readError:error instanceof NativePageError&&error.stage==='protocol'?'protocol':'load'}:{readStatus:'read_unknown'});}
  finally{if(this.#state.phase==='ready')this.#patch({reading:false});}
 }
 draft():NativePageDraft|null {
  if(this.#state.unsaved===0 && this.#state.title===this.#initialTitle && this.#preBootstrapTitle===null)return null;
  return Object.freeze({context:this.bound.context,pageId:this.pageId,title:this.#state.title,titleChanged:this.#titleEdited||this.#state.title!==this.#initialTitle||this.#preBootstrapTitle!==null,update:Uint8Array.from(Y.encodeStateAsUpdate(this.document))});
 }
 async restoreDraft(draft:NativePageDraft){
  this.#check();if(this.isComposing)throw new NativePageError('busy');
  if(draft.pageId!==this.pageId || Object.entries(this.bound.context).some(([key,value])=>draft.context[key as keyof typeof draft.context]!==value))throw new NativePageError('protocol');
  if(draft.titleChanged&&draft.title!==this.#state.title){this.setTitle(draft.title);}
  try{Y.applyUpdate(this.document,Uint8Array.from(draft.update));}catch{throw new NativePageError('protocol');}await this.durable();
 }
 close():Promise<NativePageDraft|null>{
  if(this.#closing)return this.#closing;if(this.isComposing)return Promise.reject(new NativePageError('busy'));
  this.#remote=null;this.#patch({phase:'closed',remoteWaiting:false});this.document.off('update',this.#changed);
  this.#closing=this.#tail.catch(()=>{}).then(()=>{const draft=this.draft();this.document.destroy();this.#listeners.clear();return draft;});return this.#closing;
 }
}
