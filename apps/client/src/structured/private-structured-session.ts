import {pushOperationSchema,parseOperationPayload,type PushOperation,type StructuredSnapshot} from '@greiva/protocol';
import {commitStructuredMutation,MutationCommitError,MutationAuthorizationError} from '@greiva/application';
import {WorkspaceSessionError,type WorkspaceSyncSession,type PrivateWorkspaceConnection} from '@greiva/sync';
import {NativeWorkspaceStore,NativeWorkspaceError} from '../workspace/native-workspace-store.js';

export class PrivateStructuredError extends Error{
 constructor(readonly stage:'closed'|'busy'|'protocol'|'storage'|'transport'){super(`Private structured ${stage}`);this.name='PrivateStructuredError';}
}
export type PrivateStructuredState=Readonly<{phase:'opening'|'ready'|'closed';busy:boolean;data:StructuredSnapshot|null;error:'protocol'|'storage'|'transport'|null;pending:number;conflicts:number;rejected:number;synced:boolean;hasMore:boolean;retryMutation:boolean}>;

// Explicit cycles through the captured authenticated stream. This is not the
// old unscoped engine/HTTP route, an offline grant, or an automatic retry loop.
export class PrivateStructuredSession{
 private phase:PrivateStructuredState['phase']='opening';private busy=false;private data:StructuredSnapshot|null=null;
 private error:PrivateStructuredState['error']=null;private revision=0;private confirmed:number|null=null;
 private uncertain:PushOperation|null=null;private tail:Promise<void>=Promise.resolve();private closeWork:Promise<void>|null=null;
 private listeners=new Set<(state:PrivateStructuredState)=>void>();private readonly syncSession:WorkspaceSyncSession;private detach=()=>{};private readonly lease:AbortSignal;
 private readonly read:NativeWorkspaceStore['structuredSnapshot'];private readonly mutatePort:NativeWorkspaceStore['mutate'];private readonly prepare:NativeWorkspaceStore['prepare'];
 private constructor(private readonly connection:PrivateWorkspaceConnection,private readonly store:NativeWorkspaceStore){
  this.read=store.structuredSnapshot.bind(store);this.mutatePort=store.mutate.bind(store);this.prepare=store.prepare.bind(store);
  store.assertConnection(connection);this.syncSession=connection.openSync(store);const lease=connection.generationSignal;
  if(!lease||lease.aborted){this.syncSession.close();throw new PrivateStructuredError('closed');}
  this.lease=AbortSignal.any([lease,this.syncSession.signal]);const invalidated=()=>{void this.close();};this.lease.addEventListener('abort',invalidated,{once:true});this.detach=()=>this.lease.removeEventListener('abort',invalidated);
 }
 static async open(connection:PrivateWorkspaceConnection,store:NativeWorkspaceStore){
  let session:PrivateStructuredSession;
  try{session=new PrivateStructuredSession(connection,store);}catch(error){throw new PrivateStructuredError(error instanceof NativeWorkspaceError&&error.stage==='closed'?'closed':'protocol');}
  try{await session.reload();session.check();session.phase='ready';session.publish();return session;}catch(error){const failure=session.failure(error);await session.close();throw failure;}
 }
 private check(){if(this.phase==='closed'||this.lease.aborted)throw new PrivateStructuredError('closed');try{this.store.assertConnection(this.connection);}catch{throw new PrivateStructuredError('closed');}}
 private failure(error:unknown):PrivateStructuredError{
  if(this.phase==='closed'||this.lease.aborted)return new PrivateStructuredError('closed');
  if(error instanceof PrivateStructuredError)return error;
  if(error instanceof NativeWorkspaceError)return new PrivateStructuredError(error.stage==='protocol'||error.stage==='configuration'?'protocol':error.stage==='closed'?'closed':'storage');
  if(error instanceof WorkspaceSessionError)return new PrivateStructuredError(error.stage);
  if(error instanceof MutationCommitError)return this.failure(error.cause);
  if(error instanceof MutationAuthorizationError)return new PrivateStructuredError('closed');
  return new PrivateStructuredError('protocol');
 }
 get snapshot():PrivateStructuredState{
  const pending=this.data?.operations.filter(operation=>operation.status==='pending').length??0,conflicts=this.data?.conflicts.filter(conflict=>conflict.status==='open').length??0,rejected=Math.max(this.data?.operations.filter(operation=>operation.status==='rejected').length??0,this.data?.errors.length??0);
  const hasMore=Boolean(this.data&&this.data.state.cursor!==this.data.state.headCursor);
  return Object.freeze({phase:this.phase,busy:this.busy,data:this.data,error:this.error,pending,conflicts,rejected,hasMore,retryMutation:this.uncertain!==null,
   synced:this.phase==='ready'&&!this.busy&&!this.error&&!this.uncertain&&!pending&&!conflicts&&!rejected&&!hasMore&&this.confirmed===this.revision});
 }
 subscribe(listener:(state:PrivateStructuredState)=>void){this.listeners.add(listener);listener(this.snapshot);return()=>{this.listeners.delete(listener);};}
 private publish(){for(const listener of this.listeners){try{listener(this.snapshot);}catch{/* observer cannot interrupt a commit */}}}
 private async reload(){const value=await this.read();this.check();this.data=value;this.publish();}
 private run(work:()=>Promise<void>){
  this.check();if(this.phase!=='ready'||this.busy)throw new PrivateStructuredError('busy');this.busy=true;this.error=null;this.confirmed=null;this.publish();
  const result=(async()=>{try{await work();this.check();}catch(error){const failure=this.failure(error);if(failure.stage==='closed')void this.close();else{this.error=failure.stage==='busy'?'protocol':failure.stage;this.publish();}throw failure;}finally{this.busy=false;this.publish();}})();
  this.tail=result.catch(()=>{});return result;
 }
 async mutate(candidate:unknown){
  this.check();if(this.uncertain)throw new PrivateStructuredError('busy');let operation:PushOperation;
  try{operation=pushOperationSchema.parse(JSON.parse(JSON.stringify(candidate)));parseOperationPayload(operation);if(operation.clientId!==this.store.context.clientId)throw Error();}catch{throw new PrivateStructuredError('protocol');}
  return this.commit(operation);
 }
 private commit(operation:PushOperation){
  return this.run(async()=>{
   // Retain the admitted ID/content through any unknown commit or post-commit
   // read failure. Recovery retries this exact operation, never a new nonce.
   this.uncertain=operation;
   await commitStructuredMutation({authorization:{canMutate:async()=>{this.check();return true;}},store:{commit:async request=>{
    this.check();if(request.context.subjectId!==this.store.context.subjectId||request.context.workspaceId!==this.store.context.workspaceId||request.context.clientId!==this.store.context.clientId)throw new PrivateStructuredError('protocol');
    await this.mutatePort(request.operation);
   }}},{subjectId:this.store.context.subjectId,workspaceId:this.store.context.workspaceId,clientId:this.store.context.clientId},operation);
   this.check();++this.revision;await this.reload();this.check();this.uncertain=null;this.publish();
  });
 }
 async retryMutation(){this.check();if(!this.uncertain)throw new PrivateStructuredError('protocol');return this.commit(this.uncertain);}
 async sync(){
  this.check();if(this.uncertain)throw new PrivateStructuredError('busy');
  return this.run(async()=>{
   const revision=this.revision;await this.reload();const pending=this.snapshot.pending;
   for(let index=0;index<pending;++index){const prepared=await this.prepare();this.check();if(prepared===null)break;await this.syncSession.push(prepared);this.check();await this.reload();}
   const context=this.store.context;
   await this.syncSession.pull({protocolVersion:1,workspaceId:context.workspaceId,clientId:context.clientId,cursor:this.data!.state.cursor,limit:100});this.check();await this.reload();
   if(revision===this.revision&&!this.snapshot.pending&&!this.snapshot.conflicts&&!this.snapshot.rejected&&!this.snapshot.hasMore)this.confirmed=revision;
  });
 }
 close():Promise<void>{
  if(this.closeWork)return this.closeWork;this.phase='closed';this.busy=false;this.data=null;this.uncertain=null;this.confirmed=null;this.detach();this.syncSession.close();this.publish();
  this.closeWork=this.tail.then(()=>{this.listeners.clear();});return this.closeWork;
 }
}
