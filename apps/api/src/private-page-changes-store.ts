import type pg from 'pg';
import {privatePageChangeSchema,privatePageChangesRequestSchema,privatePageChangesResponseSchema,type PrivatePageChange} from '@greiva/protocol/private-page-changes';
import {structuredOrderSchema} from '@greiva/protocol/workspace';
import {privateSchemaName} from './private-schema-name.js';
import {PostgresPrivateTransactions,PrivateTransactionInvalidRequest,PrivateTransactionUnavailable,type PrivateTransaction} from './private-transactions.js';
import type {VerifiedSession} from './session-verifier.js';
import {pageChangesCursor} from './private-page-changes-cursor.js';

export interface PrivatePageChanges{pull(session:VerifiedSession,workspaceId:string,body:unknown):Promise<unknown>;}
// Callers reserve the workspace metadata head before resource/document locks.
export async function appendPageChange(tx:PrivateTransaction,schema:string,value:Omit<PrivatePageChange,'order'>){
  const rows=await tx.query(`UPDATE "${schema}".private_page_metadata_heads SET head_order=head_order+1 WHERE workspace_id=$1 AND head_order<9223372036854775807 RETURNING head_order`,[tx.context.workspaceId]);
  if(rows.rowCount!==1)throw new PrivateTransactionUnavailable();const event=privatePageChangeSchema.parse({...value,order:rows.rows[0]!.head_order});
  await tx.query(`INSERT INTO "${schema}".private_page_metadata_events(workspace_id,server_order,page_id,event) VALUES($1,$2,$3,$4)`,[tx.context.workspaceId,event.order,event.pageId,JSON.stringify(event)]);
}
export class PostgresPrivatePageChangesStore implements PrivatePageChanges{
  private readonly schema:string;private readonly transactions:PostgresPrivateTransactions;
  constructor(pool:pg.Pool,schema:string){this.schema=privateSchemaName(schema);this.transactions=new PostgresPrivateTransactions(pool,this.schema);}
  async pull(session:VerifiedSession,workspaceId:string,body:unknown){
    const parsed=privatePageChangesRequestSchema.safeParse(body);if(!parsed.success)throw new PrivateTransactionInvalidRequest();const request=parsed.data;
    return this.transactions.run(session,workspaceId,request.clientId,[],async tx=>{
      const version=await tx.query(`SELECT version FROM "${this.schema}".private_schema_version WHERE singleton=true`);if(![5,6,7].includes(version.rows[0]?.version))throw new PrivateTransactionUnavailable();
      const heads=await tx.query(`SELECT head_order FROM "${this.schema}".private_page_metadata_heads WHERE workspace_id=$1 FOR SHARE`,[workspaceId]);
      const head=structuredOrderSchema.parse(heads.rowCount?heads.rows[0]!.head_order:'0');
      // Missing heads are valid only for a newly bootstrapped empty workspace.
      const integrity=await tx.query(`SELECT server_order FROM "${this.schema}".private_page_metadata_events WHERE workspace_id=$1 ORDER BY server_order DESC LIMIT 1`,[workspaceId]);
      if((integrity.rows[0]?.server_order??'0')!==head)throw new PrivateTransactionUnavailable();
      const keys=await tx.query(`SELECT secret FROM "${this.schema}".private_structured_config WHERE singleton=true`);if(keys.rowCount!==1)throw new PrivateTransactionUnavailable();const cursor=pageChangesCursor(workspaceId,tx.context.epoch,keys.rows[0]!.secret),after=cursor.decode(request.cursor,head);
      // Titles of deleted resources are never returned. Deletion/tombstone
      // synchronization is a separate contract; a skipped event is no delete ACK.
      const rows=await tx.query(`SELECT server_order,page_id,event FROM "${this.schema}".private_page_metadata_events WHERE workspace_id=$1 AND server_order>$2 AND server_order<=$3 ORDER BY server_order LIMIT $4`,[workspaceId,after.toString(),head,request.limit+1]);
      const all=rows.rows.map((row,index)=>{const event=privatePageChangeSchema.parse(row.event);if(event.order!==row.server_order||event.pageId!==row.page_id||BigInt(event.order)!==after+BigInt(index)+1n)throw new PrivateTransactionUnavailable();return event;});
      const window=all.slice(0,request.limit),hasMore=all.length>request.limit,readOrder=hasMore?window.at(-1)!.order:head;
      if(!hasMore&&(all.at(-1)?.order??after.toString())!==head)throw new PrivateTransactionUnavailable();
      const ids=[...new Set(all.map(e=>e.pageId))];
      const resources=ids.length?await tx.query(`SELECT id,deleted FROM "${this.schema}".private_resources WHERE workspace_id=$1 AND type='page' AND id=ANY($2::uuid[]) FOR SHARE`,[workspaceId,'{'+ids.join(',')+'}']):null;
      if(resources&&resources.rowCount!==ids.length)throw new PrivateTransactionUnavailable();
      const live=new Set(resources?.rows.filter(r=>r.deleted===false).map(r=>r.id));
      const events=window.filter(e=>live.has(e.pageId));
      return privatePageChangesResponseSchema.parse({protocolVersion:1,workspaceId,workspaceEpoch:tx.context.epoch,afterOrder:after.toString(),readOrder,headOrder:head,events,hasMore,cursor:cursor.encode(readOrder)});
    });
  }
}
