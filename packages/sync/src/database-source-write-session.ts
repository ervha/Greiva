import {workspaceLocalContextSchema} from '@greiva/protocol/workspace';
import {privateDatabaseSourcePreparedSchema,privateDatabaseSourceCreateRequestSchema,privateDatabaseSourceCreateResponseSchema,type PrivateDatabaseSourcePrepared} from '@greiva/protocol/private-database-source';
import type {WorkspaceSyncContext} from './workspace-session.js';
type Reply=ReturnType<typeof privateDatabaseSourceCreateResponseSchema.parse>;
export interface DatabaseSourceWriteTransport {create(wire:string,signal:AbortSignal):Promise<unknown>;}
export interface DatabaseSourceWriteStore {prepare():Promise<unknown>;acknowledge(prepared:PrivateDatabaseSourcePrepared,response:Reply):Promise<void>;}
export class DatabaseSourceWriteSessionError extends Error {
 constructor(readonly stage:'closed'|'busy'|'protocol'|'transport'|'storage'){super(`Database Source write ${stage}`);this.name='DatabaseSourceWriteSessionError';}
}
function frozen<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
type Pair=Readonly<{prepared:PrivateDatabaseSourcePrepared;response:Reply}>;
// One explicit operation, using durable prepared bytes. Unknown local ACK keeps
// the exact reply; unknown HTTP keeps the durable wire for idempotent resend.
export class DatabaseSourceWriteSyncSession {
 readonly context:WorkspaceSyncContext;private readonly controller=new AbortController();private busy=false;private pending:Pair|null=null;
 private readonly create:DatabaseSourceWriteTransport['create'];private readonly prepare:DatabaseSourceWriteStore['prepare'];private readonly acknowledge:DatabaseSourceWriteStore['acknowledge'];
 constructor(context:WorkspaceSyncContext,ports:{transport:DatabaseSourceWriteTransport;store:DatabaseSourceWriteStore}){try{this.context=frozen(workspaceLocalContextSchema.parse(context));}catch{throw new DatabaseSourceWriteSessionError('protocol');}this.create=ports.transport.create.bind(ports.transport);this.prepare=ports.store.prepare.bind(ports.store);this.acknowledge=ports.store.acknowledge.bind(ports.store);}
 get signal(){return this.controller.signal;}get retryAck(){return this.pending!==null;}
 close(){this.controller.abort();this.pending=null;}
 private check(){if(this.signal.aborted)throw new DatabaseSourceWriteSessionError('closed');}
 private parse<T>(work:()=>T):T{this.check();try{return work();}catch{throw new DatabaseSourceWriteSessionError('protocol');}}
 private async stage<T>(stage:'transport'|'storage',work:()=>Promise<T>):Promise<T>{this.check();try{const result=await work();this.check();return result;}catch{this.check();throw new DatabaseSourceWriteSessionError(stage);}}
 private async run<T>(work:()=>Promise<T>):Promise<T>{this.check();if(this.busy)throw new DatabaseSourceWriteSessionError('busy');this.busy=true;try{const result=await work();this.check();return result;}finally{this.busy=false;}}
 private async commit(pair:Pair):Promise<Reply>{this.pending=pair;await this.stage('storage',()=>this.acknowledge(pair.prepared,pair.response));this.pending=null;return pair.response;}
 send():Promise<Reply|null>{return this.run(async()=>{
  if(this.pending)throw new DatabaseSourceWriteSessionError('busy');const raw=await this.stage('storage',this.prepare);if(raw===null)return null;
  const {prepared,request}=this.parse(()=>{const prepared=privateDatabaseSourcePreparedSchema.parse(raw),request=privateDatabaseSourceCreateRequestSchema.parse(JSON.parse(prepared.wire));if(request.clientId!==this.context.clientId||request.source.workspaceId!==this.context.workspaceId)throw Error();return frozen({prepared,request});});
  const value=await this.stage('transport',()=>this.create(prepared.wire,this.signal));
  const response=this.parse(()=>{const reply=privateDatabaseSourceCreateResponseSchema.parse(value);if(reply.clientId!==this.context.clientId||reply.workspaceId!==this.context.workspaceId||reply.workspaceEpoch!==this.context.streamEpoch||reply.operationId!==prepared.operationId||reply.snapshot.version!==1||JSON.stringify(reply.snapshot.source)!==JSON.stringify(request.source))throw Error();return frozen(reply);});
  return this.commit(frozen({prepared,response}));
 });}
 retry():Promise<Reply>{return this.run(async()=>{if(!this.pending)throw new DatabaseSourceWriteSessionError('protocol');return this.commit(this.pending);});}
}
