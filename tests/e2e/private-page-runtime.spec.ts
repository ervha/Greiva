import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';
import {newId} from '@greiva/shared';import {emptyPageUpdate} from '@greiva/sync';
test('PAGE-BROWSER-RUNTIME: real secure-context WebCrypto/base64 and portable session validate and commit binary without Node APIs',async({page})=>{
  const bytes=emptyPageUpdate(),pageId=newId(),workspaceId=newId(),clientId=newId(),streamEpoch=newId(),binary=Buffer.from(bytes).toString('base64url'),digest=createHash('sha256').update(bytes).digest('hex');
  await page.goto('/auth.html');
  const result=await page.evaluate(async({pageId,workspaceId,clientId,streamEpoch,binary,digest})=>{
    const binaryPath='/@fs/workspace/packages/sync/src/page-binary.ts',sessionPath='/@fs/workspace/packages/sync/src/page-session.ts';
    const {pageBytes,pageBase64,pageDigest}=await import(binaryPath),{PageSyncSession}=await import(sessionPath),events:string[]=[];
    const context={issuer:'https://auth.fixture.invalid/auth/v1',subjectId:'owner',pageId,documentName:'page:'+pageId,workspaceId,clientId,streamEpoch,editorSchemaVersion:1},time='2026-10-05T00:00:00.000Z';
    const metadata={id:pageId,title:'日本語',yDocId:context.documentName,createdAt:time,updatedAt:time},scope={protocolVersion:1,workspaceId,pageId,documentName:context.documentName,editorSchemaVersion:1},request={protocolVersion:1,clientId,editorSchemaVersion:1,title:metadata.title,initialUpdate:binary},wire=JSON.stringify(request,null,2),prepared={sequence:'1',pageId,kind:'bootstrap',digest,wire};
    const response={...scope,metadata,headOrder:'1',update:binary,digest,stateVector:'AA'};let received:number[]=[];
    const session=new PageSyncSession(context,{transport:{push:async(_kind:string,captured:string)=>{events.push(captured===wire?'exact-wire':'changed-wire');return{...scope,metadata,initialDigest:digest};},read:async()=>response},store:{acknowledge:async()=>{events.push('ack-commit');},receive:async(_ctx:unknown,_request:unknown,_response:unknown,update:Uint8Array)=>{events.push('receive-commit');received=Array.from(update);}}});
    await session.push(prepared);await session.pull({protocolVersion:1,clientId,editorSchemaVersion:1,stateVector:'AA'});let invalid='';try{await session.push({...prepared,digest:'0'.repeat(64)});}catch(error){invalid=(error as {stage:string}).stage;}
    return{secure:isSecureContext,subtle:!!crypto.subtle,roundTrip:pageBase64(pageBytes(binary)),hash:await pageDigest(pageBytes(binary)),received,events,invalid};
  },{pageId,workspaceId,clientId,streamEpoch,binary,digest});
  expect(result).toEqual({secure:true,subtle:true,roundTrip:binary,hash:digest,received:Array.from(bytes),events:['exact-wire','ack-commit','receive-commit'],invalid:'protocol'});
});
test('NATIVE-WORKSPACE-BROWSER: adapter imports with browser Tauri module, sends fixed-handle bytes and closes Auth generation without Web fallback',async({page})=>{
  const workspaceId=newId(),clientId=newId(),streamEpoch=newId(),pageId=newId(),update=Array.from(emptyPageUpdate());await page.goto('/auth.html');
  const result=await page.evaluate(async({workspaceId,clientId,streamEpoch,pageId,update})=>{
    const syncPath='/@fs/workspace/packages/sync/src/index.ts',nativePath='/@fs/workspace/apps/client/src/workspace/native-workspace-store.ts';const {AuthSession,PrivateWorkspaceConnection}=await import(syncPath),{NativeWorkspaceStore}=await import(nativePath);
    const issuer='https://auth.fixture.invalid/auth/v1',subjectId='owner',context={issuer,subjectId,workspaceId,clientId,streamEpoch},token={access_token:'fixture.access.signature',refresh_token:'fixture-refresh',token_type:'bearer',user:{id:subjectId}},auth=new AuthSession(issuer,{login:async()=>token,refresh:async()=>token,verify:async()=>({issuer,subjectId,expiresAt:Math.floor(Date.now()/1000)+300}),revoke:async()=>{}}),connection=new PrivateWorkspaceConnection(auth,{apiUrl:'http://127.0.0.1:3001',clientId},async()=>new Response(JSON.stringify({protocolVersion:1,workspaceId,clientId,epoch:streamEpoch})));
    await auth.login('fixture@example.invalid','fixture-password');await connection.bootstrap();const calls:{command:string;args:unknown}[]=[];const invoke=async(command:string,args:unknown)=>{calls.push({command,args});return command==='workspace_open'?{handle:'abc-123-1',context}:null;};let fallback='';try{await NativeWorkspaceStore.open(connection);}catch(error){fallback=(error as {stage:string}).stage;}
    const store=await NativeWorkspaceStore.open(connection,invoke),nativePage=store.page(pageId);await nativePage.create('日本語',Uint8Array.from(update));await auth.refresh();await store.close();let old='';try{await nativePage.append(Uint8Array.from(update));}catch(error){old=(error as {stage:string}).stage;}connection.close();auth.close();return{calls,fallback,old};
  },{workspaceId,clientId,streamEpoch,pageId,update});
  expect(result.fallback).toBe('configuration');expect(result.old).toBe('closed');expect(result.calls).toEqual([{command:'workspace_open',args:{context:{issuer:'https://auth.fixture.invalid/auth/v1',subjectId:'owner',workspaceId,clientId,streamEpoch}}},{command:'workspace_execute',args:{handle:'abc-123-1',request:{command:'page_create',pageId,title:'日本語',update}}},{command:'workspace_close',args:{handle:'abc-123-1'}}]);
});
