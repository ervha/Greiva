import { it, expect, vi } from 'vitest';
import type pg from 'pg';
import { newId } from '@greiva/shared';
import { PostgresPrivateTransactions, PrivateTransactionInvalidRequest, PrivateTransactionUnavailable } from '../../apps/api/src/private-transactions.js';
import { SessionVerificationError } from '../../apps/api/src/session-verifier.js';

function fixture() {
  const workspaceId=newId(),clientId=newId(),epoch=newId(),session={issuer:'https://auth.fixture.invalid',subjectId:'owner',expiresAt:100};
  const query=vi.fn(async (sql:string) => {
    const rows=sql.includes('private_schema_version')?[{version:1}]:sql.includes('private_workspaces')?[{owner_issuer:session.issuer,owner_subject_id:session.subjectId,epoch,deleted:false}]:sql.includes('private_devices')?[{workspace_id:workspaceId,revoked:false}]:[];
    return {rows,rowCount:rows.length};
  });
  const release=vi.fn(),client={query,release},connect=vi.fn(async()=>client),pool={connect} as unknown as pg.Pool;
  return {workspaceId,clientId,epoch,session,query,release,connect,pool};
}
it('PRIVATE-TX: malformed scope, duplicate targets and expired identity reject before obtaining a connection', async()=>{
  const f=fixture(),txs=new PostgresPrivateTransactions(f.pool,'greiva_private_fixture',()=>0),ref={type:'page' as const,id:newId()};
  await expect(txs.run(f.session,'invalid',f.clientId,[],async()=>true)).rejects.toBeInstanceOf(PrivateTransactionInvalidRequest);
  await expect(txs.run(f.session,f.workspaceId,f.clientId,[ref,ref],async()=>true)).rejects.toBeInstanceOf(PrivateTransactionInvalidRequest);
  await expect(txs.run({...f.session,expiresAt:0},f.workspaceId,f.clientId,[],async()=>true)).rejects.toBeInstanceOf(SessionVerificationError);
  expect(f.connect).not.toHaveBeenCalled();
});
it('PRIVATE-TX: expiry while acquiring pool connection prevents BEGIN and releases the borrowed client', async()=>{
  const f=fixture();let time=0;f.connect.mockImplementation(async()=>{time=101000;return{query:f.query,release:f.release};});
  await expect(new PostgresPrivateTransactions(f.pool,'greiva_private_fixture',()=>time).access(f.session,f.workspaceId,f.clientId)).rejects.toBeInstanceOf(SessionVerificationError);
  expect(f.query.mock.calls.map(call=>call[0])).toEqual(['ROLLBACK']);expect(f.release).toHaveBeenCalledWith(false);
});
it('PRIVATE-TX: failed rollback destroys the client and suppresses driver details', async()=>{
  const f=fixture();f.query.mockImplementation(async()=>{throw new Error('private driver detail');});
  await expect(new PostgresPrivateTransactions(f.pool,'greiva_private_fixture',()=>0).access(f.session,f.workspaceId,f.clientId)).rejects.toEqual(new PrivateTransactionUnavailable());
  expect(f.release).toHaveBeenCalledWith(true);
});
it('PRIVATE-TX: unknown COMMIT result is sanitized and never replays business work', async()=>{
  const f=fixture(),original=f.query.getMockImplementation()!;f.query.mockImplementation(async sql=>{if(sql==='COMMIT')throw new Error('commit reply lost');return original(sql);});
  const work=vi.fn(async()=>true),txs=new PostgresPrivateTransactions(f.pool,'greiva_private_fixture',()=>0);
  await expect(txs.run(f.session,f.workspaceId,f.clientId,[],work)).rejects.toMatchObject({message:'Private transaction unavailable',outcome:'unknown'});
  expect(work).toHaveBeenCalledTimes(1);expect(f.query.mock.calls.filter(call=>call[0]==='COMMIT')).toHaveLength(1);expect(f.release).toHaveBeenCalledWith(false);
});
