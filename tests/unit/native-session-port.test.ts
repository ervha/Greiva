import {it,expect,vi} from 'vitest';
import {NativeSessionPort,NativeSessionPortError} from '../../apps/client/src/auth/native-session-port.js';
const verified=()=>({available:true,phase:'verified',expiresAt:200});
const context=()=>({issuer:'https://fixture.invalid/auth/v1',subjectId:'owner-A',workspaceId:'01900000-0000-7000-8000-000000000001',clientId:'01900000-0000-7000-8000-000000000002',streamEpoch:'01900000-0000-7000-8000-000000000003'});
const candidate=context().clientId;
it('NATIVE-SESSION-PORT: default browser port refuses native calls without fallback',()=>{
 expect(()=>new NativeSessionPort()).toThrowError(new NativeSessionPortError('configuration'));
});
it('NATIVE-SESSION-PORT: exact snapshot rejects private fields and invalid capability/expiry shapes',async()=>{
 for(const row of [{...verified(),access_token:'synthetic-private'}, {...verified(),identity:{email:'fixture@example.invalid'}},{...verified(),available:false},{available:true,phase:'locked',expiresAt:200},{...verified(),expiresAt:1.5},{available:true,phase:'unavailable',expiresAt:null}]){
  const port=new NativeSessionPort(async()=>row,()=>100);await expect(port.status()).rejects.toMatchObject({stage:'protocol'});expect(port.handle).toBeNull();
 }
 const port=new NativeSessionPort(async()=>({available:false,phase:'unavailable',expiresAt:null}),()=>100);expect((await port.status()).available).toBe(false);
});
it('NATIVE-SESSION-PORT: only credentials/candidate/handle cross IPC; context and request are captured',async()=>{
 const bound=context();let resolve!:(value:unknown)=>void;
 const invoke=vi.fn(async(command:string,args?:Record<string,unknown>)=>{
  if(command==='native_auth_login')return verified();if(command==='native_workspace_open')return {handle:'native-handle',context:bound};
  if(command==='native_workspace_execute')return new Promise(done=>{resolve=done;});return null;
 });
 const port=new NativeSessionPort(invoke,()=>100);await port.login('fixture@example.invalid','fixture-password');const handle=await port.open(candidate);
 expect(invoke.mock.calls.slice(0,2)).toEqual([['native_auth_login',{email:'fixture@example.invalid',password:'fixture-password'}],['native_workspace_open',{candidate}]]);
 bound.subjectId='mutated';expect(handle.context.subjectId).toBe('owner-A');expect(Object.isFrozen(handle.context)).toBe(true);
 const request={command:'page_append',pageId:candidate,update:[0,0]};const work=port.execute(request);request.update.push(9);
 expect(invoke.mock.calls[2]?.[1]).toEqual({handle:'native-handle',request:{command:'page_append',pageId:candidate,update:[0,0]}});resolve({saved:true});expect(await work).toEqual({saved:true});
});
it('NATIVE-SESSION-PORT: logout invalidates held login immediately and never publishes its late verification',async()=>{
 let resolve!:(value:unknown)=>void;const invoke=vi.fn(async(command:string)=>command==='native_auth_login'?new Promise(done=>{resolve=done;}):{localLocked:true,persistentLocked:true,cleanupPending:false,providerConfirmed:false});
 const port=new NativeSessionPort(invoke,()=>100);const work=port.login('fixture@example.invalid','fixture-password');
 await expect(port.login('fixture@example.invalid','fixture-password')).rejects.toMatchObject({stage:'busy'});const closed=await port.logout();expect(closed.providerConfirmed).toBe(false);expect(port.current.phase).toBe('locked');
 resolve(verified());await expect(work).rejects.toMatchObject({stage:'closed'});expect(port.current.phase).toBe('locked');expect(port.handle).toBeNull();
});
it('NATIVE-SESSION-PORT: cancel and dispose discard held open/execute; expiry refuses before invocation',async()=>{
 let time=100,resolve!:(value:unknown)=>void;const invoke=vi.fn(async(command:string)=>command==='native_workspace_open'?new Promise(done=>{resolve=done;}):command==='native_auth_login'?verified():null);
 const port=new NativeSessionPort(invoke,()=>time);await port.login('fixture@example.invalid','fixture-password');const opening=port.open(candidate);await port.cancel();resolve({handle:'late',context:context()});await expect(opening).rejects.toMatchObject({stage:'closed'});
 time=200;const count=invoke.mock.calls.length;await expect(port.open(candidate)).rejects.toMatchObject({stage:'unavailable'});expect(invoke.mock.calls.length).toBe(count);
 port.dispose();await expect(port.status()).rejects.toMatchObject({stage:'closed'});await Promise.resolve();expect(invoke.mock.calls.at(-1)?.[0]).toBe('native_workspace_cancel');
});
it('NATIVE-SESSION-PORT: malformed handle and secret errors never publish context or raw cause',async()=>{
 for(const handle of [{handle:'valid',context:{...context(),accessToken:'synthetic-private'}},{handle:'',context:context()},{handle:'valid',context:context(),email:'fixture@example.invalid'}]){
  const port=new NativeSessionPort(async command=>command==='native_auth_login'?verified():handle,()=>100);await port.login('fixture@example.invalid','fixture-password');await expect(port.open(candidate)).rejects.toMatchObject({stage:'protocol'});expect(port.handle).toBeNull();
 }
 const port=new NativeSessionPort(async()=>{throw Error('private token path');},()=>100);await expect(port.login('fixture@example.invalid','fixture-password')).rejects.toMatchObject({message:'Native session unavailable'});expect(port.current.phase).toBe('locked');
});
it('NATIVE-SESSION-PORT: unknown durable logout remains separate from provider confirmation',async()=>{
 const port=new NativeSessionPort(async()=>({localLocked:true,persistentLocked:false,cleanupPending:null,providerConfirmed:true}),()=>100);expect(await port.logout()).toEqual({localLocked:true,persistentLocked:false,cleanupPending:null,providerConfirmed:true});expect(port.current.phase).toBe('locked');
 const invalid=new NativeSessionPort(async()=>({localLocked:true,persistentLocked:false,cleanupPending:false,providerConfirmed:true}),()=>100);await expect(invalid.logout()).rejects.toMatchObject({stage:'protocol'});
});
it('NATIVE-SESSION-PORT: logout withholds a late local execution result without reporting it saved',async()=>{
 let resolve!:(value:unknown)=>void;const port=new NativeSessionPort(async command=>{
  if(command==='native_auth_login')return verified();if(command==='native_workspace_open')return {handle:'active',context:context()};
  if(command==='native_workspace_execute')return new Promise(done=>{resolve=done;});return {localLocked:true,persistentLocked:true,cleanupPending:false,providerConfirmed:true};
 },()=>100);
 await port.login('fixture@example.invalid','fixture-password');await port.open(candidate);const executing=port.execute({command:'page_append',pageId:candidate,update:[0,0]});
 await port.logout();resolve({saved:true});await expect(executing).rejects.toMatchObject({stage:'closed'});expect(port.current.phase).toBe('locked');expect(port.handle).toBeNull();
});

it('NATIVE-SESSION-PORT: send accepts only a bound handle/Page and strict sanitized status, never receipt or tokens',async()=>{
 for(const status of ['idle','acked','send_unknown','ack_pending']){const invoke=vi.fn(async(command:string)=>command==='native_auth_login'?verified():command==='native_workspace_open'?{handle:'native',context:context()}:{status});const port=new NativeSessionPort(invoke,()=>100);await port.login('fixture@example.invalid','fixture-password');const handle=await port.open(candidate);expect(await port.sendPageFor(handle,candidate)).toBe(status);expect(invoke.mock.calls.at(-1)).toEqual(['native_page_send',{handle:'native',pageId:candidate}]);port.dispose();}
 for(const value of [{status:['acked']},{status:{value:'acked'}},{status:'acked',receipt:{}},{status:'private'},{status:null},{status:'acked',access_token:'private'}]){const port=new NativeSessionPort(async command=>command==='native_auth_login'?verified():command==='native_workspace_open'?{handle:'native',context:context()}:value,()=>100);await port.login('fixture@example.invalid','fixture-password');const handle=await port.open(candidate);await expect(port.sendPageFor(handle,candidate)).rejects.toMatchObject({stage:'protocol'});port.dispose();}
});
it('NATIVE-SESSION-PORT: logout discards late send status and old handle refuses before invocation',async()=>{
 let resolve!:(value:unknown)=>void;const invoke=vi.fn(async(command:string)=>command==='native_auth_login'?verified():command==='native_workspace_open'?{handle:'native',context:context()}:command==='native_page_send'?new Promise(done=>{resolve=done;}):{localLocked:true,persistentLocked:true,cleanupPending:false,providerConfirmed:false});const port=new NativeSessionPort(invoke,()=>100);await port.login('fixture@example.invalid','fixture-password');const handle=await port.open(candidate);const work=port.sendPageFor(handle,candidate);await port.logout();resolve({status:'acked'});await expect(work).rejects.toMatchObject({stage:'closed'});const count=invoke.mock.calls.length;await expect(port.sendPageFor(handle,candidate)).rejects.toMatchObject({stage:'closed'});expect(invoke.mock.calls).toHaveLength(count);port.dispose();
});
