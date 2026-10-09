import {z} from 'zod';
import {idSchema} from '@greiva/shared';
import {databaseViewSchema} from '@greiva/domain';
import {structuredOrderSchema} from './workspace.js';
const id=idSchema.refine(value=>value===value.toLowerCase(),'Canonical ID required');
const version=z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const privateDatabaseViewHeaderSchema=z.strictObject({id,workspaceId:id,sourceId:id,version,name:databaseViewSchema.shape.name,layout:databaseViewSchema.shape.layout,creationOrder:structuredOrderSchema.refine(value=>value!=='0')});
export const privateDatabaseViewCatalogRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:id,cursor:z.string().min(1).max(1024).nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
export const privateDatabaseViewCatalogResponseSchema=z.strictObject({protocolVersion:z.literal(1),workspaceId:id,workspaceEpoch:id,clientId:id,sourceId:id,schemaVersion:version,afterOrder:structuredOrderSchema,throughOrder:structuredOrderSchema,headOrder:structuredOrderSchema,views:z.array(privateDatabaseViewHeaderSchema).max(100),hasMore:z.boolean(),cursor:z.string().min(1).max(1024).nullable()}).superRefine((value,ctx)=>{
 const after=BigInt(value.afterOrder),through=BigInt(value.throughOrder),head=BigInt(value.headOrder);
 if(after>through||through>head||value.hasMore!==(through<head)||value.hasMore!==(value.cursor!==null))ctx.addIssue({code:'custom',message:'Invalid View catalog progress'});
 if(new Set(value.views.map(row=>row.id)).size!==value.views.length)ctx.addIssue({code:'custom',message:'Duplicate View header'});
 let previous=after;for(const row of value.views){const order=BigInt(row.creationOrder);if(row.workspaceId!==value.workspaceId||row.sourceId!==value.sourceId||order<=previous||order>through)ctx.addIssue({code:'custom',message:'Invalid View header scope/order'});previous=order;}
});
