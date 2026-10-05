import {idSchema} from '@greiva/shared';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {workspaceLocalHandleSchema,workspaceLocalContextSchema,type WorkspacePushRequest,type WorkspacePullResponse,verifyWorkspacePushResponse} from '@greiva/protocol/workspace';
import {privatePageLocalLoadSchema,privatePagePreparedSchema,privatePageBootstrapRequestSchema,privatePageAppendRequestSchema,type PrivatePagePrepared,type PrivatePageReadRequest,type PrivatePageReadResponse} from '@greiva/protocol/private-page';
import {pageBase64,pageUpdateBytes,type PrivateWorkspaceConnection,type WorkspaceSyncContext,type WorkspaceSessionStore,type PageSessionStore,type PageSyncContext,type PageReceipt} from '@greiva/sync';
export type NativeWorkspaceInvoke=(command:string,args?:Record<string,unknown>)=>Promise<unknown>;
export class NativeWorkspaceError extends Error {
  constructor(readonly stage:'configuration'|'closed'|'protocol'|'storage'){super(`Native workspace ${stage}`);this.name='NativeWorkspaceError';}
}
function same(one:WorkspaceSyncContext,two:WorkspaceSyncContext){return Object.entries(one).every(([key,value])=>two[key as keyof WorkspaceSyncContext]===value);}
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
