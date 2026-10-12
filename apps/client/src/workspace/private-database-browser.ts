import {DatabaseSourceSessionError,type DatabaseSourceSyncSession,type PrivateWorkspaceConnection} from '@greiva/sync';
import type {PrivateDatabaseSourceSnapshot} from '@greiva/protocol/private-database-source';
import {privateDatabaseSourceCatalogResponseSchema} from '@greiva/protocol/private-database-source';
import {privateDatabaseRecordLocalLoadSchema} from '@greiva/protocol/private-database-record';
import {privateDatabaseViewLocalListSchema,privateDatabaseViewLocalLoadSchema} from '@greiva/protocol/private-database-view';
import {NativeWorkspaceStore,NativeWorkspaceError} from './native-workspace-store.js';
import {PrivateDatabaseChangesSession,PrivateDatabaseChangesError,type PrivateDatabaseChangesState} from './private-database-changes-session.js';

type RecordRow=ReturnType<typeof privateDatabaseRecordLocalLoadSchema.parse>;
type ViewHeaders=ReturnType<typeof privateDatabaseViewLocalListSchema.parse>['views'];
type ViewData=ReturnType<typeof privateDatabaseViewLocalLoadSchema.parse>;
type Catalog=ReturnType<typeof privateDatabaseSourceCatalogResponseSchema.parse>;
export class PrivateDatabaseBrowserError extends Error{
 constructor(readonly stage:'closed'|'busy'|'protocol'|'storage'|'transport'){super(`Private database browser ${stage}`);this.name='PrivateDatabaseBrowserError';}
}
export type PrivateDatabaseBrowserState=Readonly<{
 phase:'opening'|'ready'|'closed';busy:boolean;error:'protocol'|'storage'|'transport'|null;
 sources:readonly PrivateDatabaseSourceSnapshot[];sourceAfter:string|null;sourceFresh:boolean;
 catalog:Catalog|null;catalogFresh:boolean;retrySource:boolean;
 selected:PrivateDatabaseSourceSnapshot|null;records:readonly RecordRow[];recordAfter:string|null;recordFresh:boolean;
 views:readonly ViewHeaders[number][];viewAfter:string|null;view:ViewData|null;viewFresh:boolean;
 changes:PrivateDatabaseChangesState|null;selectionLocked:boolean;
}>;
const empty=()=>({sources:Object.freeze([]) as readonly PrivateDatabaseSourceSnapshot[],sourceAfter:null as string|null,sourceFresh:false,catalog:null as Catalog|null,catalogFresh:false,selected:null as PrivateDatabaseSourceSnapshot|null,records:Object.freeze([]) as readonly RecordRow[],recordAfter:null as string|null,recordFresh:false,views:Object.freeze([]) as readonly ViewHeaders[number][],viewAfter:null as string|null,view:null as ViewData|null,viewFresh:false});
// Confirmed cache only. Native read/receive never acknowledges an outgoing edit.
// Replace, rather than accumulate, each bounded window; load large rows serially.
export class PrivateDatabaseBrowser{
 private phase:PrivateDatabaseBrowserState['phase']='opening';private busy=false;private error:PrivateDatabaseBrowserState['error']=null;private data=empty();
 private changes:PrivateDatabaseChangesSession|null=null;private detachChanges=()=>{};
 private readonly lease:AbortSignal;private readonly detach:()=>void;
 private listeners=new Set<(state:PrivateDatabaseBrowserState)=>void>();private tail:Promise<void>=Promise.resolve();private closing:Promise<void>|null=null;
 private constructor(private readonly connection:PrivateWorkspaceConnection,private readonly store:NativeWorkspaceStore,private readonly reader:DatabaseSourceSyncSession){
  store.assertConnection(connection);const lease=connection.generationSignal;if(!lease||lease.aborted||reader.signal.aborted)throw new PrivateDatabaseBrowserError('closed');this.lease=lease;
  const invalidated=()=>{void this.close();};lease.addEventListener('abort',invalidated,{once:true});reader.signal.addEventListener('abort',invalidated,{once:true});this.detach=()=>{lease.removeEventListener('abort',invalidated);reader.signal.removeEventListener('abort',invalidated);};
 }
 static async open(connection:PrivateWorkspaceConnection,store:NativeWorkspaceStore){
  let reader:DatabaseSourceSyncSession|undefined,browser:PrivateDatabaseBrowser|undefined;
  try{store.assertConnection(connection);reader=store.databaseSources();browser=new PrivateDatabaseBrowser(connection,store,reader);await browser.readSources(null);browser.check();browser.phase='ready';return browser;}
  catch(error){if(browser)await browser.close();else reader?.close();throw new PrivateDatabaseBrowserError(error instanceof NativeWorkspaceError?(error.stage==='configuration'?'protocol':error.stage):error instanceof PrivateDatabaseBrowserError?error.stage:'protocol');}
 }
 get snapshot():PrivateDatabaseBrowserState{return Object.freeze({phase:this.phase,busy:this.busy,error:this.error,...this.data,changes:this.changes?.snapshot??null,retrySource:this.reader.retryReceive,selectionLocked:this.reader.retryReceive||Boolean(this.changes?.snapshot.retryReceive)});}
 subscribe(listener:(state:PrivateDatabaseBrowserState)=>void){if(this.phase==='closed')return()=>{};this.listeners.add(listener);try{listener(this.snapshot);}catch{}return()=>{this.listeners.delete(listener);};}
 private publish(){for(const listener of this.listeners)try{listener(this.snapshot);}catch{/* observers cannot interrupt persistence */}}
 private check(){if(this.phase==='closed'||this.lease.aborted||this.reader.signal.aborted)throw new PrivateDatabaseBrowserError('closed');try{this.store.assertConnection(this.connection);}catch{throw new PrivateDatabaseBrowserError('closed');}}
 private failure(error:unknown){if(this.phase==='closed'||this.lease.aborted||this.reader.signal.aborted)return new PrivateDatabaseBrowserError('closed');if(error instanceof PrivateDatabaseBrowserError||error instanceof DatabaseSourceSessionError||error instanceof PrivateDatabaseChangesError)return new PrivateDatabaseBrowserError(error.stage);if(error instanceof NativeWorkspaceError)return new PrivateDatabaseBrowserError(error.stage==='configuration'?'protocol':error.stage);return new PrivateDatabaseBrowserError('protocol');}
 private run(work:()=>Promise<void>,retry=false){
  this.check();if(this.phase!=='ready'||this.busy||(!retry&&this.snapshot.selectionLocked))throw new PrivateDatabaseBrowserError('busy');this.busy=true;this.error=null;
  const result=Promise.resolve().then(async()=>{try{this.check();await work();this.check();}catch(error){const failure=this.failure(error);if(failure.stage==='closed')void this.close();else this.error=failure.stage==='busy'?'protocol':failure.stage;throw failure;}finally{this.busy=false;this.publish();}});this.tail=result.catch(()=>{});this.publish();return result;
 }
 private async readSources(after:string|null){this.data={...this.data,sourceFresh:false};const result=await this.store.databaseSourceList({after,limit:5});this.check();this.data={...this.data,sources:result.sources,sourceAfter:result.nextAfter,sourceFresh:true};}
 async reloadSources(more=false){const after=more?this.data.sourceAfter:null;if(more&&after===null)return Promise.resolve();return this.run(()=>this.readSources(after));}
 async catalog(more=false){const cursor=more?this.data.catalog?.cursor??null:null;if(more&&cursor===null)return Promise.resolve();return this.run(async()=>{this.data={...this.data,catalogFresh:false};const catalog=await this.reader.catalog({protocolVersion:1,clientId:this.store.context.clientId,cursor,limit:10});this.check();this.data={...this.data,catalog,catalogFresh:true};});}
 async receiveSource(id:string){return this.run(async()=>{if(!this.data.catalog?.sources.some(row=>row.id===id))throw new PrivateDatabaseBrowserError('protocol');await this.reader.read(id);this.check();await this.readSources(null);await this.select(id);});}
 async retrySource(){return this.run(async()=>{if(!this.reader.retryReceive)throw new PrivateDatabaseBrowserError('protocol');const reply=await this.reader.retry();this.check();await this.readSources(null);await this.select(reply.snapshot.source.id);},true);}
 async selectSource(id:string){return this.run(async()=>{if(!this.data.sources.some(row=>row.source.id===id)&&this.data.selected?.source.id!==id)throw new PrivateDatabaseBrowserError('protocol');await this.select(id);});}
 async openSavedSource(id:string){return this.run(()=>this.select(id));}
 private async select(id:string){
  const loaded=await this.store.databaseSourceLoad(id);this.check();if(!loaded.snapshot)throw new PrivateDatabaseBrowserError('protocol');
  this.detachChanges();this.detachChanges=()=>{};const previous=this.changes;this.changes=null;await previous?.close();this.check();
  this.data={...this.data,selected:loaded.snapshot,records:Object.freeze([]),recordAfter:null,recordFresh:false,views:Object.freeze([]),viewAfter:null,view:null,viewFresh:false};this.publish();
  const changes=await PrivateDatabaseChangesSession.open(this.connection,this.store,id);if(this.phase==='closed'){await changes.close();throw new PrivateDatabaseBrowserError('closed');}this.check();this.changes=changes;this.detachChanges=changes.subscribe(()=>this.publish());
  await this.readRecords(null);await this.readViews(null);
 }
 private source(){const selected=this.data.selected;if(!selected)throw new PrivateDatabaseBrowserError('protocol');return selected.source.id;}
 private async readRecords(after:string|null){
  const sourceId=this.source();this.data={...this.data,recordFresh:false};
  const headers=await this.store.databaseRecordList(sourceId,{after,limit:20});this.check();
  const records:RecordRow[]=[];let bytes=0,next=headers.nextAfter;
  for(const header of headers.records){
   const row=await this.store.databaseRecordLoad(sourceId,header.id,{afterConflict:null,limit:1});this.check();if(!row.record||row.record.pageId!==header.pageId||row.record.version<header.version)throw new PrivateDatabaseBrowserError('protocol');
   const size=new TextEncoder().encode(JSON.stringify(row)).byteLength;
   if(records.length&&bytes+size>32*1024*1024){next=records.at(-1)!.record!.id;break;}
   bytes+=size;records.push(row);
  }
  this.data={...this.data,records:Object.freeze(records),recordAfter:next,recordFresh:true};
 }
 async reloadRecords(more=false){const after=more?this.data.recordAfter:null;if(more&&after===null)return Promise.resolve();return this.run(()=>this.readRecords(after));}
 private async readViews(after:string|null){this.data={...this.data,viewFresh:false};const result=await this.store.databaseViewList(this.source(),{after,limit:10});this.check();this.data={...this.data,views:result.views,viewAfter:result.nextAfter};if(this.data.view?.snapshot)await this.readView(this.data.view.snapshot.view.id);else this.data={...this.data,viewFresh:true};}
 async reloadViews(more=false){const after=more?this.data.viewAfter:null;if(more&&after===null)return Promise.resolve();return this.run(()=>this.readViews(after));}
 private async readView(id:string){this.data={...this.data,viewFresh:false};const view=await this.store.databaseViewLoad(this.source(),id,{afterConflict:null,limit:1});this.check();if(!view.snapshot)throw new PrivateDatabaseBrowserError('protocol');this.data={...this.data,view,viewFresh:true};}
 async openSavedView(id:string){return this.run(()=>this.readView(id));}
 async selectView(id:string|null){return this.run(async()=>{if(id===null){this.data={...this.data,view:null,viewFresh:true};return;}if(!this.data.views.some(row=>row.id===id)&&this.data.view?.snapshot?.view.id!==id)throw new PrivateDatabaseBrowserError('protocol');await this.readView(id);});}
 async sync(retry=false){return this.run(async()=>{if(!this.changes)throw new PrivateDatabaseBrowserError('protocol');if(retry)await this.changes.retryReceive();else await this.changes.sync();this.check();await this.readRecords(null);await this.readViews(null);},retry);}
 close(){if(this.closing)return this.closing;this.phase='closed';this.busy=false;this.error=null;this.data=empty();this.detach();this.reader.close();this.detachChanges();const changes=this.changes;this.changes=null;const work=changes?.close();this.publish();this.closing=this.tail.then(async()=>{await work;this.listeners.clear();});return this.closing;}
}
