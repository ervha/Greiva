import {idSchema} from '@greiva/shared';
import {workspaceLocalContextSchema} from '@greiva/protocol/workspace';
import {privateDatabaseSourceReadRequestSchema,privateDatabaseSourceReadResponseSchema,privateDatabaseSourceCatalogRequestSchema,privateDatabaseSourceCatalogResponseSchema} from '@greiva/protocol/private-database-source';
import type {WorkspaceSyncContext} from './workspace-session.js';
type ReadRequest=ReturnType<typeof privateDatabaseSourceReadRequestSchema.parse>;
type ReadResponse=ReturnType<typeof privateDatabaseSourceReadResponseSchema.parse>;
type CatalogRequest=ReturnType<typeof privateDatabaseSourceCatalogRequestSchema.parse>;
type CatalogResponse=ReturnType<typeof privateDatabaseSourceCatalogResponseSchema.parse>;
export interface DatabaseSourceTransport{read(sourceId:string,request:ReadRequest,signal:AbortSignal):Promise<unknown>;catalog(request:CatalogRequest,signal:AbortSignal):Promise<unknown>;}
export interface DatabaseSourceStore{receive(sourceId:string,request:ReadRequest,response:ReadResponse):Promise<void>;}
export class DatabaseSourceSessionError extends Error {constructor(readonly stage:'closed'|'busy'|'protocol'|'transport'|'storage'){super(`Database Source sync ${stage}`);this.name='DatabaseSourceSessionError';}}
function frozen<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
type Pair=Readonly<{sourceId:string;request:ReadRequest;response:ReadResponse}>;
// A bounded catalog observation does not receive definitions or settle a queue.
// Unknown local read commit keeps the exact pair until retry or closure.
export class DatabaseSourceSyncSession{
 readonly context:WorkspaceSyncContext;private readonly controller=new AbortController();private busy=false;private pending:Pair|null=null;
 private readonly readTransport:DatabaseSourceTransport['read'];private readonly catalogTransport:DatabaseSourceTransport['catalog'];private readonly receive:DatabaseSourceStore['receive'];
 constructor(context:WorkspaceSyncContext,ports:{transport:DatabaseSourceTransport;store:DatabaseSourceStore}){try{this.context=frozen(workspaceLocalContextSchema.parse(context));}catch{throw new DatabaseSourceSessionError('protocol');}this.readTransport=ports.transport.read.bind(ports.transport);this.catalogTransport=ports.transport.catalog.bind(ports.transport);this.receive=ports.store.receive.bind(ports.store);}
 get signal(){return this.controller.signal;}
 get retryReceive(){return this.pending!==null;}
 close(){this.controller.abort();this.pending=null;}
 private check(){if(this.signal.aborted)throw new DatabaseSourceSessionError('closed');}
 private parse<T>(work:()=>T):T{this.check();try{return work();}catch{throw new DatabaseSourceSessionError('protocol');}}
 private async stage<T>(stage:'transport'|'storage',work:()=>Promise<T>):Promise<T>{this.check();try{const value=await work();this.check();return value;}catch{this.check();throw new DatabaseSourceSessionError(stage);}}
 private async run<T>(work:()=>Promise<T>):Promise<T>{this.check();if(this.busy)throw new DatabaseSourceSessionError('busy');this.busy=true;try{const value=await work();this.check();return value;}finally{this.busy=false;}}
 private scope(value:{workspaceId:string;workspaceEpoch:string;clientId:string}){if(value.workspaceId!==this.context.workspaceId||value.workspaceEpoch!==this.context.streamEpoch||value.clientId!==this.context.clientId)throw Error();}
 private async commit(pair:Pair){this.pending=pair;await this.stage('storage',()=>this.receive(pair.sourceId,pair.request,pair.response));this.pending=null;return pair.response;}
 read(candidateId:string,candidate:unknown={protocolVersion:1,clientId:this.context.clientId}):Promise<ReadResponse>{return this.run(async()=>{
  if(this.pending)throw new DatabaseSourceSessionError('busy');const captured=this.parse(()=>{const sourceId=idSchema.parse(candidateId),request=privateDatabaseSourceReadRequestSchema.parse(candidate);if(sourceId!==sourceId.toLowerCase()||request.clientId!==this.context.clientId)throw Error();return frozen({sourceId,request});});
  const raw=await this.stage('transport',()=>this.readTransport(captured.sourceId,captured.request,this.signal)),response=this.parse(()=>{const value=privateDatabaseSourceReadResponseSchema.parse(raw);this.scope(value);if(value.snapshot.source.id!==captured.sourceId)throw Error();return frozen(value);});return this.commit(frozen({...captured,response}));
 });}
 catalog(candidate:unknown={protocolVersion:1,clientId:this.context.clientId,cursor:null}):Promise<CatalogResponse>{return this.run(async()=>{
  if(this.pending)throw new DatabaseSourceSessionError('busy');const request=this.parse(()=>{const value=privateDatabaseSourceCatalogRequestSchema.parse(candidate);if(value.clientId!==this.context.clientId)throw Error();return frozen(value);}),raw=await this.stage('transport',()=>this.catalogTransport(request,this.signal));
  return this.parse(()=>{const value=privateDatabaseSourceCatalogResponseSchema.parse(raw);this.scope(value);if(value.sources.length>request.limit||(request.cursor===null&&value.afterOrder!=='0')||(value.hasMore&&(BigInt(value.throughOrder)<=BigInt(value.afterOrder)||value.cursor===request.cursor)))throw Error();return frozen(value);});
 });}
 retry():Promise<ReadResponse>{return this.run(async()=>{if(!this.pending)throw new DatabaseSourceSessionError('protocol');return this.commit(this.pending);});}
}
