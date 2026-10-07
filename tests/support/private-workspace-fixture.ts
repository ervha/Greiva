import * as Y from 'yjs';
import { newId } from '@greiva/shared';
import type { Page } from '@greiva/protocol';
import type { PrivatePagePrepared } from '@greiva/protocol/private-page';
import { emptyPageUpdate, pageBase64, pageBytes, pageDigest } from '@greiva/sync';
import type { NativeWorkspaceInvoke } from '../../apps/client/src/workspace/native-workspace-store.js';
import type { PrivateLoginConfiguration } from '../../apps/client/src/auth/private-login.js';

// UI/unit double only. Real signed HTTP/PG/Rust tests are separate evidence.
export function privateWorkspaceFixture(){
 const configuration:PrivateLoginConfiguration={projectUrl:'https://project.fixture.invalid',apiUrl:'http://127.0.0.1:1422',algorithm:'ES256',publishableKey:'sb_publishable_fixture'};
 const context={issuer:configuration.projectUrl+'/auth/v1',subjectId:'owner',workspaceId:newId(),clientId:newId(),streamEpoch:newId()};
 type Local={metadata:Page;updates:number[][];queue:PrivatePagePrepared[];bootstrap:string;head:string|null};
 type Server={metadata:Page;doc:Y.Doc;head:number;digests:Map<string,number>};
 const local=new Map<string,Local>(),server=new Map<string,Server>(),calls:{command:string;request:Record<string,unknown>|null}[]=[];
 let active:string|null=null,generation=0,sequence=0;
 const state={loseAck:false,loseCreateReply:false,storageFailure:false,catalogFailure:false,nativeHook:null as null|((command:string,request:Record<string,unknown>|null)=>Promise<void>),queryHook:null as null|(()=>Promise<void>),readCalls:[] as string[],sentWires:[] as string[]};
 const metadata=(id:string,title:string):Page=>({id,title,yDocId:'page:'+id,createdAt:'2026-10-08T00:00:00.000Z',updatedAt:'2026-10-08T00:00:00.000Z'});
 async function queue(entry:Local,id:string,kind:'bootstrap'|'append',bytes:Uint8Array){
  const digest=await pageDigest(bytes),wire=JSON.stringify({protocolVersion:1,clientId:context.clientId,editorSchemaVersion:1,...(kind==='bootstrap'?{title:entry.metadata.title,initialUpdate:pageBase64(bytes)}:{update:pageBase64(bytes)})});
  entry.updates.push(Array.from(bytes));entry.queue.push({sequence:String(++sequence),pageId:id,kind,digest,wire});return wire;
 }
 const invoke:NativeWorkspaceInvoke=async(command,args)=>{
  const request=command==='workspace_execute'?args!.request as Record<string,unknown>:null;calls.push({command,request});await state.nativeHook?.(command,request);
  if(command==='workspace_device')return {issuer:context.issuer,subjectId:context.subjectId,clientId:context.clientId};
  if(command==='workspace_open'){active='abc-'+(++generation).toString(16)+'-1';return {handle:active,context:args!.context};}
  if(command==='workspace_close'){if(args!.handle!==active)throw Error('Old handle');active=null;return null;}
  if(command!=='workspace_execute'||args!.handle!==active)throw Error('Closed handle');
  const kind=String(request!.command),id=String(request!.pageId),entry=local.get(id);
  if(kind==='page_exists')return local.has(id);
  if(kind==='page_list'){
   const after=request!.after as string|null,limit=Number(request!.limit),rows=[...local.values()].sort((a,b)=>a.metadata.id.localeCompare(b.metadata.id)).filter(row=>after===null||row.metadata.id>after),selected=rows.slice(0,limit);
   return {context,pages:selected.map(row=>({metadata:{...row.metadata},pending:row.queue.length})),nextAfter:rows.length>limit?selected.at(-1)!.metadata.id:null};
  }
  if(kind==='page_create'){
   if(entry)return null;
   const created:Local={metadata:metadata(id,String(request!.title)),updates:[],queue:[],bootstrap:'',head:null};local.set(id,created);created.bootstrap=await queue(created,id,'bootstrap',Uint8Array.from(request!.update as number[]));
   if(state.loseCreateReply){state.loseCreateReply=false;throw Error('fixture-private-path lost reply');}return null;
  }
  if(!entry)throw Error('Missing Page');
  if(kind==='page_append'){if(state.storageFailure)throw Error('fixture-private-email storage error');await queue(entry,id,'append',Uint8Array.from(request!.update as number[]));return null;}
  if(kind==='page_load')return {page:{metadata:{...entry.metadata},updates:entry.updates.map(bytes=>bytes.slice())},pending:entry.queue.length,serverHead:entry.head};
  if(kind==='page_prepare')return entry.queue[0]?{...entry.queue[0]}:null;
  if(kind==='page_ack'){if(entry.queue[0]?.wire!==request!.wire)throw Error('Wrong receipt');entry.queue.shift();return null;}
  if(kind==='page_receive'){
   const response=request!.response as {metadata:Page;update:string;headOrder:string};entry.updates.push(Array.from(pageBytes(response.update)));entry.head=response.headOrder;
   if(!entry.queue.length)entry.metadata={...response.metadata};return null;
  }
  throw Error('Unexpected request');
 };
 const fetchPort:typeof fetch=async(input,init)=>{
  const url=String(input),body=init?.body?JSON.parse(String(init.body)) as Record<string,string>:{};
  if(url.includes('/token?'))return Response.json({access_token:'fixture.access.signature',refresh_token:'fixture-refresh',token_type:'bearer',user:{id:context.subjectId}});
  if(url.endsWith('/v1/session'))return Response.json({issuer:context.issuer,subjectId:context.subjectId,expiresAt:Math.floor(Date.now()/1000)+300});
  if(url.includes('/logout?'))return new Response('');
  if(url.endsWith('/workspaces/bootstrap'))return Response.json({protocolVersion:1,workspaceId:context.workspaceId,clientId:body.clientId,epoch:context.streamEpoch});
  if(url.endsWith('/pages/query')){
   await state.queryHook?.();if(state.catalogFailure)return Response.json({error:'fixture-private-token'},{status:503});
   const after=body.cursor?.slice('fixture:'.length),rows=[...server.values()].map(value=>value.metadata).sort((a,b)=>a.id.localeCompare(b.id)).filter(row=>!after||row.id>after),limit=Number(body.limit),selected=rows.slice(0,limit),more=rows.length>limit;
   return Response.json({protocolVersion:1,workspaceId:context.workspaceId,workspaceEpoch:context.streamEpoch,pages:selected,nextCursor:more?'fixture:'+selected.at(-1)!.id:null,hasMore:more});
  }
  const match=/\/pages\/([^/]+)\/document\/(bootstrap|append|read)$/.exec(url);if(!match)return new Response('{}',{status:404});const id=match[1]!,kind=match[2]!,scope={protocolVersion:1,workspaceId:context.workspaceId,pageId:id,documentName:'page:'+id,editorSchemaVersion:1};let saved=server.get(id);
  if(kind==='read'){
   state.readCalls.push(id);if(!saved)return new Response('{}',{status:404});
   const update=Y.encodeStateAsUpdate(saved.doc,pageBytes(body.stateVector!));
   // Downloading a remote-only Page creates its durable record in the double.
   local.set(id,local.get(id)??{metadata:{...saved.metadata},updates:[],queue:[],bootstrap:'',head:null});
   return Response.json({...scope,metadata:saved.metadata,headOrder:String(saved.head),update:pageBase64(update),digest:await pageDigest(update),stateVector:pageBase64(Y.encodeStateVector(saved.doc))});
  }
  state.sentWires.push(String(init?.body));const bytes=pageBytes((kind==='bootstrap'?body.initialUpdate:body.update)!),digest=await pageDigest(bytes);
  if(!saved){if(kind!=='bootstrap')return new Response('{}',{status:404});saved={metadata:metadata(id,body.title!),doc:new Y.Doc({gc:false}),head:1,digests:new Map()};server.set(id,saved);}
  if(!saved.digests.has(digest)){Y.applyUpdate(saved.doc,bytes);if(kind==='append')++saved.head;saved.digests.set(digest,saved.head);}
  if(state.loseAck){state.loseAck=false;return Response.json({error:'lost'},{status:503});}
  return Response.json(kind==='bootstrap'?{...scope,metadata:saved.metadata,initialDigest:digest}:{...scope,serverOrder:String(saved.digests.get(digest)),headOrder:String(saved.head),digest,stateVector:pageBase64(Y.encodeStateVector(saved.doc))});
 };
 async function seedLocal(title:string,id=newId()){
  const entry:Local={metadata:metadata(id,title),updates:[],queue:[],bootstrap:'',head:null};local.set(id,entry);entry.bootstrap=await queue(entry,id,'bootstrap',emptyPageUpdate());return id;
 }
 function seedRemote(title:string,text='remote',id=newId()){
  const doc=new Y.Doc({gc:false});Y.applyUpdate(doc,emptyPageUpdate());const block=doc.getXmlFragment('body').get(0) as Y.XmlElement;block.insert(0,[new Y.XmlText(text)]);server.set(id,{metadata:metadata(id,title),doc,head:1,digests:new Map()});return id;
 }
 function edit(doc:Y.Doc,text:string){const block=doc.getXmlFragment('body').get(0) as Y.XmlElement;if(!block.length)block.insert(0,[new Y.XmlText()]);(block.get(0) as Y.XmlText).insert(0,text);}
 return {configuration,context,invoke,fetchPort,local,server,calls,state,seedLocal,seedRemote,edit,cleanup(){for(const saved of server.values())saved.doc.destroy();}};
}
