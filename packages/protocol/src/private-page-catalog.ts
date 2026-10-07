import {z} from 'zod';import {idSchema} from '@greiva/shared';import {pageSchema} from './index.js';
import {workspaceLocalContextSchema} from './workspace.js';
export const privatePageCatalogRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:idSchema,cursor:z.string().min(1).max(8192).nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
// Query pagination only. A completed list is not a metadata delta/receipt or a
// consistent multi-request snapshot; edits/new Pages may require a fresh query.
export const privatePageCatalogResponseSchema=z.strictObject({protocolVersion:z.literal(1),workspaceId:idSchema,workspaceEpoch:idSchema,pages:z.array(pageSchema).max(100),nextCursor:z.string().min(1).max(8192).nullable(),hasMore:z.boolean()})
  .refine(value=>value.hasMore===(value.nextCursor!==null) && (!value.hasMore||value.pages.length>0) && value.pages.every((page,index)=>page.yDocId==='page:'+page.id && (index===0||value.pages[index-1]!.id<page.id)),'Invalid Page catalog progress/binding');
export const privatePageCatalogCursorSchema=z.strictObject({protocolVersion:z.literal(1),kind:z.literal('page-list'),workspaceId:idSchema,workspaceEpoch:idSchema,after:idSchema});
export type PrivatePageCatalogRequest=z.infer<typeof privatePageCatalogRequestSchema>;
export type PrivatePageCatalogResponse=z.infer<typeof privatePageCatalogResponseSchema>;
// Local navigation metadata, not a sync receipt or server catalog cursor.
export const privateLocalPageCatalogRequestSchema=z.strictObject({after:idSchema.nullable(),limit:z.number().int().min(1).max(100)});
export const privateLocalPageCatalogResponseSchema=z.strictObject({context:workspaceLocalContextSchema,pages:z.array(z.strictObject({metadata:pageSchema,pending:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)})).max(100),nextAfter:idSchema.nullable()})
  .refine(value=>value.pages.every((entry,index)=>index===0||value.pages[index-1]!.metadata.id<entry.metadata.id) && (value.nextAfter===null || value.nextAfter===value.pages.at(-1)?.metadata.id),'Invalid local Page progress');
export type PrivateLocalPageCatalogResponse=z.infer<typeof privateLocalPageCatalogResponseSchema>;
