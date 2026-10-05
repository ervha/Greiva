import { it, expect, vi } from 'vitest';
import { newId, utcNow } from '@greiva/shared';
import { WorkspaceSyncSession, type WorkspaceSessionStore } from '@greiva/sync';

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }
function fixture() {
  const context={issuer:'https://auth.fixture.invalid/auth/v1',subjectId:'subject-A',workspaceId:newId(),clientId:newId(),streamEpoch:newId()},now=utcNow();
  const operation={operationId:newId(),clientId:context.clientId,entityId:newId(),entityType:'task',kind:'create',baseVersion:null,payload:{title:'fixture 日本語',status:'todo',due:null}};
  const result={operationId:operation.operationId,clientId:context.clientId,entityId:operation.entityId,entityType:'task',status:'acknowledged',serverOrder:'1',conflicts:[],entity:{id:operation.entityId,...operation.payload,version:1,createdAt:now,updatedAt:now,deletedAt:null}};
  const request={protocolVersion:1,workspaceId:context.workspaceId,clientId:context.clientId,operations:[operation]},wire=JSON.stringify(request,null,2);
  const push={protocolVersion:1,workspaceId:context.workspaceId,streamEpoch:context.streamEpoch,results:[result]};
  const pullRequest={protocolVersion:1,workspaceId:context.workspaceId,clientId:context.clientId,cursor:null,limit:1};
  const pull={protocolVersion:1,workspaceId:context.workspaceId,streamEpoch:context.streamEpoch,operations:[result],cursor:'opaque-current',headCursor:'opaque-current',hasMore:false,serverTime:now};
  const transport={push:vi.fn(async (_wire:string,_signal:AbortSignal):Promise<unknown>=>push),pull:vi.fn(async (_request:unknown,_signal:AbortSignal):Promise<unknown>=>pull)};
  const store={acknowledge:vi.fn(async (_ctx:unknown,_request:unknown,_response:unknown)=>{}),applyPull:vi.fn(async (_ctx:unknown,_request:unknown,_response:unknown)=>{})};
  return {context,request,wire,push,pullRequest,pull,transport,store,session:new WorkspaceSyncSession(context,{transport,store})};
}
it('WORKSPACE-SESSION: preserves prepared bytes, captures immutable account scope and commits only after response validation',async()=>{
  const f=fixture(),original={...f.context};f.context.subjectId='mutated';f.context.issuer='mutated';
  await f.session.push(f.wire);expect(f.transport.push.mock.calls[0]?.[0]).toBe(f.wire);expect(f.store.acknowledge).toHaveBeenCalledWith(original,f.request,f.push,f.wire);
  const call=f.store.acknowledge.mock.calls[0]!;expect(Object.isFrozen(call[0])).toBe(true);expect(Object.isFrozen(call[1])).toBe(true);expect(Object.isFrozen(call[2])).toBe(true);expect(Object.isFrozen(f.push)).toBe(false);
});
it('WORKSPACE-SESSION: caller port replacement while network is waiting never rebinds the captured old store',async()=>{
  const f=fixture(),wait=deferred<unknown>();f.transport.push.mockImplementationOnce(()=>wait.promise);const old=f.store.acknowledge,result=f.session.push(f.wire);
  f.store.acknowledge=vi.fn();wait.resolve(f.push);await result;expect(old).toHaveBeenCalledOnce();expect(f.store.acknowledge).not.toHaveBeenCalled();
});
it('WORKSPACE-SESSION: close aborts and rejects late ACK even when a new session has identical account/workspace IDs',async()=>{
  const f=fixture(),wait=deferred<unknown>();f.transport.push.mockImplementationOnce(()=>wait.promise);const old=f.session.push(f.wire);f.session.close();
  expect(f.transport.push.mock.calls[0]?.[1].aborted).toBe(true);const fresh=fixture();const newSession=new WorkspaceSyncSession(f.context,{transport:fresh.transport,store:fresh.store});fresh.transport.push.mockResolvedValue(f.push);
  await newSession.push(f.wire);wait.resolve(f.push);await expect(old).rejects.toMatchObject({stage:'closed'});expect(f.store.acknowledge).not.toHaveBeenCalled();expect(fresh.store.acknowledge).toHaveBeenCalledOnce();await expect(f.session.push(f.wire)).rejects.toMatchObject({stage:'closed'});
});
it('WORKSPACE-SESSION: late pull from a closed old account never advances its cursor or the new account store',async()=>{
  const f=fixture(),wait=deferred<unknown>();f.transport.pull.mockImplementationOnce(()=>wait.promise);const old=f.session.pull(f.pullRequest);f.session.close();const fresh=fixture();await fresh.session.pull(fresh.pullRequest);
  wait.resolve(f.pull);await expect(old).rejects.toMatchObject({stage:'closed'});expect(f.store.applyPull).not.toHaveBeenCalled();expect(fresh.store.applyPull).toHaveBeenCalledWith(fresh.context,fresh.pullRequest,fresh.pull);
});
it('WORKSPACE-SESSION: wrong outbound scope/client and malformed prepared wire never enter transport',async()=>{
  const f=fixture();for(const wire of ['invalid JSON',JSON.stringify({...f.request,workspaceId:newId()}),JSON.stringify({...f.request,clientId:newId()})])await expect(f.session.push(wire)).rejects.toMatchObject({stage:'protocol'});
  await expect(f.session.pull({...f.pullRequest,workspaceId:newId()})).rejects.toMatchObject({stage:'protocol'});expect(f.transport.push).not.toHaveBeenCalled();expect(f.transport.pull).not.toHaveBeenCalled();
});
it('WORKSPACE-SESSION: foreign epoch/workspace/protocol and unmatched ACK never reach store',async()=>{
  const f=fixture();for(const response of [{...f.push,streamEpoch:newId()},{...f.push,workspaceId:newId()},{...f.push,protocolVersion:2},{...f.push,results:[]}]){f.transport.push.mockResolvedValueOnce(response);await expect(f.session.push(f.wire)).rejects.toMatchObject({stage:'protocol'});}expect(f.store.acknowledge).not.toHaveBeenCalled();
});
it('WORKSPACE-SESSION: pull refuses invalid progress, over-limit, duplicate/order reversal and wrong epoch before applying cursor',async()=>{
  const f=fixture(),first=f.pull.operations[0]!,second={...first,operationId:newId(),serverOrder:'2'};
  for(const response of [{...f.pull,operations:[],hasMore:true},{...f.pull,hasMore:true},{...f.pull,headCursor:'other'}, {...f.pull,operations:[first,second]}, {...f.pull,streamEpoch:newId()}]){f.transport.pull.mockResolvedValueOnce(response);await expect(f.session.pull(f.pullRequest)).rejects.toMatchObject({stage:'protocol'});}
  for(const operations of [[first,first],[second,first]]){f.transport.pull.mockResolvedValueOnce({...f.pull,operations});await expect(f.session.pull({...f.pullRequest,limit:2})).rejects.toMatchObject({stage:'protocol'});}
  expect(f.store.applyPull).not.toHaveBeenCalled();await f.session.pull(f.pullRequest);expect(f.store.applyPull).toHaveBeenCalledOnce();
});
it('WORKSPACE-SESSION: serializes requests, retries identical prepared bytes and sanitizes network/storage failures',async()=>{
  const f=fixture(),wait=deferred<unknown>();f.transport.push.mockImplementationOnce(()=>wait.promise);const active=f.session.push(f.wire);await expect(f.session.pull(f.pullRequest)).rejects.toMatchObject({stage:'busy'});expect(f.transport.pull).not.toHaveBeenCalled();wait.resolve(f.push);await active;
  f.transport.push.mockRejectedValueOnce(Error('private transport headers'));const network=await f.session.push(f.wire).catch(error=>error);expect(network.stage).toBe('transport');expect(network.cause).toBeUndefined();expect(network.message).not.toContain('private');await f.session.push(f.wire);expect(f.transport.push.mock.calls.every(([wire])=>wire===f.wire)).toBe(true);
  f.store.acknowledge.mockRejectedValueOnce(Error('private DB payload'));await expect(f.session.push(f.wire)).rejects.toMatchObject({stage:'storage'});
});
it('WORKSPACE-SESSION: a commit already started can finish only in captured old store, with no active success after close',async()=>{
  const f=fixture(),committed:string[]=[],start=deferred<void>(),finish=deferred<void>();const oldStore:WorkspaceSessionStore={acknowledge:async context=>{start.resolve();await finish.promise;committed.push(context.workspaceId);},applyPull:async()=>{}};
  const session=new WorkspaceSyncSession(f.context,{transport:f.transport,store:oldStore}),work=session.push(f.wire);await start.promise;session.close();const fresh=fixture();finish.resolve();await expect(work).rejects.toMatchObject({stage:'closed'});expect(committed).toEqual([f.context.workspaceId]);expect(fresh.store.acknowledge).not.toHaveBeenCalled();
});
