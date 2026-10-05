import { z } from 'zod';
import { idSchema } from '@greiva/shared';
import { pageSchema } from './index.js';
import { structuredOrderSchema } from './workspace.js';

// Initial diagnostic transport bounds, not a product document-size/retention
// policy. Base64url is canonicalized by the server codec before persistence.
export const privatePageUpdateBytes = 512 * 1024;
const update = z.string().min(1).max(Math.ceil(privatePageUpdateBytes * 4 / 3)).regex(/^[A-Za-z0-9_-]+$/);
const vector = z.string().min(1).max(65536).regex(/^[A-Za-z0-9_-]+$/);
const responseVector = z.string().min(1).regex(/^[A-Za-z0-9_-]+$/);
const request = { protocolVersion: z.literal(1), clientId: idSchema, editorSchemaVersion: z.number().int().positive() };
const scope = { protocolVersion: z.literal(1), workspaceId: idSchema, pageId: idSchema, documentName: z.string(), editorSchemaVersion: z.literal(1) };
export const privatePageBootstrapRequestSchema = z.strictObject({ ...request, title: z.string().max(65536), initialUpdate: update });
export const privatePageAppendRequestSchema = z.strictObject({ ...request, update });
export const privatePageReadRequestSchema = z.strictObject({ ...request, stateVector: vector });
const digest = z.string().regex(/^[0-9a-f]{64}$/);
export const privatePageBootstrapResponseSchema = z.strictObject({ ...scope, metadata: pageSchema, initialDigest: digest })
  .refine(value => value.documentName === `page:${value.pageId}` && value.metadata.id === value.pageId && value.metadata.yDocId === value.documentName, 'Page binding mismatch');
export const privatePageAppendResponseSchema = z.strictObject({ ...scope, serverOrder: structuredOrderSchema, headOrder: structuredOrderSchema, digest, stateVector: responseVector })
  .refine(value => value.documentName === `page:${value.pageId}` && BigInt(value.serverOrder) > 0n && BigInt(value.serverOrder) <= BigInt(value.headOrder), 'Page receipt binding/order mismatch');
// A diff can combine many committed frames; do not apply the input frame bound
// to it and strand a larger previously acknowledged document.
export const privatePageReadResponseSchema = z.strictObject({ ...scope, metadata: pageSchema, headOrder: structuredOrderSchema, update: z.string().min(1).regex(/^[A-Za-z0-9_-]+$/), digest, stateVector: responseVector })
  .refine(value => value.documentName === `page:${value.pageId}` && value.metadata.id === value.pageId && value.metadata.yDocId === value.documentName, 'Page binding mismatch');
