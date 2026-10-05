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
