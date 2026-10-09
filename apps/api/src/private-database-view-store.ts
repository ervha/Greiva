import {structuredOrderSchema} from '@greiva/protocol/workspace';
import type pg from 'pg';
import {isDeepStrictEqual} from 'node:util';
import {idSchema,newId} from '@greiva/shared';
import {PrivateWorkspaceAccessDenied} from '@greiva/application';
import {parseDatabaseViewSnapshot,parseDatabaseViewIntent,parseDatabaseViewConflict,planDatabaseViewUpdate,type DatabaseSource,type DatabaseViewSnapshot,type DatabaseViewConflict} from '@greiva/domain';
import {privateDatabaseSourceSnapshotSchema} from '@greiva/protocol/private-database-source';
import {privateDatabaseViewSnapshotSchema,privateDatabaseViewWriteRequestSchema,privateDatabaseViewWriteResponseSchema,privateDatabaseViewReadRequestSchema,privateDatabaseViewReadResponseSchema,type PrivateDatabaseViewWriteResponse} from '@greiva/protocol/private-database-view';
import {privateSchemaName} from './private-schema-name.js';
import {PostgresPrivateTransactions,PrivateTransactionInvalidRequest,PrivateTransactionUnavailable,type PrivateTransaction} from './private-transactions.js';
import type {VerifiedSession} from './session-verifier.js';
export class PrivateDatabaseViewInvalidRequest extends PrivateTransactionInvalidRequest{constructor(readonly code:'invalid_request'|'operation_id_reused'|'view_id_reused'='invalid_request'){super();}}
export interface PrivateDatabaseViews{write(session:VerifiedSession,workspaceId:string,sourceId:string,body:unknown):Promise<unknown>;read(session:VerifiedSession,workspaceId:string,sourceId:string,viewId:string,body:unknown):Promise<unknown>;}
function parse<T>(schema:{safeParse:(input:unknown)=>{success:boolean;data?:T}},value:unknown):T{const result=schema.safeParse(value);if(!result.success)throw new PrivateDatabaseViewInvalidRequest();return result.data!;}
function canonical(value:string){const id=parse(idSchema,value);if(id!==id.toLowerCase())throw new PrivateDatabaseViewInvalidRequest();return id;}
type ConflictRow={id:string;view_id:string;workspace_id:string;operation_id:string;record:unknown;resolved_by:string|null};
export class PostgresPrivateDatabaseViewStore implements PrivateDatabaseViews{
 private readonly schema:string;private readonly transactions:PostgresPrivateTransactions;
 constructor(pool:pg.Pool,schema:string,now:()=>number=Date.now){this.schema=privateSchemaName(schema);this.transactions=new PostgresPrivateTransactions(pool,this.schema,now);}
 async write(session:VerifiedSession,workspaceId:string,candidate:string,body:unknown){
  const sourceId=canonical(candidate),request=parse(privateDatabaseViewWriteRequestSchema,body),intent=request.intent;
  if(intent.sourceId!==sourceId)throw new PrivateDatabaseViewInvalidRequest();
  return this.transactions.run(session,workspaceId,request.clientId,[],async tx=>{
   // Source UPDATE serializes create/update/receipt within this Source. Cross-Source
   // operation races are checked again by the unique ledger insert and roll back.
   const source=await this.source(tx,sourceId,true);try{parseDatabaseViewIntent(source,intent);}catch{throw new PrivateDatabaseViewInvalidRequest();}
   const old=await tx.query(`SELECT view_id,client_id,request,result FROM "${this.schema}".private_database_view_operations WHERE workspace_id=$1 AND operation_id=$2`,[workspaceId,request.operationId]);
   if(old.rowCount){
    const row=old.rows[0]!;if(row.view_id!==intent.viewId||row.client_id!==request.clientId||!isDeepStrictEqual(row.request,request))throw new PrivateDatabaseViewInvalidRequest('operation_id_reused');
    await this.current(tx,source,intent.viewId);const receipt=privateDatabaseViewWriteResponseSchema.parse(row.result);this.checkReceipt(tx,source,receipt,intent.viewId,request.operationId);
    const history=await tx.query(`SELECT snapshot FROM "${this.schema}".private_database_view_history WHERE view_id=$1 AND version=$2`,[intent.viewId,receipt.snapshot.version]);
    if(history.rowCount!==1||!isDeepStrictEqual(history.rows[0]!.snapshot,receipt.snapshot))throw new PrivateTransactionUnavailable();
    if(receipt.result.status==='conflict')for(const conflict of receipt.result.conflicts){const rows=await tx.query(`SELECT record FROM "${this.schema}".private_database_view_conflicts WHERE view_id=$1 AND id=$2 AND workspace_id=$3 AND operation_id=$4`,[intent.viewId,conflict.id,workspaceId,request.operationId]);if(rows.rowCount!==1||!isDeepStrictEqual(rows.rows[0]!.record,conflict))throw new PrivateTransactionUnavailable();}
    return receipt;
   }
   let current:DatabaseViewSnapshot,result:PrivateDatabaseViewWriteResponse['result']={status:'applied'};
   if(intent.kind==='create'){
    const existing=await tx.query(`SELECT id FROM "${this.schema}".private_database_views WHERE workspace_id=$1 AND id=$2`,[workspaceId,intent.viewId]);if(existing.rowCount)throw new PrivateDatabaseViewInvalidRequest('view_id_reused');
    current=parseDatabaseViewSnapshot(source,{view:{id:intent.viewId,sourceId,...intent.settings},version:1});
    let creationOrder:string|null=null;
    const gate=await tx.query(`SELECT version FROM "${this.schema}".private_schema_version WHERE singleton=true`);
    if(gate.rows[0]!.version>=10){
     await tx.query(`INSERT INTO "${this.schema}".private_database_view_heads VALUES($1,$2,0) ON CONFLICT(source_id) DO NOTHING`,[sourceId,workspaceId]);
     const head=await tx.query(`SELECT workspace_id,head_order::text FROM "${this.schema}".private_database_view_heads WHERE source_id=$1 FOR UPDATE`,[sourceId]),maximum=await tx.query(`SELECT COALESCE(max(creation_order),0)::text AS head FROM "${this.schema}".private_database_views WHERE workspace_id=$1 AND source_id=$2`,[workspaceId,sourceId]);if(head.rowCount!==1||head.rows[0]!.workspace_id!==workspaceId||head.rows[0]!.head_order!==maximum.rows[0]!.head)throw new PrivateTransactionUnavailable();
     const next=await tx.query(`UPDATE "${this.schema}".private_database_view_heads SET head_order=head_order+1 WHERE source_id=$1 AND head_order<9223372036854775807 RETURNING head_order::text`,[sourceId]);if(next.rowCount!==1)throw new PrivateTransactionUnavailable();creationOrder=structuredOrderSchema.parse(next.rows[0]!.head_order);
    }
    const inserted=await tx.query(`INSERT INTO "${this.schema}".private_database_views(id,workspace_id,source_id,version,snapshot${creationOrder?',creation_order':''}) VALUES($1,$2,$3,1,$4${creationOrder?',$5':''}) ON CONFLICT(id) DO NOTHING RETURNING id`,[intent.viewId,workspaceId,sourceId,JSON.stringify(current),...(creationOrder?[creationOrder]:[])]);if(inserted.rowCount!==1)throw new PrivateWorkspaceAccessDenied();
    await this.history(tx,current);
   }else{
    current=await this.current(tx,source,intent.viewId);
    const baseRows=await tx.query(`SELECT snapshot FROM "${this.schema}".private_database_view_history WHERE view_id=$1 AND version=$2`,[intent.viewId,intent.baseVersion]);
    if(!baseRows.rowCount)result={status:'rejected',code:'base_unknown'};
    else{
     const base=this.snapshot(source,baseRows.rows[0]!.snapshot,intent.viewId,intent.baseVersion);
     let active:DatabaseViewConflict|undefined;
     if(intent.resolution){
      const rows=await tx.query(`SELECT id,view_id,workspace_id,operation_id,record,resolved_by FROM "${this.schema}".private_database_view_conflicts WHERE view_id=$1 AND id=$2`,[intent.viewId,intent.resolution.conflictId]);
      if(rows.rowCount)active=await this.conflict(tx,source,rows.rows[0]! as ConflictRow,current);
      if(!active||active.resolvedBy!==null||active.remoteVersion!==intent.resolution.remoteVersion||active.field!==intent.resolution.field||!isDeepStrictEqual(intent.patch[active.field],active[intent.resolution.choice]))result={status:'rejected',code:'resolution_invalid'};
      else if(intent.baseVersion!==current.version||!isDeepStrictEqual(current.view[active.field],active.remote))result={status:'rejected',code:'resolution_stale'};
     }
     if(result.status==='applied'){
      const plan=planDatabaseViewUpdate(source,base,current,intent,active);
      const conflicts=plan.conflicts.map(field=>parseDatabaseViewConflict(source,{...field,id:newId(),workspaceId,sourceId,schemaVersion:source.schemaVersion,viewId:intent.viewId,baseVersion:intent.baseVersion,remoteVersion:current.version,resolvedBy:null}));
      for(const conflict of conflicts)await tx.query(`INSERT INTO "${this.schema}".private_database_view_conflicts VALUES($1,$2,$3,$4,$5,NULL)`,[conflict.id,intent.viewId,workspaceId,request.operationId,JSON.stringify(conflict)]);
      if(conflicts.length)result={status:'conflict',conflicts};
      if(plan.changedFields.length){
       if(current.version===Number.MAX_SAFE_INTEGER)throw new PrivateTransactionUnavailable();
       current=parseDatabaseViewSnapshot(source,{view:plan.proposedView,version:current.version+1});
       await tx.query(`UPDATE "${this.schema}".private_database_views SET version=$3,snapshot=$4 WHERE workspace_id=$1 AND id=$2`,[workspaceId,intent.viewId,current.version,JSON.stringify(current)]);await this.history(tx,current);
      }
      if(intent.resolution){const resolved=await tx.query(`UPDATE "${this.schema}".private_database_view_conflicts SET resolved_by=$3 WHERE view_id=$1 AND id=$2 AND resolved_by IS NULL RETURNING id`,[intent.viewId,intent.resolution.conflictId,request.operationId]);if(resolved.rowCount!==1)throw new PrivateTransactionUnavailable();}
     }
    }
   }
   const receipt=privateDatabaseViewWriteResponseSchema.parse({...this.scope(tx,source),operationId:request.operationId,snapshot:current,result});
   const inserted=await tx.query(`INSERT INTO "${this.schema}".private_database_view_operations VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,operation_id) DO NOTHING RETURNING operation_id`,[workspaceId,request.operationId,intent.viewId,request.clientId,JSON.stringify(request),JSON.stringify(receipt)]);if(inserted.rowCount!==1)throw new PrivateDatabaseViewInvalidRequest('operation_id_reused');return receipt;
  });
 }
 async read(session:VerifiedSession,workspaceId:string,candidate:string,viewCandidate:string,body:unknown){
  const sourceId=canonical(candidate),viewId=canonical(viewCandidate),request=parse(privateDatabaseViewReadRequestSchema,body);
  return this.transactions.run(session,workspaceId,request.clientId,[],async tx=>{
   const source=await this.source(tx,sourceId,false),current=await this.current(tx,source,viewId);
   const rows=await tx.query(`SELECT id,view_id,workspace_id,operation_id,record,resolved_by FROM "${this.schema}".private_database_view_conflicts WHERE view_id=$1 AND resolved_by IS NULL AND ($2::uuid IS NULL OR id>$2::uuid) ORDER BY id LIMIT $3`,[viewId,request.afterConflict,request.limit+1]);
   const all:DatabaseViewConflict[]=[];for(const row of rows.rows)all.push(await this.conflict(tx,source,row as ConflictRow,current));if(all.some(row=>row.resolvedBy!==null))throw new PrivateTransactionUnavailable();
   const conflicts=all.slice(0,request.limit);return privateDatabaseViewReadResponseSchema.parse({...this.scope(tx,source),snapshot:current,conflicts,nextAfter:all.length>request.limit?conflicts.at(-1)!.id:null});
  });
 }
 private scope(tx:PrivateTransaction,source:DatabaseSource){return{protocolVersion:1 as const,workspaceId:tx.context.workspaceId,workspaceEpoch:tx.context.epoch,clientId:tx.context.clientId,sourceId:source.id,schemaVersion:source.schemaVersion};}
 private async source(tx:PrivateTransaction,id:string,write:boolean){
  const gate=await tx.query(`SELECT version FROM "${this.schema}".private_schema_version WHERE singleton=true`);if(gate.rowCount!==1||![9,10].includes(gate.rows[0]!.version))throw new PrivateTransactionUnavailable();
  const rows=await tx.query(`SELECT id,workspace_id,definition,version::text,creation_order::text,deleted FROM "${this.schema}".private_database_sources WHERE workspace_id=$1 AND id=$2 FOR ${write?'UPDATE':'SHARE'}`,[tx.context.workspaceId,id]);if(rows.rowCount!==1||rows.rows[0]!.deleted)throw new PrivateWorkspaceAccessDenied();
  const row=rows.rows[0]!,parsed=privateDatabaseSourceSnapshotSchema.safeParse({source:row.definition,version:Number(row.version),creationOrder:row.creation_order});if(!parsed.success||parsed.data.source.id!==id||parsed.data.source.workspaceId!==tx.context.workspaceId)throw new PrivateTransactionUnavailable();return parsed.data.source;
 }
 private snapshot(source:DatabaseSource,value:unknown,id:string,version:number){try{const snapshot=parseDatabaseViewSnapshot(source,privateDatabaseViewSnapshotSchema.parse(value));if(snapshot.view.id!==id||snapshot.version!==version)throw Error();return snapshot;}catch{throw new PrivateTransactionUnavailable();}}
 private async current(tx:PrivateTransaction,source:DatabaseSource,id:string){
  const rows=await tx.query(`SELECT id,workspace_id,source_id,version::text,snapshot,deleted FROM "${this.schema}".private_database_views WHERE workspace_id=$1 AND source_id=$2 AND id=$3`,[tx.context.workspaceId,source.id,id]);if(rows.rowCount!==1||rows.rows[0]!.deleted)throw new PrivateWorkspaceAccessDenied();
  const row=rows.rows[0]!,current=this.snapshot(source,row.snapshot,id,Number(row.version)),history=await tx.query(`SELECT snapshot FROM "${this.schema}".private_database_view_history WHERE view_id=$1 AND version=$2`,[id,current.version]);if(history.rowCount!==1||!isDeepStrictEqual(history.rows[0]!.snapshot,current))throw new PrivateTransactionUnavailable();return current;
 }
 private async conflict(tx:PrivateTransaction,source:DatabaseSource,row:ConflictRow,current:DatabaseViewSnapshot){try{
  const immutable=parseDatabaseViewConflict(source,row.record);if(immutable.resolvedBy!==null||immutable.id!==row.id||row.view_id!==current.view.id||row.workspace_id!==source.workspaceId||immutable.viewId!==current.view.id||immutable.remoteVersion>current.version||(row.resolved_by!==null&&canonical(row.resolved_by)!==row.resolved_by))throw Error();
  const operations=await tx.query(`SELECT request,result FROM "${this.schema}".private_database_view_operations WHERE workspace_id=$1 AND operation_id=$2 AND view_id=$3`,[source.workspaceId,row.operation_id,current.view.id]);if(operations.rowCount!==1)throw Error();
  const request=privateDatabaseViewWriteRequestSchema.parse(operations.rows[0]!.request),intent=parseDatabaseViewIntent(source,request.intent),receipt=privateDatabaseViewWriteResponseSchema.parse(operations.rows[0]!.result);
  if(request.operationId!==row.operation_id||intent.kind!=='update'||intent.viewId!==current.view.id||intent.baseVersion!==immutable.baseVersion||!isDeepStrictEqual(intent.patch[immutable.field],immutable.local)||receipt.workspaceId!==source.workspaceId||receipt.workspaceEpoch!==tx.context.epoch||receipt.sourceId!==source.id||receipt.schemaVersion!==source.schemaVersion||receipt.clientId!==request.clientId||receipt.operationId!==row.operation_id||receipt.snapshot.view.id!==current.view.id||receipt.result.status!=='conflict'||!receipt.result.conflicts.some(item=>isDeepStrictEqual(item,immutable)))throw Error();
  for(const [version,fieldValue] of [[immutable.baseVersion,immutable.base],[immutable.remoteVersion,immutable.remote]] as const){const history=await tx.query(`SELECT snapshot FROM "${this.schema}".private_database_view_history WHERE view_id=$1 AND version=$2`,[current.view.id,version]);if(history.rowCount!==1||!isDeepStrictEqual(this.snapshot(source,history.rows[0]!.snapshot,current.view.id,version).view[immutable.field],fieldValue))throw Error();}
  return parseDatabaseViewConflict(source,{...immutable,resolvedBy:row.resolved_by});
 }catch{throw new PrivateTransactionUnavailable();}}
 private async history(tx:PrivateTransaction,snapshot:DatabaseViewSnapshot){await tx.query(`INSERT INTO "${this.schema}".private_database_view_history VALUES($1,$2,$3)`,[snapshot.view.id,snapshot.version,JSON.stringify(snapshot)]);}
 private checkReceipt(tx:PrivateTransaction,source:DatabaseSource,receipt:PrivateDatabaseViewWriteResponse,id:string,operationId:string){if(receipt.workspaceId!==tx.context.workspaceId||receipt.workspaceEpoch!==tx.context.epoch||receipt.clientId!==tx.context.clientId||receipt.sourceId!==source.id||receipt.schemaVersion!==source.schemaVersion||receipt.operationId!==operationId)throw new PrivateTransactionUnavailable();this.snapshot(source,receipt.snapshot,id,receipt.snapshot.version);if(receipt.result.status==='conflict')for(const conflict of receipt.result.conflicts)try{parseDatabaseViewConflict(source,conflict);}catch{throw new PrivateTransactionUnavailable();}}
}
