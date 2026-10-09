import {privateDatabaseSourceIntentSchema,privateDatabaseSourceQueueSchema,type PrivateDatabaseSourceIntent} from '@greiva/protocol/private-database-source';
import {DatabaseSourceWriteSessionError,type DatabaseSourceWriteSyncSession,type PrivateWorkspaceConnection} from '@greiva/sync';
import {NativeWorkspaceStore,NativeWorkspaceError} from './native-workspace-store.js';
type Local=ReturnType<typeof privateDatabaseSourceQueueSchema.parse>;
export class PrivateDatabaseSourceWriteError extends Error {
 constructor(readonly stage:'closed'|'busy'|'protocol'|'storage'|'transport'){super(`Private database Source write ${stage}`);this.name='PrivateDatabaseSourceWriteError';}
}
export type PrivateDatabaseSourceWriteState=Readonly<{phase:'opening'|'ready'|'closed';busy:boolean;data:Local|null;error:'protocol'|'storage'|'transport'|null;retryEnqueue:boolean;retryAck:boolean;catalogFresh:boolean}>;
function frozen<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
export class PrivateDatabaseSourceWriteSession {
 private phase:PrivateDatabaseSourceWriteState['phase']='opening';private busy=false;private data:Local|null=null;private error:PrivateDatabaseSourceWriteState['error']=null;
 private catalogFresh=false;private pendingEnqueue:PrivateDatabaseSourceIntent|null=null;private readonly sync:DatabaseSourceWriteSyncSession;private readonly lease:AbortSignal;private readonly detach:()=>void;
 private readonly enqueueStore:NativeWorkspaceStore['databaseSourceEnqueue'];private readonly load:NativeWorkspaceStore['databaseSourceQueue'];
 private listeners=new Set<(value:PrivateDatabaseSourceWriteState)=>void>();private tail:Promise<void>=Promise.resolve();private closeWork:Promise<void>|null=null;
 private constructor(private readonly connection:PrivateWorkspaceConnection,private readonly store:NativeWorkspaceStore){
  store.assertConnection(connection);const lease=connection.generationSignal;if(!lease||lease.aborted)throw new PrivateDatabaseSourceWriteError('closed');this.lease=lease;this.enqueueStore=store.databaseSourceEnqueue.bind(store);this.load=store.databaseSourceQueue.bind(store);this.sync=store.databaseSourceWrites();
  const invalidated=()=>{void this.close();};lease.addEventListener('abort',invalidated,{once:true});this.sync.signal.addEventListener('abort',invalidated,{once:true});this.detach=()=>{lease.removeEventListener('abort',invalidated);this.sync.signal.removeEventListener('abort',invalidated);};
 }
 static async open(connection:PrivateWorkspaceConnection,store:NativeWorkspaceStore):Promise<PrivateDatabaseSourceWriteSession>{let runtime:PrivateDatabaseSourceWriteSession|undefined;try{runtime=new PrivateDatabaseSourceWriteSession(connection,store);await runtime.read();runtime.check();runtime.phase='ready';return runtime;}catch(error){const failure=runtime?runtime.failure(error):new PrivateDatabaseSourceWriteError(error instanceof NativeWorkspaceError?(error.stage==='configuration'?'protocol':error.stage):error instanceof PrivateDatabaseSourceWriteError?error.stage:'protocol');await runtime?.close();throw failure;}}
 private check(){if(this.phase==='closed'||this.lease.aborted||this.sync.signal.aborted)throw new PrivateDatabaseSourceWriteError('closed');try{this.store.assertConnection(this.connection);}catch{throw new PrivateDatabaseSourceWriteError('closed');}}
 private failure(error:unknown):PrivateDatabaseSourceWriteError {if(this.phase==='closed'||this.lease.aborted||this.sync.signal.aborted)return new PrivateDatabaseSourceWriteError('closed');if(error instanceof PrivateDatabaseSourceWriteError)return error;if(error instanceof DatabaseSourceWriteSessionError)return new PrivateDatabaseSourceWriteError(error.stage);if(error instanceof NativeWorkspaceError)return new PrivateDatabaseSourceWriteError(error.stage==='configuration'?'protocol':error.stage);return new PrivateDatabaseSourceWriteError('protocol');}
 get snapshot():PrivateDatabaseSourceWriteState{return Object.freeze({phase:this.phase,busy:this.busy,data:this.data,error:this.error,retryEnqueue:this.pendingEnqueue!==null,retryAck:this.sync.retryAck,catalogFresh:this.catalogFresh});}
 subscribe(listener:(state:PrivateDatabaseSourceWriteState)=>void){this.listeners.add(listener);try{listener(this.snapshot);}catch{/* observations do not interrupt storage */}return()=>{this.listeners.delete(listener);};}
 private publish(){for(const listener of this.listeners)try{listener(this.snapshot);}catch{/* observations do not interrupt storage */}}
 private run<T>(work:()=>Promise<T>):Promise<T>{this.check();if(this.phase!=='ready'||this.busy)throw new PrivateDatabaseSourceWriteError('busy');this.busy=true;this.error=null;this.catalogFresh=false;const result=Promise.resolve().then(async()=>{try{this.check();const value=await work();this.check();return value;}catch(error){const failure=this.failure(error);if(failure.stage==='closed')void this.close();else this.error=failure.stage==='busy'?'protocol':failure.stage;throw failure;}finally{this.busy=false;this.publish();}});this.tail=result.then(()=>{},()=>{});this.publish();return result;}
 private async read(after:string|null=null){const value=await this.load({pendingOnly:true,after,limit:100});this.check();this.data=value;this.catalogFresh=true;}
 private available(){if(this.pendingEnqueue||this.sync.retryAck)throw new PrivateDatabaseSourceWriteError('busy');}
 async reload(more=false){this.check();const after=more?this.data?.nextAfter??null:null;if(more&&after===null)return;return this.run(()=>this.read(after));}
 private async save(intent:PrivateDatabaseSourceIntent){this.pendingEnqueue=intent;await this.enqueueStore(intent);this.check();await this.read();this.pendingEnqueue=null;}
 async enqueue(candidate:unknown){this.check();this.available();let intent:PrivateDatabaseSourceIntent;try{intent=frozen(privateDatabaseSourceIntentSchema.parse(candidate));if(intent.source.workspaceId!==this.store.context.workspaceId)throw Error();}catch{throw new PrivateDatabaseSourceWriteError('protocol');}return this.run(()=>this.save(intent));}
 async retryEnqueue(){return this.run(async()=>{if(!this.pendingEnqueue)throw new PrivateDatabaseSourceWriteError('protocol');await this.save(this.pendingEnqueue);});}
 async send(){this.check();this.available();return this.run(async()=>{const reply=await this.sync.send();this.check();await this.read();return reply;});}
 async retryAck(){this.check();if(this.pendingEnqueue)throw new PrivateDatabaseSourceWriteError('busy');return this.run(async()=>{const reply=await this.sync.retry();this.check();await this.read();return reply;});}
 close():Promise<void>{if(this.closeWork)return this.closeWork;this.closeWork=this.tail.then(()=>{this.listeners.clear();});this.phase='closed';this.busy=false;this.catalogFresh=false;this.data=null;this.error=null;this.pendingEnqueue=null;this.detach();this.sync.close();this.publish();return this.closeWork;}
}
