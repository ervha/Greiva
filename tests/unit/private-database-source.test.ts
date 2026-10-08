import {it,expect} from 'vitest';
import {newId} from '@greiva/shared';
import {privateDatabaseSourceCreateRequestSchema,privateDatabaseSourceCreateResponseSchema,privateDatabaseSourceSummarySchema,privateDatabaseSourceCatalogResponseSchema} from '@greiva/protocol/private-database-source';
import {databaseSourceCursor} from '../../apps/api/src/private-database-source-cursor.js';
function fixture(){const workspaceId=newId(),clientId=newId(),epoch=newId(),source={id:'019aa000-0000-7000-8000-00000000000a',workspaceId,name:'DB',schemaVersion:1,properties:[{id:newId(),name:'Name',type:'name'}]},request={protocolVersion:1,clientId,operationId:newId(),source},scope={protocolVersion:1,workspaceId,workspaceEpoch:epoch,clientId},summary={id:source.id,workspaceId,name:source.name,schemaVersion:1,version:1,creationOrder:'1',propertyCount:1},key=new Uint8Array(32).fill(7),cursor=databaseSourceCursor(workspaceId,epoch,clientId,key);return{workspaceId,clientId,epoch,source,request,scope,summary,key,cursor};}
it('DB-SOURCE-WIRE: definition/clone/version and canonical IDs prevent SQL UUID alias corruption',()=>{
 const f=fixture(),request=privateDatabaseSourceCreateRequestSchema.parse(f.request);f.source.name='changed later';expect(request.source.name).toBe('DB');
 for(const source of [{...f.source,id:f.source.id.toUpperCase()},{...f.source,schemaVersion:2},{...f.source,ownerEmail:'must-not-store@example.invalid'},{...f.source,properties:[{...f.source.properties[0],type:'formula'}]}])expect(()=>privateDatabaseSourceCreateRequestSchema.parse({...f.request,source})).toThrow();
});
it('DB-SOURCE-WIRE: receipts bind source/workspace and metadata/schema versions',()=>{
 const f=fixture(),reply={...f.scope,operationId:f.request.operationId,snapshot:{source:f.source,version:1,creationOrder:'1'},result:{status:'created'}};expect(privateDatabaseSourceCreateResponseSchema.parse(reply)).toEqual(reply);expect(()=>privateDatabaseSourceCreateResponseSchema.parse({...reply,workspaceId:newId()})).toThrow();expect(()=>privateDatabaseSourceCreateResponseSchema.parse({...reply,snapshot:{...reply.snapshot,source:{...f.source,schemaVersion:2}}})).toThrow();
});
it('DB-SOURCE-WIRE: catalog headers contain no multiplied property/option definitions',()=>{
 const f=fixture();expect(privateDatabaseSourceSummarySchema.parse(f.summary)).toEqual(f.summary);expect(()=>privateDatabaseSourceSummarySchema.parse({...f.summary,properties:f.source.properties})).toThrow();expect(()=>privateDatabaseSourceSummarySchema.parse({...f.summary,propertyCount:0})).toThrow();
});
it('DB-SOURCE-WIRE: exact bigint progress, filtered empty windows and duplicate/order/scope guards',()=>{
 const f=fixture(),reply={...f.scope,afterOrder:'9007199254740992',throughOrder:'9007199254740993',headOrder:'9007199254740994',sources:[{...f.summary,creationOrder:'9007199254740993'}],hasMore:true,cursor:'opaque'};expect(privateDatabaseSourceCatalogResponseSchema.parse(reply)).toEqual(reply);expect(()=>privateDatabaseSourceCatalogResponseSchema.parse({...reply,sources:[...reply.sources,...reply.sources]})).toThrow();expect(()=>privateDatabaseSourceCatalogResponseSchema.parse({...reply,sources:[{...reply.sources[0],workspaceId:newId()}]})).toThrow();expect(()=>privateDatabaseSourceCatalogResponseSchema.parse({...reply,hasMore:false,cursor:null})).toThrow();expect(privateDatabaseSourceCatalogResponseSchema.parse({...reply,sources:[]})).toHaveProperty('throughOrder','9007199254740993');
});
it('DB-SOURCE-CURSOR: preserves exact after/head and fixed observed head as new sources arrive',()=>{
 const f=fixture(),token=f.cursor.encode('9007199254740993','9007199254740994');expect(f.cursor.decode(token,'9007199254740995')).toEqual({after:'9007199254740993',head:'9007199254740994'});expect(f.cursor.decode(null,'12')).toEqual({after:'0',head:'12'});
});
it('DB-SOURCE-CURSOR: purpose, workspace, epoch, device and secret are all bound',()=>{
 const f=fixture(),token=f.cursor.encode('1','2');for(const cursor of [databaseSourceCursor(newId(),f.epoch,f.clientId,f.key),databaseSourceCursor(f.workspaceId,newId(),f.clientId,f.key),databaseSourceCursor(f.workspaceId,f.epoch,newId(),f.key),databaseSourceCursor(f.workspaceId,f.epoch,f.clientId,new Uint8Array(32).fill(8))])expect(()=>cursor.decode(token,'2')).toThrow();expect(()=>f.cursor.decode(token.replace('gds1.','gpm1.'),'2')).toThrow();
});
it('DB-SOURCE-CURSOR: malformed/noncanonical/tampered and future progress is rejected',()=>{
 const f=fixture(),token=f.cursor.encode('1','2');for(const value of ['',token+'.extra',token.slice(0,-1)+(token.endsWith('A')?'B':'A'),'x'.repeat(1025),3])expect(()=>f.cursor.decode(value,'2')).toThrow();expect(()=>f.cursor.decode(token,'1')).toThrow();expect(()=>f.cursor.encode('3','2')).toThrow();
});
it('DB-SOURCE-CURSOR: signer captures a copied key instead of mutable caller bytes',()=>{
 const f=fixture(),token=f.cursor.encode('1','2');f.key.fill(0);expect(f.cursor.decode(token,'2')).toEqual({after:'1',head:'2'});expect(()=>databaseSourceCursor(f.workspaceId,f.epoch,f.clientId,new Uint8Array(31))).toThrow();
});
