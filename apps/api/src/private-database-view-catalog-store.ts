import type pg from 'pg';
import {idSchema} from '@greiva/shared';
import {PrivateWorkspaceAccessDenied} from '@greiva/application';
import {privateDatabaseSourceSnapshotSchema} from '@greiva/protocol/private-database-source';
import {privateDatabaseViewCatalogRequestSchema,privateDatabaseViewCatalogResponseSchema,privateDatabaseViewHeaderSchema} from '@greiva/protocol/private-database-view-catalog';
import {structuredOrderSchema} from '@greiva/protocol/workspace';
import {privateSchemaName} from './private-schema-name.js';
import {PostgresPrivateTransactions,PrivateTransactionInvalidRequest,PrivateTransactionUnavailable} from './private-transactions.js';
import type {VerifiedSession} from './session-verifier.js';
import {databaseViewCatalogCursor} from './private-database-view-catalog-cursor.js';
type HeaderRow={id:string;workspace_id:string;source_id:string;version:string;creation_order:string;deleted:boolean;snapshot_id:unknown;snapshot_source:unknown;snapshot_version:unknown;version_kind:unknown;name:unknown;name_kind:unknown;layout:unknown;layout_kind:unknown};
export interface PrivateDatabaseViewCatalog{catalog(session:VerifiedSession,workspaceId:string,sourceId:string,body:unknown):Promise<unknown>;}
export class PostgresPrivateDatabaseViewCatalogStore implements PrivateDatabaseViewCatalog{
 private readonly schema:string;private readonly transactions:PostgresPrivateTransactions;
 constructor(pool:pg.Pool,schema:string,now:()=>number=Date.now){this.schema=privateSchemaName(schema);this.transactions=new PostgresPrivateTransactions(pool,this.schema,now);}
 async catalog(session:VerifiedSession,workspaceId:string,candidate:string,body:unknown){
  const id=idSchema.safeParse(candidate),parsed=privateDatabaseViewCatalogRequestSchema.safeParse(body);if(!id.success||id.data!==id.data.toLowerCase()||!parsed.success)throw new PrivateTransactionInvalidRequest();const sourceId=id.data,request=parsed.data;
  return this.transactions.run(session,workspaceId,request.clientId,[],async tx=>{
   const gate=await tx.query(`SELECT version FROM "${this.schema}".private_schema_version WHERE singleton=true`);if(gate.rowCount!==1||![10,11].includes(gate.rows[0]!.version))throw new PrivateTransactionUnavailable();
   const sources=await tx.query(`SELECT definition,version::text,creation_order::text,deleted FROM "${this.schema}".private_database_sources WHERE workspace_id=$1 AND id=$2 FOR SHARE`,[workspaceId,sourceId]);if(sources.rowCount!==1||sources.rows[0]!.deleted)throw new PrivateWorkspaceAccessDenied();
   const row=sources.rows[0]!,source=privateDatabaseSourceSnapshotSchema.safeParse({source:row.definition,version:Number(row.version),creationOrder:row.creation_order});if(!source.success||source.data.source.id!==sourceId||source.data.source.workspaceId!==workspaceId)throw new PrivateTransactionUnavailable();
   const heads=await tx.query(`SELECT workspace_id,head_order::text FROM "${this.schema}".private_database_view_heads WHERE source_id=$1 FOR SHARE`,[sourceId]);if(heads.rowCount&&heads.rows[0]!.workspace_id!==workspaceId)throw new PrivateTransactionUnavailable();const head=structuredOrderSchema.parse(heads.rowCount?heads.rows[0]!.head_order:'0');
   const maximum=await tx.query(`SELECT COALESCE(max(creation_order),0)::text AS head FROM "${this.schema}".private_database_views WHERE workspace_id=$1 AND source_id=$2`,[workspaceId,sourceId]);if(maximum.rows[0]!.head!==head)throw new PrivateTransactionUnavailable();
   const keys=await tx.query(`SELECT secret FROM "${this.schema}".private_structured_config WHERE singleton=true`);if(keys.rowCount!==1)throw new PrivateTransactionUnavailable();const cursor=databaseViewCatalogCursor(workspaceId,tx.context.epoch,request.clientId,sourceId,keys.rows[0]!.secret),range=cursor.decode(request.cursor,head);
   const rows=await tx.query(`SELECT v.id,v.workspace_id,v.source_id,v.version::text,v.creation_order::text,v.deleted,v.snapshot->'view'->>'id' AS snapshot_id,v.snapshot->'view'->>'sourceId' AS snapshot_source,v.snapshot->>'version' AS snapshot_version,jsonb_typeof(v.snapshot->'version') AS version_kind,v.snapshot->'view'->>'name' AS name,jsonb_typeof(v.snapshot->'view'->'name') AS name_kind,v.snapshot->'view'->>'layout' AS layout,jsonb_typeof(v.snapshot->'view'->'layout') AS layout_kind FROM "${this.schema}".private_database_views v WHERE v.workspace_id=$1 AND v.source_id=$2 AND v.creation_order>$3 AND v.creation_order<=$4 ORDER BY v.creation_order LIMIT $5`,[workspaceId,sourceId,range.after,range.head,request.limit+1]),all=rows.rows as HeaderRow[],raw=all.slice(0,request.limit),hasMore=all.length>request.limit;
   let previous=BigInt(range.after);for(const item of all){const order=BigInt(structuredOrderSchema.parse(item.creation_order));if(order<=previous||order>BigInt(range.head)||item.workspace_id!==workspaceId||item.source_id!==sourceId||typeof item.deleted!=='boolean')throw new PrivateTransactionUnavailable();if(!item.deleted)this.header(item);previous=order;}
   const through=hasMore?raw.at(-1)!.creation_order:range.head;
   return privateDatabaseViewCatalogResponseSchema.parse({protocolVersion:1,workspaceId,workspaceEpoch:tx.context.epoch,clientId:request.clientId,sourceId,schemaVersion:source.data.source.schemaVersion,afterOrder:range.after,throughOrder:through,headOrder:range.head,views:raw.filter(item=>!item.deleted).map(item=>this.header(item)),hasMore,cursor:hasMore?cursor.encode(through,range.head):null});
  });
 }
 private header(row:HeaderRow){if(row.snapshot_id!==row.id||row.snapshot_source!==row.source_id||row.snapshot_version!==row.version||row.version_kind!=='number'||row.name_kind!=='string'||row.layout_kind!=='string')throw new PrivateTransactionUnavailable();const parsed=privateDatabaseViewHeaderSchema.safeParse({id:row.id,workspaceId:row.workspace_id,sourceId:row.source_id,version:Number(row.version),name:row.name,layout:row.layout,creationOrder:row.creation_order});if(!parsed.success)throw new PrivateTransactionUnavailable();return parsed.data;}
}
