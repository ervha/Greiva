import {privatePageTitleIntentSchema,type PrivatePageTitleIntent,type PrivatePageTitleLocalResponse} from '@greiva/protocol/private-page-metadata';
import {PageTitleSessionError,type PageTitleSyncSession,type PrivateWorkspaceConnection} from '@greiva/sync';
import {NativeWorkspaceError,NativeWorkspaceStore} from './native-workspace-store.js';
import type {NativeWorkspaceTitle} from './native-workspace-title.js';

export class PrivateTitleError extends Error {
  constructor(readonly stage:'closed'|'busy'|'protocol'|'storage'|'transport'){super(`Private title ${stage}`);this.name='PrivateTitleError';}
}
export type PrivateTitleState=Readonly<{
  phase:'opening'|'ready'|'closed';busy:boolean;data:PrivatePageTitleLocalResponse|null;
  error:'protocol'|'storage'|'transport'|null;pending:number;retryMutation:boolean;
  queryComplete:boolean;hasMoreRemote:boolean;hasMoreLocal:boolean;
}>;
// Explicit bounded cycles only. A query completion is never a synced-state or
// globally current Conflict status. The shared workspace store is not owned here.
export class PrivateTitleSession {
  private phase:PrivateTitleState['phase']='opening';private busy=false;
  private data:PrivatePageTitleLocalResponse|null=null;private error:PrivateTitleState['error']=null;
  private uncertain:PrivatePageTitleIntent|null=null;private nextQuery:string|null=null;private queryComplete=false;
  private historyOperation:string|null=null;private historyConflict:string|null=null;
  private tail:Promise<void>=Promise.resolve();private closeWork:Promise<void>|null=null;
  private readonly listeners=new Set<(state:PrivateTitleState)=>void>();
  private readonly syncSession:PageTitleSyncSession;private readonly lease:AbortSignal;private detach=()=>{};
  private readonly load:NativeWorkspaceTitle['load'];private readonly enqueue:NativeWorkspaceTitle['enqueue'];private readonly prepare:NativeWorkspaceTitle['prepare'];
  private constructor(private readonly connection:PrivateWorkspaceConnection,private readonly store:NativeWorkspaceStore,readonly pageId:string){
    store.assertConnection(connection);const port=store.title(pageId);this.load=port.load.bind(port);this.enqueue=port.enqueue.bind(port);this.prepare=port.prepare.bind(port);
    this.syncSession=connection.openTitle(pageId,port);const lease=connection.generationSignal;
    if(!lease||lease.aborted){this.syncSession.close();throw new PrivateTitleError('closed');}
    this.lease=AbortSignal.any([lease,this.syncSession.signal]);const invalidated=()=>{void this.close();};this.lease.addEventListener('abort',invalidated,{once:true});this.detach=()=>this.lease.removeEventListener('abort',invalidated);
  }
  static async open(connection:PrivateWorkspaceConnection,store:NativeWorkspaceStore,pageId:string){
    let session:PrivateTitleSession;try{session=new PrivateTitleSession(connection,store,pageId);}catch(error){throw new PrivateTitleError(error instanceof NativeWorkspaceError&&error.stage==='closed'?'closed':'protocol');}
    try{await session.reload();session.check();session.phase='ready';session.publish();return session;}catch(error){const failure=session.failure(error);await session.close();throw failure;}
  }
  private check(){if(this.phase==='closed'||this.lease.aborted)throw new PrivateTitleError('closed');try{this.store.assertConnection(this.connection);}catch{throw new PrivateTitleError('closed');}}
  private failure(error:unknown):PrivateTitleError {
    if(this.phase==='closed'||this.lease.aborted)return new PrivateTitleError('closed');
    if(error instanceof PrivateTitleError)return error;
    if(error instanceof PageTitleSessionError)return new PrivateTitleError(error.stage);
    if(error instanceof NativeWorkspaceError)return new PrivateTitleError(error.stage==='configuration'?'protocol':error.stage);
    return new PrivateTitleError('protocol');
  }
  get snapshot():PrivateTitleState{return Object.freeze({phase:this.phase,busy:this.busy,data:this.data,error:this.error,pending:this.data?.pending??0,retryMutation:this.uncertain!==null,
    queryComplete:this.phase==='ready'&&!this.busy&&!this.error&&!this.uncertain&&this.queryComplete,hasMoreRemote:this.nextQuery!==null,hasMoreLocal:Boolean(this.data&&(this.data.nextOperation!==null||this.data.nextConflict!==null))});}
  subscribe(listener:(state:PrivateTitleState)=>void){this.listeners.add(listener);try{listener(this.snapshot);}catch{/* observer cannot interrupt a commit */}return()=>{this.listeners.delete(listener);};}
  private publish(){for(const listener of this.listeners)try{listener(this.snapshot);}catch{/* observer cannot interrupt a commit */}}
  private async reload(candidate:{limit:100;afterOperation?:string|null;afterConflict?:string|null}={limit:100}){const value=await this.load(candidate);this.check();
    // Keep each last key even when its next page is empty. The other stream
    // may have more pages; null would restart an already exhausted stream.
    this.historyOperation=value.operations.at(-1)?.sequence??candidate.afterOperation??null;
    this.historyConflict=value.conflicts.at(-1)?.record.id??candidate.afterConflict??null;
    this.data=value;this.publish();}
  async history(more=false){this.check();if(this.uncertain)throw new PrivateTitleError('busy');const afterOperation=more?this.historyOperation:null,afterConflict=more?this.historyConflict:null;return this.run(async()=>{await this.reload({limit:100,afterOperation,afterConflict});});}
  private run(work:()=>Promise<void>){
    this.check();if(this.phase!=='ready'||this.busy)throw new PrivateTitleError('busy');this.busy=true;this.error=null;this.queryComplete=false;this.publish();
    const result=(async()=>{try{this.check();await work();this.check();}catch(error){const failure=this.failure(error);if(failure.stage==='closed')void this.close();else{this.error=failure.stage==='busy'?'protocol':failure.stage;this.publish();}throw failure;}finally{this.busy=false;this.publish();}})();this.tail=result.catch(()=>{});return result;
  }
  async mutate(candidate:unknown){
    this.check();if(this.uncertain)throw new PrivateTitleError('busy');if(this.data?.base===null)throw new PrivateTitleError('protocol');let intent:PrivatePageTitleIntent;
    try{intent=privatePageTitleIntentSchema.parse(JSON.parse(JSON.stringify(candidate)));if(intent.resolution)Object.freeze(intent.resolution);Object.freeze(intent);}catch{throw new PrivateTitleError('protocol');}
    return this.commit(intent);
  }
  private commit(intent:PrivatePageTitleIntent){return this.run(async()=>{
    // An unknown local commit/read result retries the same admitted nonce.
    this.uncertain=intent;this.nextQuery=null;await this.enqueue(intent);this.check();await this.reload();this.uncertain=null;this.publish();
  });}
  async retryMutation(){this.check();if(!this.uncertain)throw new PrivateTitleError('protocol');return this.commit(this.uncertain);}
  async sync(){
    this.check();if(this.uncertain)throw new PrivateTitleError('busy');return this.run(async()=>{
      await this.reload();const budget=Math.min(this.data!.pending,100);
      for(let count=0;count<budget;++count){const prepared=await this.prepare();this.check();if(prepared===null)break;await this.syncSession.push(prepared);this.check();await this.reload();}
      const response=await this.syncSession.pull({protocolVersion:1,clientId:this.store.context.clientId,afterConflict:this.nextQuery,limit:100});this.check();
      // Advance only after commit and local read succeed. Failed reads repeat
      // this exact keyset query; native candidate upserts are idempotent.
      await this.reload();this.nextQuery=response.nextAfter;this.queryComplete=response.nextAfter===null;
    });
  }
  close():Promise<void>{if(this.closeWork)return this.closeWork;this.phase='closed';this.busy=false;this.data=null;this.uncertain=null;this.nextQuery=null;this.historyOperation=null;this.historyConflict=null;this.queryComplete=false;this.detach();this.syncSession.close();this.publish();this.closeWork=this.tail.then(()=>{this.listeners.clear();});return this.closeWork;}
}
