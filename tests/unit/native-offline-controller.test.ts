import {it,expect,vi} from 'vitest';
import * as Y from 'yjs';
import {emptyPageUpdate} from '@greiva/sync';
import {NativeSessionPort} from '../../apps/client/src/auth/native-session-port.js';
import {NativeOfflinePort} from '../../apps/client/src/auth/native-offline-port.js';
import {NativeLoginController} from '../../apps/client/src/auth/native-login-controller.js';
const config={projectUrl:'https://fixture.invalid',publishableKey:'sb_publishable_fixture',algorithm:'ES256'} as const;
const context={issuer:'https://fixture.invalid/auth/v1',subjectId:'owner-A',workspaceId:'01900000-0000-7000-8000-000000000001',clientId:'01900000-0000-7000-8000-000000000002',streamEpoch:'01900000-0000-7000-8000-000000000003'};
const id='01900000-0000-7000-8000-000000000004';
async function fixture(){
 let expiry=Math.floor(Date.now()/1000)+300,valid=true,foreign=false,unknown=false,hold=false,release!:(v:unknown)=>void,entered!:()=>void;let waiting:Promise<void>|undefined;
 const updates=[Array.from(emptyPageUpdate())],metadata={id,title:'offline Page',yDocId:`page:${id}`,createdAt:'2026-10-13T00:00:00.000Z',updatedAt:'2026-10-13T00:00:00.000Z'};
 const bound=()=>foreign?{...context,subjectId:'owner-B'}:context;
 const invoke=vi.fn(async(command:string,args?:Record<string,unknown>):Promise<unknown>=>{
  if(command==='native_auth_status')return{available:true,phase:'locked',expiresAt:null};
  if(command==='native_auth_restore')return{available:true,phase:'verified',expiresAt:Math.floor(Date.now()/1000)+300};
  if(command==='native_auth_logout')return{localLocked:true,persistentLocked:true,cleanupPending:false,providerConfirmed:false};
  if(command==='native_workspace_open')return{handle:'online',context:bound()};
  if(command==='native_offline_open'){if(hold){hold=false;entered();return new Promise(done=>{release=done;});}if(!valid)throw Error('private grant');return{workspace:{handle:'offline',context},expiresAt:expiry};}
  if(command==='native_offline_check'){if(!valid||Date.now()/1000>=expiry)throw Error('private time');return{expiresAt:expiry};}
  if(command==='native_offline_execute'||command==='native_workspace_execute'){
   if(command==='native_offline_execute'&&(!valid||Date.now()/1000>=expiry))throw Error('expired');
   const request=args!.request as {command:string;update:number[]};
   if(request.command==='page_list')return{context:bound(),pages:[{metadata,pending:updates.length}],nextAfter:null};
   if(request.command==='title_load')return{context,pageId:id,base:null,localTitle:metadata.title,pending:0,operations:[],nextOperation:null,conflicts:[],nextConflict:null};
   if(request.command==='page_load')return{page:{metadata,updates},pending:updates.length,serverHead:null};
   if(request.command==='page_append'){updates.push(request.update.slice());if(unknown){unknown=false;throw Error('private committed response lost');}return null;}
  }
  if(command==='native_offline_close'||command==='native_workspace_cancel')return null;
  throw Error(`Unexpected ${command}`);
 });
 const c=new NativeLoginController(new NativeSessionPort(invoke),config,globalThis.fetch,new NativeOfflinePort(invoke));await c.start();
 return{c,invoke,updates,setExpiry(value:number){expiry=value;},revoke(){valid=false;},foreign(){foreign=true;},unknown(){unknown=true;},hold(){hold=true;waiting=new Promise(done=>{entered=done;});},wait:()=>waiting!,release(){release({workspace:{handle:'offline',context},expiresAt:expiry});}};
}
const settle=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
it('NATIVE-OFFLINE-SCREEN: startup is read-only until explicit choice; offline local editor never calls online APIs',async()=>{
 const f=await fixture();await f.c.start();expect(f.c.snapshot.phase).toBe('choosing');expect(f.invoke.mock.calls.map(c=>c[0])).toEqual(['native_auth_status']);
 await f.c.resumeOffline();expect(f.c.snapshot).toMatchObject({phase:'ready',mode:'offline'});await f.c.selectPage(id);const editor=f.c.editor!;editor.document.getText('fixture').insert(0,'local only');await editor.durable();
 await f.c.sendPage();await f.c.readPage();await f.c.loadRemote();await f.c.offline(true);await expect(editor.send()).rejects.toMatchObject({stage:'closed'});await expect(editor.read()).rejects.toMatchObject({stage:'closed'});
 expect(f.invoke.mock.calls.every(c=>c[0]==='native_auth_status'||c[0].startsWith('native_offline_'))).toBe(true);expect(f.c.editor).toBe(editor);await f.c.close();expect(f.c.snapshot.phase).toBe('choosing');f.c.dispose();
});
it('NATIVE-OFFLINE-SCREEN: missing grant refuses without refresh, replacement Page or private error',async()=>{
 const f=await fixture();f.revoke();await f.c.resumeOffline();expect(f.c.snapshot.phase).toBe('choosing');expect(f.c.snapshot.pages).toEqual([]);expect(f.c.snapshot.message).not.toContain('private');expect(f.invoke.mock.calls.map(c=>c[0])).toEqual(['native_auth_status','native_offline_open']);f.c.dispose();
});
it('NATIVE-OFFLINE-SCREEN: expiry keeps active composition until commit and same-context explicit recovery retains input',async()=>{
 vi.useFakeTimers();vi.setSystemTime(100000);try{const f=await fixture();f.setExpiry(102);await f.c.resumeOffline();await f.c.selectPage(id);const editor=f.c.editor!;editor.setComposing(true);
  await vi.advanceTimersByTimeAsync(2001);expect(f.c.editor).toBe(editor);expect(f.c.snapshot.editorLocked).toBe(true);expect(f.c.snapshot.phase).toBe('choosing');editor.document.getText('fixture').insert(0,'composition held');editor.setComposing(false);await settle();expect(f.c.editor).toBeNull();
  expect(f.invoke.mock.calls.some(c=>c[0]==='native_auth_restore')).toBe(false);await f.c.restore();await f.c.open();await f.c.selectPage(id);expect(f.c.snapshot.hasDraft).toBe(true);await f.c.restoreInput();expect(f.c.editor!.document.getText('fixture').toString()).toBe('composition held');expect(f.c.snapshot.hasDraft).toBe(false);f.c.dispose();
 }finally{vi.useRealTimers();}
});
it('NATIVE-OFFLINE-SCREEN: unknown committed append closes local gate, keeps draft and never retries; recovery merges once',async()=>{
 const f=await fixture();await f.c.resumeOffline();await f.c.selectPage(id);f.unknown();const editor=f.c.editor!;editor.document.getText('fixture').insert(0,'unknown durable');await expect(editor.durable()).rejects.toMatchObject({stage:'storage'});await settle();expect(f.c.snapshot.phase).toBe('choosing');expect(f.c.editor).toBeNull();expect(f.updates).toHaveLength(2);
 await f.c.restore();await f.c.open();await f.c.selectPage(id);expect(f.c.snapshot.hasDraft).toBe(true);await f.c.restoreInput();expect(f.c.editor!.document.getText('fixture').toString()).toBe('unknown durable');expect(f.updates).toHaveLength(2);f.c.dispose();
});
it('NATIVE-OFFLINE-SCREEN: explicit online return reopens same scope and preserves journal without sending',async()=>{
 const f=await fixture();await f.c.resumeOffline();await f.c.selectPage(id);f.c.editor!.document.getText('fixture').insert(0,'pending offline');await f.c.editor!.durable();await f.c.reconnect();expect(f.c.snapshot).toMatchObject({phase:'ready',mode:'online'});expect(f.c.editor!.document.getText('fixture').toString()).toBe('pending offline');expect(f.c.editor!.snapshot.pending).toBe(2);const calls=f.invoke.mock.calls.map(c=>c[0]);expect(calls.indexOf('native_offline_close')).toBeLessThan(calls.indexOf('native_auth_restore'));expect(calls).not.toContain('native_page_send');f.c.dispose();
});
it('NATIVE-OFFLINE-SCREEN: changed online scope never opens old Page or exposes retained draft',async()=>{
 const f=await fixture();await f.c.resumeOffline();await f.c.selectPage(id);f.foreign();const before=f.invoke.mock.calls.filter(c=>(c[1]?.request as {command?:string})?.command==='page_load').length;await f.c.reconnect();expect(f.c.snapshot.phase).toBe('verified');expect(f.c.editor).toBeNull();expect(f.c.snapshot.pages).toEqual([]);expect(f.invoke.mock.calls.filter(c=>(c[1]?.request as {command?:string})?.command==='page_load')).toHaveLength(before);f.c.dispose();
});
it('NATIVE-OFFLINE-SCREEN: logout defeats held offline restore and cleans only late offline handle',async()=>{
 const f=await fixture();f.hold();const opening=f.c.resumeOffline();await f.wait();await f.c.logout();f.release();await opening;expect(f.c.snapshot.phase).toBe('signed_out');expect(f.c.editor).toBeNull();expect(f.invoke.mock.calls.filter(c=>c[0]==='native_offline_close').at(-1)?.[1]).toEqual({handle:'offline'});expect(f.invoke.mock.calls.some(c=>c[0]==='native_offline_execute')).toBe(false);f.c.dispose();
});
it('NATIVE-OFFLINE-SCREEN: new-Page title is scoped across mode changes and hidden from another account',async()=>{
 const f=await fixture();await f.c.resumeOffline();f.c.setTitleDraft('unsaved title A');await f.c.reconnect();expect(f.c.titleDraft).toBe('unsaved title A');await f.c.logout();f.foreign();await f.c.restore();await f.c.open();expect(f.c.titleDraft).toBe('');f.c.setTitleDraft('title B');expect(f.c.titleDraft).toBe('title B');f.c.dispose();expect(f.c.titleDraft).toBe('');
});
