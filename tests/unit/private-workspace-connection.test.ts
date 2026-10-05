import { it, expect, vi } from 'vitest';
import { newId } from '@greiva/shared';
import {createHash} from 'node:crypto';
import {emptyPageUpdate} from '@greiva/sync';
import { AuthSession, PrivateWorkspaceConnection, type WorkspaceSessionStore } from '@greiva/sync';
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>{resolve=yes;});return {promise,resolve};}
function fixture(){
  const issuer='https://project.fixture.invalid/auth/v1',clientId=newId(),workspaceId=newId(),epoch=newId(),now='2026-10-05T03:00:00.000Z';
  const token={access_token:'fixture.access.signature',refresh_token:'fixture-refresh',token_type:'bearer',user:{id:'owner-A'}},clock={now:100};
  const auth=new AuthSession(issuer,{login:async()=>token,refresh:async()=>token,verify:async()=>({issuer,subjectId:'owner-A',expiresAt:200}),revoke:async()=>{}},()=>clock.now);
  const bootstrap={protocolVersion:1,workspaceId,clientId,epoch},operation={operationId:newId(),clientId,entityId:newId(),entityType:'task',kind:'create',baseVersion:null,payload:{title:'fixture',status:'todo',due:null}};
  const result={operationId:operation.operationId,clientId,entityId:operation.entityId,entityType:'task',status:'acknowledged',serverOrder:'1',conflicts:[],entity:{id:operation.entityId,...operation.payload,version:1,createdAt:now,updatedAt:now,deletedAt:null}};
  const push={protocolVersion:1,workspaceId,streamEpoch:epoch,results:[result]},wire=JSON.stringify({protocolVersion:1,workspaceId,clientId,operations:[operation]},null,2);
  const pullRequest={protocolVersion:1,workspaceId,clientId,cursor:null,limit:1},pull={protocolVersion:1,workspaceId,streamEpoch:epoch,operations:[result],cursor:'opaque-1',headCursor:'opaque-1',hasMore:false,serverTime:now};
  const fetchPort=vi.fn<typeof fetch>(async input=>new Response(JSON.stringify(String(input).endsWith('/bootstrap')?bootstrap:String(input).endsWith('/push')?push:pull)));
  const config={apiUrl:'http://127.0.0.1:3001',clientId},connection=new PrivateWorkspaceConnection(auth,config,fetchPort);
  const store={acknowledge:vi.fn(async()=>{}),applyPull:vi.fn(async()=>{})};
  return {auth,issuer,clientId,workspaceId,epoch,bootstrap,wire,push,pullRequest,pull,fetchPort,config,connection,store,clock,async login(){await auth.login('fixture@example.invalid','fixture-password');}};
}
it('PRIVATE-CONNECTION: bootstrap captures verified owner and strict registration before opening a bound sync session',async()=>{
  const f=fixture();await expect(f.connection.bootstrap()).rejects.toMatchObject({stage:'authentication'});expect(f.fetchPort).not.toHaveBeenCalled();await f.login();
  const context=await f.connection.bootstrap();expect(context).toEqual({issuer:f.issuer,subjectId:'owner-A',workspaceId:f.workspaceId,clientId:f.clientId,streamEpoch:f.epoch});expect(Object.isFrozen(context)).toBe(true);
  expect(JSON.parse(String(f.fetchPort.mock.calls[0]?.[1]?.body))).toEqual({clientId:f.clientId});
  const session=f.connection.openSync(f.store);await session.push(f.wire);await session.pull(f.pullRequest);expect(f.store.acknowledge).toHaveBeenCalledWith(context,JSON.parse(f.wire),f.push,f.wire);expect(f.store.applyPull).toHaveBeenCalledWith(context,f.pullRequest,f.pull);
});
it('PRIVATE-CONNECTION: fetch port is called without a connection receiver, as required by native browser fetch', async () => {
  const f = fixture(); await f.login();
  const fetchPort: typeof fetch = async function (this: unknown, input, init) {
    expect(this).toBeUndefined(); return f.fetchPort(input, init);
  };
  const connection = new PrivateWorkspaceConnection(f.auth, f.config, fetchPort);
  try { await connection.bootstrap(); const sync = connection.openSync(f.store); await sync.push(f.wire); await sync.pull(f.pullRequest); }
  finally { connection.close(); f.auth.close(); }
});
it('PRIVATE-CONNECTION: malformed/foreign-client bootstrap never binds a store',async()=>{
  const f=fixture();await f.login();for(const response of [{...f.bootstrap,clientId:newId()},{...f.bootstrap,protocolVersion:2},{...f.bootstrap,epoch:'invalid'},{...f.bootstrap,token:'unexpected'},{...f.bootstrap,workspaceId:'invalid'}]){
    f.fetchPort.mockResolvedValueOnce(new Response(JSON.stringify(response)));await expect(f.connection.bootstrap()).rejects.toMatchObject({stage:'protocol'});expect(f.connection.context).toBeNull();expect(()=>f.connection.openSync(f.store)).toThrow();}
});
it('PRIVATE-CONNECTION: caller config/store replacement cannot change captured API, registration or durable destination',async()=>{
  const f=fixture();f.config.apiUrl='https://other.invalid';f.config.clientId=newId();await f.login();await f.connection.bootstrap();const session=f.connection.openSync(f.store),old=f.store.acknowledge;f.store.acknowledge=vi.fn();await session.push(f.wire);
  expect(old).toHaveBeenCalledOnce();expect(f.store.acknowledge).not.toHaveBeenCalled();expect(f.fetchPort.mock.calls.every(([url])=>String(url).startsWith('http://127.0.0.1:3001/v1/'))).toBe(true);
  const [,request]=f.fetchPort.mock.calls.at(-1)!;expect(request?.body).toBe(f.wire);expect(request?.credentials).toBe('omit');expect(request?.redirect).toBe('error');expect(request?.cache).toBe('no-store');expect(new Headers(request?.headers).get('authorization')).toBe('Bearer fixture.access.signature');
});
it('PRIVATE-CONNECTION: refresh permanently closes old sync; same binding can reopen only after fresh bootstrap',async()=>{
  const f=fixture();await f.login();const context=await f.connection.bootstrap(),old=f.connection.openSync(f.store);await f.auth.refresh();expect(f.connection.context).toBeNull();await expect(old.push(f.wire)).rejects.toMatchObject({stage:'closed'});expect(()=>f.connection.openSync(f.store)).toThrow();
  expect(await f.connection.bootstrap()).toEqual(context);const fresh=f.connection.openSync(f.store);await fresh.push(f.wire);expect(f.store.acknowledge).toHaveBeenCalledOnce();await expect(old.pull(f.pullRequest)).rejects.toMatchObject({stage:'closed'});
});
it('PRIVATE-CONNECTION: close/refresh during bootstrap reject ignored-abort late responses without metadata binding',async()=>{
  for(const action of ['connection','auth','refresh'] as const){const f=fixture();await f.login();const wait=deferred<Response>();f.fetchPort.mockImplementationOnce(()=>wait.promise);const work=f.connection.bootstrap();await Promise.resolve();
    if(action==='connection')f.connection.close();else if(action==='auth')f.auth.close();else await f.auth.refresh();expect(f.fetchPort.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);wait.resolve(new Response(JSON.stringify(f.bootstrap)));await expect(work).rejects.toMatchObject({stage:'closed'});expect(f.connection.context).toBeNull();}
});
it('PRIVATE-CONNECTION: late ACK/pull after auth invalidation never reach a native store',async()=>{
  for(const action of ['push','pull'] as const){const f=fixture();await f.login();await f.connection.bootstrap();const session=f.connection.openSync(f.store),wait=deferred<Response>();f.fetchPort.mockImplementationOnce(()=>wait.promise);const work=action==='push'?session.push(f.wire):session.pull(f.pullRequest);await Promise.resolve();f.auth.close();wait.resolve(new Response(JSON.stringify(action==='push'?f.push:f.pull)));await expect(work).rejects.toMatchObject({stage:'closed'});expect(f.store.acknowledge).not.toHaveBeenCalled();expect(f.store.applyPull).not.toHaveBeenCalled();}
});
it('PRIVATE-CONNECTION: an already-started commit stays in the captured old store and cannot report active success after refresh',async()=>{
  const f=fixture();await f.login();await f.connection.bootstrap();const entered=deferred<void>(),finish=deferred<void>(),committed:string[]=[];
  const store:WorkspaceSessionStore={acknowledge:async context=>{entered.resolve();await finish.promise;committed.push(context.workspaceId);},applyPull:async()=>{}};
  const session=f.connection.openSync(store),work=session.push(f.wire);await entered.promise;await f.auth.refresh();await f.connection.bootstrap();const next=f.connection.openSync(f.store);finish.resolve();await expect(work).rejects.toMatchObject({stage:'closed'});expect(committed).toEqual([f.workspaceId]);expect(f.store.acknowledge).not.toHaveBeenCalled();await next.push(f.wire);expect(f.store.acknowledge).toHaveBeenCalledOnce();
});
it('PRIVATE-CONNECTION: bootstrap binding change closes the old connection without adopting an epoch or replacing pending storage',async()=>{
  const f=fixture();await f.login();await f.connection.bootstrap();const session=f.connection.openSync(f.store);f.fetchPort.mockResolvedValueOnce(new Response(JSON.stringify({...f.bootstrap,epoch:newId()})));
  await expect(f.connection.bootstrap()).rejects.toMatchObject({stage:'binding'});expect(f.connection.context).toBeNull();await expect(session.push(f.wire)).rejects.toMatchObject({stage:'closed'});await expect(f.connection.bootstrap()).rejects.toMatchObject({stage:'closed'});expect(f.store.acknowledge).not.toHaveBeenCalled();
});
it('PRIVATE-CONNECTION: registration is serial; HTTP/JSON errors and expiry are sanitized without fallback/retry',async()=>{
  const f=fixture();await f.login();const wait=deferred<Response>();f.fetchPort.mockImplementationOnce(()=>wait.promise);const work=f.connection.bootstrap();await expect(f.connection.bootstrap()).rejects.toMatchObject({stage:'busy'});wait.resolve(new Response(JSON.stringify(f.bootstrap)));await work;
  for(const [status,stage] of [[401,'authentication'],[403,'access_denied'],[503,'transport']] as const){const other=fixture();await other.login();await other.connection.bootstrap();other.fetchPort.mockResolvedValueOnce(new Response('private body',{status}));const error=await other.connection.bootstrap().catch(error=>error);expect(error.stage).toBe(stage);expect(error.message).not.toContain('private body');expect(error.cause).toBeUndefined();if(status!==503){expect(other.connection.context).toBeNull();await expect(other.connection.bootstrap()).rejects.toMatchObject({stage:'closed'});}}
  f.fetchPort.mockResolvedValueOnce(new Response('<private html>'));await expect(f.connection.bootstrap()).rejects.toMatchObject({stage:'protocol'});
  f.clock.now=200;expect(f.connection.context).toBeNull();await expect(f.connection.bootstrap()).rejects.toMatchObject({stage:'authentication'});
});
it('PRIVATE-CONNECTION: replacing the active sync or closing a connection cancels it while shared auth stays verified',async()=>{
  const f=fixture();await f.login();await f.connection.bootstrap();const first=f.connection.openSync(f.store),second=f.connection.openSync(f.store);await expect(first.push(f.wire)).rejects.toMatchObject({stage:'closed'});f.connection.close();await expect(second.push(f.wire)).rejects.toMatchObject({stage:'closed'});expect(f.auth.identity).toMatchObject({subjectId:'owner-A'});
  for(const config of [{apiUrl:'http://foreign.invalid',clientId:f.clientId},{apiUrl:'https://api.invalid/path',clientId:f.clientId},{apiUrl:'https://api.invalid',clientId:'invalid'}])expect(()=>new PrivateWorkspaceConnection(f.auth,config)).toThrow('Private workspace connection configuration');
});

function pageFixture(f:ReturnType<typeof fixture>,pageId=newId()){
  const bytes=emptyPageUpdate(),response={protocolVersion:1,workspaceId:f.workspaceId,pageId,documentName:'page:'+pageId,editorSchemaVersion:1,metadata:{id:pageId,title:'fixture',yDocId:'page:'+pageId,createdAt:'2026-10-05T00:00:00.000Z',updatedAt:'2026-10-05T00:00:00.000Z'},headOrder:'1',update:Buffer.from(bytes).toString('base64url'),digest:createHash('sha256').update(bytes).digest('hex'),stateVector:'AA'},request={protocolVersion:1,clientId:f.clientId,editorSchemaVersion:1,stateVector:'AA'},store={acknowledge:vi.fn(async()=>{}),receive:vi.fn(async()=>{})};
  return{pageId,response,request,store};
}
it('PRIVATE-CONNECTION-CATALOG: captures strict query input, fixed endpoint and immutable bound response without writing a store',async()=>{
  const f=fixture();await f.login();await f.connection.bootstrap();const p=pageFixture(f),request={protocolVersion:1,clientId:f.clientId,cursor:null,limit:1},response={protocolVersion:1,workspaceId:f.workspaceId,workspaceEpoch:f.epoch,pages:[p.response.metadata],nextCursor:'opaque-next',hasMore:true};
  f.fetchPort.mockResolvedValueOnce(new Response(JSON.stringify(response)));const result=await f.connection.queryPages(request);expect(result).toEqual(response);expect(Object.isFrozen(result.pages[0])).toBe(true);expect(Object.isFrozen(result.pages)).toBe(true);expect(String(f.fetchPort.mock.calls.at(-1)?.[0])).toBe(f.config.apiUrl+'/v1/workspaces/'+f.workspaceId+'/pages/query');expect(JSON.parse(String(f.fetchPort.mock.calls.at(-1)?.[1]?.body))).toEqual(request);expect(f.store.applyPull).not.toHaveBeenCalled();
  const count=f.fetchPort.mock.calls.length;await expect(f.connection.queryPages({...request,clientId:newId()})).rejects.toMatchObject({stage:'protocol'});expect(f.fetchPort.mock.calls.length).toBe(count);
  for(const invalid of [{...response,workspaceId:newId()},{...response,workspaceEpoch:newId()},{...response,pages:[p.response.metadata,p.response.metadata]},{...response,nextCursor:'same'}]){f.fetchPort.mockResolvedValueOnce(new Response(JSON.stringify(invalid)));await expect(f.connection.queryPages({...request,cursor:'same'})).rejects.toMatchObject({stage:'protocol'});}
  f.connection.close();f.auth.close();
});
it('PRIVATE-CONNECTION-CATALOG: close/refresh reject late responses; forbidden invalidates captured native generation while shared auth remains verified',async()=>{
  for(const action of ['close','refresh','forbidden'] as const){const f=fixture();await f.login();await f.connection.bootstrap();const signal=f.connection.generationSignal!,wait=deferred<Response>(),response={protocolVersion:1,workspaceId:f.workspaceId,workspaceEpoch:f.epoch,pages:[],nextCursor:null,hasMore:false};f.fetchPort.mockImplementationOnce(()=>wait.promise);const work=f.connection.queryPages({protocolVersion:1,clientId:f.clientId});await Promise.resolve();if(action==='close')f.connection.close();else if(action==='refresh')await f.auth.refresh();wait.resolve(new Response(JSON.stringify(response),{status:action==='forbidden'?403:200}));await expect(work).rejects.toMatchObject({stage:action==='forbidden'?'access_denied':'closed'});expect(signal.aborted).toBe(true);expect(f.auth.identity?.subjectId).toBe('owner-A');f.connection.close();f.auth.close();}
});
it('PRIVATE-CONNECTION-PAGE: same Page replacement closes old session, other Pages remain active; close leaves shared Auth verified',async()=>{
  const f=fixture();await f.login();const context=await f.connection.bootstrap(),a=pageFixture(f),b=pageFixture(f);const first=f.connection.openPage(a.pageId,a.store),other=f.connection.openPage(b.pageId,b.store),replaced=f.connection.openPage(a.pageId,a.store);
  await expect(first.pull(a.request)).rejects.toMatchObject({stage:'closed'});f.fetchPort.mockResolvedValueOnce(new Response(JSON.stringify(b.response)));await other.pull(b.request);f.fetchPort.mockResolvedValueOnce(new Response(JSON.stringify(a.response)));await replaced.pull(a.request);
  expect(b.store.receive).toHaveBeenCalledWith({...context,pageId:b.pageId,documentName:'page:'+b.pageId,editorSchemaVersion:1},b.request,b.response,expect.any(Uint8Array));expect(String(f.fetchPort.mock.calls.at(-1)?.[0])).toBe(f.config.apiUrl+'/v1/workspaces/'+f.workspaceId+'/pages/'+a.pageId+'/document/read');
  f.connection.close();await expect(other.pull(b.request)).rejects.toMatchObject({stage:'closed'});await expect(replaced.pull(a.request)).rejects.toMatchObject({stage:'closed'});expect(f.auth.identity?.subjectId).toBe('owner-A');
});
it('PRIVATE-CONNECTION-PAGE: refresh aborts old in-flight read, fresh bootstrap can reopen same bound store without ABA revival',async()=>{
  const f=fixture();await f.login();await f.connection.bootstrap();const p=pageFixture(f),old=f.connection.openPage(p.pageId,p.store),wait=deferred<Response>();f.fetchPort.mockImplementationOnce(()=>wait.promise);const work=old.pull(p.request);await expect.poll(()=>f.fetchPort.mock.calls.length).toBe(2);await f.auth.refresh();wait.resolve(new Response(JSON.stringify(p.response)));await expect(work).rejects.toMatchObject({stage:'closed'});expect(p.store.receive).not.toHaveBeenCalled();await f.connection.bootstrap();const fresh=f.connection.openPage(p.pageId,p.store);f.fetchPort.mockResolvedValueOnce(new Response(JSON.stringify(p.response)));await fresh.pull(p.request);expect(p.store.receive).toHaveBeenCalledOnce();await expect(old.pull(p.request)).rejects.toMatchObject({stage:'closed'});
});
it('PRIVATE-CONNECTION-PAGE: invalid IDs/expiry/403 cannot open or commit a Page; forbidden closes every captured session',async()=>{
  const f=fixture(),p=pageFixture(f);expect(()=>f.connection.openPage(p.pageId,p.store)).toThrow('authentication');await f.login();await f.connection.bootstrap();expect(()=>f.connection.openPage('invalid',p.store)).toThrow('configuration');const session=f.connection.openPage(p.pageId,p.store),other=f.connection.openPage(newId(),p.store);f.fetchPort.mockResolvedValueOnce(new Response('private body',{status:403}));await expect(session.pull(p.request)).rejects.toMatchObject({stage:'closed'});expect(f.connection.context).toBeNull();expect(p.store.receive).not.toHaveBeenCalled();await expect(other.pull(p.request)).rejects.toMatchObject({stage:'closed'});
  const expired=fixture();await expired.login();await expired.connection.bootstrap();const q=pageFixture(expired),active=expired.connection.openPage(q.pageId,q.store);expired.clock.now=200;expect(()=>expired.connection.openPage(q.pageId,q.store)).toThrow('authentication');await expect(active.pull(q.request)).rejects.toMatchObject({stage:'transport'});expect(q.store.receive).not.toHaveBeenCalled();
});
