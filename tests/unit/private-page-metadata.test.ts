import {it,expect} from 'vitest';
import {newId} from '@greiva/shared';
import {privatePageRenameRequestSchema,privatePageRenameResponseSchema,privatePageMetadataReadResponseSchema,privatePageTitleConflictSchema} from '@greiva/protocol/private-page-metadata';
const id=newId(),operationId=newId(),scope={protocolVersion:1,workspaceId:newId(),workspaceEpoch:newId(),pageId:id},metadata={id,title:'remote',yDocId:'page:'+id,createdAt:'2026-10-08T00:00:00.000Z',updatedAt:'2026-10-08T00:00:00.000Z'};
const conflict={id:newId(),operationId,baseVersion:0,remoteVersion:1,base:'base',local:'local',remote:'remote'};
it('TITLE-WIRE: strict requests reject identity spoofing, oversized titles and unsafe versions',()=>{
  const request={protocolVersion:1,clientId:newId(),operationId,baseVersion:0,title:'日本語'};expect(privatePageRenameRequestSchema.parse(request)).toEqual(request);
  for(const extra of [{subjectId:'owner'},{title:'x'.repeat(65537)},{baseVersion:Number.MAX_SAFE_INTEGER+1},{baseVersion:-1},{resolution:{conflictId:newId(),choice:'automatic'}},{protocolVersion:2}])expect(privatePageRenameRequestSchema.safeParse({...request,...extra}).success).toBe(false);
});
it('TITLE-WIRE: conflict receipt binds title, operation, Page and version',()=>{
  const receipt={...scope,metadata,version:1,operationId,result:{status:'conflict',conflict}};expect(privatePageRenameResponseSchema.safeParse(receipt).success).toBe(true);
  for(const extra of [{operationId:newId()},{version:2},{pageId:newId()},{metadata:{...metadata,title:'wrong'}}])expect(privatePageRenameResponseSchema.safeParse({...receipt,...extra}).success).toBe(false);
  expect(privatePageTitleConflictSchema.safeParse({...conflict,local:'base'}).success).toBe(false);expect(privatePageTitleConflictSchema.safeParse({...conflict,baseVersion:1}).success).toBe(false);
});
it('TITLE-WIRE: query keyset is ordered, bounded and tied to the last conflict',()=>{
  const records=[conflict,{...conflict,id:newId()}].sort((a,b)=>a.id.localeCompare(b.id)),response={...scope,metadata,version:1,conflicts:records,nextAfter:records[1]!.id};expect(privatePageMetadataReadResponseSchema.safeParse(response).success).toBe(true);
  for(const extra of [{nextAfter:newId()},{conflicts:[records[1],records[0]]},{version:0},{conflicts:[]},{conflicts:Array(101).fill(conflict)}])expect(privatePageMetadataReadResponseSchema.safeParse({...response,...extra}).success).toBe(false);
});
