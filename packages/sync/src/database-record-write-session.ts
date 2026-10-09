import {workspaceLocalContextSchema} from '@greiva/protocol/workspace';
import {privateDatabaseRecordCreatePreparedSchema,privateDatabaseRecordCreateBlockedSchema,privateDatabaseRecordUpdatePreparedSchema,privateDatabaseRecordCreateQueueSchema,privateDatabaseRecordUpdateQueueSchema,privateDatabaseRecordWriteRequestSchema,privateDatabaseRecordWriteResponseSchema} from '@greiva/protocol/private-database-record';
import {parseDatabaseRecord,parseDatabaseRecordConflict,type DatabaseSource,type DatabaseRecord,type DatabaseRecordConflict} from '@greiva/domain';
import type {WorkspaceSyncContext} from './workspace-session.js';
export type DatabaseRecordWriteKind='create'|'update';
type Prepared=ReturnType<typeof privateDatabaseRecordCreatePreparedSchema.parse>;
type Reply=ReturnType<typeof privateDatabaseRecordWriteResponseSchema.parse>;
export interface DatabaseRecordWriteTransport {write(sourceId:string,wire:string,signal:AbortSignal):Promise<unknown>;}
export interface DatabaseRecordWriteStore {prepare(kind:DatabaseRecordWriteKind):Promise<unknown>;queue(kind:DatabaseRecordWriteKind,request:{after:string|null;limit:1;pendingOnly:false}):Promise<unknown>;acknowledge(kind:DatabaseRecordWriteKind,prepared:Prepared,response:Reply):Promise<void>;}
export class DatabaseRecordWriteSessionError extends Error {constructor(readonly stage:'closed'|'busy'|'protocol'|'transport'|'storage'){super(`Database Record write ${stage}`);this.name='DatabaseRecordWriteSessionError';}}
function frozen<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
function sameRecordValue(one:unknown,two:unknown):boolean{if(one===two)return true;if(!one||!two||typeof one!=='object'||typeof two!=='object'||Array.isArray(one)!==Array.isArray(two))return false;const a=one as Record<string,unknown>,b=two as Record<string,unknown>,keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>Object.hasOwn(b,key)&&sameRecordValue(a[key],b[key]));}
const same=sameRecordValue;
type Capture={source:DatabaseSource;base:DatabaseRecord|null;candidate:DatabaseRecordConflict|null};
type Pair=Readonly<{kind:DatabaseRecordWriteKind;prepared:Prepared;response:Reply}>;
const field=(record:DatabaseRecord,key:string)=>({present:Object.hasOwn(record.values,key),value:record.values[key]??null});
function validateReply(context:WorkspaceSyncContext,prepared:Prepared,request:ReturnType<typeof privateDatabaseRecordWriteRequestSchema.parse>,capture:Capture,raw:unknown):Reply{
 const reply=privateDatabaseRecordWriteResponseSchema.parse(raw),intent=request.intent,source=capture.source;
 if(reply.workspaceId!==context.workspaceId||reply.workspaceEpoch!==context.streamEpoch||reply.clientId!==context.clientId||reply.operationId!==prepared.operationId||reply.sourceId!==source.id||reply.schemaVersion!==source.schemaVersion||reply.record.id!==prepared.recordId||reply.record.pageId!==prepared.pageId)throw Error();parseDatabaseRecord(source,reply.record);
 if(intent.kind==='create'){const keys=Object.keys(intent.values);if(reply.result.status!=='applied'||reply.record.version!==1||Object.keys(reply.record.values).length!==keys.length||keys.some(key=>!Object.hasOwn(reply.record.values,key)||reply.record.values[key]!==intent.values[key]))throw Error();}
 else{const base=capture.base;if(!base||base.version!==intent.baseVersion||reply.record.version<base.version)throw Error();const conflicts=new Set<string>();if(reply.result.status==='conflict'){if(capture.candidate)throw Error();for(const cf of reply.result.conflicts){parseDatabaseRecordConflict(source,cf);if(conflicts.has(cf.propertyId)||cf.baseVersion!==base.version||!Object.hasOwn(intent.values,cf.propertyId)||!same(cf.base,field(base,cf.propertyId))||!same(cf.local,{present:true,value:intent.values[cf.propertyId]}))throw Error();conflicts.add(cf.propertyId);}}
 if(reply.result.status!=='rejected')for(const [key,local] of Object.entries(intent.values)){const prior=field(base,key);if(!conflicts.has(key)){if(local!==prior.value&&field(reply.record,key).value!==local)throw Error();if(!capture.candidate&&local===null&&!prior.present&&!Object.hasOwn(reply.record.values,key))throw Error();}if(reply.result.status==='applied'&&reply.record.version===base.version&&(local!==prior.value||(!capture.candidate&&local===null&&!prior.present)))throw Error();}}
 return frozen(reply);
}
// Each explicit send uses a checked queue capture and original native bytes.
// A lost HTTP reply resends the durable operation. A lost local ACK result keeps
// the exact pair and retries without prepare, capture or network.
export class DatabaseRecordWriteSyncSession {
 readonly context:WorkspaceSyncContext;private readonly controller=new AbortController();private busy=false;private pending:Pair|null=null;
 private readonly write:DatabaseRecordWriteTransport['write'];private readonly prepare:DatabaseRecordWriteStore['prepare'];private readonly queue:DatabaseRecordWriteStore['queue'];private readonly acknowledge:DatabaseRecordWriteStore['acknowledge'];
 constructor(context:WorkspaceSyncContext,ports:{transport:DatabaseRecordWriteTransport;store:DatabaseRecordWriteStore}){try{this.context=frozen(workspaceLocalContextSchema.parse(context));}catch{throw new DatabaseRecordWriteSessionError('protocol');}this.write=ports.transport.write.bind(ports.transport);this.prepare=ports.store.prepare.bind(ports.store);this.queue=ports.store.queue.bind(ports.store);this.acknowledge=ports.store.acknowledge.bind(ports.store);}
 get signal(){return this.controller.signal;}get retryAck(){return this.pending!==null;}get retryKind(){return this.pending?.kind??null;}
 close(){this.controller.abort();this.pending=null;}
 private check(){if(this.signal.aborted)throw new DatabaseRecordWriteSessionError('closed');}
 private parse<T>(work:()=>T):T{this.check();try{return work();}catch{throw new DatabaseRecordWriteSessionError('protocol');}}
 private async stage<T>(stage:'transport'|'storage',work:()=>Promise<T>):Promise<T>{this.check();try{const value=await work();this.check();return value;}catch{this.check();throw new DatabaseRecordWriteSessionError(stage);}}
 private async run<T>(work:()=>Promise<T>):Promise<T>{this.check();if(this.busy)throw new DatabaseRecordWriteSessionError('busy');this.busy=true;try{const result=await work();this.check();return result;}finally{this.busy=false;}}
 private async commit(pair:Pair):Promise<Reply>{this.pending=pair;await this.stage('storage',()=>this.acknowledge(pair.kind,pair.prepared,pair.response));this.pending=null;return pair.response;}
 send(kind:DatabaseRecordWriteKind){return this.run(async()=>{
  if(this.pending)throw new DatabaseRecordWriteSessionError('busy');if(kind!=='create'&&kind!=='update')throw new DatabaseRecordWriteSessionError('protocol');const raw=await this.stage('storage',()=>this.prepare(kind));if(raw===null)return null;
  if(kind==='create'&&raw&&typeof raw==='object'&&'status' in raw)return this.parse(()=>frozen(privateDatabaseRecordCreateBlockedSchema.parse(raw)));
  const {prepared,request}=this.parse(()=>{const prepared=(kind==='create'?privateDatabaseRecordCreatePreparedSchema:privateDatabaseRecordUpdatePreparedSchema).parse(raw),request=privateDatabaseRecordWriteRequestSchema.parse(JSON.parse(prepared.wire));if(request.intent.kind!==kind||request.clientId!==this.context.clientId||new TextEncoder().encode(prepared.wire).length>8*1024*1024)throw Error();return frozen({prepared,request});});
  const after=BigInt(prepared.sequence)===1n?null:(BigInt(prepared.sequence)-1n).toString(),rawQueue=await this.stage('storage',()=>this.queue(kind,{after,limit:1,pendingOnly:false}));
  const capture=this.parse(()=>{const saved=(kind==='create'?privateDatabaseRecordCreateQueueSchema:privateDatabaseRecordUpdateQueueSchema).parse(rawQueue),row=saved.operations[0];if(!Object.entries(this.context).every(([key,value])=>saved.context[key as keyof WorkspaceSyncContext]===value)||saved.operations.length!==1||!row||row.sequence!==prepared.sequence||row.intent.operationId!==prepared.operationId||row.wire!==prepared.wire||!same(row.intent.intent,request.intent))throw Error();return frozen({source:row.intent.source,base:'base' in row?row.base:null,candidate:'candidate' in row?row.candidate:null});});
  const value=await this.stage('transport',()=>this.write(prepared.sourceId,prepared.wire,this.signal)),response=this.parse(()=>validateReply(this.context,prepared,request,capture,value));return this.commit(frozen({kind,prepared,response}));
 });}
 retry():Promise<Reply>{return this.run(async()=>{if(!this.pending)throw new DatabaseRecordWriteSessionError('protocol');return this.commit(this.pending);});}
}
