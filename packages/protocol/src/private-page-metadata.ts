import {z} from 'zod';
import {idSchema} from '@greiva/shared';
import {pageSchema} from './index.js';
import {workspaceLocalContextSchema} from './workspace.js';

const version=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const title=z.string().max(65536);
export const privatePageTitleConflictSchema=z.strictObject({
  id:idSchema,operationId:idSchema,baseVersion:version,remoteVersion:version,
  base:title,local:title,remote:title,
}).refine(value=>value.baseVersion<value.remoteVersion && value.base!==value.remote && value.local!==value.base && value.local!==value.remote,'Invalid title conflict');
export const privatePageRenameRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:idSchema,operationId:idSchema,baseVersion:version,title,
  resolution:z.strictObject({conflictId:idSchema,choice:z.enum(['local','remote'])}).optional()});
export const privatePageMetadataReadRequestSchema=z.strictObject({protocolVersion:z.literal(1),clientId:idSchema,afterConflict:idSchema.nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
const scope={protocolVersion:z.literal(1),workspaceId:idSchema,workspaceEpoch:idSchema,pageId:idSchema};
const snapshot={metadata:pageSchema,version};
export const privatePageRenameResponseSchema=z.strictObject({...scope,...snapshot,operationId:idSchema,result:z.discriminatedUnion('status',[
  z.strictObject({status:z.literal('applied')}),
  z.strictObject({status:z.literal('conflict'),conflict:privatePageTitleConflictSchema}),
  z.strictObject({status:z.literal('rejected'),code:z.enum(['base_unknown','resolution_invalid','resolution_stale'])}),
])}).refine(value=>value.metadata.id===value.pageId && value.metadata.yDocId==='page:'+value.pageId && (value.result.status!=='conflict'||(value.result.conflict.operationId===value.operationId && value.result.conflict.remoteVersion===value.version && value.result.conflict.remote===value.metadata.title)),'Invalid title receipt binding');
// Bounded query pagination; neither a delta cursor nor a sync acknowledgement.
export const privatePageMetadataReadResponseSchema=z.strictObject({...scope,...snapshot,conflicts:z.array(privatePageTitleConflictSchema).max(100),nextAfter:idSchema.nullable()})
  .refine(value=>value.metadata.id===value.pageId && value.metadata.yDocId==='page:'+value.pageId && value.conflicts.every((entry,index)=>entry.remoteVersion<=value.version && (index===0||value.conflicts[index-1]!.id<entry.id)) && (value.nextAfter===null||value.nextAfter===value.conflicts.at(-1)?.id),'Invalid title query binding');
export type PrivatePageRenameRequest=z.infer<typeof privatePageRenameRequestSchema>;
export type PrivatePageRenameResponse=z.infer<typeof privatePageRenameResponseSchema>;
export type PrivatePageTitleConflict=z.infer<typeof privatePageTitleConflictSchema>;
const sequencePattern=/^[1-9][0-9]{0,18}$/;
const sequence=z.string().regex(sequencePattern).refine(value=>sequencePattern.test(value)&&BigInt(value)<=9223372036854775807n,'Title sequence overflow');
const precedes=(one:string,two:string)=>sequencePattern.test(one)&&sequencePattern.test(two)&&BigInt(one)<BigInt(two);
export const privatePageTitleIntentSchema=z.strictObject({operationId:idSchema,title,resolution:privatePageRenameRequestSchema.shape.resolution});
export const privatePageTitlePreparedSchema=z.strictObject({pageId:idSchema,sequence,operationId:idSchema,wire:z.string().min(1).max(1024*1024)});
export const privatePageTitleLocalRequestSchema=z.strictObject({afterOperation:sequence.nullable().default(null),afterConflict:idSchema.nullable().default(null),limit:z.number().int().min(1).max(100).default(50)});
export const privatePageTitleLocalResponseSchema=z.strictObject({context:workspaceLocalContextSchema,pageId:idSchema,base:z.strictObject({...snapshot}).nullable(),localTitle:title,pending:version,
  operations:z.array(z.strictObject({sequence,intent:privatePageTitleIntentSchema,baseVersion:version,baseTitle:title,predecessor:idSchema.nullable(),wire:z.string().min(1).max(1024*1024).nullable(),response:privatePageRenameResponseSchema.nullable()})).max(100),nextOperation:sequence.nullable(),
  conflicts:z.array(z.strictObject({record:privatePageTitleConflictSchema,resolvedBy:idSchema.nullable()})).max(100),nextConflict:idSchema.nullable(),
}).refine(value=>(value.base===null?value.pending===0&&value.operations.length===0&&value.conflicts.length===0:value.base.metadata.id===value.pageId&&value.base.metadata.yDocId==='page:'+value.pageId)&&value.operations.every((entry,index)=>(index===0||precedes(value.operations[index-1]!.sequence,entry.sequence))&&(entry.response===null||entry.wire!==null&&entry.response.operationId===entry.intent.operationId&&entry.response.pageId===value.pageId&&entry.response.workspaceId===value.context.workspaceId&&entry.response.workspaceEpoch===value.context.streamEpoch))&&(value.nextOperation===null||value.nextOperation===value.operations.at(-1)?.sequence)&&value.conflicts.every((entry,index)=>index===0||value.conflicts[index-1]!.record.id<entry.record.id)&&(value.nextConflict===null||value.nextConflict===value.conflicts.at(-1)?.record.id),'Invalid local title progress/binding');
export type PrivatePageTitleIntent=z.infer<typeof privatePageTitleIntentSchema>;
export type PrivatePageTitlePrepared=z.infer<typeof privatePageTitlePreparedSchema>;
export type PrivatePageTitleLocalResponse=z.infer<typeof privatePageTitleLocalResponseSchema>;
