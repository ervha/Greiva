import {z} from 'zod';
import {idSchema} from '@greiva/shared';
import {databaseRecordSchema,databaseRecordIntentSchema,databaseRecordConflictSchema,parseDatabaseRecord,parseDatabaseRecordIntent} from '@greiva/domain';
import {workspaceLocalContextSchema} from './workspace.js';
import {structuredOrderSchema} from './workspace.js';
import {privateDatabaseSourceDefinitionSchema} from './private-database-source.js';

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
function checkScope(value:{workspaceId:string;sourceId:string;schemaVersion:number;record:z.infer<typeof privateDatabaseRecordSnapshotSchema>;result?:z.infer<typeof outcome>;conflicts?:z.infer<typeof privateDatabaseRecordConflictSchema>[]},ctx:z.RefinementCtx,allowResolved=false){
 if(value.record.workspaceId!==value.workspaceId||value.record.sourceId!==value.sourceId)ctx.addIssue({code:'custom',message:'Record response scope mismatch'});
 const conflicts=value.conflicts??(value.result?.status==='conflict'?value.result.conflicts:[]);
 if(new Set(conflicts.map(item=>item.id)).size!==conflicts.length)ctx.addIssue({code:'custom',message:'Duplicate conflict'});
 for(const conflict of conflicts)if(conflict.workspaceId!==value.workspaceId||conflict.sourceId!==value.sourceId||conflict.schemaVersion!==value.schemaVersion||conflict.recordId!==value.record.id||conflict.pageId!==value.record.pageId||conflict.remoteVersion>value.record.version||(!allowResolved&&conflict.resolvedBy!==null))ctx.addIssue({code:'custom',message:'Conflict response scope mismatch'});
}
export const privateDatabaseRecordWriteResponseSchema=z.strictObject({...scope,operationId:id,record:privateDatabaseRecordSnapshotSchema,result:outcome}).superRefine(checkScope);
export const privateDatabaseRecordReadRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:id,pageId:id,afterConflict:id.nullable().default(null),limit:z.number().int().min(1).max(20).default(20)});
export const privateDatabaseRecordReadResponseSchema=z.strictObject({...scope,record:privateDatabaseRecordSnapshotSchema,conflicts:z.array(privateDatabaseRecordConflictSchema).max(20),nextAfter:id.nullable()}).superRefine((value,ctx)=>{
 checkScope(value,ctx);
 if(value.conflicts.some((item,index)=>index>0&&item.id<=value.conflicts[index-1]!.id)||(value.nextAfter!==null&&value.nextAfter!==value.conflicts.at(-1)?.id))ctx.addIssue({code:'custom',message:'Invalid conflict page progress'});
});
export type PrivateDatabaseRecordWriteRequest=z.infer<typeof privateDatabaseRecordWriteRequestSchema>;
export type PrivateDatabaseRecordWriteResponse=z.infer<typeof privateDatabaseRecordWriteResponseSchema>;
const sequence=structuredOrderSchema.refine(value=>value!=='0','Positive Record sequence required');
export const privateDatabaseRecordCreateIntentSchema=z.strictObject({operationId:id,source:privateDatabaseSourceDefinitionSchema,intent:privateDatabaseRecordWriteRequestSchema.shape.intent.refine(value=>value.kind==='create','Create intent required')}).superRefine((value,ctx)=>{try{parseDatabaseRecordIntent(value.source,value.intent);for(const key of [value.intent.sourceId,value.intent.recordId,value.intent.pageId,...Object.keys(value.intent.values)])if(!id.safeParse(key).success)throw Error();}catch{ctx.addIssue({code:'custom',message:'Record Source definition mismatch'});}});
export const privateDatabaseRecordCreatePreparedSchema=z.strictObject({sequence,operationId:id,sourceId:id,recordId:id,pageId:id,wire:z.string().min(1).max(8*1024*1024)}).superRefine((value,ctx)=>{try{const request=privateDatabaseRecordWriteRequestSchema.parse(JSON.parse(value.wire));if(request.intent.kind!=='create'||request.operationId!==value.operationId||request.intent.sourceId!==value.sourceId||request.intent.recordId!==value.recordId||request.intent.pageId!==value.pageId)throw Error();}catch{ctx.addIssue({code:'custom',message:'Invalid prepared Record create'});}});
export const privateDatabaseRecordCreateBlockedSchema=z.strictObject({status:z.literal('blocked'),sequence,operationId:id,sourceId:id,recordId:id,pageId:id,reason:z.enum(['source','page'])});
export const privateDatabaseRecordCreateQueueRequestSchema=z.strictObject({pendingOnly:z.boolean().default(false),after:sequence.nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
export const privateDatabaseRecordCreateQueueSchema=z.strictObject({context:workspaceLocalContextSchema,pending:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),operations:z.array(z.strictObject({sequence,intent:privateDatabaseRecordCreateIntentSchema,wire:z.string().min(1).max(8*1024*1024).nullable(),response:privateDatabaseRecordWriteResponseSchema.nullable()})).max(100),nextAfter:sequence.nullable()}).superRefine((value,ctx)=>{let previous=0n;const ids=new Set<string>(),records=new Set<string>(),pages=new Set<string>();for(const row of value.operations){const item=row.intent,intent=item.intent;let valid=BigInt(row.sequence)>previous&&item.source.workspaceId===value.context.workspaceId&&!ids.has(item.operationId)&&!records.has(intent.recordId)&&!pages.has(intent.sourceId+':'+intent.pageId);previous=BigInt(row.sequence);ids.add(item.operationId);records.add(intent.recordId);pages.add(intent.sourceId+':'+intent.pageId);if(row.wire!==null){try{const request=privateDatabaseRecordWriteRequestSchema.parse(JSON.parse(row.wire));if(request.clientId!==value.context.clientId||request.operationId!==item.operationId||JSON.stringify(request.intent)!==JSON.stringify(intent))valid=false;}catch{valid=false;}}const reply=row.response;if(reply&&(row.wire===null||reply.workspaceId!==value.context.workspaceId||reply.workspaceEpoch!==value.context.streamEpoch||reply.clientId!==value.context.clientId||reply.sourceId!==intent.sourceId||reply.schemaVersion!==intent.schemaVersion||reply.operationId!==item.operationId||reply.result.status!=='applied'||reply.record.id!==intent.recordId||reply.record.pageId!==intent.pageId||reply.record.version!==1))valid=false;if(reply){try{parseDatabaseRecord(item.source,reply.record);const keys=Object.keys(intent.values);if(Object.keys(reply.record.values).length!==keys.length||keys.some(key=>reply.record.values[key]!==intent.values[key]))valid=false;}catch{valid=false;}}if(!valid)ctx.addIssue({code:'custom',message:'Invalid Record create provenance'});}if(value.nextAfter!==null&&(value.operations.length===0||value.nextAfter!==value.operations.at(-1)!.sequence))ctx.addIssue({code:'custom',message:'Invalid Record create continuation'});});
export const privateDatabaseRecordLocalLoadRequestSchema=z.strictObject({afterConflict:id.nullable().default(null),limit:z.number().int().min(1).max(20).default(20)});
export const privateDatabaseRecordLocalLoadSchema=z.strictObject({context:workspaceLocalContextSchema,sourceId:id,schemaVersion:version,record:privateDatabaseRecordSnapshotSchema.nullable(),conflicts:z.array(privateDatabaseRecordConflictSchema).max(20),nextAfter:id.nullable()}).superRefine((value,ctx)=>{
 if(value.record===null){if(value.conflicts.length||value.nextAfter!==null)ctx.addIssue({code:'custom',message:'Candidate without cached Record'});return;}
 checkScope({...value,workspaceId:value.context.workspaceId,record:value.record},ctx,true);if(value.conflicts.some((item,index)=>index>0&&item.id<=value.conflicts[index-1]!.id)||(value.nextAfter!==null&&value.nextAfter!==value.conflicts.at(-1)?.id))ctx.addIssue({code:'custom',message:'Invalid cached candidate continuation'});
});
export const privateDatabaseRecordLocalListRequestSchema=z.strictObject({after:id.nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
export const privateDatabaseRecordLocalListSchema=z.strictObject({context:workspaceLocalContextSchema,sourceId:id,schemaVersion:version,records:z.array(z.strictObject({id,pageId:id,version})).max(100),nextAfter:id.nullable()}).superRefine((value,ctx)=>{const pages=new Set<string>();let previous='';for(const row of value.records){if(row.id<=previous||pages.has(row.pageId))ctx.addIssue({code:'custom',message:'Invalid cached Record headers'});previous=row.id;pages.add(row.pageId);}if(value.nextAfter!==null&&(value.records.length===0||value.records.at(-1)!.id!==value.nextAfter))ctx.addIssue({code:'custom',message:'Invalid Record continuation'});});
