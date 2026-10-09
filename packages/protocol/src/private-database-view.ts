import {z} from 'zod';
import {workspaceLocalContextSchema} from './workspace.js';
import {idSchema} from '@greiva/shared';
import {databaseViewIntentSchema,databaseViewSnapshotSchema,databaseViewConflictSchema,parseDatabaseViewIntent,parseDatabaseViewSnapshot,parseDatabaseViewConflict} from '@greiva/domain';
const id=idSchema.refine(value=>value===value.toLowerCase(),'Canonical ID required');
const version=z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const scope={protocolVersion:z.literal(1),workspaceId:id,workspaceEpoch:id,clientId:id,sourceId:id,schemaVersion:version};
function ids(value:unknown,ctx:z.RefinementCtx):void{
 if(Array.isArray(value)){for(const item of value)ids(item,ctx);return;}
 if(!value||typeof value!=='object')return;
 for(const [key,item] of Object.entries(value)){
  if(['id','sourceId','viewId','propertyId','conflictId','workspaceId','resolvedBy'].includes(key)&&item!==null&&!id.safeParse(item).success)ctx.addIssue({code:'custom',message:'Canonical View ID required'});
  if(key==='visiblePropertyIds'&&Array.isArray(item)&&item.some(ref=>!id.safeParse(ref).success))ctx.addIssue({code:'custom',message:'Canonical View property ID required'});
  ids(item,ctx);
 }
}
export const privateDatabaseViewSnapshotSchema=databaseViewSnapshotSchema.superRefine(ids);
export const privateDatabaseViewConflictSchema=databaseViewConflictSchema.superRefine((value,ctx)=>{ids(value,ctx);if(value.field==='visiblePropertyIds')for(const refs of [value.base,value.local,value.remote])if(Array.isArray(refs)&&refs.some(ref=>!id.safeParse(ref).success))ctx.addIssue({code:'custom',message:'Canonical conflict columns required'});});
export const privateDatabaseViewWriteRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:id,operationId:id,intent:databaseViewIntentSchema}).superRefine(ids);
const outcome=z.discriminatedUnion('status',[
 z.strictObject({status:z.literal('applied')}),
 z.strictObject({status:z.literal('conflict'),conflicts:z.array(privateDatabaseViewConflictSchema).min(1).max(5)}),
 z.strictObject({status:z.literal('rejected'),code:z.enum(['base_unknown','resolution_invalid','resolution_stale'])}),
]);
function checkScope(value:{workspaceId:string;sourceId:string;schemaVersion:number;snapshot:z.infer<typeof privateDatabaseViewSnapshotSchema>;result?:z.infer<typeof outcome>;conflicts?:z.infer<typeof privateDatabaseViewConflictSchema>[]},ctx:z.RefinementCtx,allowResolved=false){
 if(value.snapshot.view.sourceId!==value.sourceId)ctx.addIssue({code:'custom',message:'View response scope mismatch'});
 const conflicts=value.conflicts??(value.result?.status==='conflict'?value.result.conflicts:[]);
 if(new Set(conflicts.map(item=>item.id)).size!==conflicts.length)ctx.addIssue({code:'custom',message:'Duplicate View conflict'});
 for(const conflict of conflicts)if(conflict.workspaceId!==value.workspaceId||conflict.sourceId!==value.sourceId||conflict.schemaVersion!==value.schemaVersion||conflict.viewId!==value.snapshot.view.id||conflict.remoteVersion>value.snapshot.version||(!allowResolved&&conflict.resolvedBy!==null))ctx.addIssue({code:'custom',message:'View conflict response scope mismatch'});
}
export const privateDatabaseViewWriteResponseSchema=z.strictObject({...scope,operationId:id,snapshot:privateDatabaseViewSnapshotSchema,result:outcome}).superRefine(checkScope);
export const privateDatabaseViewReadRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:id,afterConflict:id.nullable().default(null),limit:z.number().int().min(1).max(20).default(20)});
export const privateDatabaseViewReadResponseSchema=z.strictObject({...scope,snapshot:privateDatabaseViewSnapshotSchema,conflicts:z.array(privateDatabaseViewConflictSchema).max(20),nextAfter:id.nullable()}).superRefine((value,ctx)=>{
 checkScope(value,ctx);
 if(value.conflicts.some((item,index)=>index>0&&item.id<=value.conflicts[index-1]!.id)||(value.nextAfter!==null&&value.nextAfter!==value.conflicts.at(-1)?.id))ctx.addIssue({code:'custom',message:'Invalid View conflict progress'});
});
export type PrivateDatabaseViewWriteResponse=z.infer<typeof privateDatabaseViewWriteResponseSchema>;
export const privateDatabaseViewLocalLoadRequestSchema=z.strictObject({afterConflict:id.nullable().default(null),limit:z.number().int().min(1).max(20).default(20)});
export const privateDatabaseViewLocalLoadSchema=z.strictObject({context:workspaceLocalContextSchema,sourceId:id,schemaVersion:version,snapshot:privateDatabaseViewSnapshotSchema.nullable(),conflicts:z.array(privateDatabaseViewConflictSchema).max(20),nextAfter:id.nullable()}).superRefine((value,ctx)=>{
 if(value.snapshot===null){if(value.conflicts.length||value.nextAfter!==null)ctx.addIssue({code:'custom',message:'Candidate without cached View'});return;}
 checkScope({...value,workspaceId:value.context.workspaceId,snapshot:value.snapshot},ctx,true);if(value.conflicts.some((item,index)=>index>0&&item.id<=value.conflicts[index-1]!.id)||(value.nextAfter!==null&&value.nextAfter!==value.conflicts.at(-1)?.id))ctx.addIssue({code:'custom',message:'Invalid cached candidate continuation'});
});
export const privateDatabaseViewLocalListRequestSchema=z.strictObject({after:id.nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
export const privateDatabaseViewLocalListSchema=z.strictObject({context:workspaceLocalContextSchema,sourceId:id,schemaVersion:version,views:z.array(z.strictObject({id,name:z.string().max(120).refine(value=>value.trim().length>0),layout:z.enum(['table','list']),version})).max(100),nextAfter:id.nullable()}).superRefine((value,ctx)=>{let previous='';for(const row of value.views){if(row.id<=previous)ctx.addIssue({code:'custom',message:'Invalid cached View headers'});previous=row.id;}if(value.nextAfter!==null&&(value.views.length===0||value.views.at(-1)!.id!==value.nextAfter))ctx.addIssue({code:'custom',message:'Invalid View continuation'});});

import {privateDatabaseSourceDefinitionSchema} from './private-database-source.js';
const sequence=z.string().regex(/^[1-9][0-9]{0,18}$/).refine(value=>BigInt(value)<=9223372036854775807n);
function sameValue(a:unknown,b:unknown):boolean{if(a===b)return true;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((item,index)=>sameValue(item,b[index]));if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;const left=a as Record<string,unknown>,right=b as Record<string,unknown>;return Object.keys(left).length===Object.keys(right).length&&Object.keys(left).every(key=>Object.hasOwn(right,key)&&sameValue(left[key],right[key]));}
export const privateDatabaseViewIntentSchema=z.strictObject({operationId:id,source:privateDatabaseSourceDefinitionSchema,intent:databaseViewIntentSchema}).superRefine((value,ctx)=>{ids(value.intent,ctx);try{parseDatabaseViewIntent(value.source,value.intent);}catch{ctx.addIssue({code:'custom',message:'View definition mismatch'});}});
export const privateDatabaseViewEnqueuedSchema=z.strictObject({status:z.enum(['queued','busy']),operationId:id,viewId:id});
export const privateDatabaseViewPreparedSchema=z.strictObject({sequence,operationId:id,sourceId:id,viewId:id,wire:z.string().min(1).max(8*1024*1024)}).superRefine((value,ctx)=>{try{const request=privateDatabaseViewWriteRequestSchema.parse(JSON.parse(value.wire));if(request.operationId!==value.operationId||request.intent.sourceId!==value.sourceId||request.intent.viewId!==value.viewId||new TextEncoder().encode(value.wire).length>8*1024*1024)throw Error();}catch{ctx.addIssue({code:'custom',message:'Invalid prepared View'});}});
export const privateDatabaseViewBlockedSchema=z.strictObject({status:z.literal('blocked'),reason:z.literal('source'),sequence,operationId:id,sourceId:id,viewId:id});
export const privateDatabaseViewQueueRequestSchema=z.strictObject({pendingOnly:z.boolean().default(false),after:sequence.nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
export const privateDatabaseViewQueueSchema=z.strictObject({context:workspaceLocalContextSchema,pending:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),operations:z.array(z.strictObject({sequence,intent:privateDatabaseViewIntentSchema,base:privateDatabaseViewSnapshotSchema.nullable(),candidate:privateDatabaseViewConflictSchema.nullable(),wire:z.string().min(1).max(8*1024*1024).nullable(),response:privateDatabaseViewWriteResponseSchema.nullable()})).max(100),nextAfter:sequence.nullable()}).superRefine((value,ctx)=>{
 let previous=0n;const operations=new Set<string>();for(const row of value.operations){const item=row.intent,intent=item.intent;let valid=BigInt(row.sequence)>previous&&!operations.has(item.operationId)&&item.source.workspaceId===value.context.workspaceId;previous=BigInt(row.sequence);operations.add(item.operationId);try{
 if(intent.kind==='create'){if(row.base!==null||row.candidate!==null)valid=false;}else{if(!row.base)throw Error();parseDatabaseViewSnapshot(item.source,row.base);if(row.base.view.id!==intent.viewId||row.base.version!==intent.baseVersion)valid=false;if(intent.resolution){if(!row.candidate)throw Error();const candidate=parseDatabaseViewConflict(item.source,row.candidate),resolution=intent.resolution;if(candidate.resolvedBy!==null||candidate.viewId!==intent.viewId||candidate.id!==resolution.conflictId||candidate.field!==resolution.field||candidate.remoteVersion!==resolution.remoteVersion||!sameValue(candidate[resolution.choice],intent.patch[resolution.field])||!sameValue(candidate.remote,row.base.view[resolution.field]))valid=false;}else if(row.candidate!==null)valid=false;}
 if(row.wire!==null){const prepared=privateDatabaseViewPreparedSchema.parse({sequence:row.sequence,operationId:item.operationId,sourceId:intent.sourceId,viewId:intent.viewId,wire:row.wire}),request=privateDatabaseViewWriteRequestSchema.parse(JSON.parse(prepared.wire));if(request.clientId!==value.context.clientId||!sameValue(request.intent,intent))valid=false;}
 if(row.response){const reply=row.response;parseDatabaseViewSnapshot(item.source,reply.snapshot);if(row.wire===null||reply.workspaceId!==value.context.workspaceId||reply.workspaceEpoch!==value.context.streamEpoch||reply.clientId!==value.context.clientId||reply.sourceId!==intent.sourceId||reply.schemaVersion!==intent.schemaVersion||reply.operationId!==item.operationId||reply.snapshot.view.id!==intent.viewId)valid=false;
 if(intent.kind==='create'){if(reply.result.status!=='applied'||reply.snapshot.version!==1||!sameValue(reply.snapshot.view,{id:intent.viewId,sourceId:intent.sourceId,...intent.settings}))valid=false;}else{if(reply.snapshot.version<intent.baseVersion)valid=false;const conflicts=reply.result.status==='conflict'?reply.result.conflicts:[];if(intent.resolution&&conflicts.length)valid=false;for(const candidate of conflicts){parseDatabaseViewConflict(item.source,candidate);if(candidate.baseVersion!==intent.baseVersion||!Object.hasOwn(intent.patch,candidate.field)||!sameValue(candidate.base,row.base!.view[candidate.field])||!sameValue(candidate.local,intent.patch[candidate.field])||!sameValue(candidate.remote,reply.snapshot.view[candidate.field]))valid=false;}if(reply.result.status!=='rejected')for(const [key,local] of Object.entries(intent.patch)){const field=key as keyof typeof intent.patch;if(!conflicts.some(candidate=>candidate.field===field)&&!sameValue(local,row.base!.view[field])&&!sameValue(local,reply.snapshot.view[field]))valid=false;if(reply.result.status==='applied'&&reply.snapshot.version===intent.baseVersion&&!sameValue(local,row.base!.view[field]))valid=false;}}
 }
 }catch{valid=false;}if(!valid)ctx.addIssue({code:'custom',message:'Invalid View queue provenance'});}
 if(value.nextAfter!==null&&(value.operations.length===0||value.nextAfter!==value.operations.at(-1)!.sequence))ctx.addIssue({code:'custom',message:'Invalid View queue continuation'});
});