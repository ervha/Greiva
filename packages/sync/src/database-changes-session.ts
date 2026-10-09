import {workspaceLocalContextSchema} from '@greiva/protocol/workspace';
import {privateDatabaseSourceDefinitionSchema} from '@greiva/protocol/private-database-source';
import {privateDatabaseChangesRequestSchema,privateDatabaseChangesLocalProgressSchema,parsePrivateDatabaseChangesResponse,type PrivateDatabaseChangesResponse} from '@greiva/protocol/private-database-changes';
import type {WorkspaceSyncContext} from './workspace-session.js';

type Request=ReturnType<typeof privateDatabaseChangesRequestSchema.parse>;
export type DatabaseChangesProgress=ReturnType<typeof privateDatabaseChangesLocalProgressSchema.parse>;
export interface DatabaseChangesTransport {pull(request:Request,signal:AbortSignal):Promise<unknown>;}
export interface DatabaseChangesStore {load():Promise<unknown>;receive(request:Request,response:PrivateDatabaseChangesResponse):Promise<void>;}
export type DatabaseChangesObservation=Readonly<{response:PrivateDatabaseChangesResponse;progress:DatabaseChangesProgress}>;
export class DatabaseChangesSessionError extends Error {
 constructor(readonly stage:'closed'|'busy'|'protocol'|'transport'|'storage'){super(`Database changes sync ${stage}`);this.name='DatabaseChangesSessionError';}
}
function frozen<T>(value:T):T {if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
type Pair=Readonly<{request:Request;response:PrivateDatabaseChangesResponse}>;

// Explicit bounded pulls use durable progress. An unknown local result keeps
// the exact pair, even if COMMIT succeeded and only the return was lost.
export class DatabaseChangesSyncSession {
 readonly context:WorkspaceSyncContext;
 readonly source:ReturnType<typeof privateDatabaseSourceDefinitionSchema.parse>;
 private readonly controller=new AbortController();
 private busy=false;private pending:Pair|null=null;
 private readonly pullTransport:DatabaseChangesTransport['pull'];
 private readonly load:DatabaseChangesStore['load'];private readonly receive:DatabaseChangesStore['receive'];
 constructor(context:WorkspaceSyncContext,source:unknown,ports:{transport:DatabaseChangesTransport;store:DatabaseChangesStore}){
  try{this.context=frozen(workspaceLocalContextSchema.parse(context));this.source=frozen(privateDatabaseSourceDefinitionSchema.parse(source));if(this.source.workspaceId!==this.context.workspaceId)throw Error();}catch{throw new DatabaseChangesSessionError('protocol');}
  this.pullTransport=ports.transport.pull.bind(ports.transport);this.load=ports.store.load.bind(ports.store);this.receive=ports.store.receive.bind(ports.store);
 }
 get signal(){return this.controller.signal;}get retryReceive(){return this.pending!==null;}
 close(){this.controller.abort();this.pending=null;}
 private check(){if(this.signal.aborted)throw new DatabaseChangesSessionError('closed');}
 private parse<T>(work:()=>T):T {this.check();try{return work();}catch{throw new DatabaseChangesSessionError('protocol');}}
 private async stage<T>(stage:'transport'|'storage',work:()=>Promise<T>):Promise<T>{this.check();try{const value=await work();this.check();return value;}catch{this.check();throw new DatabaseChangesSessionError(stage);}}
 private async run<T>(work:()=>Promise<T>):Promise<T>{this.check();if(this.busy)throw new DatabaseChangesSessionError('busy');this.busy=true;try{const value=await work();this.check();return value;}finally{this.busy=false;}}
 private async saved():Promise<DatabaseChangesProgress>{
  const raw=await this.stage('storage',this.load);
  return this.parse(()=>{const value=privateDatabaseChangesLocalProgressSchema.parse(raw);if(Object.entries(this.context).some(([key,v])=>value.context[key as keyof WorkspaceSyncContext]!==v)||value.sourceId!==this.source.id||value.schemaVersion!==this.source.schemaVersion)throw Error();return frozen(value);});
 }
 progress():Promise<DatabaseChangesProgress>{return this.run(()=>this.saved());}
 private async commit(pair:Pair):Promise<DatabaseChangesObservation>{
  this.pending=pair;await this.stage('storage',()=>this.receive(pair.request,pair.response));
  const progress=await this.saved();
  this.parse(()=>{if(!progress.received||progress.journalEpoch!==pair.response.journalEpoch||BigInt(progress.order)<BigInt(pair.response.readOrder)||(progress.order===pair.response.readOrder&&progress.cursor!==pair.response.cursor))throw Error();});
  this.pending=null;return frozen({response:pair.response,progress});
 }
 pull(candidateLimit:unknown=50):Promise<DatabaseChangesObservation>{return this.run(async()=>{
  if(this.pending)throw new DatabaseChangesSessionError('busy');
  const limit=this.parse(()=>privateDatabaseChangesRequestSchema.parse({protocolVersion:1,clientId:this.context.clientId,limit:candidateLimit}).limit);
  const base=await this.saved(),request=frozen(privateDatabaseChangesRequestSchema.parse({protocolVersion:1,clientId:this.context.clientId,cursor:base.cursor,limit}));
  const raw=await this.stage('transport',()=>this.pullTransport(request,this.signal));
  const response=this.parse(()=>{const value=parsePrivateDatabaseChangesResponse(this.source,raw);if(value.clientId!==this.context.clientId||value.workspaceEpoch!==this.context.streamEpoch||value.afterOrder!==base.order||(base.received&&value.journalEpoch!==base.journalEpoch)||value.events.length>limit||BigInt(value.readOrder)-BigInt(value.afterOrder)>BigInt(limit)||(value.readOrder!==base.order&&value.cursor===request.cursor))throw Error();return value;});
  return this.commit(frozen({request,response}));
 });}
 retry():Promise<DatabaseChangesObservation>{return this.run(async()=>{if(!this.pending)throw new DatabaseChangesSessionError('protocol');return this.commit(this.pending);});}
}
