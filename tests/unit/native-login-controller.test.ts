import {it,expect,vi} from 'vitest';
import {NativeSessionPort} from '../../apps/client/src/auth/native-session-port.js';
import {NativeLoginController} from '../../apps/client/src/auth/native-login-controller.js';
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
