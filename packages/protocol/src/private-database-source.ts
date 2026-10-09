import {z} from 'zod';
import {idSchema} from '@greiva/shared';
import {databaseSourceSchema} from '@greiva/domain';
import {structuredOrderSchema} from './workspace.js';
import {workspaceLocalContextSchema} from './workspace.js';
const positiveOrder=structuredOrderSchema.refine(value=>value!=='0','Positive source order required');
const version=z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const canonicalId=idSchema.refine(value=>value===value.toLowerCase(),'Canonical entity ID required');
const definition=databaseSourceSchema.refine(source=>[source.id,source.workspaceId,...source.properties.flatMap(property=>[property.id,...(property.type==='select'?property.options.map(option=>option.id):[])])].every(id=>canonicalId.safeParse(id).success),'Canonical definition IDs required');
export const privateDatabaseSourceDefinitionSchema=definition;
const scope={protocolVersion:z.literal(1),workspaceId:canonicalId,workspaceEpoch:canonicalId,clientId:canonicalId};
export const privateDatabaseSourceSnapshotSchema=z.strictObject({source:definition,version,creationOrder:positiveOrder}).refine(row=>row.source.schemaVersion<=row.version,'Schema version exceeds metadata version');
export const privateDatabaseSourceCreateRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:canonicalId,operationId:canonicalId,source:definition.refine(source=>source.schemaVersion===1,'Initial definition version required')});
export const privateDatabaseSourceCreateResponseSchema=z.strictObject({...scope,operationId:canonicalId,snapshot:privateDatabaseSourceSnapshotSchema,result:z.strictObject({status:z.literal('created')})}).refine(reply=>reply.snapshot.source.workspaceId===reply.workspaceId,'Source scope mismatch');
export const privateDatabaseSourceReadRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:canonicalId});
export const privateDatabaseSourceReadResponseSchema=z.strictObject({...scope,snapshot:privateDatabaseSourceSnapshotSchema}).refine(reply=>reply.snapshot.source.workspaceId===reply.workspaceId,'Source scope mismatch');
export const privateDatabaseSourceCatalogRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:canonicalId,cursor:z.string().min(1).max(1024).nullable(),limit:z.number().int().min(1).max(100).default(50)});
export const privateDatabaseSourceSummarySchema=z.strictObject({id:canonicalId,workspaceId:canonicalId,name:z.string().max(120).refine(value=>value.trim().length>0,'Missing source name'),schemaVersion:version,version,creationOrder:positiveOrder,propertyCount:z.number().int().min(1).max(64)}).refine(row=>row.schemaVersion<=row.version,'Schema version exceeds metadata version');
export const privateDatabaseSourceCatalogResponseSchema=z.strictObject({...scope,afterOrder:structuredOrderSchema,throughOrder:structuredOrderSchema,headOrder:structuredOrderSchema,sources:z.array(privateDatabaseSourceSummarySchema).max(100),hasMore:z.boolean(),cursor:z.string().min(1).max(1024).nullable()}).superRefine((reply,ctx)=>{
 const after=BigInt(reply.afterOrder),through=BigInt(reply.throughOrder),head=BigInt(reply.headOrder);
 if(after>through||through>head||reply.hasMore!==(through<head)||(reply.hasMore?reply.cursor===null:reply.cursor!==null))ctx.addIssue({code:'custom',message:'Invalid source catalog progress'});
 if(new Set(reply.sources.map(row=>row.id)).size!==reply.sources.length)ctx.addIssue({code:'custom',message:'Duplicate source ID'});
 let previous=after;for(const row of reply.sources){const order=BigInt(row.creationOrder);if(row.workspaceId!==reply.workspaceId||order<=previous||order>through)ctx.addIssue({code:'custom',message:'Invalid source catalog snapshot'});previous=order;}
});
export type PrivateDatabaseSourceSnapshot=z.infer<typeof privateDatabaseSourceSnapshotSchema>;
export const privateDatabaseSourceLocalLoadSchema=z.strictObject({context:workspaceLocalContextSchema,snapshot:privateDatabaseSourceSnapshotSchema.nullable()}).refine(value=>value.snapshot===null||value.snapshot.source.workspaceId===value.context.workspaceId,'Local Source workspace mismatch');
export const privateDatabaseSourceLocalListRequestSchema=z.strictObject({after:canonicalId.nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
export const privateDatabaseSourceLocalListSchema=z.strictObject({context:workspaceLocalContextSchema,sources:z.array(privateDatabaseSourceSnapshotSchema).max(100),nextAfter:canonicalId.nullable()}).superRefine((value,ctx)=>{
 let previous='';const positions=new Set<string>();for(const row of value.sources){if(row.source.workspaceId!==value.context.workspaceId||row.source.id<=previous||positions.has(row.creationOrder))ctx.addIssue({code:'custom',message:'Invalid local Source catalog'});previous=row.source.id;positions.add(row.creationOrder);}
 if(value.nextAfter!==null&&(value.sources.length===0||value.sources.at(-1)!.source.id!==value.nextAfter))ctx.addIssue({code:'custom',message:'Invalid Source continuation'});
});
const sourceSequence=structuredOrderSchema.refine(value=>value!=='0','Positive Source sequence required');
export const privateDatabaseSourceIntentSchema=z.strictObject({operationId:canonicalId,source:definition.refine(source=>source.schemaVersion===1,'Initial definition version required')});
export const privateDatabaseSourcePreparedSchema=z.strictObject({sequence:sourceSequence,operationId:canonicalId,sourceId:canonicalId,wire:z.string().min(1).max(4*1024*1024)}).superRefine((value,ctx)=>{try{const request=privateDatabaseSourceCreateRequestSchema.parse(JSON.parse(value.wire));if(request.operationId!==value.operationId||request.source.id!==value.sourceId)throw Error();}catch{ctx.addIssue({code:'custom',message:'Invalid prepared Source wire'});}});
export const privateDatabaseSourceQueueRequestSchema=z.strictObject({after:sourceSequence.nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
export const privateDatabaseSourceQueueSchema=z.strictObject({context:workspaceLocalContextSchema,pending:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),operations:z.array(z.strictObject({sequence:sourceSequence,intent:privateDatabaseSourceIntentSchema,wire:z.string().min(1).max(4*1024*1024).nullable(),response:privateDatabaseSourceCreateResponseSchema.nullable()})).max(100),nextAfter:sourceSequence.nullable()}).superRefine((value,ctx)=>{
 let previous=0n;const sources=new Set<string>(),ids=new Set<string>();
 for(const row of value.operations){let valid=BigInt(row.sequence)>previous&&row.intent.source.workspaceId===value.context.workspaceId&&!sources.has(row.intent.source.id)&&!ids.has(row.intent.operationId);previous=BigInt(row.sequence);sources.add(row.intent.source.id);ids.add(row.intent.operationId);
  if(row.wire!==null){try{const request=privateDatabaseSourceCreateRequestSchema.parse(JSON.parse(row.wire));if(request.clientId!==value.context.clientId||request.operationId!==row.intent.operationId||JSON.stringify(request.source)!==JSON.stringify(row.intent.source))valid=false;}catch{valid=false;}}
  if(row.response!==null&&(row.wire===null||row.response.operationId!==row.intent.operationId||row.response.clientId!==value.context.clientId||row.response.workspaceId!==value.context.workspaceId||row.response.workspaceEpoch!==value.context.streamEpoch||row.response.snapshot.version!==1||JSON.stringify(row.response.snapshot.source)!==JSON.stringify(row.intent.source)))valid=false;
  if(!valid)ctx.addIssue({code:'custom',message:'Invalid Source operation provenance'});
 }
 if(value.nextAfter!==null&&(value.operations.length===0||value.nextAfter!==value.operations.at(-1)!.sequence))ctx.addIssue({code:'custom',message:'Invalid Source operation continuation'});
});
export type PrivateDatabaseSourceIntent=z.infer<typeof privateDatabaseSourceIntentSchema>;
export type PrivateDatabaseSourcePrepared=z.infer<typeof privateDatabaseSourcePreparedSchema>;
