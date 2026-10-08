import * as Y from 'yjs';
import { newId } from '@greiva/shared';
import type { Page,PushOperation,PushResult,StructuredSnapshot,Conflict } from '@greiva/protocol';
import type { PrivatePagePrepared } from '@greiva/protocol/private-page';
import { emptyPageUpdate, pageBase64, pageBytes, pageDigest } from '@greiva/sync';
import type { NativeWorkspaceInvoke } from '../../apps/client/src/workspace/native-workspace-store.js';
import type { PrivateLoginConfiguration } from '../../apps/client/src/auth/private-login.js';
import {privateTitleFixture} from './private-title-fixture.js';

// UI/unit double only. Real signed HTTP/PG/Rust tests are separate evidence.
export function privateWorkspaceFixture(){
 const configuration:PrivateLoginConfiguration={projectUrl:'https://project.fixture.invalid',apiUrl:'http://127.0.0.1:1422',algorithm:'ES256',publishableKey:'sb_publishable_fixture'};
 const context={issuer:configuration.projectUrl+'/auth/v1',subjectId:'owner',workspaceId:newId(),clientId:newId(),streamEpoch:newId()};
 type Local={metadata:Page;updates:number[][];queue:PrivatePagePrepared[];bootstrap:string;head:string|null};
 type Server={metadata:Page;doc:Y.Doc;head:number;digests:Map<string,number>};
 const local=new Map<string,Local>(),server=new Map<string,Server>(),calls:{command:string;request:Record<string,unknown>|null}[]=[];
 const structured:StructuredSnapshot={clientId:context.clientId,tasks:[],relations:[],operations:[],conflicts:[],errors:[],state:{stream:'structured',cursor:null,headCursor:null,lastSuccessfulSyncAt:null}},ledger:PushResult[]=[],prepared=new Map<string,string>();
 const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));const time='2026-10-08T00:00:00.000Z';
 function receive(result:PushResult){const rows=result.entityType==='task'?structured.tasks:structured.relations;if(result.entity){const index=rows.findIndex(row=>row.id===result.entityId);if(index<0)(rows as unknown[]).push(clone(result.entity));else (rows as unknown[])[index]=clone(result.entity);}
  for(const conflict of result.conflicts){const index=structured.conflicts.findIndex(row=>row.id===conflict.id);if(index<0)structured.conflicts.push(clone(conflict));else structured.conflicts[index]=clone(conflict);}}
 let active:string|null=null,generation=0,sequence=0;
 const state={loseAck:false,loseCreateReply:false,storageFailure:false,catalogFailure:false,structuredLoseAck:false,structuredReject:false,structuredLoseMutationReply:false,structuredStorageFailure:false,structuredSent:[] as string[],nativeHook:null as null|((command:string,request:Record<string,unknown>|null)=>Promise<void>),queryHook:null as null|(()=>Promise<void>),readCalls:[] as string[],sentWires:[] as string[]};
 const metadata=(id:string,title:string):Page=>({id,title,yDocId:'page:'+id,createdAt:'2026-10-08T00:00:00.000Z',updatedAt:'2026-10-08T00:00:00.000Z'});
 const title=privateTitleFixture(context,{local:id=>local.get(id)?.metadata,server:id=>server.get(id)?.metadata,project:(id,value)=>{local.get(id)!.metadata.title=value;},remote:(id,value)=>{server.get(id)!.metadata.title=value;},bootstrapPending:id=>Boolean(local.get(id)?.queue.some(frame=>frame.kind==='bootstrap'))});
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
  if(kind.startsWith('title_'))return title.execute(kind,id,request!);
  if(kind==='snapshot')return {context,snapshot:clone(structured)};
  if(kind==='mutate'){
   if(state.structuredStorageFailure)throw Error('fixture-private-task storage');const operation=request!.operation as PushOperation,rows=operation.entityType==='task'?structured.tasks:structured.relations,previous=rows.find(row=>row.id===operation.entityId);if(structured.operations.some(row=>row.operationId===operation.operationId))return clone(previous);
   if(operation.kind!=='create'&&(!previous||previous.version!==operation.baseVersion))throw Error('Stale base');
   const entity={...previous,id:operation.entityId,version:previous?.version??0,createdAt:previous?.createdAt??time,updatedAt:time,deletedAt:operation.kind==='delete'?time:null,...operation.payload as object};const index=rows.findIndex(row=>row.id===operation.entityId);if(index<0)(rows as unknown[]).push(entity);else (rows as unknown[])[index]=entity;structured.operations.push({...clone(operation),createdAt:time,status:'pending'});
   if(state.structuredLoseMutationReply){state.structuredLoseMutationReply=false;throw Error('fixture-private-task lost reply');}return clone(entity);
  }
  if(kind==='prepare'){const operation=structured.operations.find(row=>row.status==='pending');if(!operation)return null;if(!prepared.has(operation.operationId)){const {createdAt:_,status:__,...wire}=operation;prepared.set(operation.operationId,JSON.stringify({protocolVersion:1,workspaceId:context.workspaceId,clientId:context.clientId,operations:[wire]}));}return prepared.get(operation.operationId);}
  if(kind==='ack'){const response=request!.response as {results:PushResult[]};for(const result of response.results){const operation=structured.operations.find(row=>row.operationId===result.operationId)!;operation.status=result.status==='rejected'?'rejected':'acknowledged';if(result.status==='rejected')structured.errors.push({operationId:operation.operationId,error:result.error.code});receive(result);}return null;}
  if(kind==='pull'){const response=request!.response as {operations:PushResult[];cursor:string;headCursor:string;serverTime:string};response.operations.forEach(receive);structured.state={stream:'structured',cursor:response.cursor,headCursor:response.headCursor,lastSuccessfulSyncAt:response.serverTime};return null;}
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
   if(!entry.queue.length&&!title.managed(id))entry.metadata={...response.metadata};return null;
  }
  throw Error('Unexpected request');
 };
 const fetchPort:typeof fetch=async(input,init)=>{
  const url=String(input),body=init?.body?JSON.parse(String(init.body)) as Record<string,string>:{};
  if(url.includes('/token?'))return Response.json({access_token:'fixture.access.signature',refresh_token:'fixture-refresh',token_type:'bearer',user:{id:context.subjectId}});
  if(url.endsWith('/v1/session'))return Response.json({issuer:context.issuer,subjectId:context.subjectId,expiresAt:Math.floor(Date.now()/1000)+300});
  if(url.includes('/logout?'))return new Response('');
  if(url.endsWith('/workspaces/bootstrap'))return Response.json({protocolVersion:1,workspaceId:context.workspaceId,clientId:body.clientId,epoch:context.streamEpoch});
  const titleMatch=/\/pages\/([^/]+)\/metadata\/(rename|read)$/.exec(url);if(titleMatch)return title.fetch(titleMatch[1]!,titleMatch[2]!,body,String(init?.body));
  if(url.endsWith('/sync/push')){state.structuredSent.push(String(init?.body));const operations=(body as unknown as {operations:PushOperation[]}).operations,results=operations.map(operation=>{const old=ledger.find(row=>row.operationId===operation.operationId);if(old)return old;const rows=operation.entityType==='task'?structured.tasks:structured.relations,localEntity=rows.find(row=>row.id===operation.entityId)!,conflicts=operation.resolution?structured.conflicts.filter(row=>operation.resolution!.conflictIds.includes(row.id)).map(row=>({...row,status:'resolved' as const,resolvedBy:operation.operationId})):[],result:PushResult=state.structuredReject?{operationId:operation.operationId,clientId:operation.clientId,entityId:operation.entityId,entityType:operation.entityType,serverOrder:String(ledger.length+1),status:'rejected',entity:null,conflicts:[],error:{code:'fixture_rejected',message:'fixture-private-server',retryable:false}}:{operationId:operation.operationId,clientId:operation.clientId,entityId:operation.entityId,entityType:operation.entityType,serverOrder:String(ledger.length+1),status:'acknowledged',entity:{...clone(localEntity),version:localEntity.version+1},conflicts};state.structuredReject=false;ledger.push(result);return result;});if(state.structuredLoseAck){state.structuredLoseAck=false;return Response.json({error:'lost'},{status:503});}return Response.json({protocolVersion:1,workspaceId:context.workspaceId,streamEpoch:context.streamEpoch,results});}
  if(url.endsWith('/sync/pull')){const offset=Number(body.cursor?.replace('structured:','')??0),operations=ledger.slice(offset,offset+Number(body.limit)),cursor='structured:'+(offset+operations.length),headCursor='structured:'+ledger.length;return Response.json({protocolVersion:1,workspaceId:context.workspaceId,streamEpoch:context.streamEpoch,operations,cursor,headCursor,hasMore:cursor!==headCursor,serverTime:time});}
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
 function seedConflict(){const task=structured.tasks.find(row=>!row.deletedAt)!;task.title='remote';task.version+=1;const conflict:Conflict={id:newId(),operationId:newId(),entityType:'task',entityId:task.id,field:'title',base:'base',local:'local',remote:'remote',createdAt:time,status:'open',resolvedBy:null};structured.conflicts.push(conflict);return conflict;}
 return {configuration,context,invoke,fetchPort,local,server,calls,state,title,structured,seedConflict,seedLocal,seedRemote,edit,cleanup(){for(const saved of server.values())saved.doc.destroy();}};
}
