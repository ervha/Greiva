import {idSchema} from '@greiva/shared';
import {privatePagePreparedSchema,privatePageBootstrapRequestSchema,privatePageAppendRequestSchema,privatePageReadRequestSchema,privatePageBootstrapResponseSchema,privatePageAppendResponseSchema,privatePageReadResponseSchema,type PrivatePagePrepared,type PrivatePageReadRequest,type PrivatePageBootstrapResponse,type PrivatePageAppendResponse,type PrivatePageReadResponse} from '@greiva/protocol/private-page';
import {pageUpdateBytes,pageVectorBytes,pageDigest} from './page-binary.js';
import type {WorkspaceSyncContext} from './workspace-session.js';
export type PageSyncContext=Readonly<WorkspaceSyncContext & {pageId:string;documentName:string;editorSchemaVersion:1}>;
export type PageReceipt=PrivatePageBootstrapResponse|PrivatePageAppendResponse;
export interface PageSessionTransport {
  push(kind:PrivatePagePrepared['kind'],wire:string,signal:AbortSignal):Promise<unknown>;
  read(request:PrivatePageReadRequest,signal:AbortSignal):Promise<unknown>;
}
export interface PageSessionStore {
  acknowledge(context:PageSyncContext,prepared:PrivatePagePrepared,response:PageReceipt):Promise<void>;
  // Commit bytes before applying them to a live Y.Doc/Editor. The store port is
  // captured at construction; never select a current screen/store after await.
  receive(context:PageSyncContext,request:PrivatePageReadRequest,response:PrivatePageReadResponse,update:Uint8Array):Promise<void>;
}
export class PageSessionError extends Error {
  constructor(readonly stage:'closed'|'busy'|'protocol'|'transport'|'storage'){super(`Page sync ${stage}`);this.name='PageSessionError';}
}
function freeze<T>(value:T):T {if(value && typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
const clone=(value:unknown)=>JSON.parse(JSON.stringify(value)) as unknown;
// This diagnostic HTTP session never reopens; final Hocuspocus routing and
// native UI composition/selection remain separate integration gates.
export class PageSyncSession {
  readonly context:PageSyncContext;
  private readonly controller=new AbortController();
  private closed=false;private busy=false;
  private readonly send:PageSessionTransport['push'];private readonly read:PageSessionTransport['read'];
  private readonly acknowledge:PageSessionStore['acknowledge'];private readonly receive:PageSessionStore['receive'];
  constructor(context:PageSyncContext,ports:{transport:PageSessionTransport;store:PageSessionStore}){
    try{if(!context.issuer.trim() || !context.subjectId.trim() || context.editorSchemaVersion!==1)throw Error();const pageId=idSchema.parse(context.pageId);if(context.documentName!==`page:${pageId}`)throw Error();this.context=Object.freeze({issuer:context.issuer,subjectId:context.subjectId,workspaceId:idSchema.parse(context.workspaceId),clientId:idSchema.parse(context.clientId),streamEpoch:idSchema.parse(context.streamEpoch),pageId,documentName:context.documentName,editorSchemaVersion:1});}catch{throw new PageSessionError('protocol');}
    this.send=ports.transport.push.bind(ports.transport);this.read=ports.transport.read.bind(ports.transport);this.acknowledge=ports.store.acknowledge.bind(ports.store);this.receive=ports.store.receive.bind(ports.store);
  }
  get signal():AbortSignal {return this.controller.signal;}
  close(){this.closed=true;this.controller.abort();}
  private check(){if(this.closed)throw new PageSessionError('closed');}
  private async run(work:()=>Promise<void>){this.check();if(this.busy)throw new PageSessionError('busy');this.busy=true;try{await work();this.check();}finally{this.busy=false;}}
  private async protocol<T>(work:()=>T|Promise<T>):Promise<T>{try{const result=await work();this.check();return result;}catch{this.check();throw new PageSessionError('protocol');}}
  private async network(work:()=>Promise<unknown>){this.check();try{const value=await work();this.check();return value;}catch{this.check();throw new PageSessionError('transport');}}
  private async stored(work:()=>Promise<void>){this.check();try{await work();this.check();}catch{this.check();throw new PageSessionError('storage');}}
  private binding(value:{workspaceId:string;pageId:string;documentName:string;editorSchemaVersion:1}){if(value.workspaceId!==this.context.workspaceId || value.pageId!==this.context.pageId || value.documentName!==this.context.documentName || value.editorSchemaVersion!==this.context.editorSchemaVersion)throw Error();}
  async push(candidate:unknown):Promise<void>{await this.run(async()=>{
    const {prepared,request}=await this.protocol(async()=>{
      const prepared=freeze(privatePagePreparedSchema.parse(candidate));if(prepared.pageId!==this.context.pageId)throw Error();
      const request=freeze((prepared.kind==='bootstrap'?privatePageBootstrapRequestSchema:privatePageAppendRequestSchema).parse(JSON.parse(prepared.wire)));if(request.clientId!==this.context.clientId || request.editorSchemaVersion!==this.context.editorSchemaVersion)throw Error();
      const bytes=pageUpdateBytes('initialUpdate' in request?request.initialUpdate:request.update);if(await pageDigest(bytes)!==prepared.digest)throw Error();return{prepared,request};
    });
    const candidateResponse=await this.network(()=>this.send(prepared.kind,prepared.wire,this.controller.signal));
    const response=await this.protocol(()=>{
      const response=freeze((prepared.kind==='bootstrap'?privatePageBootstrapResponseSchema:privatePageAppendResponseSchema).parse(clone(candidateResponse)));this.binding(response);
      if('initialDigest' in response){if(response.initialDigest!==prepared.digest || !('title' in request) || response.metadata.title!==request.title)throw Error();}
      else{if(response.digest!==prepared.digest)throw Error();pageVectorBytes(response.stateVector);}return response;
    });
    await this.stored(()=>this.acknowledge(this.context,prepared,response));
  });}
  async pull(candidate:unknown):Promise<void>{await this.run(async()=>{
    const request=await this.protocol(()=>{const request=freeze(privatePageReadRequestSchema.parse(candidate));if(request.clientId!==this.context.clientId || request.editorSchemaVersion!==this.context.editorSchemaVersion)throw Error();pageVectorBytes(request.stateVector);return request;});
    const candidateResponse=await this.network(()=>this.read(request,this.controller.signal));
    const {response,update}=await this.protocol(async()=>{
      const response=freeze(privatePageReadResponseSchema.parse(clone(candidateResponse)));this.binding(response);pageVectorBytes(response.stateVector);const update=pageUpdateBytes(response.update);if(await pageDigest(update)!==response.digest)throw Error();return{response,update};
    });
    await this.stored(()=>this.receive(this.context,request,response,update));
  });}
}
