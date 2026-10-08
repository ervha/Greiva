import type pg from 'pg';
import {isDeepStrictEqual} from 'node:util';
import {idSchema} from '@greiva/shared';
import {PrivateWorkspaceAccessDenied} from '@greiva/application';
import {privateDatabaseSourceSnapshotSchema,privateDatabaseSourceSummarySchema,privateDatabaseSourceCreateRequestSchema,privateDatabaseSourceCreateResponseSchema,privateDatabaseSourceReadRequestSchema,privateDatabaseSourceReadResponseSchema,privateDatabaseSourceCatalogRequestSchema,privateDatabaseSourceCatalogResponseSchema,type PrivateDatabaseSourceSnapshot} from '@greiva/protocol/private-database-source';
import {structuredOrderSchema} from '@greiva/protocol/workspace';
import {privateSchemaName} from './private-schema-name.js';
import {PostgresPrivateTransactions,PrivateTransactionInvalidRequest,PrivateTransactionUnavailable,type PrivateTransaction} from './private-transactions.js';
import type {VerifiedSession} from './session-verifier.js';
import {databaseSourceCursor} from './private-database-source-cursor.js';
export class PrivateDatabaseSourceInvalidRequest extends PrivateTransactionInvalidRequest{constructor(readonly code:'invalid_request'|'operation_id_reused'|'source_id_reused'='invalid_request'){super();}}
export interface PrivateDatabaseSources{create(session:VerifiedSession,workspaceId:string,body:unknown):Promise<unknown>;read(session:VerifiedSession,workspaceId:string,sourceId:string,body:unknown):Promise<unknown>;catalog(session:VerifiedSession,workspaceId:string,body:unknown):Promise<unknown>;}
function parse<T>(schema:{safeParse:(input:unknown)=>{success:boolean;data?:T}},value:unknown):T{const parsed=schema.safeParse(value);if(!parsed.success)throw new PrivateDatabaseSourceInvalidRequest();return parsed.data!;}
type SourceRow={id:string;workspace_id:string;creation_order:string;version:string;definition:unknown;deleted:boolean};
type CatalogRow={id:string;workspace_id:string;creation_order:string;version:string;name:unknown;schema_version:string;property_count:number;definition_id:string;definition_workspace:string;schema_kind:string;name_kind:string;deleted:boolean};
export class PostgresPrivateDatabaseSourceStore implements PrivateDatabaseSources{
 private readonly schema:string;private readonly transactions:PostgresPrivateTransactions;
 constructor(pool:pg.Pool,schema:string,now:()=>number=Date.now){this.schema=privateSchemaName(schema);this.transactions=new PostgresPrivateTransactions(pool,this.schema,now);}
 async create(session:VerifiedSession,workspaceId:string,body:unknown){
  const request=parse(privateDatabaseSourceCreateRequestSchema,body);if(request.source.workspaceId!==workspaceId)throw new PrivateDatabaseSourceInvalidRequest();
  return this.transactions.run(session,workspaceId,request.clientId,[],async tx=>{
   await this.gate(tx);await tx.query(`INSERT INTO "${this.schema}".private_database_source_heads VALUES($1,0) ON CONFLICT(workspace_id) DO NOTHING`,[workspaceId]);
   await tx.query(`SELECT head_order FROM "${this.schema}".private_database_source_heads WHERE workspace_id=$1 FOR UPDATE`,[workspaceId]);
   const old=await tx.query(`SELECT source_id,client_id,request,result FROM "${this.schema}".private_database_source_operations WHERE workspace_id=$1 AND operation_id=$2`,[workspaceId,request.operationId]);
   if(old.rowCount){const row=old.rows[0]!;if(row.source_id!==request.source.id||row.client_id!==request.clientId||!isDeepStrictEqual(row.request,request))throw new PrivateDatabaseSourceInvalidRequest('operation_id_reused');await this.current(tx,request.source.id);const result=privateDatabaseSourceCreateResponseSchema.parse(row.result);if(result.workspaceId!==workspaceId||result.workspaceEpoch!==tx.context.epoch||result.clientId!==request.clientId||result.operationId!==request.operationId||result.snapshot.source.id!==request.source.id||!isDeepStrictEqual(result.snapshot.source,request.source))throw new PrivateTransactionUnavailable();return result;}
   const existing=await tx.query(`SELECT id FROM "${this.schema}".private_database_sources WHERE workspace_id=$1 AND id=$2`,[workspaceId,request.source.id]);if(existing.rowCount)throw new PrivateDatabaseSourceInvalidRequest('source_id_reused');
   const head=await tx.query(`UPDATE "${this.schema}".private_database_source_heads SET head_order=head_order+1 WHERE workspace_id=$1 AND head_order<9223372036854775807 RETURNING head_order::text`,[workspaceId]);if(head.rowCount!==1)throw new PrivateTransactionUnavailable();
   const order=structuredOrderSchema.parse(head.rows[0]!.head_order),insert=await tx.query(`INSERT INTO "${this.schema}".private_database_sources(id,workspace_id,creation_order,version,definition) VALUES($1,$2,$3,1,$4) ON CONFLICT(id) DO NOTHING RETURNING id`,[request.source.id,workspaceId,order,JSON.stringify(request.source)]);if(insert.rowCount!==1)throw new PrivateWorkspaceAccessDenied();
   const result=privateDatabaseSourceCreateResponseSchema.parse({...this.scope(tx),operationId:request.operationId,snapshot:{source:request.source,version:1,creationOrder:order},result:{status:'created'}});
   await tx.query(`INSERT INTO "${this.schema}".private_database_source_operations VALUES($1,$2,$3,$4,$5,$6)`,[workspaceId,request.operationId,request.source.id,request.clientId,JSON.stringify(request),JSON.stringify(result)]);return result;
  });
 }
 async read(session:VerifiedSession,workspaceId:string,candidate:string,body:unknown){
  const id=parse(idSchema,candidate),request=parse(privateDatabaseSourceReadRequestSchema,body);if(id!==id.toLowerCase())throw new PrivateDatabaseSourceInvalidRequest();return this.transactions.run(session,workspaceId,request.clientId,[],async tx=>{await this.gate(tx);return privateDatabaseSourceReadResponseSchema.parse({...this.scope(tx),snapshot:await this.current(tx,id)});});
 }
 async catalog(session:VerifiedSession,workspaceId:string,body:unknown){
  const request=parse(privateDatabaseSourceCatalogRequestSchema,body);return this.transactions.run(session,workspaceId,request.clientId,[],async tx=>{
   await this.gate(tx);const heads=await tx.query(`SELECT head_order::text FROM "${this.schema}".private_database_source_heads WHERE workspace_id=$1 FOR SHARE`,[workspaceId]),head=structuredOrderSchema.parse(heads.rowCount?heads.rows[0]!.head_order:'0');
   const maximum=await tx.query(`SELECT creation_order::text FROM "${this.schema}".private_database_sources WHERE workspace_id=$1 ORDER BY private_database_sources.creation_order DESC LIMIT 1`,[workspaceId]);if((maximum.rowCount?maximum.rows[0]!.creation_order:'0')!==head)throw new PrivateTransactionUnavailable();
   const keys=await tx.query(`SELECT secret FROM "${this.schema}".private_structured_config WHERE singleton=true`);if(keys.rowCount!==1)throw new PrivateTransactionUnavailable();const cursor=databaseSourceCursor(workspaceId,tx.context.epoch,request.clientId,keys.rows[0]!.secret),range=cursor.decode(request.cursor,head);
   // Catalogs return only small headers. Full property/option definitions are
   // loaded explicitly by read(), never multiplied across a 100-row response.
   const rows=await tx.query(`SELECT id,workspace_id,creation_order::text,version::text,definition->>'name' AS name,definition->>'schemaVersion' AS schema_version,CASE WHEN deleted THEN NULL ELSE jsonb_array_length(definition->'properties') END AS property_count,definition->>'id' AS definition_id,definition->>'workspaceId' AS definition_workspace,jsonb_typeof(definition->'schemaVersion') AS schema_kind,jsonb_typeof(definition->'name') AS name_kind,deleted FROM "${this.schema}".private_database_sources WHERE workspace_id=$1 AND creation_order>$2 AND creation_order<=$3 ORDER BY private_database_sources.creation_order LIMIT $4`,[workspaceId,range.after,range.head,request.limit+1]),all=rows.rows as CatalogRow[],raw=all.slice(0,request.limit),hasMore=all.length>request.limit;
   let previous=BigInt(range.after);for(const row of all){const order=BigInt(structuredOrderSchema.parse(row.creation_order));if(order<=previous||order>BigInt(range.head)||row.workspace_id!==workspaceId||typeof row.deleted!=='boolean')throw new PrivateTransactionUnavailable();if(!row.deleted)this.summary(row,workspaceId);previous=order;}
   const through=hasMore?raw.at(-1)!.creation_order:range.head;return privateDatabaseSourceCatalogResponseSchema.parse({...this.scope(tx),afterOrder:range.after,throughOrder:through,headOrder:range.head,sources:raw.filter(row=>!row.deleted).map(row=>this.summary(row,workspaceId)),hasMore,cursor:hasMore?cursor.encode(through,range.head):null});
  });
 }
 private scope(tx:PrivateTransaction){return{protocolVersion:1 as const,workspaceId:tx.context.workspaceId,workspaceEpoch:tx.context.epoch,clientId:tx.context.clientId};}
 private async gate(tx:PrivateTransaction){const rows=await tx.query(`SELECT version FROM "${this.schema}".private_schema_version WHERE singleton=true`);if(rows.rowCount!==1||![6,7].includes(rows.rows[0]!.version))throw new PrivateTransactionUnavailable();}
 private snapshot(row:SourceRow,workspaceId:string):PrivateDatabaseSourceSnapshot{const parsed=privateDatabaseSourceSnapshotSchema.safeParse({source:row.definition,version:Number(row.version),creationOrder:row.creation_order});if(!parsed.success||row.workspace_id!==workspaceId||parsed.data.source.workspaceId!==workspaceId||parsed.data.source.id!==row.id)throw new PrivateTransactionUnavailable();return parsed.data;}
 private summary(row:CatalogRow,workspaceId:string){if(row.definition_id!==row.id||row.definition_workspace!==workspaceId||row.schema_kind!=='number'||row.name_kind!=='string'||!/^[1-9]\d*$/.test(row.schema_version))throw new PrivateTransactionUnavailable();const parsed=privateDatabaseSourceSummarySchema.safeParse({id:row.id,workspaceId:row.workspace_id,name:row.name,schemaVersion:Number(row.schema_version),version:Number(row.version),creationOrder:row.creation_order,propertyCount:row.property_count});if(!parsed.success)throw new PrivateTransactionUnavailable();return parsed.data;}
 private async current(tx:PrivateTransaction,id:string){const rows=await tx.query(`SELECT id,workspace_id,creation_order::text,version::text,definition,deleted FROM "${this.schema}".private_database_sources WHERE workspace_id=$1 AND id=$2 FOR SHARE`,[tx.context.workspaceId,id]);if(rows.rowCount!==1||rows.rows[0]!.deleted)throw new PrivateWorkspaceAccessDenied();return this.snapshot(rows.rows[0]! as SourceRow,tx.context.workspaceId);}
}
