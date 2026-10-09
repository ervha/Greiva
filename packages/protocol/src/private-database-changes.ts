import {z} from 'zod';
import {idSchema} from '@greiva/shared';
import {databaseSourceSchema,parseDatabaseRecord,parseDatabaseRecordConflict,parseDatabaseViewSnapshot,parseDatabaseViewConflict,type DatabaseSource} from '@greiva/domain';
import {workspaceLocalContextSchema,structuredOrderSchema} from './workspace.js';
import {privateDatabaseRecordSnapshotSchema,privateDatabaseRecordConflictSchema} from './private-database-record.js';
import {privateDatabaseViewSnapshotSchema,privateDatabaseViewConflictSchema} from './private-database-view.js';
const id=idSchema.refine(value=>value===value.toLowerCase(),'Canonical ID required');
const version=z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const order=structuredOrderSchema.refine(value=>value!=='0','Positive event order required');
export const privateDatabaseChangeSchema=z.discriminatedUnion('kind',[
 z.strictObject({kind:z.literal('record'),order,record:privateDatabaseRecordSnapshotSchema,conflict:privateDatabaseRecordConflictSchema.nullable()}),
 z.strictObject({kind:z.literal('view'),order,snapshot:privateDatabaseViewSnapshotSchema,conflict:privateDatabaseViewConflictSchema.nullable()}),
]).superRefine((event,ctx)=>{
 if(!event.conflict)return;
 const conflict=event.conflict;
 if(event.kind==='record'){
  if(!('recordId' in conflict)||conflict.recordId!==event.record.id||conflict.pageId!==event.record.pageId||conflict.workspaceId!==event.record.workspaceId||conflict.sourceId!==event.record.sourceId||conflict.remoteVersion>event.record.version)ctx.addIssue({code:'custom',message:'Invalid Record event conflict binding'});
 }else if(!('viewId' in conflict)||conflict.viewId!==event.snapshot.view.id||conflict.sourceId!==event.snapshot.view.sourceId||conflict.remoteVersion>event.snapshot.version)ctx.addIssue({code:'custom',message:'Invalid View event conflict binding'});
});
export const privateDatabaseChangesRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:id,cursor:z.string().min(1).max(1024).nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
export const privateDatabaseChangesResponseSchema=z.strictObject({protocolVersion:z.literal(1),workspaceId:id,workspaceEpoch:id,clientId:id,sourceId:id,schemaVersion:version,journalEpoch:id,afterOrder:structuredOrderSchema,readOrder:structuredOrderSchema,headOrder:structuredOrderSchema,events:z.array(privateDatabaseChangeSchema).max(100),hasMore:z.boolean(),cursor:z.string().min(1).max(1024)}).superRefine((response,ctx)=>{
 const after=BigInt(response.afterOrder),read=BigInt(response.readOrder),head=BigInt(response.headOrder);
 if(after>read||read>head||response.hasMore!==(read<head)||(response.hasMore&&read===after))ctx.addIssue({code:'custom',message:'Invalid database change progress'});
 let previous=after;
 for(const event of response.events){const position=BigInt(event.order);if(position<=previous||position>read)ctx.addIssue({code:'custom',message:'Invalid database event order'});previous=position;
  if(event.kind==='record'){if(event.record.workspaceId!==response.workspaceId||event.record.sourceId!==response.sourceId)ctx.addIssue({code:'custom',message:'Record event scope mismatch'});}else if(event.snapshot.view.sourceId!==response.sourceId)ctx.addIssue({code:'custom',message:'View event scope mismatch'});
  if(event.conflict&&(event.conflict.workspaceId!==response.workspaceId||event.conflict.sourceId!==response.sourceId||event.conflict.schemaVersion!==response.schemaVersion))ctx.addIssue({code:'custom',message:'Database event candidate scope mismatch'});
 }
});
export type PrivateDatabaseChange=z.infer<typeof privateDatabaseChangeSchema>;
export type PrivateDatabaseChangesResponse=z.infer<typeof privateDatabaseChangesResponseSchema>;
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
export function parsePrivateDatabaseChange(source:DatabaseSource,candidate:unknown):PrivateDatabaseChange{
 const definition=databaseSourceSchema.parse(source),event=privateDatabaseChangeSchema.parse(candidate);
 if(event.kind==='record'){parseDatabaseRecord(definition,event.record);if(event.conflict)parseDatabaseRecordConflict(definition,event.conflict);}
 else{parseDatabaseViewSnapshot(definition,event.snapshot);if(event.conflict)parseDatabaseViewConflict(definition,event.conflict);}
 return freeze(event);
}
export function parsePrivateDatabaseChangesResponse(source:DatabaseSource,candidate:unknown):PrivateDatabaseChangesResponse{
 const definition=databaseSourceSchema.parse(source),response=privateDatabaseChangesResponseSchema.parse(candidate);
 if(response.workspaceId!==definition.workspaceId||response.sourceId!==definition.id||response.schemaVersion!==definition.schemaVersion)throw Error('Database change definition mismatch');
 return freeze({...response,events:response.events.map(event=>parsePrivateDatabaseChange(definition,event))});
}
export const privateDatabaseChangesLocalProgressSchema=z.strictObject({context:workspaceLocalContextSchema,sourceId:id,schemaVersion:version,journalEpoch:id.nullable(),order:structuredOrderSchema,cursor:z.string().min(1).max(1024).nullable(),headOrder:structuredOrderSchema,hasMore:z.boolean(),received:z.boolean()}).superRefine((v,ctx)=>{if(v.received){if(v.cursor===null||v.journalEpoch===null||BigInt(v.order)>BigInt(v.headOrder)||v.hasMore!==(BigInt(v.order)<BigInt(v.headOrder)))ctx.addIssue({code:'custom',message:'Invalid saved database progress'});}else if(v.cursor!==null||v.journalEpoch!==null||v.order!=='0'||v.headOrder!=='0'||v.hasMore)ctx.addIssue({code:'custom',message:'Invalid unreceived database progress'});});
