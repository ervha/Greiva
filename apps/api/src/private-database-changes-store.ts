import type pg from 'pg';
import {isDeepStrictEqual} from 'node:util';
import {idSchema} from '@greiva/shared';
import {PrivateWorkspaceAccessDenied} from '@greiva/application';
import {privateDatabaseSourceSnapshotSchema} from '@greiva/protocol/private-database-source';
import {privateDatabaseChangeSchema,privateDatabaseChangesRequestSchema,parsePrivateDatabaseChange,parsePrivateDatabaseChangesResponse,type PrivateDatabaseChange} from '@greiva/protocol/private-database-changes';
import {structuredOrderSchema} from '@greiva/protocol/workspace';
import {privateSchemaName} from './private-schema-name.js';
import {PostgresPrivateTransactions,PrivateTransactionInvalidRequest,PrivateTransactionUnavailable,type PrivateTransaction} from './private-transactions.js';
import {databaseChangesCursor} from './private-database-changes-cursor.js';
import {verifyDatabaseChangeCandidate} from './private-database-changes-journal.js';
import type {VerifiedSession} from './session-verifier.js';
export interface PrivateDatabaseChanges{pull(session:VerifiedSession,workspaceId:string,sourceId:string,body:unknown):Promise<unknown>;}
type EventRow={workspace_id:string;source_id:string;server_order:string;kind:string;entity_id:string;event:unknown};
 type IndexRow=Omit<EventRow,'event'>&{event_bytes:number;page_id:string|null};
export class PostgresPrivateDatabaseChangesStore implements PrivateDatabaseChanges{
 private readonly schema:string;private readonly transactions:PostgresPrivateTransactions;
 constructor(pool:pg.Pool,schema:string,now:()=>number=Date.now,private readonly windowBytes=64*1024*1024){this.schema=privateSchemaName(schema);this.transactions=new PostgresPrivateTransactions(pool,this.schema,now);if(!Number.isSafeInteger(windowBytes)||windowBytes<1||windowBytes>64*1024*1024)throw Error('Invalid database change window budget');}
 async pull(session:VerifiedSession,workspaceId:string,candidate:string,body:unknown){
  const id=idSchema.safeParse(candidate),parsed=privateDatabaseChangesRequestSchema.safeParse(body);if(!id.success||id.data!==id.data.toLowerCase()||!parsed.success)throw new PrivateTransactionInvalidRequest();const sourceId=id.data,request=parsed.data;
  return this.transactions.run(session,workspaceId,request.clientId,[],async tx=>{
   const gate=await tx.query(`SELECT version FROM "${this.schema}".private_schema_version WHERE singleton=true`);if(gate.rowCount!==1||gate.rows[0]!.version!==11)throw new PrivateTransactionUnavailable();
   // Bounded preflight before business locks. Capture an observed head and then
   // acquire Page resources before Source, matching the Record writer's order.
   const observed=await this.head(tx,sourceId,false),keys=await tx.query(`SELECT secret FROM "${this.schema}".private_structured_config WHERE singleton=true`);if(keys.rowCount!==1)throw new PrivateTransactionUnavailable();
   const cursor=databaseChangesCursor(workspaceId,tx.context.epoch,request.clientId,sourceId,observed.journal_epoch,keys.rows[0]!.secret),after=cursor.decode(request.cursor,observed.head_order),index=await this.index(tx,sourceId,after,observed.head_order,request.limit);
   let windowCount=0,bytes=0;
   for(const [position,item] of index.entries()){if(item.workspace_id!==workspaceId||item.source_id!==sourceId||BigInt(structuredOrderSchema.parse(item.server_order))!==BigInt(after)+BigInt(position)+1n||!['record','view'].includes(item.kind)||!Number.isSafeInteger(item.event_bytes)||item.event_bytes<1||item.event_bytes>this.windowBytes||!idSchema.safeParse(item.entity_id).success||(item.kind==='record'&&(!idSchema.safeParse(item.page_id).success||item.page_id!==item.page_id!.toLowerCase())))throw new PrivateTransactionUnavailable();if(position===windowCount&&windowCount<request.limit&&bytes+item.event_bytes<=this.windowBytes){bytes+=item.event_bytes;windowCount++;}}
   const raw=await this.events(tx,sourceId,after,observed.head_order,windowCount);
   const preliminary=raw.map(row=>this.raw(row,workspaceId,sourceId)),ids=[...new Set(preliminary.flatMap(event=>event.kind==='record'?[event.record.pageId]:[]))].sort();
   const resources=ids.length?await tx.query(`SELECT id,deleted FROM "${this.schema}".private_resources WHERE workspace_id=$1 AND type='page' AND id=ANY($2::uuid[]) ORDER BY id FOR SHARE`,[workspaceId,'{'+ids.join(',')+'}']):null;if(resources&&resources.rowCount!==ids.length)throw new PrivateTransactionUnavailable();const livePages=new Set(resources?.rows.filter(row=>row.deleted===false).map(row=>row.id));
   const sources=await tx.query(`SELECT definition,version::text,creation_order::text,deleted FROM "${this.schema}".private_database_sources WHERE workspace_id=$1 AND id=$2 FOR SHARE`,[workspaceId,sourceId]);if(sources.rowCount!==1||sources.rows[0]!.deleted)throw new PrivateWorkspaceAccessDenied();const row=sources.rows[0]!,source=privateDatabaseSourceSnapshotSchema.safeParse({source:row.definition,version:Number(row.version),creationOrder:row.creation_order});if(!source.success||source.data.source.id!==sourceId||source.data.source.workspaceId!==workspaceId)throw new PrivateTransactionUnavailable();
   const current=await this.head(tx,sourceId,true);if(current.journal_epoch!==observed.journal_epoch||BigInt(current.head_order)<BigInt(observed.head_order))throw new PrivateTransactionUnavailable();
   const last=await tx.query(`SELECT server_order::text FROM "${this.schema}".private_database_change_events WHERE source_id=$1 ORDER BY private_database_change_events.server_order DESC LIMIT 1`,[sourceId]);if((last.rows[0]?.server_order??'0')!==current.head_order)throw new PrivateTransactionUnavailable();
   const repeatedIndex=await this.index(tx,sourceId,after,observed.head_order,request.limit);if(!isDeepStrictEqual(index,repeatedIndex))throw new PrivateTransactionUnavailable();const repeated=await this.events(tx,sourceId,after,observed.head_order,windowCount);if(!isDeepStrictEqual(raw,repeated))throw new PrivateTransactionUnavailable();
   const all:PrivateDatabaseChange[]=[];for(const [index,eventRow] of repeated.entries()){
    const event=parsePrivateDatabaseChange(source.data.source,this.raw(eventRow,workspaceId,sourceId));if(BigInt(event.order)!==BigInt(after)+BigInt(index)+1n)throw new PrivateTransactionUnavailable();
    const history=event.kind==='record'?await tx.query(`SELECT snapshot FROM "${this.schema}".private_database_record_history WHERE record_id=$1 AND version=$2`,[event.record.id,event.record.version]):await tx.query(`SELECT snapshot FROM "${this.schema}".private_database_view_history WHERE view_id=$1 AND version=$2`,[event.snapshot.view.id,event.snapshot.version]);if(history.rowCount!==1||!isDeepStrictEqual(history.rows[0]!.snapshot,event.kind==='record'?event.record:event.snapshot))throw new PrivateTransactionUnavailable();await verifyDatabaseChangeCandidate(tx,this.schema,source.data.source,tx.context.epoch,event);all.push(event);
   }
   const window=all.slice(0,windowCount),hasMore=all.length>windowCount,readOrder=hasMore?window.at(-1)!.order:observed.head_order;if(!hasMore&&(all.at(-1)?.order??after)!==observed.head_order)throw new PrivateTransactionUnavailable();
   const visible:PrivateDatabaseChange[]=[];for(const event of window){
    const entities=event.kind==='record'?await tx.query(`SELECT deleted,page_id FROM "${this.schema}".private_database_records WHERE workspace_id=$1 AND source_id=$2 AND id=$3`,[workspaceId,sourceId,event.record.id]):await tx.query(`SELECT deleted FROM "${this.schema}".private_database_views WHERE workspace_id=$1 AND source_id=$2 AND id=$3`,[workspaceId,sourceId,event.snapshot.view.id]);if(entities.rowCount!==1||typeof entities.rows[0]!.deleted!=='boolean'||(event.kind==='record'&&entities.rows[0]!.page_id!==event.record.pageId))throw new PrivateTransactionUnavailable();if(!entities.rows[0]!.deleted&&(event.kind==='view'||livePages.has(event.record.pageId)))visible.push(event);
   }
   return parsePrivateDatabaseChangesResponse(source.data.source,{protocolVersion:1,workspaceId,workspaceEpoch:tx.context.epoch,clientId:request.clientId,sourceId,schemaVersion:source.data.source.schemaVersion,journalEpoch:observed.journal_epoch,afterOrder:after,readOrder,headOrder:observed.head_order,events:visible,hasMore,cursor:cursor.encode(readOrder)});
  });
 }
 private async head(tx:PrivateTransaction,sourceId:string,lock:boolean){
  const rows=await tx.query(`SELECT workspace_id,journal_epoch,head_order::text FROM "${this.schema}".private_database_change_heads WHERE source_id=$1 AND workspace_id=$2${lock?' FOR SHARE':''}`,[sourceId,tx.context.workspaceId]);
  if(rows.rowCount!==1){const source=await tx.query(`SELECT id,deleted FROM "${this.schema}".private_database_sources WHERE id=$1 AND workspace_id=$2`,[sourceId,tx.context.workspaceId]);if(source.rowCount!==1||source.rows[0]!.deleted)throw new PrivateWorkspaceAccessDenied();throw new PrivateTransactionUnavailable();}
  const row=rows.rows[0]!,epoch=idSchema.safeParse(row.journal_epoch);if(row.workspace_id!==tx.context.workspaceId||!epoch.success||epoch.data!==epoch.data.toLowerCase())throw new PrivateTransactionUnavailable();structuredOrderSchema.parse(row.head_order);return row as {workspace_id:string;journal_epoch:string;head_order:string};
 }
 private index(tx:PrivateTransaction,sourceId:string,after:string,head:string,limit:number){return tx.query<IndexRow>(`SELECT workspace_id,source_id,server_order::text,kind,entity_id,octet_length(event::text) AS event_bytes,CASE WHEN kind='record' THEN event->'record'->>'pageId' ELSE NULL END AS page_id FROM "${this.schema}".private_database_change_events WHERE source_id=$1 AND workspace_id=$2 AND server_order>$3 AND server_order<=$4 ORDER BY private_database_change_events.server_order LIMIT $5`,[sourceId,tx.context.workspaceId,after,head,limit+1]).then(rows=>rows.rows);}
 private events(tx:PrivateTransaction,sourceId:string,after:string,head:string,limit:number){return tx.query<EventRow>(`SELECT workspace_id,source_id,server_order::text,kind,entity_id,event FROM "${this.schema}".private_database_change_events WHERE source_id=$1 AND workspace_id=$2 AND server_order>$3 AND server_order<=$4 ORDER BY private_database_change_events.server_order LIMIT $5`,[sourceId,tx.context.workspaceId,after,head,limit+1]).then(rows=>rows.rows);}
 private raw(row:EventRow,workspaceId:string,sourceId:string){try{const event=privateDatabaseChangeSchema.parse(row.event);if(row.workspace_id!==workspaceId||row.source_id!==sourceId||row.server_order!==event.order||row.kind!==event.kind||row.entity_id!==(event.kind==='record'?event.record.id:event.snapshot.view.id))throw Error();return event;}catch{throw new PrivateTransactionUnavailable();}}
}
