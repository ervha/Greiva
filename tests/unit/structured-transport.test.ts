import { it,expect } from 'vitest';
import { newId } from '@greiva/shared';
import { httpStructuredTransport,StructuredTransportError } from '@greiva/sync';
import type { PushOperation,PushResult } from '@greiva/protocol';
const operation: PushOperation = {operationId:newId(),clientId:newId(),entityType:'task',entityId:newId(),kind:'create',baseVersion:null,payload:{title:'retained',status:'todo',due:null}};
const time = '2026-10-01T08:00:00.000Z';
const result: PushResult = {operationId:operation.operationId,clientId:operation.clientId,entityType:'task',entityId:operation.entityId,serverOrder:'1',status:'acknowledged',conflicts:[],entity:{id:operation.entityId,title:'retained',status:'todo',due:null,version:1,createdAt:time,updatedAt:time,deletedAt:null}};
const signal = ()=>new AbortController().signal;
const reply = (body: unknown,status = 200)=>httpStructuredTransport('http://test.invalid',async ()=>new Response(JSON.stringify(body),{status}));
it('STEP7-TRANSPORT: separates retryable service failures, permanent protocol errors and permission errors',async ()=> {
  for (const [status,category] of [[503,'network'],[400,'protocol'],[403,'permission'],[401,'permission']] as const) {
    await expect(reply({},status).push(operation,signal())).rejects.toMatchObject({category});
  }
  const malformed = httpStructuredTransport('http://test.invalid',async ()=>new Response('not JSON'));
  await expect(malformed.pull(null,signal())).rejects.toMatchObject({category:'protocol'});
  const disconnected = httpStructuredTransport('http://test.invalid',async ()=> {throw new TypeError('disconnected');});
  await expect(disconnected.push(operation,signal())).rejects.toBeInstanceOf(StructuredTransportError);
  await expect(disconnected.push(operation,signal())).rejects.toMatchObject({category:'network'});
});
it('STEP7-TRANSPORT: refuses ACKs for another operation/client/entity and malformed result envelopes',async ()=> {
  for (const invalid of [{...result,operationId:newId()},{...result,clientId:newId()},{...result,entityId:newId()},{...result,serverOrder:'01'}]) {
    await expect(reply({results:[invalid]}).push(operation,signal())).rejects.toMatchObject({category:'protocol'});
  }
  await expect(reply({results:[result,result]}).push(operation,signal())).rejects.toMatchObject({category:'protocol'});
  expect(await reply({results:[result]}).push(operation,signal())).toEqual(result);
});
it('STEP7-TRANSPORT: rejects nonadvancing, empty intermediate and inconsistent last-page cursors',async ()=> {
  const valid = {operations:[result],cursor:'next',headCursor:'head',hasMore:true,serverTime:time};
  for (const invalid of [{...valid,operations:[]},{...valid,cursor:'head'},{...valid,hasMore:false},{...valid,cursor:'old'}]) {
    await expect(reply(invalid).pull('old',signal())).rejects.toMatchObject({category:'protocol'});
  }
  expect(await reply(valid).pull('old',signal())).toEqual(valid);
  expect(await reply({...valid,operations:[],cursor:'old',headCursor:'old',hasMore:false}).pull('old',signal())).toMatchObject({hasMore:false,cursor:'old'});
});
