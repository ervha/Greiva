import type pg from 'pg';
import { isDeepStrictEqual } from 'node:util';
import { newId, utcNow } from '@greiva/shared';
import { PrivateWorkspaceAccessDenied } from '@greiva/application';
import { parseOperationPayload, pushResultSchema, taskSchema, relationSchema, conflictSchema, type StructuredEntity, type PushOperation, type PushResult, type Conflict } from '@greiva/protocol';
import { workspacePushRequestSchema, workspacePushResponseSchema, workspacePullRequestSchema, workspacePullResponseSchema } from '@greiva/protocol/workspace';
import { PostgresPrivateTransactions, PrivateTransactionInvalidRequest, PrivateTransactionUnavailable, type PrivateTransaction } from './private-transactions.js';
import type { VerifiedSession } from './session-verifier.js';
import { privateSchemaName } from './private-schema-name.js';
import { workspaceCursor, InvalidWorkspaceCursor } from './workspace-cursor.js';

export class PrivateSyncInvalidRequest extends PrivateTransactionInvalidRequest {
  constructor(readonly code: 'invalid_request' | 'invalid_cursor' | 'operation_id_reused' = 'invalid_request') { super(); }
}
export interface PrivateStructuredSync {
  push(session: VerifiedSession, workspaceId: string, candidate: unknown): Promise<unknown>;
  pull(session: VerifiedSession, workspaceId: string, candidate: unknown): Promise<unknown>;
}
const entity=(type:PushOperation['entityType'],value:unknown):StructuredEntity => (type==='task'?taskSchema:relationSchema).parse(value);
const fields=(value:StructuredEntity):Record<string,unknown> => 'title' in value ? {title:value.title,status:value.status,due:value.due} : {fromType:value.fromType,fromId:value.fromId,toType:value.toType,toId:value.toId};
const reject=(operation:PushOperation,order:string,code:string,current:StructuredEntity|null):PushResult => pushResultSchema.parse({
  operationId:operation.operationId,clientId:operation.clientId,entityType:operation.entityType,entityId:operation.entityId,serverOrder:order,status:'rejected',entity:current,conflicts:[],error:{code,message:`Operation rejected: ${code}`,retryable:false},
});

// Separate private ledger. Does not wrap, import or expose the old PoC store.
// Entire batch commits atomically after owner/device checks; all reads/history/
// results are scoped to the same frozen workspace transaction context.
export class PostgresPrivateStructuredStore implements PrivateStructuredSync {
  private readonly schema:string;
  private readonly transactions:PostgresPrivateTransactions;
  constructor(pool:pg.Pool,schema:string) {this.schema=privateSchemaName(schema);this.transactions=new PostgresPrivateTransactions(pool,this.schema);}
  async push(session:VerifiedSession,workspaceId:string,candidate:unknown) {
    const parsed=workspacePushRequestSchema.safeParse(candidate);
    if(!parsed.success || parsed.data.workspaceId!==workspaceId)throw new PrivateSyncInvalidRequest();
    // Detached JSON captures payloads as well as the envelope before any wait.
    const request=workspacePushRequestSchema.parse(JSON.parse(JSON.stringify(parsed.data)));
    return this.transactions.run(session,workspaceId,request.clientId,[],async tx=>{
      const stream=await this.stream(tx,true);let order=BigInt(stream.head);
      const results:PushResult[]=[];
      for(const operation of request.operations){
        const previous=await tx.query(`SELECT workspace_id,request,result FROM "${this.schema}".private_structured_operations WHERE operation_id=$1`,[operation.operationId]);
        if(previous.rowCount){
          if(previous.rows[0]!.workspace_id!==workspaceId)throw new PrivateWorkspaceAccessDenied();
          if(!isDeepStrictEqual(previous.rows[0]!.request,operation))throw new PrivateSyncInvalidRequest('operation_id_reused');
          results.push(pushResultSchema.parse(previous.rows[0]!.result));continue;
        }
        if(order===9223372036854775807n)throw new PrivateTransactionUnavailable();
        order++;
        results.push(await this.apply(tx,operation,order.toString()));
      }
      await tx.query(`UPDATE "${this.schema}".private_structured_streams SET last_order=$2 WHERE workspace_id=$1`,[workspaceId,order.toString()]);
      return workspacePushResponseSchema.parse({protocolVersion:1,workspaceId,streamEpoch:tx.context.epoch,results});
    });
  }
  async pull(session:VerifiedSession,workspaceId:string,candidate:unknown) {
    const parsed=workspacePullRequestSchema.safeParse(candidate);
    if(!parsed.success || parsed.data.workspaceId!==workspaceId)throw new PrivateSyncInvalidRequest();
    const request=parsed.data;
    return this.transactions.run(session,workspaceId,request.clientId,[],async tx=>{
      const stream=await this.stream(tx,false),cursor=workspaceCursor(workspaceId,tx.context.epoch,stream.secret);
      let after:bigint;try{after=cursor.decode(request.cursor,stream.head);}catch(error){if(error instanceof InvalidWorkspaceCursor)throw new PrivateSyncInvalidRequest('invalid_cursor');throw error;}
      const rows=await tx.query(`SELECT server_order,result FROM "${this.schema}".private_structured_operations WHERE workspace_id=$1 AND server_order>$2 AND server_order<=$3 ORDER BY server_order LIMIT $4`,[workspaceId,after.toString(),stream.head,request.limit]);
      let applied=after;const operations:PushResult[]=[];
      for(const row of rows.rows){if(BigInt(row.server_order)!==applied+1n)throw new PrivateTransactionUnavailable();applied++;const result=pushResultSchema.parse(row.result);if(result.serverOrder!==applied.toString())throw new PrivateTransactionUnavailable();operations.push(result);}
      if(!rows.rowCount && after<BigInt(stream.head))throw new PrivateTransactionUnavailable();
      return workspacePullResponseSchema.parse({protocolVersion:1,workspaceId,streamEpoch:tx.context.epoch,operations,cursor:cursor.encode(applied.toString()),headCursor:cursor.encode(stream.head),hasMore:applied<BigInt(stream.head),serverTime:utcNow()});
    });
  }
  private async stream(tx:PrivateTransaction,write:boolean) {
    const version=await tx.query(`SELECT version FROM "${this.schema}".private_schema_version WHERE singleton=true`);
    if(version.rowCount!==1 || ![2,3,4,5,6,7,8,9,10].includes(version.rows[0]!.version))throw new PrivateTransactionUnavailable();
    const config=await tx.query(`SELECT secret FROM "${this.schema}".private_structured_config WHERE singleton=true`);
    if(config.rowCount!==1 || !Buffer.isBuffer(config.rows[0]!.secret) || config.rows[0]!.secret.length!==32)throw new PrivateTransactionUnavailable();
    await tx.query(`INSERT INTO "${this.schema}".private_structured_streams(workspace_id) VALUES($1) ON CONFLICT(workspace_id) DO NOTHING`,[tx.context.workspaceId]);
    const rows=await tx.query(`SELECT last_order FROM "${this.schema}".private_structured_streams WHERE workspace_id=$1 FOR ${write?'UPDATE':'SHARE'}`,[tx.context.workspaceId]);
    if(rows.rowCount!==1)throw new PrivateTransactionUnavailable();return{head:rows.rows[0]!.last_order as string,secret:config.rows[0]!.secret as Buffer};
  }
  private async current(tx:PrivateTransaction,operation:PushOperation) {
    const metadata=await tx.query(`SELECT workspace_id,deleted FROM "${this.schema}".private_resources WHERE type=$1 AND id=$2 FOR UPDATE`,[operation.entityType,operation.entityId]);
    if(!metadata.rowCount)return null;
    if(metadata.rows[0]!.workspace_id!==tx.context.workspaceId)throw new PrivateWorkspaceAccessDenied();
    const rows=await tx.query(`SELECT version,entity FROM "${this.schema}".private_structured_entities WHERE workspace_id=$1 AND type=$2 AND id=$3`,[tx.context.workspaceId,operation.entityType,operation.entityId]);
    if(rows.rowCount!==1)throw new PrivateTransactionUnavailable();const value=entity(operation.entityType,rows.rows[0]!.entity);
    if(value.id!==operation.entityId || value.version.toString()!==rows.rows[0]!.version || !!value.deletedAt!==metadata.rows[0]!.deleted)throw new PrivateTransactionUnavailable();return value;
  }
  private async endpoints(tx:PrivateTransaction,value:Record<string,unknown>) {
    let live=true;
    for(const prefix of ['from','to']){
      const rows=await tx.query(`SELECT workspace_id,deleted FROM "${this.schema}".private_resources WHERE type=$1 AND id=$2 FOR SHARE`,[String(value[`${prefix}Type`]),String(value[`${prefix}Id`])]);
      if(rows.rowCount && rows.rows[0]!.workspace_id!==tx.context.workspaceId)throw new PrivateWorkspaceAccessDenied();
      if(rows.rowCount!==1 || rows.rows[0]!.deleted)live=false;
    }return live;
  }
  private async apply(tx:PrivateTransaction,operation:PushOperation,order:string):Promise<PushResult> {
    const workspaceId=tx.context.workspaceId,current=await this.current(tx,operation);
    let payload:Record<string,unknown>;try{payload=parseOperationPayload(operation);}catch{return this.finish(tx,operation,reject(operation,order,'invalid_payload',current));}
    let causalBase:Record<string,unknown>|null=null;
    if(operation.predecessorOperationId){
      const rows=await tx.query(`SELECT request,result,local_after FROM "${this.schema}".private_structured_operations WHERE workspace_id=$1 AND operation_id=$2`,[workspaceId,operation.predecessorOperationId]);const previous=rows.rows[0];
      if(operation.kind==='create' || !previous || !previous.local_after || previous.result.status==='rejected' || previous.request.clientId!==operation.clientId || previous.request.entityType!==operation.entityType || previous.request.entityId!==operation.entityId || previous.result.entity?.version!==operation.baseVersion)return this.finish(tx,operation,reject(operation,order,'invalid_predecessor',current));
      causalBase=previous.local_after;
    }
    const now=utcNow();let next:StructuredEntity|null=null,changed=false,localAfter:Record<string,unknown>|null=null;const conflicts:Conflict[]=[];
    if(operation.kind==='create'){
      localAfter=payload;
      if(operation.entityType==='relation' && !await this.endpoints(tx,payload))return this.finish(tx,operation,reject(operation,order,'invalid_relation_endpoint',current));
      if(current){
        const first=await tx.query(`SELECT entity FROM "${this.schema}".private_structured_history WHERE workspace_id=$1 AND type=$2 AND id=$3 ORDER BY version LIMIT 1`,[workspaceId,operation.entityType,operation.entityId]);
        if(!first.rowCount)throw new PrivateTransactionUnavailable();
        if(!isDeepStrictEqual(fields(entity(operation.entityType,first.rows[0]!.entity)),payload))return this.finish(tx,operation,reject(operation,order,'entity_id_collision',current));next=current;
      }else{next=entity(operation.entityType,{id:operation.entityId,...payload,version:1,createdAt:now,updatedAt:now,deletedAt:null});changed=true;}
    }else if(!current)return this.finish(tx,operation,reject(operation,order,'entity_not_found',null));
    else if(current.deletedAt){
      next=current;localAfter={...(causalBase??fields(current)),...payload};
      // A tombstone ignores late field edits, but never adopts a foreign
      // endpoint in a causal frame. Missing/deleted own endpoints stay ignored.
      if(operation.entityType==='relation')await this.endpoints(tx,localAfter);
    }
    else if(current.version===Number.MAX_SAFE_INTEGER)return this.finish(tx,operation,reject(operation,order,'version_exhausted',current));
    else{
      const rows=await tx.query(`SELECT entity FROM "${this.schema}".private_structured_history WHERE workspace_id=$1 AND type=$2 AND id=$3 AND version=$4`,[workspaceId,operation.entityType,operation.entityId,operation.baseVersion]);
      if(!rows.rowCount)return this.finish(tx,operation,reject(operation,order,'base_unavailable',current));
      const base=causalBase??fields(entity(operation.entityType,rows.rows[0]!.entity));localAfter={...base,...payload};
      if(operation.kind==='delete'){next=entity(operation.entityType,{...current,version:current.version+1,updatedAt:now,deletedAt:now});changed=true;}
      else{
        if(operation.entityType==='relation' && !await this.endpoints(tx,localAfter))return this.finish(tx,operation,reject(operation,order,'invalid_relation_endpoint',current));
        const resolutions:Conflict[]=[];
        for(const id of operation.resolution?.conflictIds??[]){
          const records=await tx.query(`SELECT record FROM "${this.schema}".private_structured_conflicts WHERE workspace_id=$1 AND id=$2`,[workspaceId,id]);const record=records.rowCount?conflictSchema.parse(records.rows[0]!.record):null;
          if(!record || record.status!=='open' || record.entityType!==operation.entityType || record.entityId!==operation.entityId || !Object.hasOwn(payload,record.field) || !isDeepStrictEqual(payload[record.field],record[operation.resolution!.choice]))return this.finish(tx,operation,reject(operation,order,'invalid_resolution',current));resolutions.push(record);
        }
        const patch:Record<string,unknown>={};
        for(const [field,local] of Object.entries(payload)){const previous=base[field],remote=(current as unknown as Record<string,unknown>)[field];if(isDeepStrictEqual(previous,local))continue;
          if(!isDeepStrictEqual(previous,remote) && !isDeepStrictEqual(local,remote))conflicts.push({id:newId(),operationId:operation.operationId,entityType:operation.entityType,entityId:operation.entityId,field:field as Conflict['field'],base:previous,local,remote,createdAt:now,status:'open',resolvedBy:null});else patch[field]=local;
        }
        changed=Object.keys(patch).length>0 || conflicts.length===0;next=changed?entity(operation.entityType,{...current,...patch,version:current.version+1,updatedAt:now}):current;
        if(operation.entityType==='relation' && !await this.endpoints(tx,fields(next)))return this.finish(tx,operation,reject(operation,order,'invalid_relation_endpoint',current));
        if(!conflicts.length)conflicts.push(...resolutions.map(record=>({...record,status:'resolved' as const,resolvedBy:operation.operationId})));
      }
    }
    if(!next)throw new PrivateTransactionUnavailable();
    if(next.deletedAt){const open=await tx.query(`SELECT record FROM "${this.schema}".private_structured_conflicts WHERE workspace_id=$1 AND type=$2 AND entity_id=$3 AND status='open'`,[workspaceId,operation.entityType,operation.entityId]);conflicts.push(...open.rows.map(row=>({...conflictSchema.parse(row.record),status:'resolved' as const,resolvedBy:operation.operationId})));}
    if(changed){
      if(!current){
        const reserved=await tx.query(`INSERT INTO "${this.schema}".private_resources(type,id,workspace_id,deleted) VALUES($1,$2,$3,$4) ON CONFLICT(type,id) DO NOTHING RETURNING workspace_id`,[operation.entityType,operation.entityId,workspaceId,!!next.deletedAt]);
        if(reserved.rowCount!==1){const collision=await tx.query(`SELECT workspace_id FROM "${this.schema}".private_resources WHERE type=$1 AND id=$2`,[operation.entityType,operation.entityId]);if(collision.rows[0]?.workspace_id!==workspaceId)throw new PrivateWorkspaceAccessDenied();throw new PrivateTransactionUnavailable();}
        await tx.query(`INSERT INTO "${this.schema}".private_structured_entities VALUES($1,$2,$3,$4,$5)`,[operation.entityType,operation.entityId,workspaceId,next.version,JSON.stringify(next)]);
      }else{
        await tx.query(`UPDATE "${this.schema}".private_resources SET deleted=$4 WHERE type=$1 AND id=$2 AND workspace_id=$3`,[operation.entityType,operation.entityId,workspaceId,!!next.deletedAt]);
        await tx.query(`UPDATE "${this.schema}".private_structured_entities SET version=$4,entity=$5 WHERE workspace_id=$1 AND type=$2 AND id=$3`,[workspaceId,operation.entityType,operation.entityId,next.version,JSON.stringify(next)]);
      }
      await tx.query(`INSERT INTO "${this.schema}".private_structured_history VALUES($1,$2,$3,$4,$5)`,[workspaceId,operation.entityType,operation.entityId,next.version,JSON.stringify(next)]);
    }
    for(const record of conflicts){
      const saved=await tx.query(`INSERT INTO "${this.schema}".private_structured_conflicts AS stored VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(id) DO UPDATE SET status=EXCLUDED.status,record=EXCLUDED.record
        WHERE stored.workspace_id=EXCLUDED.workspace_id AND stored.type=EXCLUDED.type AND stored.entity_id=EXCLUDED.entity_id RETURNING id`,[record.id,workspaceId,operation.entityType,operation.entityId,record.status,JSON.stringify(record)]);
      if(saved.rowCount!==1)throw new PrivateTransactionUnavailable();
    }
    return this.finish(tx,operation,pushResultSchema.parse({operationId:operation.operationId,clientId:operation.clientId,entityType:operation.entityType,entityId:operation.entityId,serverOrder:order,status:conflicts.some(record=>record.status==='open')?'conflict':'acknowledged',entity:next,conflicts}),localAfter);
  }
  private async finish(tx:PrivateTransaction,operation:PushOperation,result:PushResult,localAfter:Record<string,unknown>|null=null) {
    await tx.query(`INSERT INTO "${this.schema}".private_structured_operations VALUES($1,$2,$3,$4,$5,$6,$7)`,[tx.context.workspaceId,result.serverOrder,operation.operationId,operation.clientId,JSON.stringify(operation),JSON.stringify(result),localAfter?JSON.stringify(localAfter):null]);return result;
  }
}
