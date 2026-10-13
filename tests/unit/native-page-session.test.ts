import {it,expect,vi} from 'vitest';import * as Y from 'yjs';
import {NativeSessionPort} from '../../apps/client/src/auth/native-session-port.js';
import {NativePageSession} from '../../apps/client/src/editor/native-page-session.js';
const pageId='01900000-0000-7000-8000-000000000004';
const context={issuer:'https://fixture.invalid/auth/v1',subjectId:'owner-A',workspaceId:'01900000-0000-7000-8000-000000000001',clientId:'01900000-0000-7000-8000-000000000002',streamEpoch:'01900000-0000-7000-8000-000000000003'};
function add(doc:Y.Doc,text:string){doc.transact(()=>{const p=new Y.XmlElement('paragraph'),t=new Y.XmlText();t.insert(0,text);p.insert(0,[t]);const body=doc.getXmlFragment('body');body.insert(body.length,[p]);});}
async function fixture(){
 const pages=new Map<string,{title:string;updates:number[][]}>();let handle=0,hold=false,fail=false,unknown=false,createUnknown=false,release!:()=>void,entered!:()=>void;let waiting:Promise<void>|undefined;
 const calls:{command:string;args?:Record<string,unknown>}[]=[];
 const invoke=vi.fn(async(command:string,args?:Record<string,unknown>)=>{
  calls.push({command,...(args?{args}: {})});if(command==='native_auth_login')return{available:true,phase:'verified',expiresAt:Math.floor(Date.now()/1000)+300};if(command==='native_workspace_open')return{handle:`handle-${++handle}`,context};
  if(command!=='native_workspace_execute')return null;const request=args!.request as {command:string;pageId:string;title?:string;update?:number[]};
  if(request.command==='page_create'){pages.set(request.pageId,{title:request.title!,updates:[request.update!.slice()]});if(createUnknown)throw Error('private commit response');return null;}
  const page=pages.get(request.pageId)!;
  if(request.command==='page_load')return{page:{metadata:{id:request.pageId,title:page.title,yDocId:`page:${request.pageId}`,createdAt:'2026-10-13T00:00:00.000Z',updatedAt:'2026-10-13T00:00:00.000Z'},updates:page.updates.map(bytes=>bytes.slice())},serverHead:null,pending:page.updates.length};
  if(request.command==='page_append'){
   if(hold){hold=false;entered();await new Promise<void>(done=>{release=done;});}
   if(!fail || unknown)page.updates.push(request.update!.slice());if(fail || unknown)throw Error('private disk credential path');return null;
  }throw Error('unexpected command');
 });
 const port=new NativeSessionPort(invoke);await port.login('fixture@example.invalid','fixture-password');await port.open(context.clientId);
 return{port,pages,calls,hold(){hold=true;waiting=new Promise(done=>{entered=done;});},wait:()=>waiting!,release:()=>release(),fail(value=true){fail=value;},unknown(value=true){unknown=value;},createUnknown(value=true){createUnknown=value;}};
}
function replay(updates:number[][]){const doc=new Y.Doc({gc:false});for(const bytes of updates)Y.applyUpdate(doc,Uint8Array.from(bytes));return doc;}
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
