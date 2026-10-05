import {createHmac,timingSafeEqual} from 'node:crypto';
import {privatePageCatalogRequestSchema,privatePageCatalogResponseSchema,privatePageCatalogCursorSchema} from '@greiva/protocol/private-page-catalog';
import {pageSchema} from '@greiva/protocol';
import {PrivateTransactionInvalidRequest,PrivateTransactionUnavailable,type PrivateTransaction} from './private-transactions.js';
export class PrivatePageCatalogInvalidRequest extends PrivateTransactionInvalidRequest {constructor(readonly code:'invalid_request'|'invalid_cursor'='invalid_request'){super();}}
function key(secret:unknown):Buffer {if(!Buffer.isBuffer(secret)||secret.length!==32)throw new PrivateTransactionUnavailable();return Buffer.from(secret);}
export function pageCatalogCursor(secret:unknown,workspaceId:string,workspaceEpoch:string,after:string):string {
  const bytes=key(secret),payload=Buffer.from(JSON.stringify(privatePageCatalogCursorSchema.parse({protocolVersion:1,kind:'page-list',workspaceId,workspaceEpoch,after}))).toString('base64url'),body='gq1.'+payload;
  return body+'.'+createHmac('sha256',bytes).update(body).digest('base64url');
}
export function pageCatalogAfter(secret:unknown,workspaceId:string,workspaceEpoch:string,cursor:string):string {
  const bytes=key(secret);try{
    if(cursor.length>8192)throw Error();const parts=cursor.split('.');if(parts.length!==3||parts[0]!=='gq1')throw Error();const payload=Buffer.from(parts[1]!,'base64url'),signature=Buffer.from(parts[2]!,'base64url');if(payload.toString('base64url')!==parts[1]||signature.toString('base64url')!==parts[2])throw Error();
    const expected=createHmac('sha256',bytes).update(parts[0]+'.'+parts[1]).digest();if(signature.length!==expected.length || !timingSafeEqual(signature,expected))throw Error();
    const value=privatePageCatalogCursorSchema.parse(JSON.parse(payload.toString('utf8')));if(value.workspaceId!==workspaceId || value.workspaceEpoch!==workspaceEpoch)throw Error();return value.after;
  }catch{throw new PrivatePageCatalogInvalidRequest('invalid_cursor');}
}
export function pageCatalogRequest(body:unknown){const result=privatePageCatalogRequestSchema.safeParse(body);if(!result.success)throw new PrivatePageCatalogInvalidRequest();return result.data;}
export async function queryPageCatalog(tx:PrivateTransaction,schema:string,request:ReturnType<typeof pageCatalogRequest>){
  const keys=await tx.query(`SELECT secret FROM "${schema}".private_structured_config WHERE singleton=true`);if(keys.rowCount!==1)throw new PrivateTransactionUnavailable();const secret=key(keys.rows[0]!.secret),after=request.cursor===null?null:pageCatalogAfter(secret,tx.context.workspaceId,tx.context.epoch,request.cursor);
  // SHARE on live resource rows keeps tombstones from overtaking this read.
  // Document metadata is read in the same statement snapshot; this is a query,
  // not a stable cross-request snapshot or a document/structured sync cursor.
  const rows=await tx.query(`SELECT d.page_id,d.editor_schema_version,d.metadata FROM "${schema}".private_page_documents d JOIN "${schema}".private_resources r ON r.type='page' AND r.id=d.page_id AND r.workspace_id=d.workspace_id WHERE d.workspace_id=$1 AND r.deleted=false AND ($2::uuid IS NULL OR d.page_id>$2::uuid) ORDER BY d.page_id LIMIT $3 FOR SHARE OF r`,[tx.context.workspaceId,after,request.limit+1]);
  const pages=rows.rows.map(row=>{const parsed=pageSchema.safeParse(row.metadata);if(row.editor_schema_version!==1 || !parsed.success || parsed.data.id!==row.page_id || parsed.data.yDocId!=='page:'+row.page_id)throw new PrivateTransactionUnavailable();return parsed.data;}).slice(0,request.limit),hasMore=rows.rows.length>request.limit;
  return privatePageCatalogResponseSchema.parse({protocolVersion:1,workspaceId:tx.context.workspaceId,workspaceEpoch:tx.context.epoch,pages,hasMore,nextCursor:hasMore?pageCatalogCursor(secret,tx.context.workspaceId,tx.context.epoch,pages.at(-1)!.id):null});
}
