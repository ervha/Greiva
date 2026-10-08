import {workspaceLocalContextSchema,structuredOrderSchema} from '@greiva/protocol/workspace';
import {privatePageChangesRequestSchema,privatePageChangesResponseSchema,type PrivatePageChangesRequest,type PrivatePageChangesResponse} from '@greiva/protocol/private-page-changes';
import type {WorkspaceSyncContext} from './workspace-session.js';

export interface PageChangesTransport {pull(request:PrivatePageChangesRequest,signal:AbortSignal):Promise<unknown>;}
export interface PageChangesStore {receive(request:PrivatePageChangesRequest,response:PrivatePageChangesResponse):Promise<void>;}
export class PageChangesSessionError extends Error {
  constructor(readonly stage:'closed'|'busy'|'protocol'|'transport'|'storage'){super(`Page changes sync ${stage}`);this.name='PageChangesSessionError';}
}
function frozen<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))frozen(child);Object.freeze(value);}return value;}
const clone=(value:unknown):unknown=>JSON.parse(JSON.stringify(value));

// Each pull is one bounded observation. A failed admitted local commit retains
// the exact pair; no newer network reply can replace its unknown result.
export class PageChangesSyncSession {
  readonly context:WorkspaceSyncContext;
  private readonly controller=new AbortController();private busy=false;
  private pending:Readonly<{request:PrivatePageChangesRequest;response:PrivatePageChangesResponse}>|null=null;
  private readonly pullTransport:PageChangesTransport['pull'];private readonly receive:PageChangesStore['receive'];
  constructor(context:WorkspaceSyncContext,ports:{transport:PageChangesTransport;store:PageChangesStore}){
    try{this.context=frozen(workspaceLocalContextSchema.parse(clone(context)));}catch{throw new PageChangesSessionError('protocol');}
    this.pullTransport=ports.transport.pull.bind(ports.transport);this.receive=ports.store.receive.bind(ports.store);
  }
  get signal(){return this.controller.signal;}
  get retryReceive(){return this.pending!==null;}
  close(){this.controller.abort();this.pending=null;}
  private check(){if(this.signal.aborted)throw new PageChangesSessionError('closed');}
  private protocol<T>(work:()=>T):T{this.check();try{return work();}catch{throw new PageChangesSessionError('protocol');}}
  private async stage<T>(stage:'transport'|'storage',work:()=>Promise<T>):Promise<T>{this.check();try{const value=await work();this.check();return value;}catch{this.check();throw new PageChangesSessionError(stage);}}
  private async run<T>(work:()=>Promise<T>):Promise<T>{this.check();if(this.busy)throw new PageChangesSessionError('busy');this.busy=true;try{const value=await work();this.check();return value;}finally{this.busy=false;}}
  private async commit(pair:NonNullable<PageChangesSyncSession['pending']>){
    this.pending=pair;await this.stage('storage',()=>this.receive(pair.request,pair.response));this.pending=null;return pair.response;
  }
  async pull(candidate:unknown,candidateAfter:unknown){return this.run(async()=>{
    if(this.pending)throw new PageChangesSessionError('busy');
    const {request,after}=this.protocol(()=>{const request=frozen(privatePageChangesRequestSchema.parse(clone(candidate))),after=structuredOrderSchema.parse(candidateAfter);if(request.clientId!==this.context.clientId||(request.cursor===null&&after!=='0'))throw Error();return{request,after};});
    const value=await this.stage('transport',()=>this.pullTransport(request,this.signal));
    const response=this.protocol(()=>{const reply=privatePageChangesResponseSchema.parse(clone(value));if(reply.workspaceId!==this.context.workspaceId||reply.workspaceEpoch!==this.context.streamEpoch||reply.afterOrder!==after||reply.events.length>request.limit||(reply.readOrder!==after&&reply.cursor===request.cursor))throw Error();return frozen(reply);});
    return this.commit(Object.freeze({request,response}));
  });}
  async retry(){return this.run(async()=>{if(!this.pending)throw new PageChangesSessionError('protocol');return this.commit(this.pending);});}
}
