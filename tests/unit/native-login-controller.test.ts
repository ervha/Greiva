import {it,expect,vi} from 'vitest';
import {NativeSessionPort} from '../../apps/client/src/auth/native-session-port.js';
import {NativeLoginController} from '../../apps/client/src/auth/native-login-controller.js';
import * as Y from 'yjs';import {emptyPageUpdate} from '@greiva/sync';
const config={projectUrl:'https://fixture.invalid',publishableKey:'sb_publishable_fixture',algorithm:'ES256'} as const;
const context={issuer:'https://fixture.invalid/auth/v1',subjectId:'owner-A',workspaceId:'01900000-0000-7000-8000-000000000001',clientId:'01900000-0000-7000-8000-000000000002',streamEpoch:'01900000-0000-7000-8000-000000000003'};
const id='01900000-0000-7000-8000-000000000004';const pages=[{metadata:{id,title:'retained Page',yDocId:`page:${id}`,createdAt:'2026-10-13T00:00:00.000Z',updatedAt:'2026-10-13T00:00:00.000Z'},pending:2}];
const verified=()=>({available:true,phase:'verified',expiresAt:Math.floor(Date.now()/1000)+300});
it('NATIVE-LOGIN: startup restore happens once; failure never retries credential automatically',async()=>{
 const invoke=vi.fn(async command=>{if(command==='native_auth_status')return{available:true,phase:'locked',expiresAt:null};throw Error('private credential');});const c=new NativeLoginController(new NativeSessionPort(invoke),config);
 await c.start();await c.start();expect(c.snapshot.phase).toBe('signed_out');expect(invoke.mock.calls.map(call=>call[0])).toEqual(['native_auth_status','native_auth_restore']);expect(c.snapshot.message).not.toContain('private');c.dispose();
});
it('NATIVE-LOGIN: logout defeats held restore and publishes no late verified identity',async()=>{
 let resolve!:(value:unknown)=>void;let entered!:()=>void;const waiting=new Promise<void>(done=>{entered=done;});
 const port=new NativeSessionPort(async command=>command==='native_auth_status'?{available:true,phase:'locked',expiresAt:null}:command==='native_auth_restore'?new Promise(done=>{resolve=done;entered();}):{localLocked:true,persistentLocked:true,cleanupPending:false,providerConfirmed:false});const c=new NativeLoginController(port,config);
 const start=c.start();await waiting;await c.logout();resolve(verified());await start;expect(c.snapshot.phase).toBe('signed_out');expect(c.snapshot.pages).toEqual([]);c.dispose();
});
it('NATIVE-LOGIN: foreign local list is hidden and cancels its handle without owner fallback',async()=>{
 const invoke=vi.fn(async command=>command==='native_auth_status'||command==='native_auth_login'?verified():command==='native_workspace_open'?{handle:'native',context}:command==='native_workspace_execute'?{context:{...context,subjectId:'foreign'},pages,nextAfter:null}:null);const c=new NativeLoginController(new NativeSessionPort(invoke),config);
 await c.start();await c.open();expect(c.snapshot.pages).toEqual([]);expect(c.snapshot.phase).toBe('verified');expect(c.snapshot.message).not.toContain('retained Page');expect(invoke.mock.calls.at(-1)?.[0]).toBe('native_workspace_cancel');c.dispose();
});
it('NATIVE-LOGIN: durable logout unknown is distinct from provider confirmation and can retry',async()=>{
 let persistent=false;const c=new NativeLoginController(new NativeSessionPort(async()=>({localLocked:true,persistentLocked:persistent,cleanupPending:persistent?false:null,providerConfirmed:true})),config);
 await c.logout();expect(c.snapshot.logoutUnconfirmed).toBe(true);expect(c.snapshot.message).toContain('端末へのログアウト記録');persistent=true;await c.logout();expect(c.snapshot.logoutUnconfirmed).toBe(false);expect(c.snapshot.phase).toBe('signed_out');c.dispose();
});
it('NATIVE-LOGIN: expiry removes local catalog, with no automatic refresh or resubmission',async()=>{
 vi.useFakeTimers();vi.setSystemTime(100000);try{
  const invoke=vi.fn(async command=>command==='native_auth_status'?Date.now()<200000?{available:true,phase:'verified',expiresAt:200}:{available:true,phase:'locked',expiresAt:null}:command==='native_workspace_open'?{handle:'native',context}:command==='native_workspace_execute'?{context,pages,nextAfter:null}:null);
  const c=new NativeLoginController(new NativeSessionPort(invoke),config);await c.start();await c.open();expect(c.snapshot.pages).toHaveLength(1);await vi.advanceTimersByTimeAsync(100001);expect(c.snapshot.phase).toBe('signed_out');expect(c.snapshot.pages).toEqual([]);expect(invoke.mock.calls.some(call=>call[0]==='native_auth_restore')).toBe(false);c.dispose();
 }finally{vi.useRealTimers();}
});
async function editorFixture(){
 let savedTitle=pages[0]!.metadata.title,titleFail=false;let owner='A',fail=false,held=false,entered!:()=>void,release!:(value:unknown)=>void;let waiting:Promise<void>|undefined;const updates={A:[Array.from(emptyPageUpdate())],B:[Array.from(emptyPageUpdate())]};
 const bound=()=>owner==='A'?context:{...context,subjectId:'owner-B',workspaceId:'01900000-0000-7000-8000-000000000009',clientId:'01900000-0000-7000-8000-000000000007'};
 const loaded=()=>({page:{metadata:{...pages[0]!.metadata,title:savedTitle},updates:updates[owner as 'A'|'B'].map(bytes=>bytes.slice())},pending:updates[owner as 'A'|'B'].length,serverHead:null});
 const invoke=vi.fn(async(command:string,args?:Record<string,unknown>)=>{
  if(command==='native_auth_status'||command==='native_auth_restore'||command==='native_auth_login')return verified();if(command==='native_workspace_open')return{handle:'native-'+owner,context:bound()};if(command==='native_auth_logout')return{localLocked:true,persistentLocked:true,cleanupPending:false,providerConfirmed:true};
  if(command!=='native_workspace_execute')return null;const r=args!.request as {command:string;update:number[];intent?:{title:string}};
  if(r.command==='title_ready')return true;
  if(r.command==='title_load')return{context:bound(),pageId:id,base:null,localTitle:savedTitle,pending:0,operations:[],nextOperation:null,conflicts:[],nextConflict:null};
  if(r.command==='page_list')return{context:bound(),pages,nextAfter:null};if(r.command==='page_load'){if(held){held=false;entered();return new Promise(done=>{release=done;});}return loaded();}
  if(r.command==='page_append'){if(fail)throw Error('private path');updates[owner as 'A'|'B'].push(r.update.slice());return null;}
  if(r.command==='title_enqueue'){if(titleFail)throw Error('fixture title disk');savedTitle=r.intent?.title??'';return null;}
  throw Error('unexpected command');
 });
 const c=new NativeLoginController(new NativeSessionPort(invoke),config);await c.start();await c.open();
 return{c,invoke,failTitle(value=true){titleFail=value;},owner(value:string){owner=value;},fail(value=true){fail=value;},hold(){held=true;waiting=new Promise(done=>{entered=done;});},wait:()=>waiting!,release:()=>release(loaded())};
}
it('NATIVE-EDITOR: late Page load after logout never activates its editor or publishes old catalog',async()=>{
 const f=await editorFixture();f.hold();const opening=f.c.selectPage(id);await f.wait();await f.c.logout();f.release();expect(await opening).toBe(false);expect(f.c.editor).toBeNull();expect(f.c.snapshot.phase).toBe('signed_out');expect(f.c.snapshot.pages).toEqual([]);f.c.dispose();
});
it('NATIVE-EDITOR: logout while closing defeats an old refresh before it can consume a credential',async()=>{
 const f=await editorFixture();await f.c.selectPage(id);const close=f.c.close(),restore=f.c.restore(),logout=f.c.logout();await Promise.all([close,restore,logout]);expect(f.invoke.mock.calls.some(call=>call[0]==='native_auth_restore')).toBe(false);expect(f.c.snapshot.phase).toBe('signed_out');expect(f.c.editor).toBeNull();f.c.dispose();
});
it('NATIVE-EDITOR: held draft is hidden from another account and restored only after same-context reconnect',async()=>{
 const f=await editorFixture();await f.c.selectPage(id);f.fail();const editor=f.c.editor!;editor.document.getText('fixture').insert(0,'owner-A held input');await expect(editor.durable()).rejects.toMatchObject({stage:'storage'});await f.c.logout();f.fail(false);f.owner('B');await f.c.login('other@example.invalid','fixture-password');await f.c.open();await f.c.selectPage(id);expect(f.c.snapshot.hasDraft).toBe(false);await f.c.restoreInput();expect(f.c.editor!.document.getText('fixture').toString()).toBe('');
 await f.c.logout();f.owner('A');await f.c.login('fixture@example.invalid','fixture-password');await f.c.open();await f.c.selectPage(id);expect(f.c.snapshot.hasDraft).toBe(true);await f.c.restoreInput();expect(f.c.editor!.document.getText('fixture').toString()).toBe('owner-A held input');expect(f.c.snapshot.hasDraft).toBe(false);f.c.dispose();
});
it('NATIVE-EDITOR: a later body-only failure retains an older unsaved title, including an empty title',async()=>{
 for(const title of ['older unsaved title','']){const f=await editorFixture();await f.c.selectPage(id);f.failTitle();f.c.editor!.setTitle(title);await expect(f.c.editor!.durable()).rejects.toMatchObject({stage:'storage'});await f.c.close();f.failTitle(false);await f.c.open();await f.c.selectPage(id);expect(f.c.snapshot.hasDraft).toBe(true);f.fail();f.c.editor!.document.getText('fixture').insert(0,'new body-only draft');await expect(f.c.editor!.durable()).rejects.toMatchObject({stage:'storage'});await f.c.close();f.fail(false);await f.c.open();await f.c.selectPage(id);await f.c.restoreInput();expect(f.c.editor!.snapshot.title).toBe(title);expect(f.c.editor!.document.getText('fixture').toString()).toContain('new body-only draft');f.c.dispose();}
});
it('NATIVE-EDITOR: editor title change updates page catalog and draft retains updated title',async()=>{
 const f=await editorFixture();await f.c.selectPage(id);
 expect(f.c.snapshot.pages[0]?.metadata.title).toBe('retained Page');
 f.c.editor!.setTitle('Dynamic Title');
 expect(f.c.snapshot.pages[0]?.metadata.title).toBe('Dynamic Title');
 f.fail();
 f.c.editor!.document.getText('fixture').insert(0,'draft text');
 await expect(f.c.editor!.durable()).rejects.toMatchObject({stage:'storage'});
 await f.c.logout();
 f.fail(false);
 await f.c.login('fixture@example.invalid','fixture-password');
 await f.c.open();
 await f.c.selectPage(id);
 expect(f.c.snapshot.hasDraft).toBe(true);
 await f.c.restoreInput();
 expect(f.c.editor!.snapshot.title).toBe('Dynamic Title');
 f.c.dispose();
});
it('NATIVE-CATALOG-SCREEN: query is explicit, failed more retains rows, remote opening requires received journal',async()=>{
 let fail=false,status='read_unknown';const commands:string[]=[];const invoke=vi.fn(async(command:string,args?:Record<string,unknown>)=>{commands.push(command);if(command==='native_auth_status')return verified();if(command==='native_workspace_open')return{handle:'catalog',context};if(command==='native_page_catalog'){if(fail)throw Error('private network');return{pages:args!.more?[]:[pages[0]!.metadata],hasMore:!args!.more};}if(command==='native_page_read')return{status};if(command==='native_workspace_execute'){const request=args!.request as {command:string};if(request.command==='page_list')return{context,pages:[],nextAfter:null};if(request.command==='title_load')return{context,pageId:id,base:null,localTitle:pages[0]!.metadata.title,pending:0,operations:[],nextOperation:null,conflicts:[],nextConflict:null};if(request.command==='page_load')return{page:{metadata:pages[0]!.metadata,updates:[Array.from(emptyPageUpdate())]},pending:0,serverHead:null};throw Error('unexpected write');}return null;});
 const c=new NativeLoginController(new NativeSessionPort(invoke),config);await c.start();await c.open();expect(commands).not.toContain('native_page_catalog');expect(c.snapshot.remoteLoaded).toBe(false);await c.loadRemote();expect(c.snapshot.remotePages).toHaveLength(1);fail=true;await c.loadRemote(true);expect(c.snapshot.remoteError).toBe(true);expect(c.snapshot.remoteHasMore).toBe(true);expect(c.snapshot.remotePages).toHaveLength(1);fail=false;await c.loadRemote(true);expect(c.snapshot.remoteHasMore).toBe(false);
 expect(await c.selectRemotePage('01900000-0000-7000-8000-000000000008')).toBe(false);expect(await c.selectRemotePage(id)).toBe(false);expect(c.editor).toBeNull();expect(c.snapshot.message).toContain('取得結果');expect(commands.filter(x=>x==='native_workspace_execute')).toHaveLength(2);status='store_pending';expect(await c.selectRemotePage(id)).toBe(false);expect(c.snapshot.message).toContain('保存は未確認');status='received';expect(await c.selectRemotePage(id)).toBe(true);expect(c.editor?.snapshot.pending).toBe(0);await c.close();expect(c.snapshot.remotePages).toEqual([]);expect(c.snapshot.remoteLoaded).toBe(false);c.dispose();
});
it('NATIVE-CATALOG-SCREEN: logout hides late results and failed fresh query disables old continuation',async()=>{
 let fail=false,hold=false,resolve!:(v:unknown)=>void;const invoke=vi.fn(async(command:string)=>{if(command==='native_auth_status')return verified();if(command==='native_workspace_open')return{handle:'catalog',context};if(command==='native_workspace_execute')return{context,pages:[],nextAfter:null};if(command==='native_page_catalog'){if(hold)return new Promise(done=>{resolve=done;});if(fail)throw Error();return{pages:[pages[0]!.metadata],hasMore:true};}return{localLocked:true,persistentLocked:true,cleanupPending:false,providerConfirmed:true};});const c=new NativeLoginController(new NativeSessionPort(invoke),config);await c.start();await c.open();await c.loadRemote();fail=true;await c.loadRemote();expect(c.snapshot.remotePages).toHaveLength(1);expect(c.snapshot.remoteHasMore).toBe(false);hold=true;const query=c.loadRemote();await c.logout();resolve({pages:[pages[0]!.metadata],hasMore:true});await query;expect(c.snapshot.remotePages).toEqual([]);expect(c.snapshot.remoteBusy).toBe(false);expect(c.snapshot.phase).toBe('signed_out');c.dispose();
});
it('NATIVE-CATALOG-SCREEN: failed remote open checks native permission and removes revoked metadata',async()=>{
 let revoked=false;const invoke=vi.fn(async(command:string)=>{if(command==='native_auth_status')return revoked?{available:true,phase:'locked',expiresAt:null}:verified();if(command==='native_workspace_open')return{handle:'catalog',context};if(command==='native_workspace_execute')return{context,pages:[],nextAfter:null};if(command==='native_page_catalog')return{pages:[pages[0]!.metadata],hasMore:false};if(command==='native_page_read'){revoked=true;throw Error('private authorization');}return null;});const c=new NativeLoginController(new NativeSessionPort(invoke),config);await c.start();await c.open();await c.loadRemote();expect(await c.selectRemotePage(id)).toBe(false);expect(c.snapshot.phase).toBe('signed_out');expect(c.snapshot.remotePages).toEqual([]);expect(c.editor).toBeNull();c.dispose();
});
it('NATIVE-STRUCTURED-CONTROLLER: open attaches structured session, structuredDraft blocks close/reconnect/logout, and closing cleans up',async()=>{
 const invoke=vi.fn(async(command:string,args?:Record<string,unknown>)=>{
  if(command==='native_auth_status'||command==='native_auth_restore')return verified();
  if(command==='native_workspace_open')return{handle:'struct-1',context};
  if(command==='native_auth_logout')return{localLocked:true,persistentLocked:true,cleanupPending:false,providerConfirmed:true};
  if(command==='native_workspace_execute'){
   const r=args!.request as {command:string};
   if(r.command==='page_list')return{context,pages:[],nextAfter:null};
   if(r.command==='snapshot'){
    return{
     context,
     snapshot:{
      tasks:[],
      relations:[],
      operations:[],
      state:{stream:'structured',cursor:null,headCursor:null,lastSuccessfulSyncAt:null},
      clientId:context.clientId,
      conflicts:[],
      errors:[],
     },
    };
   }
   throw Error('unexpected write');
  }
  return null;
 });
 const c=new NativeLoginController(new NativeSessionPort(invoke),config);
 await c.start();
 await c.open();
 expect(c.structured).not.toBeNull();
 expect(c.structured?.snapshot.phase).toBe('ready');

 c.setStructuredDraft(true);
 expect(c.snapshot.structuredDraft).toBe(true);
 expect(c.snapshot.busy).toBe(true);
 expect(c.snapshot.composing).toBe(true);

 await c.close();
 expect(c.snapshot.phase).toBe('ready');

 await c.reconnect();
 expect(c.snapshot.phase).toBe('ready');

 await c.logout();
 expect(c.snapshot.phase).toBe('ready');

 c.setStructuredDraft(false);
 expect(c.snapshot.structuredDraft).toBe(false);

 await c.close();
 expect(c.snapshot.phase).toBe('verified');
 expect(c.structured).toBeNull();
 c.dispose();
});
