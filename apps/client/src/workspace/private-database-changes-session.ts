import {DatabaseChangesSessionError,type DatabaseChangesSyncSession,type DatabaseChangesProgress,type DatabaseChangesObservation,type PrivateWorkspaceConnection} from '@greiva/sync';
import {NativeWorkspaceError,NativeWorkspaceStore} from './native-workspace-store.js';

export class PrivateDatabaseChangesError extends Error {
 constructor(readonly stage:'closed'|'busy'|'protocol'|'storage'|'transport'){super(`Private database changes ${stage}`);this.name='PrivateDatabaseChangesError';}
}
export type PrivateDatabaseChangesState=Readonly<{phase:'opening'|'ready'|'closed';busy:boolean;data:DatabaseChangesProgress|null;error:'protocol'|'storage'|'transport'|null;retryReceive:boolean;observedHead:boolean}>;

// Owns its delta session, not the shared workspace store. Opening/reloading
// reads durable local state only; each sync is one explicit bounded window.
export class PrivateDatabaseChangesSession {
 readonly sourceId:string;
 private phase:PrivateDatabaseChangesState['phase']='opening';private busy=false;
 private data:DatabaseChangesProgress|null=null;private error:PrivateDatabaseChangesState['error']=null;private observedHead=false;
 private readonly lease:AbortSignal;private readonly detach:()=>void;
 private listeners=new Set<(state:PrivateDatabaseChangesState)=>void>();
 private tail:Promise<void>=Promise.resolve();private closeWork:Promise<void>|null=null;
 private constructor(private readonly connection:PrivateWorkspaceConnection,private readonly store:NativeWorkspaceStore,private readonly session:DatabaseChangesSyncSession){
  store.assertConnection(connection);const lease=connection.generationSignal;if(!lease||lease.aborted||session.signal.aborted)throw new PrivateDatabaseChangesError('closed');this.lease=lease;this.sourceId=session.source.id;
  const invalidated=()=>{void this.close();};lease.addEventListener('abort',invalidated,{once:true});session.signal.addEventListener('abort',invalidated,{once:true});this.detach=()=>{lease.removeEventListener('abort',invalidated);session.signal.removeEventListener('abort',invalidated);};
 }
 static async open(connection:PrivateWorkspaceConnection,store:NativeWorkspaceStore,sourceId:string):Promise<PrivateDatabaseChangesSession>{
  let sync:DatabaseChangesSyncSession|undefined,runtime:PrivateDatabaseChangesSession|undefined;
  try{store.assertConnection(connection);sync=await store.databaseChanges(sourceId);runtime=new PrivateDatabaseChangesSession(connection,store,sync);runtime.data=await sync.progress();runtime.check();runtime.phase='ready';return runtime;}
  catch(error){const failure=runtime?runtime.failure(error):new PrivateDatabaseChangesError(error instanceof NativeWorkspaceError?(error.stage==='configuration'?'protocol':error.stage):error instanceof DatabaseChangesSessionError?error.stage:error instanceof PrivateDatabaseChangesError?error.stage:'protocol');if(runtime)await runtime.close();else sync?.close();throw failure;}
 }
 private check(){if(this.phase==='closed'||this.lease.aborted||this.session.signal.aborted)throw new PrivateDatabaseChangesError('closed');try{this.store.assertConnection(this.connection);}catch{throw new PrivateDatabaseChangesError('closed');}}
 private failure(error:unknown):PrivateDatabaseChangesError{
  if(this.phase==='closed'||this.lease.aborted||this.session.signal.aborted)return new PrivateDatabaseChangesError('closed');
  if(error instanceof PrivateDatabaseChangesError)return error;
  if(error instanceof DatabaseChangesSessionError)return new PrivateDatabaseChangesError(error.stage);
  if(error instanceof NativeWorkspaceError)return new PrivateDatabaseChangesError(error.stage==='configuration'?'protocol':error.stage);
  return new PrivateDatabaseChangesError('protocol');
 }
 get snapshot():PrivateDatabaseChangesState{return Object.freeze({phase:this.phase,busy:this.busy,data:this.data,error:this.error,retryReceive:this.session.retryReceive,observedHead:this.phase==='ready'&&!this.busy&&!this.error&&!this.session.retryReceive&&this.observedHead});}
 subscribe(listener:(state:PrivateDatabaseChangesState)=>void){this.listeners.add(listener);try{listener(this.snapshot);}catch{/* observation cannot interrupt storage */}return()=>{this.listeners.delete(listener);};}
 private publish(){for(const listener of this.listeners)try{listener(this.snapshot);}catch{/* observation cannot interrupt storage */}}
 private run(work:()=>Promise<void>):Promise<void>{
  this.check();if(this.phase!=='ready'||this.busy)throw new PrivateDatabaseChangesError('busy');this.busy=true;this.error=null;this.observedHead=false;
  const result=Promise.resolve().then(async()=>{try{this.check();await work();this.check();}catch(error){const failure=this.failure(error);if(failure.stage==='closed')void this.close();else this.error=failure.stage==='busy'?'protocol':failure.stage;throw failure;}finally{this.busy=false;this.publish();}});this.tail=result.catch(()=>{});this.publish();return result;
 }
 async reload(){return this.run(async()=>{const data=await this.session.progress();this.check();this.data=data;});}
 private observe(value:DatabaseChangesObservation){this.check();this.data=value.progress;this.observedHead=!value.progress.hasMore;}
 async sync(){this.check();if(this.session.retryReceive)throw new PrivateDatabaseChangesError('busy');return this.run(async()=>this.observe(await this.session.pull(100)));}
 async retryReceive(){return this.run(async()=>this.observe(await this.session.retry()));}
 close():Promise<void>{if(this.closeWork)return this.closeWork;this.closeWork=this.tail.then(()=>{this.listeners.clear();});this.phase='closed';this.busy=false;this.data=null;this.error=null;this.observedHead=false;this.detach();this.session.close();this.publish();return this.closeWork;}
}
