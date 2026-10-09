import {idSchema} from '@greiva/shared';
import {parseDatabaseRecord,parseDatabaseRecordConflict} from '@greiva/domain';
import {privateDatabaseRecordReadRequestSchema,privateDatabaseRecordReadResponseSchema,privateDatabaseRecordLocalLoadRequestSchema,privateDatabaseRecordLocalLoadSchema,privateDatabaseRecordLocalListRequestSchema,privateDatabaseRecordLocalListSchema} from '@greiva/protocol/private-database-record';
import {privateDatabaseSourceReadRequestSchema,privateDatabaseSourceReadResponseSchema,privateDatabaseSourceLocalLoadSchema,privateDatabaseSourceLocalListSchema,privateDatabaseSourceLocalListRequestSchema} from '@greiva/protocol/private-database-source';
import {NativeWorkspaceTitle} from './native-workspace-title.js';
import {parseOperationPayload,pushOperationSchema,taskSchema,relationSchema} from '@greiva/protocol';
import {workspaceStructuredSnapshotSchema} from '@greiva/protocol/workspace';
import {privateLocalPageCatalogRequestSchema,privateLocalPageCatalogResponseSchema} from '@greiva/protocol/private-page-catalog';
import {privatePageChangesLocalRequestSchema,privatePageChangesLocalResponseSchema,privatePageChangesRequestSchema,privatePageChangesResponseSchema} from '@greiva/protocol/private-page-changes';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {workspaceLocalHandleSchema,workspaceLocalContextSchema,type WorkspacePushRequest,type WorkspacePullResponse,verifyWorkspacePushResponse} from '@greiva/protocol/workspace';
import {privatePageLocalLoadSchema,privatePagePreparedSchema,privatePageBootstrapRequestSchema,privatePageAppendRequestSchema,type PrivatePagePrepared,type PrivatePageReadRequest,type PrivatePageReadResponse} from '@greiva/protocol/private-page';
import {pageBase64,pageUpdateBytes,type PrivateWorkspaceConnection,type WorkspaceSyncContext,type WorkspaceSessionStore,type PageSessionStore,type PageSyncContext,type PageReceipt} from '@greiva/sync';
export type NativeWorkspaceInvoke=(command:string,args?:Record<string,unknown>)=>Promise<unknown>;
export class NativeWorkspaceError extends Error {
  constructor(readonly stage:'configuration'|'closed'|'protocol'|'storage'){super(`Native workspace ${stage}`);this.name='NativeWorkspaceError';}
}
function same(one:WorkspaceSyncContext,two:WorkspaceSyncContext){return Object.entries(one).every(([key,value])=>two[key as keyof WorkspaceSyncContext]===value);}
function immutable<T>(value:T):T{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))immutable(child);}return value;}
// Fixed app-owned paths and local handles are repository binding, not a native
// JWT grant. This adapter requires the trusted verified connection composition;
// no Web fallback, credential disk writes or offline grant is introduced.
export class NativeWorkspaceStore implements WorkspaceSessionStore {
  readonly context:WorkspaceSyncContext;
  private closed=false;private closeWork:Promise<void>|null=null;
  private constructor(private readonly connection:PrivateWorkspaceConnection,private readonly handle:string,context:WorkspaceSyncContext,private readonly lease:AbortSignal,private readonly invokePort:NativeWorkspaceInvoke){this.context=Object.freeze({...context});lease.addEventListener('abort',this.invalidated,{once:true});}
  private invalidated=()=>{void this.close().catch(()=>{});};
  static async open(connection:PrivateWorkspaceConnection,invokePort:NativeWorkspaceInvoke=invoke):Promise<NativeWorkspaceStore>{
    if(invokePort===invoke && !isTauri())throw new NativeWorkspaceError('configuration');
    const context=connection.context,lease=connection.generationSignal;if(!context || !lease || lease.aborted)throw new NativeWorkspaceError('closed');
    const contextResult=workspaceLocalContextSchema.safeParse(context);if(!contextResult.success)throw new NativeWorkspaceError('protocol');const captured=contextResult.data;let value:unknown;
    try{value=await invokePort('workspace_open',{context:captured});}catch{throw new NativeWorkspaceError(lease.aborted?'closed':'storage');}
    const parsed=workspaceLocalHandleSchema.safeParse(value);if(!parsed.success)throw new NativeWorkspaceError('protocol');
    const close=async()=>{try{await invokePort('workspace_close',{handle:parsed.data.handle});}catch{/* do not expose private causes or adopt another handle */}};
    if(lease.aborted || connection.generationSignal!==lease || !connection.context || !same(captured,connection.context)){await close();throw new NativeWorkspaceError('closed');}
    if(!same(captured,parsed.data.context)){await close();throw new NativeWorkspaceError('protocol');}
    return new NativeWorkspaceStore(connection,parsed.data.handle,captured,lease,invokePort);
  }
  private check(context:WorkspaceSyncContext=this.context){
    if(this.closed || this.lease.aborted || this.connection.generationSignal!==this.lease || !this.connection.context)throw new NativeWorkspaceError('closed');
    if(!same(this.context,context) || !same(this.context,this.connection.context))throw new NativeWorkspaceError('protocol');
  }
  close():Promise<void>{
    if(this.closeWork)return this.closeWork;this.closed=true;this.lease.removeEventListener('abort',this.invalidated);
    const invokePort=this.invokePort;this.closeWork=Promise.resolve().then(()=>invokePort('workspace_close',{handle:this.handle})).then(()=>{},()=>{throw new NativeWorkspaceError('storage');});return this.closeWork;
  }
  private async execute(request:Record<string,unknown>):Promise<unknown>{
    this.check();const invokePort=this.invokePort;let result:unknown;
    try{const captured=JSON.parse(JSON.stringify(request)) as unknown;result=await invokePort('workspace_execute',{handle:this.handle,request:captured});}catch{this.check();throw new NativeWorkspaceError('storage');}
    this.check();return result;
  }
  async acknowledge(context:WorkspaceSyncContext,_prepared:WorkspacePushRequest,response:ReturnType<typeof verifyWorkspacePushResponse>,wire:string){this.check(context);await this.execute({command:'ack',wire,response});}
  async applyPull(context:WorkspaceSyncContext,request:unknown,response:WorkspacePullResponse){this.check(context);await this.execute({command:'pull',request,response});}
  async snapshot():Promise<unknown>{const value=await this.execute({command:'snapshot'});try{if(!value || typeof value!=='object' || !('context' in value) || !same(this.context,workspaceLocalContextSchema.parse(value.context)))throw Error();this.check();return value;}catch{this.check();throw new NativeWorkspaceError('protocol');}}
  async prepare():Promise<string|null>{const value=await this.execute({command:'prepare'});if(value!==null && typeof value!=='string')throw new NativeWorkspaceError('protocol');this.check();return value;}
  page(pageId:string):NativeWorkspacePage {
    const parsed=idSchema.safeParse(pageId);if(!parsed.success)throw new NativeWorkspaceError('protocol');this.check();return new NativeWorkspacePage(this,pageId);
  }
  assertActive(){this.check();}
  databaseSources(){this.check();return this.connection.openDatabaseSources({receive:this.databaseSourceReceive.bind(this)});}
  async databaseRecordReceive(sourceId:string,recordId:string,candidateRequest:unknown,candidateResponse:unknown):Promise<void>{
    this.check();let request:ReturnType<typeof privateDatabaseRecordReadRequestSchema.parse>,response:ReturnType<typeof privateDatabaseRecordReadResponseSchema.parse>;
    try{if(idSchema.parse(recordId)!==recordId.toLowerCase())throw Error();request=privateDatabaseRecordReadRequestSchema.parse(candidateRequest);response=privateDatabaseRecordReadResponseSchema.parse(candidateResponse);if(request.clientId!==this.context.clientId||response.clientId!==this.context.clientId||response.workspaceId!==this.context.workspaceId||response.workspaceEpoch!==this.context.streamEpoch||response.sourceId!==sourceId||response.record.id!==recordId||response.record.pageId!==request.pageId||response.conflicts.length>request.limit||response.conflicts.some(item=>request.afterConflict!==null&&item.id<=request.afterConflict!))throw Error();immutable(request);immutable(response);}catch{throw new NativeWorkspaceError('protocol');}
    const cached=await this.databaseSourceLoad(sourceId);try{if(!cached.snapshot||cached.snapshot.source.schemaVersion!==response.schemaVersion)throw Error();parseDatabaseRecord(cached.snapshot.source,response.record);for(const conflict of response.conflicts)parseDatabaseRecordConflict(cached.snapshot.source,conflict);}catch{throw new NativeWorkspaceError('protocol');}
    const result=await this.execute({command:'database_record_receive',sourceId,recordId,request,response});if(result!==null)throw new NativeWorkspaceError('protocol');this.check();
  }
  async databaseRecordLoad(sourceId:string,recordId:string,candidate:unknown={afterConflict:null,limit:20}){
    this.check();let request:ReturnType<typeof privateDatabaseRecordLocalLoadRequestSchema.parse>;try{if(idSchema.parse(recordId)!==recordId.toLowerCase())throw Error();request=privateDatabaseRecordLocalLoadRequestSchema.parse(candidate);}catch{throw new NativeWorkspaceError('protocol');}const source=await this.databaseSourceLoad(sourceId);if(!source.snapshot)throw new NativeWorkspaceError('protocol');
    const value=await this.execute({command:'database_record_load',sourceId,recordId,...request});try{const result=privateDatabaseRecordLocalLoadSchema.parse(value);if(!same(this.context,result.context)||result.sourceId!==sourceId||result.schemaVersion!==source.snapshot.source.schemaVersion||result.conflicts.length>request.limit||result.conflicts.some(row=>request.afterConflict!==null&&row.id<=request.afterConflict!))throw Error();if(result.record){if(result.record.id!==recordId)throw Error();parseDatabaseRecord(source.snapshot.source,result.record);for(const conflict of result.conflicts)parseDatabaseRecordConflict(source.snapshot.source,conflict);}this.check();return immutable(result);}catch{this.check();throw new NativeWorkspaceError('protocol');}
  }
  async databaseRecordList(sourceId:string,candidate:unknown={after:null,limit:50}){
    this.check();let request:ReturnType<typeof privateDatabaseRecordLocalListRequestSchema.parse>;try{request=privateDatabaseRecordLocalListRequestSchema.parse(candidate);}catch{throw new NativeWorkspaceError('protocol');}const source=await this.databaseSourceLoad(sourceId);if(!source.snapshot)throw new NativeWorkspaceError('protocol');
    const value=await this.execute({command:'database_record_list',sourceId,...request});try{const result=privateDatabaseRecordLocalListSchema.parse(value);if(!same(this.context,result.context)||result.sourceId!==sourceId||result.schemaVersion!==source.snapshot.source.schemaVersion||result.records.length>request.limit||result.records.some(row=>request.after!==null&&row.id<=request.after!))throw Error();this.check();return immutable(result);}catch{this.check();throw new NativeWorkspaceError('protocol');}
  }
  async databaseSourceReceive(sourceId:string,candidateRequest:unknown,candidateResponse:unknown):Promise<void>{
    this.check();let request:ReturnType<typeof privateDatabaseSourceReadRequestSchema.parse>,response:ReturnType<typeof privateDatabaseSourceReadResponseSchema.parse>;
    try{if(idSchema.parse(sourceId)!==sourceId.toLowerCase())throw Error();request=privateDatabaseSourceReadRequestSchema.parse(candidateRequest);response=privateDatabaseSourceReadResponseSchema.parse(candidateResponse);if(request.clientId!==this.context.clientId||response.clientId!==this.context.clientId||response.workspaceId!==this.context.workspaceId||response.workspaceEpoch!==this.context.streamEpoch||response.snapshot.source.id!==sourceId)throw Error();immutable(request);immutable(response);}catch{throw new NativeWorkspaceError('protocol');}
    const result=await this.execute({command:'database_source_receive',sourceId,request,response});if(result!==null)throw new NativeWorkspaceError('protocol');this.check();
  }
  async databaseSourceLoad(sourceId:string){
    this.check();try{if(idSchema.parse(sourceId)!==sourceId.toLowerCase())throw Error();}catch{throw new NativeWorkspaceError('protocol');}
    const value=await this.execute({command:'database_source_load',sourceId});try{const result=privateDatabaseSourceLocalLoadSchema.parse(value);if(!same(this.context,result.context)||(result.snapshot!==null&&result.snapshot.source.id!==sourceId))throw Error();this.check();return immutable(result);}catch{this.check();throw new NativeWorkspaceError('protocol');}
  }
  async databaseSourceList(candidate:unknown={after:null,limit:50}){
    this.check();let request:ReturnType<typeof privateDatabaseSourceLocalListRequestSchema.parse>;try{request=privateDatabaseSourceLocalListRequestSchema.parse(candidate);}catch{throw new NativeWorkspaceError('protocol');}
    const value=await this.execute({command:'database_source_list',...request});try{const result=privateDatabaseSourceLocalListSchema.parse(value);if(!same(this.context,result.context)||result.sources.length>request.limit||result.sources.some(row=>request.after!==null&&row.source.id<=request.after!))throw Error();this.check();return immutable(result);}catch{this.check();throw new NativeWorkspaceError('protocol');}
  }
  async changesLoad(candidate:unknown={afterPage:null,limit:50}){
    const parsed=privatePageChangesLocalRequestSchema.safeParse(candidate);if(!parsed.success)throw new NativeWorkspaceError('protocol');const request=parsed.data;
    const value=await this.execute({command:'changes_load',...request});try{const result=privatePageChangesLocalResponseSchema.parse(value);if(!same(this.context,result.context)||result.pages.length>request.limit||result.pages.some(row=>request.afterPage!==null&&row.metadata.id<=request.afterPage!))throw Error();this.check();return immutable(result);}catch{this.check();throw new NativeWorkspaceError('protocol');}
  }
  async changesReceive(candidateRequest:unknown,candidateResponse:unknown):Promise<void>{
    let request:ReturnType<typeof privatePageChangesRequestSchema.parse>,response:ReturnType<typeof privatePageChangesResponseSchema.parse>;
    this.check();try{request=privatePageChangesRequestSchema.parse(candidateRequest);response=privatePageChangesResponseSchema.parse(candidateResponse);if(request.clientId!==this.context.clientId||response.workspaceId!==this.context.workspaceId||response.workspaceEpoch!==this.context.streamEpoch||response.events.length>request.limit)throw Error();immutable(request);immutable(response);}catch{throw new NativeWorkspaceError('protocol');}
    await this.execute({command:'changes_receive',request,response});this.check();
  }
  async structuredSnapshot(){
    const value=await this.execute({command:'snapshot'});
    try{const result=workspaceStructuredSnapshotSchema.parse(value);if(!same(this.context,result.context)||result.snapshot.clientId!==this.context.clientId)throw Error();this.check();return immutable(result.snapshot);}
    catch{this.check();throw new NativeWorkspaceError('protocol');}
  }
  title(pageId:string):NativeWorkspaceTitle{const parsed=idSchema.safeParse(pageId);if(!parsed.success)throw new NativeWorkspaceError('protocol');this.check();return new NativeWorkspaceTitle(this,pageId);}
  async mutate(candidate:unknown):Promise<void>{
    let operation:ReturnType<typeof pushOperationSchema.parse>;
    try{operation=pushOperationSchema.parse(candidate);parseOperationPayload(operation);if(operation.clientId!==this.context.clientId)throw Error();}catch{throw new NativeWorkspaceError('protocol');}
    const value=await this.execute({command:'mutate',operation});
    try{const entity=operation.entityType==='task'?taskSchema.parse(value):relationSchema.parse(value);if(entity.id!==operation.entityId)throw Error();this.check();}
    catch{this.check();throw new NativeWorkspaceError('protocol');}
  }
  async hasPage(candidate:string):Promise<boolean>{
    const pageId=idSchema.safeParse(candidate);if(!pageId.success)throw new NativeWorkspaceError('protocol');
    const value=await this.execute({command:'page_exists',pageId:pageId.data});if(typeof value!=='boolean')throw new NativeWorkspaceError('protocol');this.check();return value;
  }
  async listPages(candidate:unknown={after:null,limit:50}) {
    const request=privateLocalPageCatalogRequestSchema.safeParse(candidate);if(!request.success)throw new NativeWorkspaceError('protocol');
    const value=await this.execute({command:'page_list',...request.data});
    try{const result=privateLocalPageCatalogResponseSchema.parse(value);if(!same(this.context,result.context) || result.pages.length>request.data.limit || result.pages.some(page=>request.data.after!==null && page.metadata.id<=request.data.after!))throw Error();
      for(const page of result.pages){Object.freeze(page.metadata);Object.freeze(page);}Object.freeze(result.pages);Object.freeze(result.context);this.check();return Object.freeze(result);
    }catch{this.check();throw new NativeWorkspaceError('protocol');}
  }
  assertConnection(connection:PrivateWorkspaceConnection){if(connection!==this.connection)throw new NativeWorkspaceError('protocol');this.check();}
  async pageCommand(pageId:string,command:string,fields:Record<string,unknown>={}):Promise<unknown>{return this.execute({...fields,command,pageId});}
}
export class NativeWorkspacePage implements PageSessionStore {
  constructor(private readonly store:NativeWorkspaceStore,readonly pageId:string){}
  private check(context:PageSyncContext){if(context.pageId!==this.pageId || context.documentName!=='page:'+this.pageId || context.editorSchemaVersion!==1 || !same(this.store.context,context))throw new NativeWorkspaceError('protocol');}
  async create(title:string,update:Uint8Array):Promise<void>{this.store.assertActive();
    const bytes=Uint8Array.from(update);try{privatePageBootstrapRequestSchema.parse({protocolVersion:1,clientId:this.store.context.clientId,editorSchemaVersion:1,title,initialUpdate:pageBase64(bytes)});pageUpdateBytes(pageBase64(bytes));}catch{throw new NativeWorkspaceError('protocol');}
    await this.store.pageCommand(this.pageId,'page_create',{title,update:Array.from(bytes)});this.store.assertActive();
  }
  async append(update:Uint8Array):Promise<void>{this.store.assertActive();
    const bytes=Uint8Array.from(update);try{privatePageAppendRequestSchema.parse({protocolVersion:1,clientId:this.store.context.clientId,editorSchemaVersion:1,update:pageBase64(bytes)});pageUpdateBytes(pageBase64(bytes));}catch{throw new NativeWorkspaceError('protocol');}
    await this.store.pageCommand(this.pageId,'page_append',{update:Array.from(bytes)});this.store.assertActive();
  }
  async load(){
    const candidate=await this.store.pageCommand(this.pageId,'page_load');try{const value=privatePageLocalLoadSchema.parse(candidate);if(value.page.metadata.id!==this.pageId || value.page.metadata.yDocId!=='page:'+this.pageId)throw Error();for(const bytes of value.page.updates)pageUpdateBytes(pageBase64(Uint8Array.from(bytes)));this.store.assertActive();return value;}catch{this.store.assertActive();throw new NativeWorkspaceError('protocol');}
  }
  async prepare():Promise<PrivatePagePrepared|null>{const value=await this.store.pageCommand(this.pageId,'page_prepare');if(value===null){this.store.assertActive();return null;}try{const prepared=privatePagePreparedSchema.parse(value);if(prepared.pageId!==this.pageId)throw Error();this.store.assertActive();return Object.freeze(prepared);}catch{this.store.assertActive();throw new NativeWorkspaceError('protocol');}}
  async acknowledge(context:PageSyncContext,prepared:PrivatePagePrepared,response:PageReceipt){this.check(context);if(prepared.pageId!==this.pageId)throw new NativeWorkspaceError('protocol');await this.store.pageCommand(this.pageId,'page_ack',{sequence:prepared.sequence,wire:prepared.wire,response});}
  async receive(context:PageSyncContext,_request:PrivatePageReadRequest,response:PrivatePageReadResponse,_update:Uint8Array){this.check(context);await this.store.pageCommand(this.pageId,'page_receive',{response});}
}
