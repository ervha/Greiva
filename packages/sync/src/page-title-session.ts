import {idSchema} from '@greiva/shared';
import {workspaceLocalContextSchema} from '@greiva/protocol/workspace';
import {privatePageTitlePreparedSchema,privatePageRenameRequestSchema,privatePageRenameResponseSchema,privatePageMetadataReadRequestSchema,privatePageMetadataReadResponseSchema,type PrivatePageTitlePrepared,type PrivatePageRenameResponse} from '@greiva/protocol/private-page-metadata';
import type {WorkspaceSyncContext} from './workspace-session.js';

export type PageTitleContext=Readonly<WorkspaceSyncContext & {pageId:string}>;
type ReadRequest=ReturnType<typeof privatePageMetadataReadRequestSchema.parse>;
type ReadResponse=ReturnType<typeof privatePageMetadataReadResponseSchema.parse>;
export interface PageTitleTransport {
  rename(wire:string,signal:AbortSignal):Promise<unknown>;
  read(request:ReadRequest,signal:AbortSignal):Promise<unknown>;
}
export interface PageTitleStore {
  acknowledge(prepared:PrivatePageTitlePrepared,response:PrivatePageRenameResponse):Promise<void>;
  receive(request:ReadRequest,response:ReadResponse):Promise<void>;
}
export class PageTitleSessionError extends Error {
  constructor(readonly stage:'closed'|'busy'|'protocol'|'transport'|'storage'){super(`Page title sync ${stage}`);this.name='PageTitleSessionError';}
}
function frozen<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
const clone=(value:unknown):unknown=>JSON.parse(JSON.stringify(value));

// Scoped metadata queries are not a delta stream or a synchronized-state proof.
export class PageTitleSyncSession {
  readonly context:PageTitleContext;
  private readonly controller=new AbortController();
  private busy=false;
  private readonly rename:PageTitleTransport['rename'];private readonly read:PageTitleTransport['read'];
  private readonly acknowledge:PageTitleStore['acknowledge'];private readonly receive:PageTitleStore['receive'];
  constructor(context:PageTitleContext,ports:{transport:PageTitleTransport;store:PageTitleStore}){
    try{const {pageId,...workspace}=context;this.context=Object.freeze({...workspaceLocalContextSchema.parse(workspace),pageId:idSchema.parse(pageId)});}catch{throw new PageTitleSessionError('protocol');}
    this.rename=ports.transport.rename.bind(ports.transport);this.read=ports.transport.read.bind(ports.transport);
    this.acknowledge=ports.store.acknowledge.bind(ports.store);this.receive=ports.store.receive.bind(ports.store);
  }
  get signal(){return this.controller.signal;}
  close(){this.controller.abort();}
  private check(){if(this.signal.aborted)throw new PageTitleSessionError('closed');}
  private protocol<T>(work:()=>T):T{this.check();try{return work();}catch{throw new PageTitleSessionError('protocol');}}
  private async stage<T>(stage:'transport'|'storage',work:()=>Promise<T>):Promise<T>{this.check();try{const value=await work();this.check();return value;}catch{this.check();throw new PageTitleSessionError(stage);}}
  private async run<T>(work:()=>Promise<T>):Promise<T>{this.check();if(this.busy)throw new PageTitleSessionError('busy');this.busy=true;try{const value=await work();this.check();return value;}finally{this.busy=false;}}
  private binding(value:{workspaceId:string;workspaceEpoch:string;pageId:string}){if(value.workspaceId!==this.context.workspaceId||value.workspaceEpoch!==this.context.streamEpoch||value.pageId!==this.context.pageId)throw Error();}
  async push(candidate:unknown){return this.run(async()=>{
    const {prepared,request}=this.protocol(()=>{const prepared=frozen(privatePageTitlePreparedSchema.parse(clone(candidate))),request=privatePageRenameRequestSchema.parse(JSON.parse(prepared.wire));if(prepared.pageId!==this.context.pageId||request.clientId!==this.context.clientId||request.operationId!==prepared.operationId)throw Error();return{prepared,request};});
    const value=await this.stage('transport',()=>this.rename(prepared.wire,this.signal));
    const response=this.protocol(()=>{const response=privatePageRenameResponseSchema.parse(clone(value));this.binding(response);if(response.operationId!==prepared.operationId)throw Error();
      if(response.result.status==='applied'&&response.version<request.baseVersion)throw Error();
      if(response.result.status==='conflict'&&(request.resolution!==undefined||response.result.conflict.baseVersion!==request.baseVersion||response.result.conflict.local!==request.title))throw Error();
      if(response.result.status==='rejected'&&response.result.code!=='base_unknown'&&request.resolution===undefined)throw Error();return frozen(response);});
    // Native store additionally checks observed baseTitle and atomic queue order.
    await this.stage('storage',()=>this.acknowledge(prepared,response));return response;
  });}
  async pull(candidate:unknown){return this.run(async()=>{
    const request=this.protocol(()=>{const request=privatePageMetadataReadRequestSchema.parse(clone(candidate));if(request.clientId!==this.context.clientId)throw Error();return frozen(request);});
    const value=await this.stage('transport',()=>this.read(request,this.signal));
    const response=this.protocol(()=>{const response=privatePageMetadataReadResponseSchema.parse(clone(value));this.binding(response);if(response.conflicts.length>request.limit||response.conflicts.some(conflict=>request.afterConflict!==null&&conflict.id<=request.afterConflict))throw Error();return frozen(response);});
    await this.stage('storage',()=>this.receive(request,response));return response;
  });}
}
