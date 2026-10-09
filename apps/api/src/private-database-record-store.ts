import type pg from 'pg';
import {isDeepStrictEqual} from 'node:util';
import {idSchema,newId} from '@greiva/shared';
import {PrivateWorkspaceAccessDenied} from '@greiva/application';
import {parseDatabaseRecord,parseDatabaseRecordIntent,parseDatabaseRecordConflict,planDatabaseRecordUpdate,type DatabaseSource,type DatabaseRecord,type DatabaseRecordConflict} from '@greiva/domain';
import {pageSchema} from '@greiva/protocol';
import {structuredOrderSchema} from '@greiva/protocol/workspace';
import {privateDatabaseSourceSnapshotSchema} from '@greiva/protocol/private-database-source';
import {privateDatabaseRecordWriteRequestSchema,privateDatabaseRecordWriteResponseSchema,privateDatabaseRecordReadRequestSchema,privateDatabaseRecordReadResponseSchema,type PrivateDatabaseRecordWriteResponse} from '@greiva/protocol/private-database-record';
import {privateSchemaName} from './private-schema-name.js';
import {PostgresPrivateTransactions,PrivateTransactionInvalidRequest,PrivateTransactionUnavailable,type PrivateTransaction} from './private-transactions.js';
import type {VerifiedSession} from './session-verifier.js';

export class PrivateDatabaseRecordInvalidRequest extends PrivateTransactionInvalidRequest{constructor(readonly code:'invalid_request'|'operation_id_reused'|'record_id_reused'|'page_binding_reused'='invalid_request'){super();}}
export interface PrivateDatabaseRecords{write(session:VerifiedSession,workspaceId:string,sourceId:string,body:unknown):Promise<unknown>;read(session:VerifiedSession,workspaceId:string,sourceId:string,recordId:string,body:unknown):Promise<unknown>;}
function parse<T>(schema:{safeParse:(input:unknown)=>{success:boolean;data?:T}},value:unknown):T{const result=schema.safeParse(value);if(!result.success)throw new PrivateDatabaseRecordInvalidRequest();return result.data!;}
function canonical(value:string){const id=parse(idSchema,value);if(id!==id.toLowerCase())throw new PrivateDatabaseRecordInvalidRequest();return id;}
type RecordRow={id:string;workspace_id:string;source_id:string;page_id:string;version:string;snapshot:unknown;deleted:boolean};
type ConflictRow={id:string;record_id:string;workspace_id:string;record:unknown;resolved_by:string|null};
export class PostgresPrivateDatabaseRecordStore implements PrivateDatabaseRecords{
 private readonly schema:string;private readonly transactions:PostgresPrivateTransactions;
 constructor(pool:pg.Pool,schema:string,now:()=>number=Date.now){this.schema=privateSchemaName(schema);this.transactions=new PostgresPrivateTransactions(pool,this.schema,now);}
 async write(session:VerifiedSession,workspaceId:string,candidate:string,body:unknown){
  const sourceId=canonical(candidate),request=parse(privateDatabaseRecordWriteRequestSchema,body),intent=request.intent;
  if(intent.sourceId!==sourceId)throw new PrivateDatabaseRecordInvalidRequest();
  return this.transactions.run(session,workspaceId,request.clientId,[{type:'page',id:intent.pageId}],async tx=>{
   // Source UPDATE serializes first create, binding uniqueness and cross-record
   // operation IDs. Resource SHARE locks precede Source, never Page document writes.
   const source=await this.source(tx,sourceId,true);try{parseDatabaseRecordIntent(source,intent);}catch{throw new PrivateDatabaseRecordInvalidRequest();}
   await this.page(tx,intent.pageId);
   const old=await tx.query(`SELECT record_id,client_id,request,result FROM "${this.schema}".private_database_record_operations WHERE workspace_id=$1 AND operation_id=$2`,[workspaceId,request.operationId]);
   if(old.rowCount){
    const row=old.rows[0]!;if(row.record_id!==intent.recordId||row.client_id!==request.clientId||!isDeepStrictEqual(row.request,request))throw new PrivateDatabaseRecordInvalidRequest('operation_id_reused');
    await this.current(tx,source,intent.recordId,intent.pageId);const receipt=privateDatabaseRecordWriteResponseSchema.parse(row.result);this.checkReceipt(tx,source,receipt,intent.recordId,intent.pageId,request.operationId);
    const history=await tx.query(`SELECT snapshot FROM "${this.schema}".private_database_record_history WHERE record_id=$1 AND version=$2`,[intent.recordId,receipt.record.version]);
    if(history.rowCount!==1||!isDeepStrictEqual(history.rows[0]!.snapshot,receipt.record))throw new PrivateTransactionUnavailable();
    if(receipt.result.status==='conflict')for(const conflict of receipt.result.conflicts){const rows=await tx.query(`SELECT record FROM "${this.schema}".private_database_record_conflicts WHERE record_id=$1 AND id=$2 AND workspace_id=$3 AND operation_id=$4`,[intent.recordId,conflict.id,workspaceId,request.operationId]);if(rows.rowCount!==1||!isDeepStrictEqual(rows.rows[0]!.record,conflict))throw new PrivateTransactionUnavailable();}
    return receipt;
   }
   let current:DatabaseRecord,result:PrivateDatabaseRecordWriteResponse['result']={status:'applied'};
   if(intent.kind==='create'){
    const existing=await tx.query(`SELECT id,page_id FROM "${this.schema}".private_database_records WHERE workspace_id=$1 AND source_id=$2 AND (id=$3 OR page_id=$4)`,[workspaceId,sourceId,intent.recordId,intent.pageId]);
    if(existing.rowCount)throw new PrivateDatabaseRecordInvalidRequest(existing.rows.some(row=>row.id===intent.recordId)?'record_id_reused':'page_binding_reused');
    current=parseDatabaseRecord(source,{id:intent.recordId,workspaceId,sourceId,pageId:intent.pageId,version:1,values:intent.values});
    let creationOrder:string|null=null;
    const gate=await tx.query(`SELECT version FROM "${this.schema}".private_schema_version WHERE singleton=true`);
    if(gate.rows[0]!.version>=8){
     await tx.query(`INSERT INTO "${this.schema}".private_database_record_heads VALUES($1,$2,0) ON CONFLICT(source_id) DO NOTHING`,[sourceId,workspaceId]);
     const head=await tx.query(`SELECT workspace_id,head_order::text FROM "${this.schema}".private_database_record_heads WHERE source_id=$1 FOR UPDATE`,[sourceId]);
     const maximum=await tx.query(`SELECT COALESCE(max(creation_order),0)::text AS head FROM "${this.schema}".private_database_records WHERE workspace_id=$1 AND source_id=$2`,[workspaceId,sourceId]);
     if(head.rowCount!==1||head.rows[0]!.workspace_id!==workspaceId||head.rows[0]!.head_order!==maximum.rows[0]!.head)throw new PrivateTransactionUnavailable();
     const next=await tx.query(`UPDATE "${this.schema}".private_database_record_heads SET head_order=head_order+1 WHERE source_id=$1 AND head_order<9223372036854775807 RETURNING head_order::text`,[sourceId]);if(next.rowCount!==1)throw new PrivateTransactionUnavailable();creationOrder=structuredOrderSchema.parse(next.rows[0]!.head_order);
    }
    const inserted=await tx.query(`INSERT INTO "${this.schema}".private_database_records(id,workspace_id,source_id,page_id,version,snapshot${creationOrder?',creation_order':''}) VALUES($1,$2,$3,$4,1,$5${creationOrder?',$6':''}) ON CONFLICT(id) DO NOTHING RETURNING id`,[intent.recordId,workspaceId,sourceId,intent.pageId,JSON.stringify(current),...(creationOrder?[creationOrder]:[])]);
    if(inserted.rowCount!==1)throw new PrivateWorkspaceAccessDenied();
    await this.history(tx,current);
   }else{
    current=await this.current(tx,source,intent.recordId,intent.pageId);
    const baseRows=await tx.query(`SELECT snapshot FROM "${this.schema}".private_database_record_history WHERE record_id=$1 AND version=$2`,[current.id,intent.baseVersion]);
    if(!baseRows.rowCount)result={status:'rejected',code:'base_unknown'};
    else{
     const base=this.snapshot(source,baseRows.rows[0]!.snapshot,current.id,current.pageId,intent.baseVersion);
     let active:DatabaseRecordConflict|undefined;
     if(intent.resolution){
      const rows=await tx.query(`SELECT id,record_id,workspace_id,record,resolved_by FROM "${this.schema}".private_database_record_conflicts WHERE record_id=$1 AND id=$2`,[current.id,intent.resolution.conflictId]);
      if(rows.rowCount)active=this.conflict(source,rows.rows[0]! as ConflictRow,current);
      if(!active||active.resolvedBy!==null||active.remoteVersion!==intent.resolution.remoteVersion||active.propertyId!==intent.resolution.propertyId||intent.values[active.propertyId]!==active[intent.resolution.choice].value)result={status:'rejected',code:'resolution_invalid'};
      else if(intent.baseVersion!==current.version||Object.hasOwn(current.values,active.propertyId)!==active.remote.present||(current.values[active.propertyId]??null)!==active.remote.value)result={status:'rejected',code:'resolution_stale'};
     }
     if(result.status==='applied'){
      const plan=planDatabaseRecordUpdate(source,base,current,intent,active);
      const conflicts=plan.conflicts.map(field=>parseDatabaseRecordConflict(source,{...field,id:newId(),workspaceId,sourceId,schemaVersion:source.schemaVersion,recordId:current.id,pageId:current.pageId,baseVersion:intent.baseVersion,remoteVersion:current.version,resolvedBy:null}));
      for(const conflict of conflicts)await tx.query(`INSERT INTO "${this.schema}".private_database_record_conflicts VALUES($1,$2,$3,$4,$5,NULL)`,[conflict.id,current.id,workspaceId,request.operationId,JSON.stringify(conflict)]);
      if(conflicts.length)result={status:'conflict',conflicts};
      if(plan.changedPropertyIds.length){
       if(current.version===Number.MAX_SAFE_INTEGER)throw new PrivateTransactionUnavailable();
       current=parseDatabaseRecord(source,{...current,version:current.version+1,values:plan.proposedValues});
       await tx.query(`UPDATE "${this.schema}".private_database_records SET version=$3,snapshot=$4 WHERE workspace_id=$1 AND id=$2`,[workspaceId,current.id,current.version,JSON.stringify(current)]);
       await this.history(tx,current);
      }
      if(intent.resolution)await tx.query(`UPDATE "${this.schema}".private_database_record_conflicts SET resolved_by=$3 WHERE record_id=$1 AND id=$2 AND resolved_by IS NULL`,[current.id,intent.resolution.conflictId,request.operationId]);
     }
    }
   }
   const receipt=privateDatabaseRecordWriteResponseSchema.parse({...this.scope(tx,source),operationId:request.operationId,record:current,result});
   const inserted=await tx.query(`INSERT INTO "${this.schema}".private_database_record_operations VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,operation_id) DO NOTHING RETURNING operation_id`,[workspaceId,request.operationId,current.id,request.clientId,JSON.stringify(request),JSON.stringify(receipt)]);
   if(inserted.rowCount!==1)throw new PrivateDatabaseRecordInvalidRequest('operation_id_reused');return receipt;
  });
 }
 async read(session:VerifiedSession,workspaceId:string,candidate:string,recordCandidate:string,body:unknown){
  const sourceId=canonical(candidate),recordId=canonical(recordCandidate),request=parse(privateDatabaseRecordReadRequestSchema,body);
  return this.transactions.run(session,workspaceId,request.clientId,[{type:'page',id:request.pageId}],async tx=>{
   const source=await this.source(tx,sourceId,false);await this.page(tx,request.pageId);const current=await this.current(tx,source,recordId,request.pageId);
   const rows=await tx.query(`SELECT id,record_id,workspace_id,record,resolved_by FROM "${this.schema}".private_database_record_conflicts WHERE record_id=$1 AND resolved_by IS NULL AND ($2::uuid IS NULL OR id>$2::uuid) ORDER BY id LIMIT $3`,[recordId,request.afterConflict,request.limit+1]);
   const all=rows.rows.map(row=>this.conflict(source,row as ConflictRow,current));
   if(all.some(row=>row.resolvedBy!==null))throw new PrivateTransactionUnavailable();
   const conflicts=all.slice(0,request.limit);
   return privateDatabaseRecordReadResponseSchema.parse({...this.scope(tx,source),record:current,conflicts,nextAfter:all.length>request.limit?conflicts.at(-1)!.id:null});
  });
 }
 private scope(tx:PrivateTransaction,source:DatabaseSource){return{protocolVersion:1 as const,workspaceId:tx.context.workspaceId,workspaceEpoch:tx.context.epoch,clientId:tx.context.clientId,sourceId:source.id,schemaVersion:source.schemaVersion};}
 private async source(tx:PrivateTransaction,id:string,write:boolean){
  const gate=await tx.query(`SELECT version FROM "${this.schema}".private_schema_version WHERE singleton=true`);if(gate.rowCount!==1||![7,8].includes(gate.rows[0]!.version))throw new PrivateTransactionUnavailable();
  const rows=await tx.query(`SELECT id,workspace_id,definition,version::text,creation_order::text,deleted FROM "${this.schema}".private_database_sources WHERE workspace_id=$1 AND id=$2 FOR ${write?'UPDATE':'SHARE'}`,[tx.context.workspaceId,id]);
  if(rows.rowCount!==1||rows.rows[0]!.deleted)throw new PrivateWorkspaceAccessDenied();const row=rows.rows[0]!,parsed=privateDatabaseSourceSnapshotSchema.safeParse({source:row.definition,version:Number(row.version),creationOrder:row.creation_order});
  if(!parsed.success||parsed.data.source.id!==id||parsed.data.source.workspaceId!==tx.context.workspaceId)throw new PrivateTransactionUnavailable();return parsed.data.source;
 }
 private async page(tx:PrivateTransaction,id:string){
  const rows=await tx.query(`SELECT metadata FROM "${this.schema}".private_page_documents WHERE workspace_id=$1 AND page_id=$2`,[tx.context.workspaceId,id]);if(rows.rowCount!==1)throw new PrivateWorkspaceAccessDenied();
  const parsed=pageSchema.safeParse(rows.rows[0]!.metadata);if(!parsed.success||parsed.data.id!==id||parsed.data.yDocId!=='page:'+id)throw new PrivateTransactionUnavailable();
 }
 private snapshot(source:DatabaseSource,value:unknown,id:string,pageId:string,version:number){
  try{const record=parseDatabaseRecord(source,value);if(record.id!==id||record.pageId!==pageId||record.version!==version)throw Error();return record;}catch{throw new PrivateTransactionUnavailable();}
 }
 private async current(tx:PrivateTransaction,source:DatabaseSource,id:string,pageId:string){
  const rows=await tx.query(`SELECT id,workspace_id,source_id,page_id,version::text,snapshot,deleted FROM "${this.schema}".private_database_records WHERE workspace_id=$1 AND source_id=$2 AND id=$3`,[tx.context.workspaceId,source.id,id]);
  if(rows.rowCount!==1||rows.rows[0]!.deleted||rows.rows[0]!.page_id!==pageId)throw new PrivateWorkspaceAccessDenied();const row=rows.rows[0]! as RecordRow,current=this.snapshot(source,row.snapshot,id,pageId,Number(row.version));
  const history=await tx.query(`SELECT snapshot FROM "${this.schema}".private_database_record_history WHERE record_id=$1 AND version=$2`,[id,current.version]);if(history.rowCount!==1||!isDeepStrictEqual(history.rows[0]!.snapshot,current))throw new PrivateTransactionUnavailable();return current;
 }
 private conflict(source:DatabaseSource,row:ConflictRow,current:DatabaseRecord){
  try{const immutable=parseDatabaseRecordConflict(source,row.record);if(immutable.resolvedBy!==null||immutable.id!==row.id||row.record_id!==current.id||row.workspace_id!==source.workspaceId||immutable.recordId!==current.id||immutable.pageId!==current.pageId||immutable.remoteVersion>current.version||(row.resolved_by!==null&&canonical(row.resolved_by)!==row.resolved_by))throw Error();return parseDatabaseRecordConflict(source,{...immutable,resolvedBy:row.resolved_by});}catch{throw new PrivateTransactionUnavailable();}
 }
 private async history(tx:PrivateTransaction,record:DatabaseRecord){await tx.query(`INSERT INTO "${this.schema}".private_database_record_history VALUES($1,$2,$3)`,[record.id,record.version,JSON.stringify(record)]);}
 private checkReceipt(tx:PrivateTransaction,source:DatabaseSource,receipt:PrivateDatabaseRecordWriteResponse,id:string,pageId:string,operationId:string){
  if(receipt.workspaceId!==tx.context.workspaceId||receipt.workspaceEpoch!==tx.context.epoch||receipt.clientId!==tx.context.clientId||receipt.sourceId!==source.id||receipt.schemaVersion!==source.schemaVersion||receipt.operationId!==operationId)throw new PrivateTransactionUnavailable();
  this.snapshot(source,receipt.record,id,pageId,receipt.record.version);if(receipt.result.status==='conflict')for(const conflict of receipt.result.conflicts)try{parseDatabaseRecordConflict(source,conflict);}catch{throw new PrivateTransactionUnavailable();}
 }
}
