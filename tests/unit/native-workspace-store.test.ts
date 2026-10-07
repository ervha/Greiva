import {it,expect,vi} from 'vitest';
import {newId} from '@greiva/shared';import {AuthSession,PrivateWorkspaceConnection,emptyPageUpdate} from '@greiva/sync';
import {NativeWorkspaceStore,type NativeWorkspaceInvoke} from '../../apps/client/src/workspace/native-workspace-store.js';
const deferred=<T>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>{resolve=yes;});return{promise,resolve};};
async function fixture(){
  const context={issuer:'https://auth.fixture.invalid/auth/v1',subjectId:'owner',workspaceId:newId(),clientId:newId(),streamEpoch:newId()},token={access_token:'fixture.access.signature',refresh_token:'fixture-refresh',token_type:'bearer',user:{id:context.subjectId}},auth=new AuthSession(context.issuer,{login:async()=>token,refresh:async()=>token,verify:async()=>({issuer:context.issuer,subjectId:context.subjectId,expiresAt:200}),revoke:async()=>{}},()=>100),connection=new PrivateWorkspaceConnection(auth,{apiUrl:'http://127.0.0.1:3001',clientId:context.clientId},async()=>new Response(JSON.stringify({protocolVersion:1,workspaceId:context.workspaceId,clientId:context.clientId,epoch:context.streamEpoch})));
  await auth.login('fixture@example.invalid','fixture-password');await connection.bootstrap();const handle='abc-123-1',invoke=vi.fn<NativeWorkspaceInvoke>(async<T>(command:string)=>({workspace_open:{handle,context},workspace_close:null,workspace_execute:{context,snapshot:{}}})[command as 'workspace_open'] as T),id=newId();
  return{context,auth,connection,handle,invoke,id,async cleanup(){connection.close();auth.close();}};
}
it('NATIVE-WORKSPACE: failed/foreign native handle never adopts another store; private errors are sanitized',async()=>{
  const f=await fixture();try{for(const response of [{handle:'../foreign',context:f.context},{handle:f.handle,context:{...f.context,subjectId:'other'}},{handle:f.handle,context:f.context,path:'private.sqlite'}]){f.invoke.mockResolvedValueOnce(response);await expect(NativeWorkspaceStore.open(f.connection,f.invoke)).rejects.toMatchObject({stage:'protocol'});}f.invoke.mockRejectedValueOnce(Error('private database path token'));await expect(NativeWorkspaceStore.open(f.connection,f.invoke)).rejects.toMatchObject({stage:'storage',message:'Native workspace storage'});}finally{await f.cleanup();}
});
it('NATIVE-WORKSPACE: refresh during native open closes a late handle and old generation never exposes storage',async()=>{
  const f=await fixture(),wait=deferred<unknown>();try{f.invoke.mockImplementationOnce(()=>wait.promise as Promise<never>);const work=NativeWorkspaceStore.open(f.connection,f.invoke);await f.auth.refresh();wait.resolve({handle:f.handle,context:f.context});await expect(work).rejects.toMatchObject({stage:'closed'});expect(f.invoke).toHaveBeenLastCalledWith('workspace_close',{handle:f.handle});}finally{await f.cleanup();}
});
it('NATIVE-WORKSPACE: execute captures requests and exact handle; close during admitted work rejects late success and cleanup coalesces',async()=>{
  const f=await fixture(),wait=deferred<unknown>();try{const store=await NativeWorkspaceStore.open(f.connection,f.invoke);f.invoke.mockImplementationOnce(()=>wait.promise as Promise<never>);const request={cursor:null,protocolVersion:1,workspaceId:f.context.workspaceId,clientId:f.context.clientId,limit:1},response={protocolVersion:1 as const,workspaceId:f.context.workspaceId,streamEpoch:f.context.streamEpoch,operations:[],cursor:'same',headCursor:'same',hasMore:false,serverTime:'2026-10-05T00:00:00.000Z'};const work=store.applyPull(f.context,request,response);response.cursor='mutated';expect((f.invoke.mock.calls[1]?.[1]?.request as any).response.cursor).toBe('same');const one=store.close(),two=store.close();expect(one).toBe(two);wait.resolve(null);await expect(work).rejects.toMatchObject({stage:'closed'});await one;expect(f.invoke.mock.calls.filter(call=>call[0]==='workspace_close')).toHaveLength(1);}finally{await f.cleanup();}
});
it('NATIVE-WORKSPACE: Page methods reject malformed bytes/IDs/load/foreign response and cannot inject a path or override the captured Page',async()=>{
  const f=await fixture();try{const store=await NativeWorkspaceStore.open(f.connection,f.invoke);expect(()=>store.page('../foreign')).toThrow('protocol');const page=store.page(f.id);await expect(page.append(Uint8Array.from([255]))).rejects.toMatchObject({stage:'protocol'});expect(f.invoke).toHaveBeenCalledTimes(1);await page.create('日本語',emptyPageUpdate());const args=f.invoke.mock.calls[1]?.[1];expect(args).toMatchObject({handle:f.handle,request:{command:'page_create',pageId:f.id,title:'日本語',update:Array.from(emptyPageUpdate())}});expect(args).not.toHaveProperty('path');f.invoke.mockResolvedValueOnce({page:{metadata:{id:newId()}},serverHead:null,pending:0});await expect(page.load()).rejects.toMatchObject({stage:'protocol'});await store.pageCommand(f.id,'page_prepare',{pageId:newId(),command:'sql'});expect(f.invoke).toHaveBeenLastCalledWith('workspace_execute',{handle:f.handle,request:{command:'page_prepare',pageId:f.id}});await store.close();}finally{await f.cleanup();}
});
it('NATIVE-WORKSPACE: Auth abort permanently closes captured store even after fresh bootstrap with identical IDs',async()=>{
  const f=await fixture();try{const store=await NativeWorkspaceStore.open(f.connection,f.invoke),page=store.page(f.id);await f.auth.refresh();await f.connection.bootstrap();await expect(store.prepare()).rejects.toMatchObject({stage:'closed'});await expect(page.create('retained',emptyPageUpdate())).rejects.toMatchObject({stage:'closed'});await store.close();const fresh=await NativeWorkspaceStore.open(f.connection,f.invoke);f.invoke.mockResolvedValueOnce(null);expect(await fresh.page(f.id).prepare()).toBeNull();await fresh.close();}finally{await f.cleanup();}
});
it('NATIVE-WORKSPACE: cleanup failure is safe and never reopens ports or deletes retained data',async()=>{
  const f=await fixture();try{const store=await NativeWorkspaceStore.open(f.connection,f.invoke);f.invoke.mockRejectedValueOnce(Error('private path'));await expect(store.close()).rejects.toMatchObject({stage:'storage',message:'Native workspace storage'});await expect(store.snapshot()).rejects.toMatchObject({stage:'closed'});expect(f.invoke.mock.calls.map(call=>call[0])).toEqual(['workspace_open','workspace_close']);}finally{await f.cleanup();}
});
it('NATIVE-WORKSPACE: connection close aborts the native generation and starts cleanup while shared Auth remains verified',async()=>{
  const f=await fixture();try{const store=await NativeWorkspaceStore.open(f.connection,f.invoke);f.connection.close();await expect.poll(()=>f.invoke.mock.calls.filter(call=>call[0]==='workspace_close').length).toBe(1);expect(f.auth.identity?.subjectId).toBe(f.context.subjectId);await expect(store.prepare()).rejects.toMatchObject({stage:'closed'});await store.close();}finally{await f.cleanup();}
});
it('LOCAL-PAGE-CATALOG: strict request and bound immutable response; no binary/wire or caller mutation',async()=>{
 const f=await fixture();try{
  const store=await NativeWorkspaceStore.open(f.connection,f.invoke),metadata={id:f.id,title:'local pending',yDocId:'page:'+f.id,createdAt:'2026-10-08T00:00:00.000Z',updatedAt:'2026-10-08T00:00:00.000Z'};
  const response={context:f.context,pages:[{metadata,pending:2}],nextAfter:null};f.invoke.mockResolvedValueOnce(response);
  const result=await store.listPages();expect(result.pages[0]?.pending).toBe(2);expect(Object.isFrozen(result.pages[0]?.metadata)).toBe(true);
  expect(f.invoke).toHaveBeenLastCalledWith('workspace_execute',{handle:f.handle,request:{command:'page_list',after:null,limit:50}});
  const count=f.invoke.mock.calls.length;for(const candidate of [{after:null,limit:0},{after:'../path',limit:1},{after:null,limit:101},{after:null,limit:1,sql:'delete'}])await expect(store.listPages(candidate)).rejects.toMatchObject({stage:'protocol'});expect(f.invoke).toHaveBeenCalledTimes(count);
  for(const candidate of [{...response,context:{...f.context,clientId:newId()}},{...response,nextAfter:newId()},{...response,pages:[{metadata,pending:-1}]},{...response,pages:[{metadata,pending:1,wire:'private'}]}]){f.invoke.mockResolvedValueOnce(candidate);await expect(store.listPages()).rejects.toMatchObject({stage:'protocol'});}
  f.invoke.mockResolvedValueOnce(response);await expect(store.listPages({after:f.id,limit:1})).rejects.toMatchObject({stage:'protocol'});
  await store.close();
 }finally{await f.cleanup();}
});
it('LOCAL-PAGE-CATALOG: Auth close rejects ignored-abort late result and does not adopt a current workspace',async()=>{
 const f=await fixture();try{const store=await NativeWorkspaceStore.open(f.connection,f.invoke),wait=deferred<unknown>();f.invoke.mockImplementationOnce(()=>wait.promise);const work=store.listPages();f.connection.close();wait.resolve({context:f.context,pages:[],nextAfter:null});await expect(work).rejects.toMatchObject({stage:'closed'});await store.close();}finally{await f.cleanup();}
});
