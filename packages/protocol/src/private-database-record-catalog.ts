import {z} from 'zod';
import {idSchema} from '@greiva/shared';
import {structuredOrderSchema} from './workspace.js';
const id=idSchema.refine(value=>value===value.toLowerCase(),'Canonical ID required');
const version=z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const privateDatabaseRecordHeaderSchema=z.strictObject({id,workspaceId:id,sourceId:id,pageId:id,version,creationOrder:structuredOrderSchema.refine(value=>value!=='0')});
export const privateDatabaseRecordCatalogRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:id,cursor:z.string().min(1).max(1024).nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
export const privateDatabaseRecordCatalogResponseSchema=z.strictObject({protocolVersion:z.literal(1),workspaceId:id,workspaceEpoch:id,clientId:id,sourceId:id,schemaVersion:version,afterOrder:structuredOrderSchema,throughOrder:structuredOrderSchema,headOrder:structuredOrderSchema,records:z.array(privateDatabaseRecordHeaderSchema).max(100),hasMore:z.boolean(),cursor:z.string().min(1).max(1024).nullable()}).superRefine((value,ctx)=>{
 const after=BigInt(value.afterOrder),through=BigInt(value.throughOrder),head=BigInt(value.headOrder);
 if(after>through||through>head||value.hasMore!==(through<head)||value.hasMore!==(value.cursor!==null))ctx.addIssue({code:'custom',message:'Invalid catalog progress'});
 if(new Set(value.records.map(row=>row.id)).size!==value.records.length||new Set(value.records.map(row=>row.pageId)).size!==value.records.length)ctx.addIssue({code:'custom',message:'Duplicate catalog binding'});
 let previous=after;
 for(const row of value.records){const order=BigInt(row.creationOrder);if(row.workspaceId!==value.workspaceId||row.sourceId!==value.sourceId||order<=previous||order>through)ctx.addIssue({code:'custom',message:'Invalid catalog header scope or order'});previous=order;}
});
