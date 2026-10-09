import {z} from 'zod';
import {idSchema} from '@greiva/shared';
import {databaseRecordSchema,databaseRecordIntentSchema,databaseRecordConflictSchema} from '@greiva/domain';
import {workspaceLocalContextSchema} from './workspace.js';

const id=idSchema.refine(value=>value===value.toLowerCase(),'Canonical ID required');
const version=z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const scope={protocolVersion:z.literal(1),workspaceId:id,workspaceEpoch:id,clientId:id,sourceId:id,schemaVersion:version};
export const privateDatabaseRecordSnapshotSchema=databaseRecordSchema.superRefine((record,ctx)=>{
 for(const value of [record.id,record.workspaceId,record.sourceId,record.pageId,...Object.keys(record.values)])if(!id.safeParse(value).success)ctx.addIssue({code:'custom',message:'Canonical record ID required'});
});
export const privateDatabaseRecordConflictSchema=databaseRecordConflictSchema.superRefine((conflict,ctx)=>{
 for(const value of [conflict.id,conflict.workspaceId,conflict.sourceId,conflict.recordId,conflict.pageId,conflict.propertyId,...(conflict.resolvedBy?[conflict.resolvedBy]:[])])if(!id.safeParse(value).success)ctx.addIssue({code:'custom',message:'Canonical conflict ID required'});
});
export const privateDatabaseRecordWriteRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:id,operationId:id,intent:databaseRecordIntentSchema}).superRefine((request,ctx)=>{
 const intent=request.intent;
 for(const value of [intent.sourceId,intent.recordId,intent.pageId,...Object.keys(intent.values),...(intent.kind==='update'&&intent.resolution?[intent.resolution.conflictId,intent.resolution.propertyId]:[])])if(!id.safeParse(value).success)ctx.addIssue({code:'custom',message:'Canonical intent ID required'});
});
const outcome=z.discriminatedUnion('status',[
 z.strictObject({status:z.literal('applied')}),
 z.strictObject({status:z.literal('conflict'),conflicts:z.array(privateDatabaseRecordConflictSchema).min(1).max(63)}),
 z.strictObject({status:z.literal('rejected'),code:z.enum(['base_unknown','resolution_invalid','resolution_stale'])}),
]);
function checkScope(value:{workspaceId:string;sourceId:string;schemaVersion:number;record:z.infer<typeof privateDatabaseRecordSnapshotSchema>;result?:z.infer<typeof outcome>;conflicts?:z.infer<typeof privateDatabaseRecordConflictSchema>[]},ctx:z.RefinementCtx){
 if(value.record.workspaceId!==value.workspaceId||value.record.sourceId!==value.sourceId)ctx.addIssue({code:'custom',message:'Record response scope mismatch'});
 const conflicts=value.conflicts??(value.result?.status==='conflict'?value.result.conflicts:[]);
 if(new Set(conflicts.map(item=>item.id)).size!==conflicts.length)ctx.addIssue({code:'custom',message:'Duplicate conflict'});
 for(const conflict of conflicts)if(conflict.workspaceId!==value.workspaceId||conflict.sourceId!==value.sourceId||conflict.schemaVersion!==value.schemaVersion||conflict.recordId!==value.record.id||conflict.pageId!==value.record.pageId||conflict.remoteVersion>value.record.version||conflict.resolvedBy!==null)ctx.addIssue({code:'custom',message:'Conflict response scope mismatch'});
}
export const privateDatabaseRecordWriteResponseSchema=z.strictObject({...scope,operationId:id,record:privateDatabaseRecordSnapshotSchema,result:outcome}).superRefine(checkScope);
export const privateDatabaseRecordReadRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:id,pageId:id,afterConflict:id.nullable().default(null),limit:z.number().int().min(1).max(20).default(20)});
export const privateDatabaseRecordReadResponseSchema=z.strictObject({...scope,record:privateDatabaseRecordSnapshotSchema,conflicts:z.array(privateDatabaseRecordConflictSchema).max(20),nextAfter:id.nullable()}).superRefine((value,ctx)=>{
 checkScope(value,ctx);
 if(value.conflicts.some((item,index)=>index>0&&item.id<=value.conflicts[index-1]!.id)||(value.nextAfter!==null&&value.nextAfter!==value.conflicts.at(-1)?.id))ctx.addIssue({code:'custom',message:'Invalid conflict page progress'});
});
export type PrivateDatabaseRecordWriteRequest=z.infer<typeof privateDatabaseRecordWriteRequestSchema>;
export type PrivateDatabaseRecordWriteResponse=z.infer<typeof privateDatabaseRecordWriteResponseSchema>;
export const privateDatabaseRecordLocalLoadRequestSchema=z.strictObject({afterConflict:id.nullable().default(null),limit:z.number().int().min(1).max(20).default(20)});
export const privateDatabaseRecordLocalLoadSchema=z.strictObject({context:workspaceLocalContextSchema,sourceId:id,schemaVersion:version,record:privateDatabaseRecordSnapshotSchema.nullable(),conflicts:z.array(privateDatabaseRecordConflictSchema).max(20),nextAfter:id.nullable()}).superRefine((value,ctx)=>{
 if(value.record===null){if(value.conflicts.length||value.nextAfter!==null)ctx.addIssue({code:'custom',message:'Candidate without cached Record'});return;}
 checkScope({...value,workspaceId:value.context.workspaceId,record:value.record},ctx);if(value.conflicts.some((item,index)=>index>0&&item.id<=value.conflicts[index-1]!.id)||(value.nextAfter!==null&&value.nextAfter!==value.conflicts.at(-1)?.id))ctx.addIssue({code:'custom',message:'Invalid cached candidate continuation'});
});
export const privateDatabaseRecordLocalListRequestSchema=z.strictObject({after:id.nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
export const privateDatabaseRecordLocalListSchema=z.strictObject({context:workspaceLocalContextSchema,sourceId:id,schemaVersion:version,records:z.array(z.strictObject({id,pageId:id,version})).max(100),nextAfter:id.nullable()}).superRefine((value,ctx)=>{const pages=new Set<string>();let previous='';for(const row of value.records){if(row.id<=previous||pages.has(row.pageId))ctx.addIssue({code:'custom',message:'Invalid cached Record headers'});previous=row.id;pages.add(row.pageId);}if(value.nextAfter!==null&&(value.records.length===0||value.records.at(-1)!.id!==value.nextAfter))ctx.addIssue({code:'custom',message:'Invalid Record continuation'});});
