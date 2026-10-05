import {it,expect} from 'vitest';
import {newId} from '@greiva/shared';
import {privatePageCatalogRequestSchema,privatePageCatalogResponseSchema} from '@greiva/protocol/private-page-catalog';
import {pageCatalogCursor,pageCatalogAfter} from '../../apps/api/src/private-page-catalog.js';
it('PRIVATE-PAGE-CATALOG: signed query cursors bind workspace/epoch and reject tampering, noncanonical encoding, foreign streams and broken keys',()=>{
  const key=Buffer.alloc(32,9),workspace=newId(),epoch=newId(),after=newId(),cursor=pageCatalogCursor(key,workspace,epoch,after);
  expect(pageCatalogAfter(key,workspace,epoch,cursor)).toBe(after);
  for(const invalid of [cursor+'=',cursor.replace('gq1.','gw1.'),cursor.slice(0,-3)+'zzz','gq1.e30.AA','x'.repeat(8193)])expect(()=>pageCatalogAfter(key,workspace,epoch,invalid)).toThrow();
  for(const [secret,ws,ep] of [[Buffer.alloc(32,8),workspace,epoch],[key,newId(),epoch],[key,workspace,newId()]] as const)expect(()=>pageCatalogAfter(secret,ws,ep,cursor)).toThrow();
  expect(()=>pageCatalogAfter(Buffer.alloc(31),workspace,epoch,cursor)).toThrow();expect(()=>pageCatalogCursor(null,workspace,epoch,after)).toThrow();
});
it('PRIVATE-PAGE-CATALOG: strict bounded requests and responses reject inconsistent progress, duplicate/out-of-order IDs and document binding',()=>{
  const clientId=newId(),ids=[newId(),newId()].sort(),now='2026-10-05T00:00:00.000Z',pages=ids.map(id=>({id,title:'日本語',yDocId:'page:'+id,createdAt:now,updatedAt:now})),response={protocolVersion:1,workspaceId:newId(),workspaceEpoch:newId(),pages,nextCursor:null,hasMore:false};
  expect(privatePageCatalogRequestSchema.parse({protocolVersion:1,clientId})).toEqual({protocolVersion:1,clientId,cursor:null,limit:50});
  for(const value of [{protocolVersion:1,clientId,limit:0},{protocolVersion:1,clientId,limit:101},{protocolVersion:1,clientId,path:'unexpected'}])expect(privatePageCatalogRequestSchema.safeParse(value).success).toBe(false);
  expect(privatePageCatalogResponseSchema.safeParse(response).success).toBe(true);
  for(const value of [{...response,hasMore:true},{...response,nextCursor:'next'},{...response,pages:[pages[0],pages[0]]},{...response,pages:[...pages].reverse()},{...response,pages:[{...pages[0],yDocId:'page:'+newId()}]},{...response,pages:[],hasMore:true,nextCursor:'next'}])expect(privatePageCatalogResponseSchema.safeParse(value).success).toBe(false);
});
