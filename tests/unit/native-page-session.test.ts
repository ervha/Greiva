import {it,expect,vi} from 'vitest';import * as Y from 'yjs';
import {NativeSessionPort} from '../../apps/client/src/auth/native-session-port.js';
import {NativePageSession} from '../../apps/client/src/editor/native-page-session.js';
const pageId='01900000-0000-7000-8000-000000000004';
const context={issuer:'https://fixture.invalid/auth/v1',subjectId:'owner-A',workspaceId:'01900000-0000-7000-8000-000000000001',clientId:'01900000-0000-7000-8000-000000000002',streamEpoch:'01900000-0000-7000-8000-000000000003'};
function add(doc:Y.Doc,text:string){doc.transact(()=>{const p=new Y.XmlElement('paragraph'),t=new Y.XmlText();t.insert(0,text);p.insert(0,[t]);const body=doc.getXmlFragment('body');body.insert(body.length,[p]);});}
async function fixture(){
 const pages=new Map<string,{title:string;updates:number[][]}>(),acked=new Map<string,number>();let handle=0,hold=false,holdSend=false,badLoad=false,fail=false,unknown=false,createUnknown=false,titleFail:string|null=null,release!:()=>void,entered!:()=>void;let waiting:Promise<void>|undefined;const sendResults:string[]=[],readResults:string[]=[],remote:number[][]=[];let readHold=false;
 const calls:{command:string;args?:Record<string,unknown>}[]=[];
 const invoke=vi.fn(async(command:string,args?:Record<string,unknown>)=>{
  calls.push({command,...(args?{args}: {})});if(command==='native_auth_login')return{available:true,phase:'verified',expiresAt:Math.floor(Date.now()/1000)+300};if(command==='native_workspace_open')return{handle:`handle-${++handle}`,context};
  if(command==='native_page_send'){if(holdSend){holdSend=false;entered();await new Promise<void>(done=>{release=done;});}const id=args!.pageId as string,count=acked.get(id)??0;const status=sendResults.shift()??(count<pages.get(id)!.updates.length?'acked':'idle');if(status==='acked')acked.set(id,count+1);return{status};}
  if(command==='native_page_read'){if(readHold){readHold=false;entered();await new Promise<void>(done=>{release=done;});}const status=readResults.shift()??'received';if(status==='received'){const page=pages.get(args!.pageId as string)!;for(const bytes of remote)if(!page.updates.some(old=>JSON.stringify(old)===JSON.stringify(bytes)))page.updates.push(bytes.slice());}return{status};}
  if(command!=='native_workspace_execute')return null;const request=args!.request as {command:string;pageId:string;title?:string;update?:number[];intent?:{title:string}};
  if(request.command==='page_create'){pages.set(request.pageId,{title:request.title!,updates:[request.update!.slice()]});if(createUnknown)throw Error('private commit response');return null;}
  const page=pages.get(request.pageId)!;
  if(request.command==='page_load'&&badLoad)throw Error('fixture unavailable');
  if(request.command==='page_load')return{page:{metadata:{id:request.pageId,title:page.title,yDocId:`page:${request.pageId}`,createdAt:'2026-10-13T00:00:00.000Z',updatedAt:'2026-10-13T00:00:00.000Z'},updates:page.updates.map(bytes=>bytes.slice())},serverHead:null,pending:page.updates.filter(bytes=>!remote.some(r=>JSON.stringify(r)===JSON.stringify(bytes))).length-(acked.get(request.pageId)??0)};
  if(request.command==='page_append'){
   if(hold){hold=false;entered();await new Promise<void>(done=>{release=done;});}
   if(!fail || unknown)page.updates.push(request.update!.slice());if(fail || unknown)throw Error('private disk credential path');return null;
  }
  if(request.command==='title_enqueue'){if(titleFail)throw Error(titleFail);page.title=request.intent?.title??'';return null;}
  throw Error('unexpected command');
 });
 const port=new NativeSessionPort(invoke);await port.login('fixture@example.invalid','fixture-password');await port.open(context.clientId);
 return{port,pages,calls,sendResults,readResults,remote,holdRead(){readHold=true;waiting=new Promise(done=>{entered=done;});},failLoad(value=true){badLoad=value;},holdSend(){holdSend=true;waiting=new Promise(done=>{entered=done;});},hold(){hold=true;waiting=new Promise(done=>{entered=done;});},wait:()=>waiting!,release:()=>release(),fail(value=true){fail=value;},unknown(value=true){unknown=value;},createUnknown(value=true){createUnknown=value;},failTitle(reason='private disk credential path'){titleFail=reason;},succeedTitle(){titleFail=null;}};
}
function replay(updates:number[][]){const doc=new Y.Doc({gc:false});for(const bytes of updates)Y.applyUpdate(doc,Uint8Array.from(bytes));return doc;
}
it('NATIVE-PAGE: ordered immutable Yjs appends replay to exact body/vector and pending remains explicit',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});f.hold();add(s.document,'alpha');await f.wait();add(s.document,'beta');expect(s.snapshot.saving).toBe(2);expect(s.snapshot.unsaved).toBe(2);f.release();await s.durable();
 const persisted=replay(f.pages.get(pageId)!.updates);expect(persisted.getXmlFragment('body').toString()).toBe(s.document.getXmlFragment('body').toString());expect(Array.from(Y.encodeStateVector(persisted))).toEqual(Array.from(Y.encodeStateVector(s.document)));expect(s.snapshot).toMatchObject({saving:0,unsaved:0,pending:3});persisted.destroy();expect(await s.close()).toBeNull();f.port.dispose();
});
it('NATIVE-PAGE: switched handle never receives queued old update; explicit same-scope draft recovery merges only missing content',async()=>{
 const f=await fixture(),old=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});f.hold();add(old.document,'committed-before-response');await f.wait();add(old.document,'held-draft');await f.port.open(context.clientId);f.release();await expect(old.durable()).rejects.toMatchObject({stage:'closed'});
 const appends=f.calls.filter(call=>(call.args?.request as {command?:string}|undefined)?.command==='page_append');expect(appends).toHaveLength(1);expect(appends[0]?.args?.handle).toBe('handle-1');const draft=await old.close();expect(draft).not.toBeNull();
 const next=await NativePageSession.open(f.port,pageId);await next.restoreDraft(draft!);expect(next.document.getXmlFragment('body').toString()).toContain('held-draft');expect(f.pages.get(pageId)!.updates).toHaveLength(3);expect(next.snapshot.unsaved).toBe(0);await next.close();f.port.dispose();
});
it('NATIVE-PAGE: failed/unknown commit keeps draft, stops automatic retries and can recover without duplicating committed Yjs',async()=>{
 for(const unknown of [false,true]){
  const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});if(unknown)f.unknown();else f.fail();add(s.document,'first retained');await expect(s.durable()).rejects.toMatchObject({stage:'storage',message:'Native Page storage'});add(s.document,'second retained');expect(s.snapshot.unsaved).toBe(2);
  expect(f.calls.filter(c=>(c.args?.request as {command?:string}|undefined)?.command==='page_append')).toHaveLength(1);const draft=await s.close();f.unknown(false);f.fail(false);await f.port.open(context.clientId);const next=await NativePageSession.open(f.port,pageId);await next.restoreDraft(draft!);
  const persisted=replay(f.pages.get(pageId)!.updates);expect(persisted.getXmlFragment('body').toString()).toBe(next.document.getXmlFragment('body').toString());expect(persisted.getXmlFragment('body').toString()).toContain('second retained');persisted.destroy();await next.close();f.port.dispose();
 }
});
it('NATIVE-PAGE: foreign workspace draft refuses before writing, malformed Yjs/load rejects before editor activation',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});const count=f.calls.length;
 await expect(s.restoreDraft({context:{...context,subjectId:'foreign'},pageId,title:'foreign',update:new Uint8Array([0,0])})).rejects.toMatchObject({stage:'protocol'});expect(f.calls).toHaveLength(count);await s.close();f.pages.get(pageId)!.updates=[[255]];await expect(NativePageSession.open(f.port,pageId)).rejects.toMatchObject({stage:'protocol'});f.port.dispose();
});
it('NATIVE-PAGE: composition prevents destruction; already admitted updates settle before normal close',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});s.setComposing(true);add(s.document,'変換確定');await expect(s.close()).rejects.toMatchObject({stage:'busy'});expect(s.snapshot.phase).toBe('ready');expect(s.document.getXmlFragment('body').toString()).toContain('変換確定');s.setComposing(false);const closing=s.close();expect(s.close()).toBe(closing);expect(await closing).toBeNull();expect(s.snapshot.phase).toBe('closed');f.port.dispose();
});
it('NATIVE-PAGE: uncertain create is not automatically repeated; explicit local reopen uses retained Page',async()=>{
 const f=await fixture();f.createUnknown();await expect(NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'})).rejects.toMatchObject({stage:'storage'});expect(f.calls.filter(c=>(c.args?.request as {command?:string}|undefined)?.command==='page_create')).toHaveLength(1);const s=await NativePageSession.open(f.port,pageId);expect(s.snapshot.title).toBe('synthetic');await s.close();f.port.dispose();
});

it('NATIVE-PAGE-SEND: explicit bounded send keeps local editing durable during HTTP and rereads pending without replacing Doc',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});const original=s.document;f.holdSend();const sending=s.send();await f.wait();expect(s.snapshot).toMatchObject({sending:true,pendingFresh:false});add(s.document,'saved while HTTP waits');await s.durable();expect(f.pages.get(pageId)!.updates).toHaveLength(2);f.release();await sending;
 expect(s.document).toBe(original);expect(s.document.getXmlFragment('body').toString()).toContain('saved while HTTP waits');expect(s.snapshot).toMatchObject({sending:false,sendStatus:'acked',pending:1,pendingFresh:true});await s.send();expect(s.snapshot.pending).toBe(0);await s.close();f.port.dispose();
});
it('NATIVE-PAGE-SEND: unknown transport or known receipt stops the batch with no automatic retry',async()=>{
 for(const status of ['send_unknown','ack_pending']){const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});add(s.document,'retained');await s.durable();f.sendResults.push(status);await s.send();expect(s.snapshot).toMatchObject({sendStatus:status,pending:2,pendingFresh:true,storageError:null});expect(f.calls.filter(call=>call.command==='native_page_send')).toHaveLength(1);await s.send();expect(s.snapshot.pending).toBe(0);await s.close();f.port.dispose();}
});
it('NATIVE-PAGE-SEND: composition refuses before IPC and a late send cannot adopt another handle',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});s.setComposing(true);await expect(s.send()).rejects.toMatchObject({stage:'busy'});expect(f.calls.filter(call=>call.command==='native_page_send')).toHaveLength(0);s.setComposing(false);f.holdSend();const sending=s.send();await f.wait();await f.port.open(context.clientId);f.release();await sending;expect(s.snapshot).toMatchObject({sendStatus:'send_unknown',pendingFresh:false});expect(f.calls.filter(call=>call.command==='native_page_send').map(call=>call.args?.handle)).toEqual(['handle-1']);await s.close();f.port.dispose();
});

it('NATIVE-PAGE-SEND: one explicit action sends at most 32 frames and preserves remaining pending',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});for(let i=0;i<40;i++)add(s.document,`frame ${i}`);await s.durable();await s.send();expect(s.snapshot).toMatchObject({sendStatus:'acked',pending:9,pendingFresh:true});expect(f.calls.filter(call=>call.command==='native_page_send')).toHaveLength(32);await s.send();expect(s.snapshot.pending).toBe(0);await s.close();f.port.dispose();
});
it('NATIVE-PAGE-SEND: failed local recheck retains known ACK and marks its pending count unconfirmed',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});f.failLoad();await s.send();expect(s.snapshot).toMatchObject({sendStatus:'acked',pendingFresh:false,sending:false,storageError:null});await s.close();f.port.dispose();
});

it('NATIVE-PAGE-READ: durable journal merges into the same Doc with local edits and no remote append echo',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});add(s.document,'local pending');await s.durable();const peer=replay(f.pages.get(pageId)!.updates);add(peer,'remote persisted');f.remote.push(Array.from(Y.encodeStateAsUpdate(peer)));const before=f.calls.filter(c=>(c.args?.request as {command?:string}|undefined)?.command==='page_append').length,original=s.document;await s.read();expect(s.document).toBe(original);expect(s.snapshot).toMatchObject({readStatus:'received',readError:null,remoteWaiting:false,reading:false,pending:2});expect(s.document.getXmlFragment('body').toString()).toContain('local pending');expect(s.document.getXmlFragment('body').toString()).toContain('remote persisted');expect(Array.from(Y.encodeStateVector(s.document))).toEqual(Array.from(Y.encodeStateVector(peer)));expect(f.calls.filter(c=>(c.args?.request as {command?:string}|undefined)?.command==='page_append')).toHaveLength(before);await s.read();expect(s.document.getXmlFragment('body').toString().split('remote persisted')).toHaveLength(2);peer.destroy();await s.close();f.port.dispose();
});
it('NATIVE-PAGE-READ: a held read delivers during composition but applies only after confirmation',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});const peer=replay(f.pages.get(pageId)!.updates);add(peer,'remote waiting');f.remote.push(Array.from(Y.encodeStateAsUpdate(peer)));f.holdRead();const reading=s.read();await f.wait();s.setComposing(true);add(s.document,'composition local');await s.durable();f.release();await reading;expect(s.snapshot).toMatchObject({readStatus:'received',remoteWaiting:true,reading:false});expect(s.document.getXmlFragment('body').toString()).not.toContain('remote waiting');const writes=f.calls.filter(c=>(c.args?.request as {command?:string}|undefined)?.command==='page_append').length;await expect(s.close()).rejects.toMatchObject({stage:'busy'});s.setComposing(false);expect(s.snapshot.remoteWaiting).toBe(false);expect(s.document.getXmlFragment('body').toString()).toContain('remote waiting');expect(s.document.getXmlFragment('body').toString()).toContain('composition local');expect(f.calls.filter(c=>(c.args?.request as {command?:string}|undefined)?.command==='page_append')).toHaveLength(writes);peer.destroy();await s.close();f.port.dispose();
});
it('NATIVE-PAGE-READ: unknown read or unconfirmed native store never merges or automatically retries',async()=>{
 for(const status of ['read_unknown','store_pending']){const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});const peer=replay(f.pages.get(pageId)!.updates);add(peer,'remote candidate');f.remote.push(Array.from(Y.encodeStateAsUpdate(peer)));f.readResults.push(status);await s.read();expect(s.snapshot).toMatchObject({readStatus:status,readError:null,remoteWaiting:false});expect(s.document.getXmlFragment('body').toString()).not.toContain('remote candidate');expect(f.calls.filter(c=>c.command==='native_page_read')).toHaveLength(1);await s.read();expect(s.document.getXmlFragment('body').toString()).toContain('remote candidate');peer.destroy();await s.close();f.port.dispose();}
});
it('NATIVE-PAGE-READ: malformed late journal validates in a probe before touching live content, known receive retries display locally',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});add(s.document,'kept live');await s.durable();const vector=Array.from(Y.encodeStateVector(s.document)),peer=replay(f.pages.get(pageId)!.updates);add(peer,'must not partially apply');f.remote.push(Array.from(Y.encodeStateAsUpdate(peer)),[255]);await s.read();expect(s.snapshot).toMatchObject({readStatus:'received',readError:'protocol'});expect(Array.from(Y.encodeStateVector(s.document))).toEqual(vector);expect(s.document.getXmlFragment('body').toString()).not.toContain('must not partially apply');f.pages.get(pageId)!.updates=f.pages.get(pageId)!.updates.filter(bytes=>bytes[0]!==255);await s.read();expect(s.snapshot.readError).toBeNull();expect(s.document.getXmlFragment('body').toString()).toContain('must not partially apply');expect(f.calls.filter(c=>c.command==='native_page_read')).toHaveLength(1);peer.destroy();await s.close();f.port.dispose();
});
it('NATIVE-PAGE-READ: local load failure keeps received distinct, and closed admission discards a held result',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});f.failLoad();await s.read();expect(s.snapshot).toMatchObject({readStatus:'received',readError:'load'});f.failLoad(false);await s.read();expect(s.snapshot.readError).toBeNull();expect(f.calls.filter(c=>c.command==='native_page_read')).toHaveLength(1);f.holdRead();const reading=s.read();await f.wait();await f.port.cancel();f.release();await reading;expect(s.snapshot.readStatus).toBe('read_unknown');await s.close();f.port.dispose();
});

it('NATIVE-PAGE-READ: deferred remote replay refuses a handle revoked before composition ends',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});const peer=replay(f.pages.get(pageId)!.updates);add(peer,'deferred foreign-safe');f.remote.push(Array.from(Y.encodeStateAsUpdate(peer)));f.holdRead();const reading=s.read();await f.wait();s.setComposing(true);f.release();await reading;expect(s.snapshot.remoteWaiting).toBe(true);await f.port.cancel();s.setComposing(false);expect(s.snapshot).toMatchObject({remoteWaiting:false,readError:'load'});expect(s.document.getXmlFragment('body').toString()).not.toContain('deferred foreign-safe');peer.destroy();await s.close();f.port.dispose();
});

it('NATIVE-PAGE-TITLE: valid title edit updates session title, notifies subscribers, and enqueues title_enqueue command',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});
 const observed:string[]=[];const unsubscribe=s.subscribe(state=>observed.push(state.title));
 s.setTitle('new title');expect(s.snapshot.title).toBe('new title');expect(observed).toContain('new title');
 await s.durable();
 const enqueues=f.calls.filter(c=>(c.args?.request as {command?:string}|undefined)?.command==='title_enqueue');
 expect(enqueues).toHaveLength(1);
 expect(enqueues[0]?.args?.request).toMatchObject({command:'title_enqueue',pageId,intent:{title:'new title'}});
 expect(f.pages.get(pageId)!.title).toBe('new title');
 unsubscribe();await s.close();f.port.dispose();
});

it('NATIVE-PAGE-TITLE: control characters, null bytes, and oversized titles are rejected',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});
 for(const bad of ['bad\x00title','bad\u0085title','bad\ntitle','x'.repeat(4097),'🦀'.repeat(1025)]){
  s.setTitle(bad);
  expect(s.snapshot.title).toBe('synthetic');
 }
 await s.durable();
 expect(f.calls.filter(c=>(c.args?.request as {command?:string}|undefined)?.command==='title_enqueue')).toHaveLength(0);
 await s.close();f.port.dispose();
});

it('NATIVE-PAGE-TITLE: title change is captured in draft and restored across sessions',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});
 s.setTitle('draft modified title');
 const draft=s.draft();
 expect(draft).not.toBeNull();
 expect(draft!.title).toBe('draft modified title');
 await s.close();
 const next=await NativePageSession.open(f.port,pageId);
 await next.restoreDraft(draft!);
 expect(next.snapshot.title).toBe('draft modified title');
 await next.close();f.port.dispose();
});

it('NATIVE-PAGE-TITLE: pre-bootstrap title enqueue failure is retained in draft and retried on send ack',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});
 f.failTitle('Page bootstrap receipt required');
 s.setTitle('retained title');
 expect(s.snapshot.title).toBe('retained title');
 await s.durable();
 expect(s.snapshot.storageError).toBeNull();
 const draft=s.draft();
 expect(draft).not.toBeNull();
 expect(draft!.title).toBe('retained title');
 f.succeedTitle();
 await s.send();
 await s.durable();
 expect(f.pages.get(pageId)!.title).toBe('retained title');
 await s.close();f.port.dispose();
});

it('NATIVE-PAGE-TITLE: genuine storage failure in title_enqueue sets storageError and rejects durable',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});
 await s.send();
 f.failTitle('private disk credential path');
 s.setTitle('failing title');
 await expect(s.durable()).rejects.toMatchObject({stage:'storage'});
 expect(s.snapshot.storageError).toBe('storage');
 await s.close().catch(()=>{});f.port.dispose();
});

it('NATIVE-PAGE-TITLE: newer title edit during read is preserved and not overwritten by stale page_load',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});
 const peer=replay(f.pages.get(pageId)!.updates);add(peer,'remote update');
 f.remote.push(Array.from(Y.encodeStateAsUpdate(peer)));
 f.pages.get(pageId)!.title='stale remote title';
 f.holdRead();
 const reading=s.read();
 await f.wait();
 s.setTitle('local newer title');
 f.release();
 await reading;
 expect(s.snapshot.title).toBe('local newer title');
 peer.destroy();await s.close();f.port.dispose();
});

it('NATIVE-PAGE-TITLE: setComposing updates session isComposing and prevents teardown',async()=>{
 const f=await fixture(),s=await NativePageSession.open(f.port,pageId,{kind:'create',title:'synthetic'});
 s.setComposing(true);
 expect(s.isComposing).toBe(true);
 expect(s.snapshot.composing).toBe(true);
 await expect(s.close()).rejects.toMatchObject({stage:'busy'});
 s.setComposing(false);
 expect(s.isComposing).toBe(false);
 expect(s.snapshot.composing).toBe(false);
 await s.close();f.port.dispose();
});
