import {it,expect,vi} from 'vitest';
import * as Y from 'yjs';
import {emptyPageUpdate} from '@greiva/sync';
import {NativeSessionPort} from '../../apps/client/src/auth/native-session-port.js';
import {NativeLoginController} from '../../apps/client/src/auth/native-login-controller.js';
const config={projectUrl:'https://fixture.invalid',publishableKey:'sb_publishable_fixture',algorithm:'ES256'} as const;
const context={issuer:'https://fixture.invalid/auth/v1',subjectId:'owner-A',workspaceId:'01900000-0000-7000-8000-000000000001',clientId:'01900000-0000-7000-8000-000000000002',streamEpoch:'01900000-0000-7000-8000-000000000003'};
const id='01900000-0000-7000-8000-000000000004';
const metadata={id,title:'reconnect fixture',yDocId:`page:${id}`,createdAt:'2026-10-15T00:00:00.000Z',updatedAt:'2026-10-15T00:00:00.000Z'};
const verified=()=>({available:true,phase:'verified',expiresAt:Math.floor(Date.now()/1000)+300});
async function fixture(){
 let authenticated=true,opens=0,fail='',hold='',appendFailure='',catalogFail=false,omit=false;let nextContext={...context};let release!:()=>void,entered!:()=>void,waiting:Promise<void>|undefined;
 const updates=[Array.from(emptyPageUpdate())];const calls:{command:string;args:Record<string,unknown>|undefined}[]=[];
 const pause=async(step:string)=>{if(hold===step){hold='';entered();await new Promise<void>(done=>{release=done;});}if(fail===step)throw Error('private fixture failure');};
 const invoke=vi.fn(async(command:string,args?:Record<string,unknown>)=>{
  calls.push({command,args:structuredClone(args)});
  if(command==='native_auth_status')return authenticated?verified():{available:true,phase:'locked',expiresAt:null};
  if(command==='native_auth_login'){authenticated=true;return verified();}
  if(command==='native_auth_restore'){authenticated=false;await pause('restore');authenticated=true;return verified();}
  if(command==='native_workspace_open'){await pause('open');return{handle:`handle-${++opens}`,context:opens===1?context:nextContext};}
  if(command==='native_auth_logout'){authenticated=false;return{localLocked:true,persistentLocked:true,cleanupPending:false,providerConfirmed:true};}
  if(command==='native_workspace_cancel')return null;
  if(command==='native_page_catalog'){await pause('catalog');if(catalogFail)throw Error();return{pages:[metadata],hasMore:true};}
  if(command!=='native_workspace_execute')throw Error('unexpected remote effect');
  const request=args!.request as {command:string;update?:number[]};
  if(request.command==='page_list'){await pause('list');return{context:nextContext,pages:omit?[]:[{metadata,pending:updates.length}],nextAfter:null};}
  if(request.command==='title_load')return{context,pageId:id,base:null,localTitle:metadata.title,pending:0,operations:[],nextOperation:null,conflicts:[],nextConflict:null};
   if(request.command==='page_load'){await pause('load');return{page:{metadata,updates:updates.map(bytes=>bytes.slice())},pending:updates.length,serverHead:null};}
  if(request.command==='page_append'){if(appendFailure!=='before')updates.push(request.update!.slice());if(appendFailure)throw Error();return null;}
  throw Error('unexpected local command');
 });
 const port=new NativeSessionPort(invoke),c=new NativeLoginController(port,config);await c.start();await c.open();await c.selectPage(id);
 return{c,port,calls,updates,setContext(value:typeof context){nextContext=value;},fail(step:string){fail=step;},appendFailure(value:string){appendFailure=value;},catalogFail(value=true){catalogFail=value;},omit(){omit=true;},hold(step:string){hold=step;waiting=new Promise(done=>{entered=done;});},wait:()=>waiting!,release:()=>release()};
}
it('NATIVE-RECONNECT: original pending and exact body/vector return even outside first local page window; fresh catalog only',async()=>{
 const f=await fixture(),old=f.c.editor!;old.document.getText('fixture').insert(0,'retained local body');await old.durable();const vector=Y.encodeStateVector(old.document),pending=old.snapshot.pending;await f.c.loadRemote();f.omit();const start=f.calls.length;await f.c.reconnect();expect(f.c.snapshot.phase).toBe('ready');expect(f.c.editor).not.toBe(old);expect(old.snapshot.phase).toBe('closed');expect(f.c.editor!.document.getText('fixture').toString()).toBe('retained local body');expect(Y.encodeStateVector(f.c.editor!.document)).toEqual(vector);expect(f.c.editor!.snapshot.pending).toBe(pending);expect(f.c.snapshot.pages).toEqual([]);expect(f.c.snapshot.remoteLoaded).toBe(true);
 const calls=f.calls.slice(start);expect(calls.map(c=>c.command)).toEqual(['native_auth_restore','native_workspace_open','native_workspace_execute','native_workspace_execute','native_workspace_execute','native_page_catalog']);expect(calls.at(-1)!.args).toEqual({handle:'handle-2',more:false});expect(f.c.editor!.bound.handle).toBe('handle-2');f.c.dispose();
});
it('NATIVE-RECONNECT: unqueried remote catalog stays unqueried; composition and queued local writes prevent reconnect',async()=>{
 const f=await fixture();f.c.editor!.setComposing(true);const before=f.calls.length;await f.c.reconnect();expect(f.calls).toHaveLength(before);expect(f.c.editor!.isComposing).toBe(true);f.c.editor!.setComposing(false);f.c.editor!.document.getText('fixture').insert(0,'saving');await f.c.reconnect();expect(f.calls.filter(c=>c.command==='native_auth_restore')).toHaveLength(0);await f.c.editor!.durable();await f.c.reconnect();expect(f.calls.filter(c=>c.command==='native_page_catalog')).toHaveLength(0);expect(f.c.snapshot.remoteLoaded).toBe(false);f.c.dispose();
});
it.each(['before','after'])('NATIVE-RECONNECT: %s unknown save keeps scoped memory draft and explicit recovery merges missing bytes',async failure=>{
 const f=await fixture();f.appendFailure(failure);f.c.editor!.document.getText('fixture').insert(0,'unknown retained input');await expect(f.c.editor!.durable()).rejects.toThrow();const expected=Y.encodeStateVector(f.c.editor!.document),count=f.updates.length;f.appendFailure('');await f.c.reconnect();expect(f.c.snapshot.hasDraft).toBe(true);expect(f.updates).toHaveLength(count);await f.c.restoreInput();expect(f.c.editor!.document.getText('fixture').toString()).toBe('unknown retained input');expect(Y.encodeStateVector(f.c.editor!.document)).toEqual(expected);expect(f.c.snapshot.hasDraft).toBe(false);f.c.dispose();
});
it.each(Object.keys(context) as (keyof typeof context)[])('NATIVE-RECONNECT: changed %s refuses old Page before listing or reading new scope',async key=>{
 const f=await fixture();const next={...context,[key]:key==='issuer'?'https://other.invalid/auth/v1':key==='subjectId'?'owner-B':'01900000-0000-7000-8000-000000000009'};f.setContext(next);const start=f.calls.length;await f.c.reconnect();expect(f.c.snapshot.phase).toBe('verified');expect(f.c.snapshot.message).toContain('接続先が変わった');expect(f.c.snapshot.pages).toEqual([]);expect(f.c.editor).toBeNull();expect(f.calls.slice(start).map(c=>c.command)).toEqual(['native_auth_restore','native_workspace_open','native_workspace_cancel']);f.c.dispose();
});
it.each(['restore','open','list','load'])('NATIVE-RECONNECT: %s failure closes new admission and does not retry or create a replacement Page',async step=>{
 const f=await fixture();f.fail(step);const start=f.calls.length;await f.c.reconnect();expect(f.c.editor).toBeNull();expect(f.c.snapshot.phase).toBe(step==='restore'?'signed_out':'verified');expect(f.c.snapshot.pages).toEqual([]);expect(f.c.snapshot.message).toContain('再接続を確認できません');expect(f.calls.slice(start).filter(c=>c.command==='native_auth_restore')).toHaveLength(1);expect(f.calls.slice(start).some(c=>(c.args?.request as {command?:string})?.command==='page_create')).toBe(false);f.c.dispose();
});
it.each(['restore','open','load','catalog'])('NATIVE-RECONNECT: logout defeats held %s and never adopts an old candidate or catalog',async step=>{
 const f=await fixture();if(step==='catalog')await f.c.loadRemote();f.hold(step);const reconnect=f.c.reconnect();await f.wait();await f.c.logout();const count=f.calls.length;f.release();await reconnect;expect(f.c.snapshot.phase).toBe('signed_out');expect(f.c.editor).toBeNull();expect(f.c.snapshot.remotePages).toEqual([]);expect(f.calls).toHaveLength(count);f.c.dispose();
});
it('NATIVE-RECONNECT: catalog failure keeps reopened local Page, clears old rows/cursor and permits fresh explicit query',async()=>{
 const f=await fixture();await f.c.loadRemote();f.catalogFail();await f.c.reconnect();expect(f.c.snapshot.phase).toBe('ready');expect(f.c.editor!.pageId).toBe(id);expect(f.c.snapshot.remotePages).toEqual([]);expect(f.c.snapshot.remoteHasMore).toBe(false);expect(f.c.snapshot.remoteError).toBe(true);f.catalogFail(false);await f.c.loadRemote();expect(f.c.snapshot.remoteLoaded).toBe(true);expect(f.calls.filter(c=>c.command==='native_page_catalog').map(c=>c.args?.more)).toEqual([false,false,false]);f.c.dispose();
});
