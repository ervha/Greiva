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

it('NATIVE-SESSION-PORT: native read accepts only bound Page and strict persisted/read-unknown/store-pending status',async()=>{
 for(const status of ['received','read_unknown','store_pending']){const invoke=vi.fn(async(command:string)=>command==='native_auth_login'?verified():command==='native_workspace_open'?{handle:'native',context:context()}:{status});const port=new NativeSessionPort(invoke,()=>100);await port.login('fixture@example.invalid','fixture-password');const handle=await port.open(candidate);expect(await port.readPageFor(handle,candidate)).toBe(status);expect(invoke.mock.calls.at(-1)).toEqual(['native_page_read',{handle:'native',pageId:candidate}]);const count=invoke.mock.calls.length;await expect(port.readPageFor(handle,'../../foreign')).rejects.toMatchObject({stage:'protocol'});expect(invoke.mock.calls).toHaveLength(count);port.dispose();}
 for(const value of [{status:['received']},{status:'received',response:{}},{status:'received',access_token:'private'},{status:'acked'}]){const port=new NativeSessionPort(async command=>command==='native_auth_login'?verified():command==='native_workspace_open'?{handle:'native',context:context()}:value,()=>100);await port.login('fixture@example.invalid','fixture-password');const handle=await port.open(candidate);await expect(port.readPageFor(handle,candidate)).rejects.toMatchObject({stage:'protocol'});port.dispose();}
});
it('NATIVE-SESSION-PORT: cancelled read cannot deliver late received status to a reopened workspace',async()=>{
 let resolve!:(value:unknown)=>void;const invoke=vi.fn(async(command:string)=>command==='native_auth_login'?verified():command==='native_workspace_open'?{handle:'native',context:context()}:command==='native_page_read'?new Promise(done=>{resolve=done;}):null);const port=new NativeSessionPort(invoke,()=>100);await port.login('fixture@example.invalid','fixture-password');const old=await port.open(candidate);const work=port.readPageFor(old,candidate);await port.cancel();await port.open(candidate);resolve({status:'received'});await expect(work).rejects.toMatchObject({stage:'closed'});const count=invoke.mock.calls.length;await expect(port.readPageFor(old,candidate)).rejects.toMatchObject({stage:'closed'});expect(invoke.mock.calls).toHaveLength(count);port.dispose();
});
it('NATIVE-CATALOG: exact metadata-only IPC, immutable rows and invalid response refusal',async()=>{
 const page={id:candidate,title:'catalog fixture',yDocId:`page:${candidate}`,createdAt:'2026-10-15T00:00:00.000Z',updatedAt:'2026-10-15T00:00:00.000Z'};let response:unknown={pages:[page],hasMore:true};const invoke=vi.fn(async(command:string)=>command==='native_auth_login'?verified():command==='native_workspace_open'?{handle:'catalog',context:context()}:response);const port=new NativeSessionPort(invoke,()=>100);await port.login('fixture@example.invalid','fixture-password');const h=await port.open(candidate);
 const rows=await port.catalogFor(h);expect(Object.isFrozen(rows.pages[0])).toBe(true);expect(invoke.mock.calls.at(-1)).toEqual(['native_page_catalog',{handle:'catalog',more:false}]);
 for(const invalid of [{pages:[],hasMore:true},{pages:[{...page,yDocId:'page:foreign'}],hasMore:false},{pages:[page,page],hasMore:false},{pages:Array(21).fill(page),hasMore:false},{pages:[page],hasMore:false,nextCursor:'private'},{pages:[{...page,accessToken:'private'}],hasMore:false}]){response=invalid;await expect(port.catalogFor(h)).rejects.toMatchObject({stage:'protocol'});}port.dispose();
});
it('NATIVE-CATALOG: held result is discarded on cancel; overlapping query refuses without invoking',async()=>{
 let resolve!:(v:unknown)=>void;const invoke=vi.fn(async(command:string)=>command==='native_auth_login'?verified():command==='native_workspace_open'?{handle:'catalog',context:context()}:command==='native_page_catalog'?new Promise(done=>{resolve=done;}):null);const port=new NativeSessionPort(invoke,()=>100);await port.login('fixture@example.invalid','fixture-password');const h=await port.open(candidate);const query=port.catalogFor(h);await expect(port.catalogFor(h,true)).rejects.toMatchObject({stage:'busy'});await port.cancel();resolve({pages:[],hasMore:false});await expect(query).rejects.toMatchObject({stage:'closed'});expect(invoke.mock.calls.filter(c=>c[0]==='native_page_catalog')).toHaveLength(1);port.dispose();
});
it('NATIVE-TITLE-PORT: fixed IPC exposes strict status only and refuses stale handles after logout',async()=>{
 for(const kind of ['send','read'] as const){
  let response:unknown={status:kind==='send'?'conflict':'received'};
  const invoke=vi.fn(async(command:string)=>command==='native_auth_login'?verified():command==='native_workspace_open'?{handle:'native',context:context()}:command==='native_auth_logout'?{localLocked:true,persistentLocked:true,cleanupPending:false,providerConfirmed:false}:response);
  const port=new NativeSessionPort(invoke,()=>100);await port.login('fixture@example.invalid','fixture-password');const handle=await port.open(candidate);const action=()=>kind==='send'?port.sendTitleFor(handle,candidate):port.readTitleFor(handle,candidate);
  expect(await action()).toBe(kind==='send'?'conflict':'received');expect(invoke.mock.calls.at(-1)).toEqual([`native_title_${kind}`,{handle:'native',pageId:candidate}]);
  for(const value of [{status:['received']},{status:'applied',receipt:{}},{status:'received',access_token:'private'},{status:'unknown'}]){response=value;await expect(action()).rejects.toMatchObject({stage:'protocol'});}
  await port.logout();const count=invoke.mock.calls.length;await expect(action()).rejects.toMatchObject({stage:'closed'});expect(invoke.mock.calls).toHaveLength(count);port.dispose();
 }
});
