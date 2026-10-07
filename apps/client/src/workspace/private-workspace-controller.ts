import { newId, idSchema } from '@greiva/shared';
import type { PrivatePageCatalogResponse, PrivateLocalPageCatalogResponse } from '@greiva/protocol/private-page-catalog';
import { PrivateConnectionError, type PrivateWorkspaceConnection } from '@greiva/sync';
import { NativeWorkspaceStore, NativeWorkspaceError, type NativeWorkspaceInvoke } from './native-workspace-store.js';
import { PrivatePageEditorSession, PrivatePageEditorError } from '../editor/private-page-session.js';

type Failure='storage'|'transport'|'protocol'|null;
export type PrivateWorkspaceState=Readonly<{
  phase:'closed'|'opening'|'ready'|'error';busy:boolean;
  localPages:readonly PrivateLocalPageCatalogResponse['pages'][number][];localAfter:string|null;
  remotePages:readonly PrivatePageCatalogResponse['pages'][number][];remoteCursor:string|null;remoteStatus:'unloaded'|'ready'|'error';
  selectedPageId:string|null;error:Failure;navigationBlocked:boolean;retryCreate:boolean;
}>;
const empty=():Omit<PrivateWorkspaceState,'navigationBlocked'|'retryCreate'>=>({phase:'closed',busy:false,localPages:Object.freeze([]),localAfter:null,remotePages:Object.freeze([]),remoteCursor:null,remoteStatus:'unloaded',selectedPageId:null,error:null});

// One composition owns one native store/editor. Serialize cleanup and opening:
// a slow old workspace_open must finish/close before the next owner opens.
export class PrivateWorkspaceController {
  private revision=0;private disposed=false;private tail:Promise<void>=Promise.resolve();
  private connection:PrivateWorkspaceConnection|null=null;private store:NativeWorkspaceStore|null=null;
  private page:PrivatePageEditorSession|null=null;private detachPage=()=>{};private detachLease=()=>{};
  private creation:{id:string;title:string}|null=null;private listeners=new Set<(state:PrivateWorkspaceState)=>void>();
  private state=empty();
  constructor(private readonly invokePort?:NativeWorkspaceInvoke){}
  get editor(){return this.state.phase==='ready'?this.page:null;}
  get snapshot():PrivateWorkspaceState{return Object.freeze({...this.state,navigationBlocked:this.state.phase==='ready'&&Boolean(this.page?.snapshot.storageError||this.page?.isComposing),retryCreate:this.creation!==null});}
  subscribe(listener:(state:PrivateWorkspaceState)=>void){if(this.disposed)return()=>{};this.listeners.add(listener);listener(this.snapshot);return()=>{this.listeners.delete(listener);};}
  private publish(){if(!this.disposed)for(const listener of this.listeners){try{listener(this.snapshot);}catch{/* observer cannot interrupt cleanup/commit */}}}
  private patch(value:Partial<typeof this.state>){this.state={...this.state,...value};this.publish();}
  private livePending(pages:PrivateWorkspaceState['localPages']){
    const page=this.page;
    return Object.freeze(pages.map(entry=>page?.snapshot.phase==='ready'&&entry.metadata.id===page.pageId?Object.freeze({...entry,pending:page.snapshot.pending}):entry));
  }
  private current(revision:number){return !this.disposed&&revision===this.revision;}
  private check(revision:number){if(!this.current(revision)||!this.connection?.context)throw new NativeWorkspaceError('closed');this.store?.assertActive();}
  private category(error:unknown):Exclude<Failure,null>{
    if(error instanceof NativeWorkspaceError)return error.stage==='protocol'||error.stage==='configuration'?'protocol':'storage';
    if(error instanceof PrivatePageEditorError)return error.stage==='transport'?'transport':error.stage==='protocol'?'protocol':'storage';
    if(error instanceof PrivateConnectionError)return error.stage==='transport'?'transport':'protocol';
    return 'protocol';
  }
  private enqueue(revision:number,work:()=>Promise<void>){
    const result=this.tail.then(async()=>{if(!this.current(revision))return;try{await work();}catch(error){if(this.current(revision))this.patch({error:this.category(error),...(this.state.phase==='opening'?{phase:'error' as const}:{})});}finally{if(this.current(revision))this.patch({busy:false});}});
    this.tail=result.catch(()=>{});return result;
  }
  private async release(){
    this.detachLease();this.detachLease=()=>{};this.detachPage();this.detachPage=()=>{};
    const page=this.page,store=this.store;this.page=null;this.store=null;this.connection=null;this.creation=null;
    try{await page?.close();}finally{await store?.close();}
  }
  connect(connection:PrivateWorkspaceConnection){
    if(this.disposed)return Promise.resolve();const revision=++this.revision;
    this.detachLease();this.detachLease=()=>{};
    this.state={...empty(),phase:'opening',busy:true};this.publish();
    return this.enqueue(revision,async()=>{
      await this.release();if(!this.current(revision))return;
      this.connection=connection;const lease=connection.generationSignal;if(!lease||lease.aborted)throw new NativeWorkspaceError('closed');
      const invalidated=()=>{if(this.connection===connection)void this.close();};lease.addEventListener('abort',invalidated,{once:true});this.detachLease=()=>lease.removeEventListener('abort',invalidated);
      const store=await NativeWorkspaceStore.open(connection,this.invokePort);
      if(!this.current(revision)){await store.close();return;}this.store=store;this.check(revision);
      const local=await store.listPages();this.check(revision);this.patch({phase:'ready',localPages:local.pages,localAfter:local.nextAfter});
    });
  }
  close(){
    this.detachLease();this.detachLease=()=>{};
    ++this.revision;this.state=empty();this.publish();
    const work=this.tail.then(()=>this.release());this.tail=work.catch(()=>{});return work.catch(()=>{if(!this.disposed&&this.state.phase==='closed')this.patch({error:'storage'});});
  }
  async dispose(){if(this.disposed)return;this.disposed=true;this.listeners.clear();await this.close();}
  private begin(){if(this.disposed||this.state.phase!=='ready'||this.state.busy)return null;this.patch({busy:true,error:null});return this.revision;}
  loadLocal(more=false){
    const revision=this.begin();if(revision===null)return Promise.resolve();const store=this.store!,after=more?this.state.localAfter:null;
    return this.enqueue(revision,async()=>{if(more&&after===null)return;const result=await store.listPages({after,limit:50});this.check(revision);this.patch({localPages:this.livePending(more?[...this.state.localPages,...result.pages]:result.pages),localAfter:result.nextAfter});});
  }
  loadRemote(more=false){
    const revision=this.begin();if(revision===null)return Promise.resolve();const connection=this.connection!,cursor=more?this.state.remoteCursor:null;
    return this.enqueue(revision,async()=>{if(more&&cursor===null)return;try{
      const result=await connection.queryPages({protocolVersion:1,clientId:connection.context!.clientId,cursor,limit:50});this.check(revision);
      if(more&&result.pages.some(page=>page.id<=(this.state.remotePages.at(-1)?.id??'')))throw new NativeWorkspaceError('protocol');
      this.patch({remotePages:more?Object.freeze([...this.state.remotePages,...result.pages]):result.pages,remoteCursor:result.nextCursor,remoteStatus:'ready'});
    }catch(error){if(this.current(revision))this.patch({remoteStatus:'error'});throw error;}});
  }
  private async replacePage(revision:number,connection:PrivateWorkspaceConnection,store:NativeWorkspaceStore,id:string,source:Parameters<typeof PrivatePageEditorSession.open>[3]){
    // Page navigation waits for admitted durable writes. Never switch while a
    // composition or an unsaved storage-failure draft still needs copying.
    const previous=this.page;await previous?.durable();this.check(revision);
    this.detachPage();this.detachPage=()=>{};this.page=null;this.patch({selectedPageId:null});await previous?.close();this.check(revision);
    const page=await PrivatePageEditorSession.open(connection,store,id,source);
    if(!this.current(revision)){await page.close();return;}this.check(revision);this.page=page;
    this.detachPage=page.subscribe(()=>{if(this.page===page&&this.current(revision))this.patch({localPages:this.livePending(this.state.localPages)});});this.patch({selectedPageId:id});
  }
  openPage(candidate:string){
    if(this.snapshot.navigationBlocked)return Promise.resolve();
    if(this.page?.pageId===candidate&&this.page.snapshot.phase==='ready')return Promise.resolve();
    if(!idSchema.safeParse(candidate).success||![...this.state.localPages.map(page=>page.metadata.id),...this.state.remotePages.map(page=>page.id)].includes(candidate)){this.patch({error:'protocol'});return Promise.resolve();}
    const revision=this.begin();if(revision===null)return Promise.resolve();const connection=this.connection!,store=this.store!;
    return this.enqueue(revision,async()=>{const exists=await store.hasPage(candidate);this.check(revision);await this.replacePage(revision,connection,store,candidate,{kind:exists?'local':'remote'});});
  }
  createPage(title:string){
    if(this.snapshot.navigationBlocked)return Promise.resolve();
    if(title.length>65536||(this.creation&&this.creation.title!==title)){this.patch({error:'protocol'});return Promise.resolve();}
    const revision=this.begin();if(revision===null)return Promise.resolve();const connection=this.connection!,store=this.store!;
    this.creation??={id:newId(),title};const intent=this.creation;
    return this.enqueue(revision,async()=>{
      await this.replacePage(revision,connection,store,intent.id,{kind:'create',title:intent.title});this.check(revision);this.creation=null;
      const local=await store.listPages();this.check(revision);this.patch({localPages:this.livePending(local.pages),localAfter:local.nextAfter});
    });
  }
}
