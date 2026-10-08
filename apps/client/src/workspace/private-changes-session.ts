import type {privatePageChangesLocalResponseSchema} from '@greiva/protocol/private-page-changes';
import {PageChangesSessionError,type PageChangesSyncSession,type PrivateWorkspaceConnection} from '@greiva/sync';
import {NativeWorkspaceError,NativeWorkspaceStore} from './native-workspace-store.js';

type Local=ReturnType<typeof privatePageChangesLocalResponseSchema.parse>;
export class PrivateChangesError extends Error {
  constructor(readonly stage:'closed'|'busy'|'protocol'|'storage'|'transport'){super(`Private Page changes ${stage}`);this.name='PrivateChangesError';}
}
export type PrivateChangesState=Readonly<{phase:'opening'|'ready'|'closed';busy:boolean;data:Local|null;error:'protocol'|'storage'|'transport'|null;retryReceive:boolean;readComplete:boolean;hasMoreRemote:boolean;hasMoreLocal:boolean}>;

// Opening and local catalog browsing do not start network work. Each explicit
// sync reads durable progress before one pull; closure owns no shared store.
export class PrivateChangesSession {
  private phase:PrivateChangesState['phase']='opening';private busy=false;private data:Local|null=null;
  private error:PrivateChangesState['error']=null;private readComplete=false;
  private readonly lease:AbortSignal;private readonly detach:()=>void;private readonly syncSession:PageChangesSyncSession;
  private readonly load:NativeWorkspaceStore['changesLoad'];private listeners=new Set<(state:PrivateChangesState)=>void>();
  private tail:Promise<void>=Promise.resolve();private closeWork:Promise<void>|null=null;
  private constructor(private readonly connection:PrivateWorkspaceConnection,private readonly store:NativeWorkspaceStore){
    store.assertConnection(connection);const lease=connection.generationSignal;if(!lease||lease.aborted)throw new PrivateChangesError('closed');this.lease=lease;
    this.load=store.changesLoad.bind(store);this.syncSession=connection.openChanges({receive:store.changesReceive.bind(store)});
    const invalidated=()=>{void this.close();};lease.addEventListener('abort',invalidated,{once:true});this.syncSession.signal.addEventListener('abort',invalidated,{once:true});this.detach=()=>{lease.removeEventListener('abort',invalidated);this.syncSession.signal.removeEventListener('abort',invalidated);};
  }
  static async open(connection:PrivateWorkspaceConnection,store:NativeWorkspaceStore){
    let session:PrivateChangesSession;try{session=new PrivateChangesSession(connection,store);}catch(error){if(error instanceof PrivateChangesError)throw error;throw new PrivateChangesError(error instanceof NativeWorkspaceError&&error.stage==='closed'?'closed':'protocol');}
    try{await session.reload();session.check();session.phase='ready';session.publish();return session;}catch(error){const failure=session.failure(error);await session.close();throw failure;}
  }
  private check(){if(this.phase==='closed'||this.lease.aborted||this.syncSession.signal.aborted)throw new PrivateChangesError('closed');try{this.store.assertConnection(this.connection);}catch{throw new PrivateChangesError('closed');}}
  private failure(error:unknown):PrivateChangesError {
    if(this.phase==='closed'||this.lease.aborted||this.syncSession.signal.aborted)return new PrivateChangesError('closed');
    if(error instanceof PrivateChangesError)return error;
    if(error instanceof PageChangesSessionError)return new PrivateChangesError(error.stage);
    if(error instanceof NativeWorkspaceError)return new PrivateChangesError(error.stage==='configuration'?'protocol':error.stage);
    return new PrivateChangesError('protocol');
  }
  get snapshot():PrivateChangesState{return Object.freeze({phase:this.phase,busy:this.busy,data:this.data,error:this.error,retryReceive:this.syncSession.retryReceive,readComplete:this.phase==='ready'&&!this.busy&&!this.error&&this.readComplete,hasMoreRemote:this.data?.hasMore??false,hasMoreLocal:this.data?.nextAfter!==null&&this.data!==null});}
  subscribe(listener:(state:PrivateChangesState)=>void){this.listeners.add(listener);try{listener(this.snapshot);}catch{/* observers cannot interrupt commit */}return()=>{this.listeners.delete(listener);};}
  private publish(){for(const listener of this.listeners)try{listener(this.snapshot);}catch{/* observers cannot interrupt commit */}}
  private async reload(afterPage:string|null=null){const value=await this.load({afterPage,limit:100});this.check();this.data=value;this.publish();}
  private run(work:()=>Promise<void>){
    this.check();if(this.phase!=='ready'||this.busy)throw new PrivateChangesError('busy');this.busy=true;this.error=null;this.readComplete=false;this.publish();
    const result=(async()=>{try{await work();this.check();}catch(error){const failure=this.failure(error);if(failure.stage==='closed')void this.close();else{this.error=failure.stage==='busy'?'protocol':failure.stage;this.publish();}throw failure;}finally{this.busy=false;this.publish();}})();this.tail=result.catch(()=>{});return result;
  }
  async catalog(more=false){this.check();if(this.syncSession.retryReceive)throw new PrivateChangesError('busy');const after=more?this.data?.nextAfter??null:null;if(more&&after===null)return;return this.run(()=>this.reload(after));}
  async sync(){this.check();if(this.syncSession.retryReceive)throw new PrivateChangesError('busy');return this.run(async()=>{
    await this.reload();const base=this.data!;const reply=await this.syncSession.pull({protocolVersion:1,clientId:this.store.context.clientId,cursor:base.cursor,limit:100},base.order);this.check();
    await this.reload();this.readComplete=!this.data!.hasMore&&this.data!.order===reply.readOrder&&this.data!.cursor===reply.cursor;
  });}
  async retryReceive(){this.check();return this.run(async()=>{const reply=await this.syncSession.retry();this.check();await this.reload();this.readComplete=!this.data!.hasMore&&this.data!.order===reply.readOrder&&this.data!.cursor===reply.cursor;});}
  close():Promise<void>{if(this.closeWork)return this.closeWork;this.phase='closed';this.busy=false;this.data=null;this.error=null;this.readComplete=false;this.detach();this.syncSession.close();this.publish();this.closeWork=this.tail.then(()=>{this.listeners.clear();});return this.closeWork;}
}
