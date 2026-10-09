import {idSchema} from '@greiva/shared';
import {parseDatabaseRecord,parseDatabaseRecordConflict,parseDatabaseViewSnapshot,parseDatabaseViewConflict} from '@greiva/domain';
import {workspaceLocalContextSchema} from '@greiva/protocol/workspace';
import {privateDatabaseSourceDefinitionSchema} from '@greiva/protocol/private-database-source';
import {privateDatabaseRecordReadRequestSchema,privateDatabaseRecordReadResponseSchema} from '@greiva/protocol/private-database-record';
import {privateDatabaseViewReadRequestSchema,privateDatabaseViewReadResponseSchema} from '@greiva/protocol/private-database-view';
import {privateDatabaseRecordCatalogRequestSchema,privateDatabaseRecordCatalogResponseSchema} from '@greiva/protocol/private-database-record-catalog';
import {privateDatabaseViewCatalogRequestSchema,privateDatabaseViewCatalogResponseSchema} from '@greiva/protocol/private-database-view-catalog';
import type {WorkspaceSyncContext} from './workspace-session.js';
type RecordRequest=ReturnType<typeof privateDatabaseRecordReadRequestSchema.parse>;
type RecordResponse=ReturnType<typeof privateDatabaseRecordReadResponseSchema.parse>;
type ViewRequest=ReturnType<typeof privateDatabaseViewReadRequestSchema.parse>;
type ViewResponse=ReturnType<typeof privateDatabaseViewReadResponseSchema.parse>;
type CatalogRequest=ReturnType<typeof privateDatabaseRecordCatalogRequestSchema.parse>;
export interface DatabaseContentTransport{
 readRecord(recordId:string,request:RecordRequest,signal:AbortSignal):Promise<unknown>;
 readView(viewId:string,request:ViewRequest,signal:AbortSignal):Promise<unknown>;
 catalogRecords(request:CatalogRequest,signal:AbortSignal):Promise<unknown>;
 catalogViews(request:CatalogRequest,signal:AbortSignal):Promise<unknown>;
}
export interface DatabaseContentStore{
 receiveRecord(recordId:string,request:RecordRequest,response:RecordResponse):Promise<void>;
 receiveView(viewId:string,request:ViewRequest,response:ViewResponse):Promise<void>;
}
export class DatabaseContentSessionError extends Error{constructor(readonly stage:'closed'|'busy'|'protocol'|'transport'|'storage'){super(`Database content sync ${stage}`);this.name='DatabaseContentSessionError';}}
function frozen<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
type Pair=Readonly<{kind:'record';id:string;request:RecordRequest;response:RecordResponse}|{kind:'view';id:string;request:ViewRequest;response:ViewResponse}>;
// Captured Source definition and Auth generation; explicit observations only.
// A catalog never saves snapshots or settles an operation queue.
export class DatabaseContentSyncSession{
 readonly context:WorkspaceSyncContext;readonly source:ReturnType<typeof privateDatabaseSourceDefinitionSchema.parse>;
 private readonly controller=new AbortController();private busy=false;private pending:Pair|null=null;
 private readonly transport:DatabaseContentTransport;private readonly store:DatabaseContentStore;
 constructor(context:WorkspaceSyncContext,source:unknown,ports:{transport:DatabaseContentTransport;store:DatabaseContentStore}){
  try{this.context=frozen(workspaceLocalContextSchema.parse(context));this.source=frozen(privateDatabaseSourceDefinitionSchema.parse(source));if(this.source.workspaceId!==this.context.workspaceId)throw Error();}catch{throw new DatabaseContentSessionError('protocol');}
  this.transport=Object.freeze({readRecord:ports.transport.readRecord.bind(ports.transport),readView:ports.transport.readView.bind(ports.transport),catalogRecords:ports.transport.catalogRecords.bind(ports.transport),catalogViews:ports.transport.catalogViews.bind(ports.transport)});
  this.store=Object.freeze({receiveRecord:ports.store.receiveRecord.bind(ports.store),receiveView:ports.store.receiveView.bind(ports.store)});
 }
 get signal(){return this.controller.signal;}get retryReceive(){return this.pending!==null;}
 close(){this.controller.abort();this.pending=null;}
 private check(){if(this.signal.aborted)throw new DatabaseContentSessionError('closed');}
 private parse<T>(work:()=>T):T{this.check();try{return work();}catch{throw new DatabaseContentSessionError('protocol');}}
 private async stage<T>(stage:'transport'|'storage',work:()=>Promise<T>):Promise<T>{this.check();try{const result=await work();this.check();return result;}catch{this.check();throw new DatabaseContentSessionError(stage);}}
 private async run<T>(work:()=>Promise<T>):Promise<T>{this.check();if(this.busy)throw new DatabaseContentSessionError('busy');this.busy=true;try{const result=await work();this.check();return result;}finally{this.busy=false;}}
 private available(){if(this.pending)throw new DatabaseContentSessionError('busy');}
 private scope(v:{workspaceId:string;workspaceEpoch:string;clientId:string;sourceId:string;schemaVersion:number}){if(v.workspaceId!==this.context.workspaceId||v.workspaceEpoch!==this.context.streamEpoch||v.clientId!==this.context.clientId||v.sourceId!==this.source.id||v.schemaVersion!==this.source.schemaVersion)throw Error();}
 private target(raw:string){const id=idSchema.parse(raw);if(id!==id.toLowerCase())throw Error();return id;}
 private async commit(pair:Pair){this.pending=pair;if(pair.kind==='record')await this.stage('storage',()=>this.store.receiveRecord(pair.id,pair.request,pair.response));else await this.stage('storage',()=>this.store.receiveView(pair.id,pair.request,pair.response));this.pending=null;return pair.response;}
 readRecord(candidateId:string,candidateRequest:unknown):Promise<RecordResponse>{return this.run(async()=>{
  this.available();const captured=this.parse(()=>{const id=this.target(candidateId),request=privateDatabaseRecordReadRequestSchema.parse(candidateRequest);if(request.clientId!==this.context.clientId)throw Error();return frozen({id,request});});
  const raw=await this.stage('transport',()=>this.transport.readRecord(captured.id,captured.request,this.signal)),response=this.parse(()=>{const reply=privateDatabaseRecordReadResponseSchema.parse(raw);this.scope(reply);if(reply.record.id!==captured.id||reply.record.pageId!==captured.request.pageId||reply.conflicts.length>captured.request.limit||reply.conflicts.some(row=>captured.request.afterConflict!==null&&row.id<=captured.request.afterConflict!))throw Error();parseDatabaseRecord(this.source,reply.record);for(const conflict of reply.conflicts)parseDatabaseRecordConflict(this.source,conflict);return frozen(reply);});
  await this.commit(frozen({kind:'record',...captured,response}));return response;
 });}
 readView(candidateId:string,candidateRequest:unknown={protocolVersion:1,clientId:this.context.clientId}):Promise<ViewResponse>{return this.run(async()=>{
  this.available();const captured=this.parse(()=>{const id=this.target(candidateId),request=privateDatabaseViewReadRequestSchema.parse(candidateRequest);if(request.clientId!==this.context.clientId)throw Error();return frozen({id,request});});
  const raw=await this.stage('transport',()=>this.transport.readView(captured.id,captured.request,this.signal)),response=this.parse(()=>{const reply=privateDatabaseViewReadResponseSchema.parse(raw);this.scope(reply);if(reply.snapshot.view.id!==captured.id||reply.conflicts.length>captured.request.limit||reply.conflicts.some(row=>captured.request.afterConflict!==null&&row.id<=captured.request.afterConflict!))throw Error();parseDatabaseViewSnapshot(this.source,reply.snapshot);for(const conflict of reply.conflicts)parseDatabaseViewConflict(this.source,conflict);return frozen(reply);});
  await this.commit(frozen({kind:'view',...captured,response}));return response;
 });}
 catalogRecords(candidate:unknown={protocolVersion:1,clientId:this.context.clientId}):Promise<ReturnType<typeof privateDatabaseRecordCatalogResponseSchema.parse>>{return this.catalog('record',candidate);}
 catalogViews(candidate:unknown={protocolVersion:1,clientId:this.context.clientId}):Promise<ReturnType<typeof privateDatabaseViewCatalogResponseSchema.parse>>{return this.catalog('view',candidate);}
 private catalog(kind:'record',candidate:unknown):Promise<ReturnType<typeof privateDatabaseRecordCatalogResponseSchema.parse>>;
 private catalog(kind:'view',candidate:unknown):Promise<ReturnType<typeof privateDatabaseViewCatalogResponseSchema.parse>>;
 private catalog(kind:'record'|'view',candidate:unknown){return this.run(async()=>{
  this.available();const request=this.parse(()=>{const value=(kind==='record'?privateDatabaseRecordCatalogRequestSchema:privateDatabaseViewCatalogRequestSchema).parse(candidate);if(value.clientId!==this.context.clientId)throw Error();return frozen(value);}),raw=await this.stage('transport',()=>kind==='record'?this.transport.catalogRecords(request,this.signal):this.transport.catalogViews(request,this.signal));
  return this.parse(()=>{const value=(kind==='record'?privateDatabaseRecordCatalogResponseSchema:privateDatabaseViewCatalogResponseSchema).parse(raw);this.scope(value);const rows='records' in value?value.records:value.views;if(rows.length>request.limit||(request.cursor===null&&value.afterOrder!=='0')||(value.hasMore&&(BigInt(value.throughOrder)<=BigInt(value.afterOrder)||value.cursor===request.cursor)))throw Error();return frozen(value);});
 });}
 retry():Promise<RecordResponse|ViewResponse>{return this.run(async()=>{if(!this.pending)throw new DatabaseContentSessionError('protocol');return this.commit(this.pending);});}
}
