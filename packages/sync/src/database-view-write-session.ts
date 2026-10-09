import {workspaceLocalContextSchema} from '@greiva/protocol/workspace';
import {privateDatabaseViewPreparedSchema,privateDatabaseViewBlockedSchema,privateDatabaseViewQueueSchema,privateDatabaseViewWriteRequestSchema,privateDatabaseViewWriteResponseSchema} from '@greiva/protocol/private-database-view';
import type {WorkspaceSyncContext} from './workspace-session.js';
type Prepared=ReturnType<typeof privateDatabaseViewPreparedSchema.parse>;
type Reply=ReturnType<typeof privateDatabaseViewWriteResponseSchema.parse>;
export interface DatabaseViewWriteTransport {write(sourceId:string,wire:string,signal:AbortSignal):Promise<unknown>;}
export interface DatabaseViewWriteStore {prepare():Promise<unknown>;queue(request:{after:string|null;limit:1;pendingOnly:false}):Promise<unknown>;acknowledge(prepared:Prepared,response:Reply):Promise<void>;}
export class DatabaseViewWriteSessionError extends Error {constructor(readonly stage:'closed'|'busy'|'protocol'|'transport'|'storage'){super(`Database View write ${stage}`);this.name='DatabaseViewWriteSessionError';}}
function frozen<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
function same(a:unknown,b:unknown):boolean{if(a===b)return true;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,index)=>same(value,b[index]));if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const left=a as Record<string,unknown>,right=b as Record<string,unknown>;return Object.keys(left).length===Object.keys(right).length&&Object.keys(left).every(key=>Object.hasOwn(right,key)&&same(left[key],right[key]));}
type Pair=Readonly<{prepared:Prepared;response:Reply}>;
// The checked native row supplies the original Source/base/candidate. Validation
// against an original reply never installs a replacement or invented baseline.
export class DatabaseViewWriteSyncSession {
 readonly context:WorkspaceSyncContext;private readonly controller=new AbortController();private busy=false;private pending:Pair|null=null;
 private readonly write:DatabaseViewWriteTransport['write'];private readonly prepare:DatabaseViewWriteStore['prepare'];private readonly queue:DatabaseViewWriteStore['queue'];private readonly acknowledge:DatabaseViewWriteStore['acknowledge'];
 constructor(context:WorkspaceSyncContext,ports:{transport:DatabaseViewWriteTransport;store:DatabaseViewWriteStore}){try{this.context=frozen(workspaceLocalContextSchema.parse(context));}catch{throw new DatabaseViewWriteSessionError('protocol');}this.write=ports.transport.write.bind(ports.transport);this.prepare=ports.store.prepare.bind(ports.store);this.queue=ports.store.queue.bind(ports.store);this.acknowledge=ports.store.acknowledge.bind(ports.store);}
 get signal(){return this.controller.signal;}get retryAck(){return this.pending!==null;}
 close(){this.controller.abort();this.pending=null;}
 private check(){if(this.signal.aborted)throw new DatabaseViewWriteSessionError('closed');}
 private parse<T>(work:()=>T):T{this.check();try{return work();}catch{throw new DatabaseViewWriteSessionError('protocol');}}
 private async stage<T>(stage:'transport'|'storage',work:()=>Promise<T>):Promise<T>{this.check();try{const result=await work();this.check();return result;}catch{this.check();throw new DatabaseViewWriteSessionError(stage);}}
 private async run<T>(work:()=>Promise<T>):Promise<T>{this.check();if(this.busy)throw new DatabaseViewWriteSessionError('busy');this.busy=true;try{const result=await work();this.check();return result;}finally{this.busy=false;}}
 private async commit(pair:Pair):Promise<Reply>{this.pending=pair;await this.stage('storage',()=>this.acknowledge(pair.prepared,pair.response));this.pending=null;return pair.response;}
 send(){return this.run(async()=>{
  if(this.pending)throw new DatabaseViewWriteSessionError('busy');const raw=await this.stage('storage',()=>this.prepare());if(raw===null)return null;
  if(raw&&typeof raw==='object'&&'status' in raw)return this.parse(()=>frozen(privateDatabaseViewBlockedSchema.parse(raw)));
  const {prepared,request}=this.parse(()=>{const prepared=privateDatabaseViewPreparedSchema.parse(raw),request=privateDatabaseViewWriteRequestSchema.parse(JSON.parse(prepared.wire));if(request.clientId!==this.context.clientId)throw Error();return frozen({prepared,request});});
  const after=BigInt(prepared.sequence)===1n?null:(BigInt(prepared.sequence)-1n).toString(),rawQueue=await this.stage('storage',()=>this.queue({after,limit:1,pendingOnly:false}));
  const capture=this.parse(()=>{const value=privateDatabaseViewQueueSchema.parse(rawQueue),row=value.operations[0];if(!same(value.context,this.context)||value.operations.length!==1||!row||row.sequence!==prepared.sequence||row.intent.operationId!==prepared.operationId||row.wire!==prepared.wire||row.response!==null||!same(row.intent.intent,request.intent))throw Error();return frozen({context:value.context,pending:value.pending,row});});
  const rawReply=await this.stage('transport',()=>this.write(prepared.sourceId,prepared.wire,this.signal)),response=this.parse(()=>{const response=privateDatabaseViewWriteResponseSchema.parse(rawReply);if(response.result.status==='conflict'&&new Set(response.result.conflicts.map(value=>value.field)).size!==response.result.conflicts.length)throw Error();privateDatabaseViewQueueSchema.parse({context:capture.context,pending:capture.pending,operations:[{...capture.row,response}],nextAfter:null});return frozen(response);});
  return this.commit(frozen({prepared,response}));
 });}
 retry():Promise<Reply>{return this.run(async()=>{if(!this.pending)throw new DatabaseViewWriteSessionError('protocol');return this.commit(this.pending);});}
}
