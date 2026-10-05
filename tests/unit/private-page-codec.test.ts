import { it,expect } from 'vitest';
import * as Y from 'yjs';
import { privatePageUpdate,privatePageVector,pageUpdateDigest } from '../../apps/api/src/private-page-codec.js';
import { privatePageBootstrapRequestSchema,privatePageReadResponseSchema } from '@greiva/protocol/private-page';
import { newId } from '@greiva/shared';

it('PRIVATE-PAGE-CODEC: V1 update roundtrip preserves bytes and SHA256; reject trailing, truncated, malformed and noncanonical bytes',()=>{
  const doc=new Y.Doc({gc:false});try{doc.getText('body').insert(0,'日本語 body');const bytes=Buffer.from(Y.encodeStateAsUpdate(doc)),encoded=bytes.toString('base64url');expect(privatePageUpdate(encoded,512*1024)).toEqual(bytes);expect(pageUpdateDigest(bytes)).toMatch(/^[0-9a-f]{64}$/);
    for(const candidate of [Buffer.concat([bytes,Buffer.from([0])]).toString('base64url'),bytes.subarray(0,-1).toString('base64url'),'_w',encoded+'=', 'AA'])expect(()=>privatePageUpdate(candidate,512*1024)).toThrow('Invalid private transaction request');
    expect(()=>privatePageUpdate(encoded,1)).toThrow();
  }finally{doc.destroy();}
});
it('PRIVATE-PAGE-CODEC: canonical state vector is accepted; trailing/truncated/noncanonical vectors rejected',()=>{
  const doc=new Y.Doc();try{doc.getText('body').insert(0,'vector');const bytes=Buffer.from(Y.encodeStateVector(doc));expect(privatePageVector(bytes.toString('base64url'))).toEqual(bytes);expect(privatePageVector('AA')).toEqual(Buffer.from([0]));
    for(const candidate of [Buffer.concat([bytes,Buffer.from([0])]).toString('base64url'),bytes.subarray(0,-1).toString('base64url'),'_w','AA='])expect(()=>privatePageVector(candidate)).toThrow();
  }finally{doc.destroy();}
});
it('PRIVATE-PAGE-PROTOCOL: strict frame bounds do not reject larger committed response diffs and body identity must match metadata',()=>{
  const workspaceId=newId(),pageId=newId(),time='2026-10-05T00:00:00.000Z',metadata={id:pageId,title:'title',yDocId:`page:${pageId}`,createdAt:time,updatedAt:time},update=Buffer.alloc(600*1024).toString('base64url');
  expect(privatePageBootstrapRequestSchema.safeParse({protocolVersion:1,clientId:newId(),editorSchemaVersion:1,title:'title',initialUpdate:update}).success).toBe(false);
  const response={protocolVersion:1,workspaceId,pageId,documentName:`page:${pageId}`,editorSchemaVersion:1,metadata,headOrder:'1',update,digest:'0'.repeat(64),stateVector:'AA'};
  expect(privatePageReadResponseSchema.safeParse(response).success).toBe(true);expect(privatePageReadResponseSchema.safeParse({...response,documentName:`page:${newId()}`}).success).toBe(false);
});
