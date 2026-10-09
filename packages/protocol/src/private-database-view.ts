import {z} from 'zod';
import {workspaceLocalContextSchema} from './workspace.js';
import {idSchema} from '@greiva/shared';
import {databaseViewIntentSchema,databaseViewSnapshotSchema,databaseViewConflictSchema} from '@greiva/domain';
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
