import {it,expect,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {newId} from '@greiva/shared';import {AuthSession,PrivateWorkspaceConnection} from '@greiva/sync';
import {WorkspaceRegistryDevice} from '../support/workspace-registry-device.js';
import {NativeWorkspaceStore,type NativeWorkspaceInvoke} from '../../apps/client/src/workspace/native-workspace-store.js';
import {PrivateStructuredSession} from '../../apps/client/src/structured/private-structured-session.js';
import type {PushOperation} from '@greiva/protocol';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return {promise,resolve};};
async function fixture(){
 const directory=mkdtempSync(join(tmpdir(),'greiva-private-structured-session-')),registry=new WorkspaceRegistryDevice(join(directory,'store')),context={issuer:'https://auth.fixture.invalid/auth/v1',subjectId:'owner',workspaceId:newId(),clientId:newId(),streamEpoch:newId()};
 const token={access_token:'fixture.access.signature',refresh_token:'fixture-refresh',token_type:'bearer',user:{id:context.subjectId}},auth=new AuthSession(context.issuer,{login:async()=>token,refresh:async()=>token,verify:async()=>({issuer:context.issuer,subjectId:context.subjectId,expiresAt:200}),revoke:async()=>{}},()=>100);
 const state={hook:null as null|((command:string,args?:Record<string,unknown>)=>Promise<void>),loseMutationReply:false,failSnapshot:false,pull:null as null|((body:Record<string,unknown>)=>unknown)};
 const invoke:NativeWorkspaceInvoke=async(command,args)=>{await state.hook?.(command,args);const request=args?.request as {command?:string}|undefined;
  if(request?.command==='snapshot'&&state.failSnapshot){state.failSnapshot=false;throw Error('fixture-private-path read');}
  const result=await registry.invoke(command,args);if(request?.command==='mutate'&&state.loseMutationReply){state.loseMutationReply=false;throw Error('fixture-private-email reply');}return result;};
 const connection=new PrivateWorkspaceConnection(auth,{apiUrl:'http://127.0.0.1:3001',clientId:context.clientId},async(input,init)=>{
  if(String(input).endsWith('/workspaces/bootstrap'))return Response.json({protocolVersion:1,workspaceId:context.workspaceId,clientId:context.clientId,epoch:context.streamEpoch});
  if(state.pull)return Response.json(state.pull(JSON.parse(String(init?.body)) as Record<string,unknown>));
  return Response.json({protocolVersion:1,workspaceId:context.workspaceId,streamEpoch:context.streamEpoch,operations:[],cursor:'fixture-head',headCursor:'fixture-head',hasMore:false,serverTime:'2026-10-08T00:00:00.000Z'});
 });
 await auth.login('fixture@example.invalid','fixture-password');await connection.bootstrap();let store=await NativeWorkspaceStore.open(connection,invoke),session=await PrivateStructuredSession.open(connection,store);
 const create=(title='task'):PushOperation=>({operationId:newId(),clientId:context.clientId,entityType:'task',entityId:newId(),kind:'create',baseVersion:null,payload:{title,status:'todo',due:null}});
 return {context,directory,registry,state,invoke,auth,connection,get store(){return store;},get session(){return session;},create,
  async reopen(){await session.close();await store.close();await registry.close('SIGKILL');store=await NativeWorkspaceStore.open(connection,invoke);session=await PrivateStructuredSession.open(connection,store);},
  async cleanup(){await session.close();await store.close().catch(()=>{});connection.close();auth.close();await registry.close();rmSync(directory,{recursive:true,force:true});}};
}
it('PRIVATE-STRUCTURED: bound native Task/Relation CRUD and exact pending survive restart; local restore never claims synced',async()=>{
 const f=await fixture();try{expect(f.session.snapshot).toMatchObject({phase:'ready',pending:0,synced:false});const one=f.create('one'),two=f.create('two');await f.session.mutate(one);await f.session.mutate(two);
 const relation:PushOperation={operationId:newId(),clientId:f.context.clientId,entityType:'relation',entityId:newId(),kind:'create',baseVersion:null,payload:{fromType:'task',fromId:one.entityId,toType:'task',toId:two.entityId}};await f.session.mutate(relation);
 await f.session.mutate({operationId:newId(),clientId:f.context.clientId,entityType:'task',entityId:one.entityId,kind:'update',baseVersion:0,payload:{title:'edited'}});
 const before=await f.store.prepare();await f.reopen();expect(await f.store.prepare()).toBe(before);expect(f.session.snapshot).toMatchObject({pending:4,synced:false});expect(f.session.snapshot.data!.relations[0]?.id).toBe(relation.entityId);expect(Object.isFrozen(f.session.snapshot.data!.tasks)).toBe(true);
 await f.session.mutate({operationId:newId(),clientId:f.context.clientId,entityType:'relation',entityId:relation.entityId,kind:'delete',baseVersion:0,payload:{}});expect(f.session.snapshot.data!.relations[0]?.deletedAt).not.toBeNull();
 }finally{await f.cleanup();}
});
it('PRIVATE-STRUCTURED: lost mutation reply retries exact nonce/content once and validation never writes a foreign client',async()=>{
 const f=await fixture();try{const operation=f.create('unknown');f.state.loseMutationReply=true;await expect(f.session.mutate(operation)).rejects.toMatchObject({stage:'storage'});expect(f.session.snapshot).toMatchObject({retryMutation:true,synced:false});expect((await f.store.structuredSnapshot()).operations).toHaveLength(1);await expect(f.session.mutate(f.create('blocked'))).rejects.toMatchObject({stage:'busy'});
 await f.session.retryMutation();expect(f.session.snapshot).toMatchObject({pending:1,retryMutation:false,synced:false});expect(f.session.snapshot.data!.operations[0]?.operationId).toBe(operation.operationId);await expect(f.session.mutate({...f.create(),clientId:newId()})).rejects.toMatchObject({stage:'protocol'});expect(f.session.snapshot.data!.operations).toHaveLength(1);expect(JSON.stringify(f.session.snapshot)).not.toContain('fixture-private-email');
 }finally{await f.cleanup();}
});
it('PRIVATE-STRUCTURED: post-commit snapshot failure keeps same retry intent and cannot duplicate a durable entity',async()=>{
 const f=await fixture();try{const operation=f.create();f.state.failSnapshot=true;await expect(f.session.mutate(operation)).rejects.toMatchObject({stage:'storage'});expect(f.session.snapshot.retryMutation).toBe(true);await f.session.retryMutation();expect(f.session.snapshot.data!.tasks).toHaveLength(1);expect(f.session.snapshot.data!.operations).toHaveLength(1);expect(f.session.snapshot.data!.operations[0]?.operationId).toBe(operation.operationId);
 }finally{await f.cleanup();}
});
it('PRIVATE-STRUCTURED: refresh closes data immediately; ignored-abort old mutation never writes into freshly reopened store',async()=>{
 const f=await fixture(),wait=deferred();let started=false,fresh:NativeWorkspaceStore|undefined;
 try{f.state.hook=async(command,args)=>{if(command==='workspace_execute'&&(args?.request as {command?:string})?.command==='mutate'){started=true;await wait.promise;}};const work=f.session.mutate(f.create());await vi.waitFor(()=>expect(started).toBe(true));await f.auth.refresh();expect(f.session.snapshot).toMatchObject({phase:'closed',data:null,synced:false});await f.store.close();await f.connection.bootstrap();fresh=await NativeWorkspaceStore.open(f.connection,f.registry.invoke);wait.resolve();await expect(work).rejects.toMatchObject({stage:'closed'});expect((await fresh.structuredSnapshot()).tasks).toEqual([]);
 }finally{wait.resolve();await fresh?.close();await f.cleanup();}
});
it('PRIVATE-STRUCTURED: bounded explicit pull cycle leaves hasMore unconfirmed and next cycle reaches the observed head',async()=>{
 const f=await fixture();try{const peer=newId(),time='2026-10-08T00:00:00.000Z',operations=Array.from({length:101},(_,index)=>{const id=newId();return {operationId:newId(),clientId:peer,entityType:'task',entityId:id,serverOrder:String(index+1),status:'acknowledged',conflicts:[],entity:{id,title:'peer '+index,status:'todo',due:null,version:1,createdAt:time,updatedAt:time,deletedAt:null}};});
 f.state.pull=body=>({protocolVersion:1,workspaceId:f.context.workspaceId,streamEpoch:f.context.streamEpoch,operations:body.cursor===null?operations.slice(0,100):operations.slice(100),cursor:body.cursor===null?'page100':'page101',headCursor:'page101',hasMore:body.cursor===null,serverTime:time});
 await f.session.sync();expect(f.session.snapshot).toMatchObject({hasMore:true,synced:false});expect(f.session.snapshot.data!.tasks).toHaveLength(100);await f.session.sync();expect(f.session.snapshot).toMatchObject({hasMore:false,synced:true});expect(f.session.snapshot.data!.tasks).toHaveLength(101);
 }finally{await f.cleanup();}
});
it('PRIVATE-STRUCTURED: replacing the connection stream closes the old runtime even with the same live Auth generation',async()=>{
 const f=await fixture();try{await f.session.sync();expect(f.session.snapshot.synced).toBe(true);const replacement=f.connection.openSync(f.store);expect(f.session.snapshot).toMatchObject({phase:'closed',data:null,synced:false});await expect(f.session.mutate(f.create())).rejects.toMatchObject({stage:'closed'});expect((await f.store.structuredSnapshot()).operations).toEqual([]);replacement.close();}finally{await f.cleanup();}
});
