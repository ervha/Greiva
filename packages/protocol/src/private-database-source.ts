import {z} from 'zod';
import {idSchema} from '@greiva/shared';
import {databaseSourceSchema} from '@greiva/domain';
import {structuredOrderSchema} from './workspace.js';
const positiveOrder=structuredOrderSchema.refine(value=>value!=='0','Positive source order required');
const version=z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const canonicalId=idSchema.refine(value=>value===value.toLowerCase(),'Canonical entity ID required');
const definition=databaseSourceSchema.refine(source=>[source.id,source.workspaceId,...source.properties.flatMap(property=>[property.id,...(property.type==='select'?property.options.map(option=>option.id):[])])].every(id=>canonicalId.safeParse(id).success),'Canonical definition IDs required');
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
