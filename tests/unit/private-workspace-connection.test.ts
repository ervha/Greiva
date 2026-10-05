import { it, expect, vi } from 'vitest';
import { newId } from '@greiva/shared';
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
