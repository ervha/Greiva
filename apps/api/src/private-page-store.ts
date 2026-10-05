import type pg from 'pg';
import * as Y from 'yjs';
import { isDeepStrictEqual } from 'node:util';
import { idSchema,utcNow } from '@greiva/shared';
import { pageSchema } from '@greiva/protocol';
import { privatePageBootstrapRequestSchema,privatePageAppendRequestSchema,privatePageReadRequestSchema,privatePageBootstrapResponseSchema,privatePageAppendResponseSchema,privatePageReadResponseSchema,privatePageUpdateBytes } from '@greiva/protocol/private-page';
import { PrivateWorkspaceAccessDenied } from '@greiva/application';
import { privateSchemaName } from './private-schema-name.js';
import { PostgresPrivateTransactions,PrivateTransactionUnavailable,type PrivateTransaction } from './private-transactions.js';
import { PrivatePageInvalidRequest,privatePageUpdate,privatePageVector,pageUpdateDigest } from './private-page-codec.js';
import {pageCatalogRequest,queryPageCatalog} from './private-page-catalog.js';
import type { VerifiedSession } from './session-verifier.js';

export interface PrivatePageDocuments {
  query(session:VerifiedSession,workspaceId:string,body:unknown):Promise<unknown>;
  bootstrap(session:VerifiedSession,workspaceId:string,pageId:string,body:unknown):Promise<unknown>;
  append(session:VerifiedSession,workspaceId:string,pageId:string,body:unknown):Promise<unknown>;
  read(session:VerifiedSession,workspaceId:string,pageId:string,body:unknown):Promise<unknown>;
}
type StoredDocument = {head_order:string;editor_schema_version:number;metadata:unknown;creation_request:unknown};
const scope=(workspaceId:string,pageId:string)=>({protocolVersion:1 as const,workspaceId,pageId,documentName:`page:${pageId}`,editorSchemaVersion:1 as const});
function pageId(candidate:string) {const result=idSchema.safeParse(candidate);if(!result.success)throw new PrivatePageInvalidRequest();return result.data;}
function supported(version:number) {if(version!==1)throw new PrivatePageInvalidRequest('unsupported_document_schema');}

// Append-only binary authority; no JSON projection import, compaction, GC,
// automatic orphan initialization or WebSocket room/cache is exposed here.
export class PostgresPrivatePageStore implements PrivatePageDocuments {
  private readonly schema:string;
  private readonly transactions:PostgresPrivateTransactions;
  constructor(pool:pg.Pool,schema:string) {this.schema=privateSchemaName(schema);this.transactions=new PostgresPrivateTransactions(pool,this.schema);}

  async query(session:VerifiedSession,workspaceId:string,body:unknown){const request=pageCatalogRequest(body);return this.transactions.run(session,workspaceId,request.clientId,[],async tx=>{await this.version(tx);return queryPageCatalog(tx,this.schema,request);});}
  async bootstrap(session:VerifiedSession,workspaceId:string,candidateId:string,body:unknown) {
    const id=pageId(candidateId),parsed=privatePageBootstrapRequestSchema.safeParse(body);if(!parsed.success)throw new PrivatePageInvalidRequest();
    const request=parsed.data;supported(request.editorSchemaVersion);
    return this.transactions.run(session,workspaceId,request.clientId,[],async tx=>{
      await this.version(tx);
      const existing=await tx.query(`SELECT workspace_id,deleted FROM "${this.schema}".private_resources WHERE type='page' AND id=$1 FOR UPDATE`,[id]);
      if(existing.rowCount){
        if(existing.rows[0]!.workspace_id!==workspaceId || existing.rows[0]!.deleted)throw new PrivateWorkspaceAccessDenied();
        const stored=await this.document(tx,id,true);
        if(!isDeepStrictEqual(stored.creation_request,request))throw new PrivatePageInvalidRequest('page_id_reused');
        const restored=await this.restore(tx,id,stored);try{return privatePageBootstrapResponseSchema.parse({...scope(workspaceId,id),metadata:pageSchema.parse(stored.metadata),initialDigest:restored.initialDigest});}finally{restored.document.destroy();}
      }
      const update=privatePageUpdate(request.initialUpdate,privatePageUpdateBytes),document=new Y.Doc({gc:false});
      try{
        try{Y.applyUpdate(document,update);}catch{throw new PrivatePageInvalidRequest('invalid_document_update');}
        const digest=pageUpdateDigest(update),time=utcNow(),metadata=pageSchema.parse({id,title:request.title,yDocId:`page:${id}`,createdAt:time,updatedAt:time});
        const reserved=await tx.query(`INSERT INTO "${this.schema}".private_resources(type,id,workspace_id,deleted) VALUES('page',$1,$2,false) ON CONFLICT(type,id) DO NOTHING RETURNING workspace_id`,[id,workspaceId]);
        if(reserved.rowCount!==1){const collision=await tx.query(`SELECT workspace_id FROM "${this.schema}".private_resources WHERE type='page' AND id=$1`,[id]);if(collision.rows[0]?.workspace_id!==workspaceId)throw new PrivateWorkspaceAccessDenied();throw new PrivateTransactionUnavailable();}
        await tx.query(`INSERT INTO "${this.schema}".private_page_documents(page_id,workspace_id,editor_schema_version,creation_request,metadata,head_order) VALUES($1,$2,1,$3,$4,1)`,[id,workspaceId,JSON.stringify(request),JSON.stringify(metadata)]);
        await this.save(tx,id,'1',digest,update,request.clientId);
        return privatePageBootstrapResponseSchema.parse({...scope(workspaceId,id),metadata,initialDigest:digest});
      }finally{document.destroy();}
    });
  }
  async append(session:VerifiedSession,workspaceId:string,candidateId:string,body:unknown) {
    const id=pageId(candidateId),parsed=privatePageAppendRequestSchema.safeParse(body);if(!parsed.success)throw new PrivatePageInvalidRequest();
    const request=parsed.data;supported(request.editorSchemaVersion);
    return this.transactions.run(session,workspaceId,request.clientId,[{type:'page',id}],async tx=>{
      await this.version(tx);const stored=await this.document(tx,id,true),restored=await this.restore(tx,id,stored);
      try{
        const update=privatePageUpdate(request.update,privatePageUpdateBytes),digest=pageUpdateDigest(update),previous=await tx.query(`SELECT server_order,update FROM "${this.schema}".private_page_updates WHERE workspace_id=$1 AND page_id=$2 AND digest=$3`,[workspaceId,id,digest]);
        let head=BigInt(stored.head_order),order:string;
        if(previous.rowCount){if(!Buffer.isBuffer(previous.rows[0]!.update) || !previous.rows[0]!.update.equals(update))throw new PrivateTransactionUnavailable();order=previous.rows[0]!.server_order;}
        else{
          if(head===9223372036854775807n)throw new PrivateTransactionUnavailable();
          try{Y.applyUpdate(restored.document,update);}catch{throw new PrivatePageInvalidRequest('invalid_document_update');}
          head++;order=head.toString();await this.save(tx,id,order,digest,update,request.clientId);
          const metadata=pageSchema.parse({...pageSchema.parse(stored.metadata),updatedAt:utcNow()});
          await tx.query(`UPDATE "${this.schema}".private_page_documents SET head_order=$3,metadata=$4 WHERE workspace_id=$1 AND page_id=$2`,[workspaceId,id,order,JSON.stringify(metadata)]);
        }
        return privatePageAppendResponseSchema.parse({...scope(workspaceId,id),serverOrder:order,headOrder:head.toString(),digest,stateVector:Buffer.from(Y.encodeStateVector(restored.document)).toString('base64url')});
      }finally{restored.document.destroy();}
    });
  }
  async read(session:VerifiedSession,workspaceId:string,candidateId:string,body:unknown) {
    const id=pageId(candidateId),parsed=privatePageReadRequestSchema.safeParse(body);if(!parsed.success)throw new PrivatePageInvalidRequest();
    const request=parsed.data;supported(request.editorSchemaVersion);
    return this.transactions.run(session,workspaceId,request.clientId,[{type:'page',id}],async tx=>{
      await this.version(tx);const stored=await this.document(tx,id,false),restored=await this.restore(tx,id,stored);
      try{const vector=privatePageVector(request.stateVector),update=Buffer.from(Y.encodeStateAsUpdate(restored.document,vector));return privatePageReadResponseSchema.parse({...scope(workspaceId,id),metadata:pageSchema.parse(stored.metadata),headOrder:stored.head_order,update:update.toString('base64url'),digest:pageUpdateDigest(update),stateVector:Buffer.from(Y.encodeStateVector(restored.document)).toString('base64url')});}
      finally{restored.document.destroy();}
    });
  }
  private async version(tx:PrivateTransaction) {const rows=await tx.query(`SELECT version FROM "${this.schema}".private_schema_version WHERE singleton=true`);if(rows.rowCount!==1 || rows.rows[0]!.version!==3)throw new PrivateTransactionUnavailable();}
  private async document(tx:PrivateTransaction,id:string,write:boolean):Promise<StoredDocument> {
    const rows=await tx.query<StoredDocument>(`SELECT head_order,editor_schema_version,metadata,creation_request FROM "${this.schema}".private_page_documents WHERE workspace_id=$1 AND page_id=$2 FOR ${write?'UPDATE':'SHARE'}`,[tx.context.workspaceId,id]);
    const row=rows.rows[0];if(rows.rowCount!==1 || !row || row.editor_schema_version!==1)throw new PrivateTransactionUnavailable();
    const metadata=pageSchema.safeParse(row.metadata);if(!metadata.success || metadata.data.id!==id || metadata.data.yDocId!==`page:${id}`)throw new PrivateTransactionUnavailable();return row;
  }
  private async restore(tx:PrivateTransaction,id:string,stored:StoredDocument) {
    const rows=await tx.query(`SELECT server_order,digest,update FROM "${this.schema}".private_page_updates WHERE workspace_id=$1 AND page_id=$2 ORDER BY server_order`,[tx.context.workspaceId,id]);
    const document=new Y.Doc({gc:false});let order=0n,initialDigest='';
    try{
      for(const row of rows.rows){
        if(BigInt(row.server_order)!==order+1n || !Buffer.isBuffer(row.update) || pageUpdateDigest(row.update)!==row.digest)throw new PrivateTransactionUnavailable();
        const update=privatePageUpdate(row.update.toString('base64url'),privatePageUpdateBytes);Y.applyUpdate(document,update);order++;
        if(order===1n)initialDigest=row.digest;
      }
      if(!order || order.toString()!==stored.head_order)throw new PrivateTransactionUnavailable();
      return{document,initialDigest};
    }catch{document.destroy();throw new PrivateTransactionUnavailable();}
  }
  private save(tx:PrivateTransaction,id:string,order:string,digest:string,update:Buffer,clientId:string) {
    return tx.query(`INSERT INTO "${this.schema}".private_page_updates(workspace_id,page_id,server_order,digest,update,first_client_id) VALUES($1,$2,$3,$4,decode($5,'hex'),$6)`,[tx.context.workspaceId,id,order,digest,update.toString('hex'),clientId]);
  }
}
