import {z} from 'zod';
import {idSchema} from '@greiva/shared';
import {pageSchema} from './index.js';
import {structuredOrderSchema} from './workspace.js';
import {privatePageTitleConflictSchema} from './private-page-metadata.js';
import {workspaceLocalContextSchema} from './workspace.js';

export const privatePageChangesRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:idSchema,cursor:z.string().min(1).max(1024).nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
export const privatePageChangeSchema=z.strictObject({order:structuredOrderSchema,pageId:idSchema,metadata:pageSchema,version:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),conflict:z.strictObject({record:privatePageTitleConflictSchema,resolvedBy:idSchema.nullable()}).nullable()})
  .refine(v=>v.order!=='0'&&v.metadata.id===v.pageId&&v.metadata.yDocId==='page:'+v.pageId&&v.metadata.title.length<=65536&&(v.conflict===null||v.conflict.record.remoteVersion<=v.version),'Invalid Page change binding');
export const privatePageChangesResponseSchema=z.strictObject({protocolVersion:z.literal(1),workspaceId:idSchema,workspaceEpoch:idSchema,afterOrder:structuredOrderSchema,readOrder:structuredOrderSchema,headOrder:structuredOrderSchema,events:z.array(privatePageChangeSchema).max(100),hasMore:z.boolean(),cursor:z.string().min(1).max(1024)})
  .refine(v=>BigInt(v.afterOrder)<=BigInt(v.readOrder)&&BigInt(v.readOrder)<=BigInt(v.headOrder)&&v.events.every((e,i)=>BigInt(e.order)>BigInt(v.afterOrder)&&BigInt(e.order)<=BigInt(v.readOrder)&&(i===0||BigInt(v.events[i-1]!.order)<BigInt(e.order)))&&(v.hasMore?BigInt(v.readOrder)>BigInt(v.afterOrder)&&BigInt(v.readOrder)<BigInt(v.headOrder):v.readOrder===v.headOrder),'Invalid Page change progress');
export type PrivatePageChange=z.infer<typeof privatePageChangeSchema>;
export type PrivatePageChangesRequest=z.infer<typeof privatePageChangesRequestSchema>;
export type PrivatePageChangesResponse=z.infer<typeof privatePageChangesResponseSchema>;
export const privatePageChangesLocalRequestSchema=z.strictObject({afterPage:idSchema.nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
export const privatePageChangesLocalResponseSchema=z.strictObject({context:workspaceLocalContextSchema,order:structuredOrderSchema,cursor:z.string().min(1).max(1024).nullable(),headOrder:structuredOrderSchema,received:z.boolean(),hasMore:z.boolean(),pages:z.array(z.strictObject({metadata:pageSchema,version:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),lastOrder:structuredOrderSchema})).max(100),nextAfter:idSchema.nullable()})
  .refine(v=>BigInt(v.order)<=BigInt(v.headOrder)&&v.received===(v.cursor!==null)&&(v.received||(v.order==='0'&&v.headOrder==='0'&&!v.hasMore))&&(v.hasMore?BigInt(v.order)<BigInt(v.headOrder):v.order===v.headOrder)&&v.pages.every((e,i)=>e.metadata.yDocId==='page:'+e.metadata.id&&e.metadata.title.length<=65536&&e.lastOrder!=='0'&&BigInt(e.lastOrder)<=BigInt(v.order)&&(i===0||v.pages[i-1]!.metadata.id<e.metadata.id))&&(v.nextAfter===null||v.nextAfter===v.pages.at(-1)?.metadata.id),'Invalid local Page changes state');
