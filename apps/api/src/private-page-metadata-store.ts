import type pg from 'pg';
import {isDeepStrictEqual} from 'node:util';
import {idSchema,newId,utcNow} from '@greiva/shared';
import {pageSchema} from '@greiva/protocol';
import {privatePageRenameRequestSchema,privatePageRenameResponseSchema,privatePageMetadataReadRequestSchema,privatePageMetadataReadResponseSchema,privatePageTitleConflictSchema,type PrivatePageRenameResponse} from '@greiva/protocol/private-page-metadata';
import {privateSchemaName} from './private-schema-name.js';
import {PostgresPrivateTransactions,PrivateTransactionInvalidRequest,PrivateTransactionUnavailable,type PrivateTransaction} from './private-transactions.js';
import type {VerifiedSession} from './session-verifier.js';
import {appendPageChange} from './private-page-changes-store.js';

export class PrivatePageMetadataInvalidRequest extends PrivateTransactionInvalidRequest{constructor(readonly code:'invalid_request'|'operation_id_reused'='invalid_request'){super();}}
export interface PrivatePageMetadata{rename(session:VerifiedSession,workspaceId:string,pageId:string,body:unknown):Promise<unknown>;read(session:VerifiedSession,workspaceId:string,pageId:string,body:unknown):Promise<unknown>;}
function parse<T>(schema:{safeParse:(input:unknown)=>{success:boolean;data?:T}},input:unknown):T{const parsed=schema.safeParse(input);if(!parsed.success)throw new PrivatePageMetadataInvalidRequest();return parsed.data!;}
export class PostgresPrivatePageMetadataStore implements PrivatePageMetadata{
  private readonly schema:string;private readonly transactions:PostgresPrivateTransactions;
  constructor(pool:pg.Pool,schema:string){this.schema=privateSchemaName(schema);this.transactions=new PostgresPrivateTransactions(pool,this.schema);}
  async rename(session:VerifiedSession,workspaceId:string,candidate:string,body:unknown){
    const id=parse(idSchema,candidate),request=parse(privatePageRenameRequestSchema,body);
    return this.transactions.run(session,workspaceId,request.clientId,[{type:'page',id}],async tx=>{
      const current=await this.current(tx,id,true),scope=this.scope(tx,id);
      let resolved:ReturnType<typeof privatePageTitleConflictSchema.parse>|null=null;
      const previous=await tx.query(`SELECT page_id,client_id,request,result FROM "${this.schema}".private_page_title_operations WHERE workspace_id=$1 AND operation_id=$2`,[workspaceId,request.operationId]);
      if(previous.rowCount){const row=previous.rows[0]!;if(row.page_id!==id||row.client_id!==request.clientId||!isDeepStrictEqual(row.request,request))throw new PrivatePageMetadataInvalidRequest('operation_id_reused');
        const receipt=privatePageRenameResponseSchema.parse(row.result);if(receipt.workspaceId!==workspaceId||receipt.workspaceEpoch!==tx.context.epoch||receipt.pageId!==id||receipt.operationId!==request.operationId)throw new PrivateTransactionUnavailable();return receipt;}
      const base=await tx.query(`SELECT title FROM "${this.schema}".private_page_title_history WHERE page_id=$1 AND version=$2`,[id,request.baseVersion]);
      let result:PrivatePageRenameResponse['result']={status:'applied'},metadata=current.metadata,version=current.version;
      if(!base.rowCount)result={status:'rejected',code:'base_unknown'};
      else if(request.resolution){
        const rows=await tx.query(`SELECT record,resolved_by FROM "${this.schema}".private_page_title_conflicts WHERE page_id=$1 AND id=$2`,[id,request.resolution.conflictId]);
        const row=rows.rows[0],conflict=row?privatePageTitleConflictSchema.parse(row.record):undefined;
        if(!row||row.resolved_by!==null||!conflict||conflict.id!==request.resolution.conflictId||request.title!==conflict[request.resolution.choice])result={status:'rejected',code:'resolution_invalid'};
        else if(request.baseVersion!==version)result={status:'rejected',code:'resolution_stale'};
        else {await tx.query(`UPDATE "${this.schema}".private_page_title_conflicts SET resolved_by=$3 WHERE page_id=$1 AND id=$2`,[id,conflict.id,request.operationId]);resolved=conflict;}
      }else if(base.rows[0]!.title!==metadata.title && request.title!==base.rows[0]!.title && request.title!==metadata.title){
        const conflict=privatePageTitleConflictSchema.parse({id:newId(),operationId:request.operationId,baseVersion:request.baseVersion,remoteVersion:version,base:base.rows[0]!.title,local:request.title,remote:metadata.title});
        await tx.query(`INSERT INTO "${this.schema}".private_page_title_conflicts(page_id,id,record) VALUES($1,$2,$3)`,[id,conflict.id,JSON.stringify(conflict)]);result={status:'conflict',conflict};
      }
      // An unchanged local base is a no-op, preserving concurrent remote edits.
      if(result.status==='applied' && request.title!==metadata.title && (request.resolution||request.title!==base.rows[0]!.title)){
        if(version===Number.MAX_SAFE_INTEGER)throw new PrivateTransactionUnavailable();version++;
        metadata=pageSchema.parse({...metadata,title:request.title,updatedAt:utcNow()});
        await tx.query(`UPDATE "${this.schema}".private_page_documents SET metadata=$3 WHERE workspace_id=$1 AND page_id=$2`,[workspaceId,id,JSON.stringify(metadata)]);
        await tx.query(`UPDATE "${this.schema}".private_page_title_state SET version=$2 WHERE page_id=$1`,[id,version]);
        await tx.query(`INSERT INTO "${this.schema}".private_page_title_history VALUES($1,$2,$3)`,[id,version,metadata.title]);
      }
      const receipt=privatePageRenameResponseSchema.parse({...scope,metadata,version,operationId:request.operationId,result});
      const inserted=await tx.query(`INSERT INTO "${this.schema}".private_page_title_operations VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,operation_id) DO NOTHING RETURNING operation_id`,[workspaceId,id,request.operationId,request.clientId,JSON.stringify(request),JSON.stringify(receipt)]);
      // A cross-Page nonce collision rolls back all title/conflict writes.
      if(inserted.rowCount!==1)throw new PrivatePageMetadataInvalidRequest('operation_id_reused');
      if(current.schemaVersion>=5&&(version!==current.version||result.status==='conflict'||resolved!==null))await appendPageChange(tx,this.schema,{pageId:id,metadata,version,conflict:result.status==='conflict'?{record:result.conflict,resolvedBy:null}:resolved?{record:resolved,resolvedBy:request.operationId}:null});
      return receipt;
    },{metadataJournal:true});
  }
  async read(session:VerifiedSession,workspaceId:string,candidate:string,body:unknown){
    const id=parse(idSchema,candidate),request=parse(privatePageMetadataReadRequestSchema,body);
    return this.transactions.run(session,workspaceId,request.clientId,[{type:'page',id}],async tx=>{
      const current=await this.current(tx,id,false);
      const rows=await tx.query(`SELECT id,record FROM "${this.schema}".private_page_title_conflicts WHERE page_id=$1 AND resolved_by IS NULL AND ($2::uuid IS NULL OR id>$2::uuid) ORDER BY id LIMIT $3`,[id,request.afterConflict,request.limit+1]);
      const entries=rows.rows.map(row=>{const entry=privatePageTitleConflictSchema.parse(row.record);if(entry.id!==row.id||entry.remoteVersion>current.version)throw new PrivateTransactionUnavailable();return entry;});
      const conflicts=entries.slice(0,request.limit);return privatePageMetadataReadResponseSchema.parse({...this.scope(tx,id),metadata:current.metadata,version:current.version,conflicts,nextAfter:entries.length>request.limit?conflicts.at(-1)!.id:null});
    });
  }
  private scope(tx:PrivateTransaction,pageId:string){return{protocolVersion:1,workspaceId:tx.context.workspaceId,workspaceEpoch:tx.context.epoch,pageId};}
  private async current(tx:PrivateTransaction,id:string,write:boolean){
    const gate=await tx.query(`SELECT version FROM "${this.schema}".private_schema_version WHERE singleton=true`);if(gate.rowCount!==1||![4,5,6,7,8,9,10].includes(gate.rows[0]!.version))throw new PrivateTransactionUnavailable();
    const docs=await tx.query(`SELECT metadata FROM "${this.schema}".private_page_documents WHERE workspace_id=$1 AND page_id=$2 FOR ${write?'UPDATE':'SHARE'}`,[tx.context.workspaceId,id]);
    if(docs.rowCount!==1)throw new PrivateTransactionUnavailable();const metadata=pageSchema.parse(docs.rows[0]!.metadata);if(metadata.id!==id||metadata.yDocId!=='page:'+id||metadata.title.length>65536)throw new PrivateTransactionUnavailable();
    const state=await tx.query(`SELECT s.version,h.title FROM "${this.schema}".private_page_title_state s JOIN "${this.schema}".private_page_title_history h ON h.page_id=s.page_id AND h.version=s.version WHERE s.page_id=$1`,[id]);
    const version=Number(state.rows[0]?.version);if(state.rowCount!==1||!Number.isSafeInteger(version)||version<0||state.rows[0]!.title!==metadata.title)throw new PrivateTransactionUnavailable();return{metadata,version,schemaVersion:gate.rows[0]!.version as number};
  }
}
