import type pg from 'pg';
import {idSchema} from '@greiva/shared';
import {PrivateWorkspaceAccessDenied} from '@greiva/application';
import {privateDatabaseSourceSnapshotSchema} from '@greiva/protocol/private-database-source';
import {privateDatabaseRecordCatalogRequestSchema,privateDatabaseRecordCatalogResponseSchema,privateDatabaseRecordHeaderSchema} from '@greiva/protocol/private-database-record-catalog';
import {structuredOrderSchema} from '@greiva/protocol/workspace';
import {privateSchemaName} from './private-schema-name.js';
import {PostgresPrivateTransactions,PrivateTransactionInvalidRequest,PrivateTransactionUnavailable} from './private-transactions.js';
import type {VerifiedSession} from './session-verifier.js';
import {databaseRecordCatalogCursor} from './private-database-record-catalog-cursor.js';
type HeaderRow={id:string;workspace_id:string;source_id:string;page_id:string;version:string;creation_order:string;deleted:boolean;page_access:boolean;snapshot_id:unknown;snapshot_workspace:unknown;snapshot_source:unknown;snapshot_page:unknown;snapshot_version:unknown;version_kind:unknown};
export interface PrivateDatabaseRecordCatalog{catalog(session:VerifiedSession,workspaceId:string,sourceId:string,body:unknown):Promise<unknown>;}
export class PostgresPrivateDatabaseRecordCatalogStore implements PrivateDatabaseRecordCatalog{
 private readonly schema:string;private readonly transactions:PostgresPrivateTransactions;
 constructor(pool:pg.Pool,schema:string,now:()=>number=Date.now){this.schema=privateSchemaName(schema);this.transactions=new PostgresPrivateTransactions(pool,this.schema,now);}
 async catalog(session:VerifiedSession,workspaceId:string,candidate:string,body:unknown){
  const id=idSchema.safeParse(candidate),parsed=privateDatabaseRecordCatalogRequestSchema.safeParse(body);
  if(!id.success||id.data!==id.data.toLowerCase()||!parsed.success)throw new PrivateTransactionInvalidRequest();const sourceId=id.data,request=parsed.data;
  return this.transactions.run(session,workspaceId,request.clientId,[],async tx=>{
   const gate=await tx.query(`SELECT version FROM "${this.schema}".private_schema_version WHERE singleton=true`);if(gate.rowCount!==1||gate.rows[0]!.version!==8)throw new PrivateTransactionUnavailable();
   const sources=await tx.query(`SELECT definition,version::text,creation_order::text,deleted FROM "${this.schema}".private_database_sources WHERE workspace_id=$1 AND id=$2 FOR SHARE`,[workspaceId,sourceId]);
   if(sources.rowCount!==1||sources.rows[0]!.deleted)throw new PrivateWorkspaceAccessDenied();const row=sources.rows[0]!,source=privateDatabaseSourceSnapshotSchema.safeParse({source:row.definition,version:Number(row.version),creationOrder:row.creation_order});if(!source.success||source.data.source.id!==sourceId||source.data.source.workspaceId!==workspaceId)throw new PrivateTransactionUnavailable();
   const heads=await tx.query(`SELECT workspace_id,head_order::text FROM "${this.schema}".private_database_record_heads WHERE source_id=$1 FOR SHARE`,[sourceId]);if(heads.rowCount&&heads.rows[0]!.workspace_id!==workspaceId)throw new PrivateTransactionUnavailable();const head=structuredOrderSchema.parse(heads.rowCount?heads.rows[0]!.head_order:'0');
   const maximum=await tx.query(`SELECT COALESCE(max(creation_order),0)::text AS head FROM "${this.schema}".private_database_records WHERE workspace_id=$1 AND source_id=$2`,[workspaceId,sourceId]);if(maximum.rows[0]!.head!==head)throw new PrivateTransactionUnavailable();
   const keys=await tx.query(`SELECT secret FROM "${this.schema}".private_structured_config WHERE singleton=true`);if(keys.rowCount!==1)throw new PrivateTransactionUnavailable();const cursor=databaseRecordCatalogCursor(workspaceId,tx.context.epoch,request.clientId,sourceId,keys.rows[0]!.secret),range=cursor.decode(request.cursor,head);
   const rows=await tx.query(`SELECT r.id,r.workspace_id,r.source_id,r.page_id,r.version::text,r.creation_order::text,r.deleted,(p.id IS NOT NULL AND NOT p.deleted AND p.workspace_id=r.workspace_id) AS page_access,r.snapshot->>'id' AS snapshot_id,r.snapshot->>'workspaceId' AS snapshot_workspace,r.snapshot->>'sourceId' AS snapshot_source,r.snapshot->>'pageId' AS snapshot_page,r.snapshot->>'version' AS snapshot_version,jsonb_typeof(r.snapshot->'version') AS version_kind FROM "${this.schema}".private_database_records r LEFT JOIN "${this.schema}".private_resources p ON p.type='page' AND p.id=r.page_id WHERE r.workspace_id=$1 AND r.source_id=$2 AND r.creation_order>$3 AND r.creation_order<=$4 ORDER BY r.creation_order LIMIT $5`,[workspaceId,sourceId,range.after,range.head,request.limit+1]),all=rows.rows as HeaderRow[],raw=all.slice(0,request.limit),hasMore=all.length>request.limit;
   let previous=BigInt(range.after);for(const item of all){const order=BigInt(structuredOrderSchema.parse(item.creation_order));if(order<=previous||order>BigInt(range.head)||item.workspace_id!==workspaceId||item.source_id!==sourceId||typeof item.deleted!=='boolean'||typeof item.page_access!=='boolean')throw new PrivateTransactionUnavailable();if(!item.deleted)this.header(item);previous=order;}
   const through=hasMore?raw.at(-1)!.creation_order:range.head;
   return privateDatabaseRecordCatalogResponseSchema.parse({protocolVersion:1,workspaceId,workspaceEpoch:tx.context.epoch,clientId:request.clientId,sourceId,schemaVersion:source.data.source.schemaVersion,afterOrder:range.after,throughOrder:through,headOrder:range.head,records:raw.filter(item=>!item.deleted&&item.page_access).map(item=>this.header(item)),hasMore,cursor:hasMore?cursor.encode(through,range.head):null});
  });
 }
 private header(row:HeaderRow){
  if(row.snapshot_id!==row.id||row.snapshot_workspace!==row.workspace_id||row.snapshot_source!==row.source_id||row.snapshot_page!==row.page_id||row.version_kind!=='number'||row.snapshot_version!==row.version)throw new PrivateTransactionUnavailable();
  const parsed=privateDatabaseRecordHeaderSchema.safeParse({id:row.id,workspaceId:row.workspace_id,sourceId:row.source_id,pageId:row.page_id,version:Number(row.version),creationOrder:row.creation_order});if(!parsed.success)throw new PrivateTransactionUnavailable();return parsed.data;
 }
}
