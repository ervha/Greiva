import { it, expect, vi } from 'vitest';
import pg from 'pg';
import { newId } from '@greiva/shared';
import { PrivateWorkspaceAccessDenied } from '@greiva/application';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { PostgresPrivateBootstrapStore } from '../../apps/api/src/private-bootstrap-store.js';
import { installPrivateWorkspaceSchema } from '../../apps/api/src/private-workspace-schema.js';
import { PostgresPrivateTransactions, PrivateTransactionInvalidRequest, PrivateTransactionUnavailable, type PrivateTransaction } from '../../apps/api/src/private-transactions.js';
import { sessionVerifier, SessionVerificationError } from '../../apps/api/src/session-verifier.js';
import { PostgresPrivateAccessStore } from '../../apps/api/src/private-access-store.js';
import { createPrivateApp } from '../../apps/api/src/private-app.js';

const enabled = process.env.GREIVA_TEST_POSTGRES === '1';
const actor = (subjectId = 'owner', issuer = 'https://auth.fixture.invalid/auth/v1') => ({ subjectId, issuer, expiresAt: Math.floor(Date.now()/1000)+300 });
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; };
async function isolated(run: (pool: pg.Pool, schema: string) => Promise<void>) {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 6, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
  const schema = `greiva_private_${newId().replaceAll('-','')}`;
  try {
    await installPrivateWorkspaceSchema(pool,schema);
    await pool.query(`CREATE TABLE "${schema}".test_data (id uuid PRIMARY KEY, workspace_id uuid NOT NULL, value text NOT NULL)`);
    await run(pool,schema);
  } finally { try { await pool.query(`DROP SCHEMA "${schema}" CASCADE`); } finally { await pool.end(); } }
}
async function locked(pool: pg.Pool, pid: number) {
  const deadline = Date.now()+3000;
  do {
    const result = await pool.query('SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))',[pid]);
    if (result.rowCount) return;
    await new Promise(done => setTimeout(done,10));
  } while (Date.now()<deadline);
  throw new Error('Expected actual PostgreSQL lock wait');
}
async function fixture(pool: pg.Pool, schema: string) {
  const owner = actor(), bootstrap = new PostgresPrivateBootstrapStore(pool,schema), binding = await bootstrap.bootstrap(owner,{clientId:newId()}), page = { type:'page' as const, id:newId() };
  await pool.query(`INSERT INTO "${schema}".private_resources(type,id,workspace_id) VALUES($1,$2,$3)`,[page.type,page.id,binding.workspaceId]);
  return { owner, bootstrap, binding, page, transactions:new PostgresPrivateTransactions(pool,schema) };
}
it.skipIf(!enabled)('PRIVATE-TX-PG: issuer/owner/device and typed resource isolation; malformed/duplicate references never run work', async () => {
  await isolated(async (pool,schema) => {
    const f=await fixture(pool,schema), other=await f.bootstrap.bootstrap(actor('other'),{clientId:newId()});
    const access=(owner=f.owner,workspaceId=f.binding.workspaceId,clientId=f.binding.clientId,targets=[f.page]) => f.transactions.run(owner,workspaceId,clientId,targets,async()=>true);
    await expect(access()).resolves.toBe(true);
    await Promise.all([access(actor('other')),access(actor('owner','https://other.fixture.invalid/auth/v1')),access(f.owner,other.workspaceId),access(f.owner,f.binding.workspaceId,other.clientId),access(f.owner,f.binding.workspaceId,newId()),access(f.owner,f.binding.workspaceId,f.binding.clientId,[{...f.page,id:newId()}])].map(request=>expect(request).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied)));
    await expect(f.transactions.run(f.owner,f.binding.workspaceId,f.binding.clientId,[{type:'task',id:f.page.id}],async()=>true)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    await expect(access(f.owner,f.binding.workspaceId,f.binding.clientId,[f.page,f.page])).rejects.toBeInstanceOf(PrivateTransactionInvalidRequest);
    await expect(access(f.owner,'invalid')).rejects.toBeInstanceOf(PrivateTransactionInvalidRequest);
    await pool.query(`UPDATE "${schema}".private_resources SET workspace_id=$1 WHERE id=$2`,[other.workspaceId,f.page.id]);
    await expect(access()).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    await pool.query(`UPDATE "${schema}".private_schema_version SET version=999`);
    await expect(access()).rejects.toBeInstanceOf(PrivateTransactionUnavailable);
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".test_data`)).rows[0].n).toBe(0);
  });
});
it.skipIf(!enabled).each(['device','workspace','resource'] as const)('PRIVATE-TX-PG: admitted write holds %s non-key revocation/tombstone until commit; next transaction denied', async target => {
  await isolated(async (pool,schema) => {
    const f=await fixture(pool,schema), entered=deferred(), finish=deferred(), rowId=newId();
    const update=target==='device' ? `UPDATE "${schema}".private_devices SET revoked=true WHERE id=$1` : target==='workspace' ? `UPDATE "${schema}".private_workspaces SET deleted=true WHERE id=$1` : `UPDATE "${schema}".private_resources SET deleted=true WHERE id=$1`;
    const targetId=target==='device'?f.binding.clientId:target==='workspace'?f.binding.workspaceId:f.page.id;
    const transaction=f.transactions.run(f.owner,f.binding.workspaceId,f.binding.clientId,[f.page],async tx => {
      expect(Object.isFrozen(tx.context)).toBe(true);
      await tx.query(`INSERT INTO "${schema}".test_data VALUES($1,$2,$3)`,[rowId,tx.context.workspaceId,'saved']);
      entered.resolve(); await finish.promise; return tx.context;
    });
    const mutator=await pool.connect(); let change: Promise<pg.QueryResult> | undefined;
    try {
      await entered.promise;
      const pid=(await pool.query(`SELECT pid FROM pg_stat_activity WHERE query LIKE $1 AND state='idle in transaction'`,[`INSERT INTO "${schema}".test_data%`])).rows[0].pid as number;
      change=mutator.query(update,[targetId]); void change.catch(()=>{});
      await locked(pool,pid);
      finish.resolve(); expect(await transaction).toMatchObject(f.binding);
      await change;
      expect((await pool.query(`SELECT value FROM "${schema}".test_data WHERE id=$1`,[rowId])).rows).toEqual([{value:'saved'}]);
      await expect(f.transactions.run(f.owner,f.binding.workspaceId,f.binding.clientId,[f.page],async()=>true)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    } finally { finish.resolve(); await Promise.allSettled([transaction,...(change?[change]:[])]); mutator.release(); }
  });
});
it.skipIf(!enabled).each(['device','workspace','resource'] as const)('PRIVATE-TX-PG: %s change committed before permission lock is observed and denies business work', async target => {
  await isolated(async (pool,schema) => {
    const f=await fixture(pool,schema), mutator=await pool.connect(); let runs=0, transaction:Promise<boolean>|undefined;
    try {
      await mutator.query('BEGIN'); const pid=(await mutator.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;
      const table=target==='device'?'private_devices':target==='workspace'?'private_workspaces':'private_resources', flag=target==='device'?'revoked':'deleted', id=target==='device'?f.binding.clientId:target==='workspace'?f.binding.workspaceId:f.page.id;
      await mutator.query(`UPDATE "${schema}".${table} SET ${flag}=true WHERE id=$1`,[id]);
      transaction=f.transactions.run(f.owner,f.binding.workspaceId,f.binding.clientId,[f.page],async()=>{runs++;return true;}); void transaction.catch(()=>{});
      await locked(pool,pid); await mutator.query('COMMIT');
      await expect(transaction).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied); expect(runs).toBe(0);
    } finally { await mutator.query('ROLLBACK'); if(transaction)await Promise.allSettled([transaction]);mutator.release(); }
  });
});
it.skipIf(!enabled)('PRIVATE-TX-PG: callback failure, swallowed SQL failure and unfinished query roll back; escaped query cannot run after release', async () => {
  await isolated(async (pool,schema) => {
    const f=await fixture(pool,schema); let escaped:PrivateTransaction|undefined;
    const insert=(tx:PrivateTransaction) => tx.query(`INSERT INTO "${schema}".test_data VALUES($1,$2,$3)`,[newId(),f.binding.workspaceId,'rollback']);
    await expect(f.transactions.run(f.owner,f.binding.workspaceId,f.binding.clientId,[],async tx=>{await insert(tx);throw new Error('sensitive SQL detail');})).rejects.toEqual(new PrivateTransactionUnavailable());
    await expect(f.transactions.run(f.owner,f.binding.workspaceId,f.binding.clientId,[],async tx=>{await insert(tx);try{await tx.query('SELECT greiva_missing_function()');}catch{/* deliberately swallowed */}return true;})).rejects.toEqual(new PrivateTransactionUnavailable());
    await expect(f.transactions.run(f.owner,f.binding.workspaceId,f.binding.clientId,[],async tx=>{void tx.query(`INSERT INTO "${schema}".test_data SELECT $1,$2,$3 FROM pg_sleep(0.03)`,[newId(),f.binding.workspaceId,'unfinished']);return true;})).rejects.toBeInstanceOf(PrivateTransactionUnavailable);
    await f.transactions.run(f.owner,f.binding.workspaceId,f.binding.clientId,[],async tx=>{escaped=tx;return true;});
    await expect(insert(escaped!)).rejects.toBeInstanceOf(PrivateTransactionUnavailable);
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".test_data`)).rows[0].n).toBe(0);
  });
});
it.skipIf(!enabled)('PRIVATE-TX-PG: expiry during lock wait or before commit denies and rolls back; captured identity and targets survive caller mutation', async () => {
  await isolated(async (pool,schema) => {
    const f=await fixture(pool,schema); let time=Date.now(); const txs=new PostgresPrivateTransactions(pool,schema,()=>time), owner={...f.owner,expiresAt:Math.floor(time/1000)+2};
    await expect(txs.run(owner,f.binding.workspaceId,f.binding.clientId,[],async tx=>{await tx.query(`INSERT INTO "${schema}".test_data VALUES($1,$2,$3)`,[newId(),f.binding.workspaceId,'expired']);time+=3000;return true;})).rejects.toBeInstanceOf(SessionVerificationError);
    time=Date.now(); owner.expiresAt=Math.floor(time/1000)+2;
    const mutator=await pool.connect();let transaction:Promise<boolean>|undefined;
    try {
      await mutator.query('BEGIN');const pid=(await mutator.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;
      await mutator.query(`SELECT id FROM "${schema}".private_devices WHERE id=$1 FOR UPDATE`,[f.binding.clientId]);
      let runs=0; transaction=txs.run(owner,f.binding.workspaceId,f.binding.clientId,[f.page],async()=>{runs++;return true;});void transaction.catch(()=>{});
      await locked(pool,pid);time+=3000;await mutator.query('COMMIT');await expect(transaction).rejects.toBeInstanceOf(SessionVerificationError);expect(runs).toBe(0);
      time=Date.now();owner.expiresAt=Math.floor(time/1000)+300;const target={...f.page};
      await mutator.query('BEGIN');await mutator.query(`SELECT id FROM "${schema}".private_devices WHERE id=$1 FOR UPDATE`,[f.binding.clientId]);
      transaction=txs.run(owner,f.binding.workspaceId,f.binding.clientId,[target],async tx=>{expect(tx.context.subjectId).toBe('owner');return true;});void transaction.catch(()=>{});
      await locked(pool,pid);owner.subjectId='attacker';owner.issuer='https://other.fixture.invalid';owner.expiresAt=0;target.id=newId();await mutator.query('COMMIT');await expect(transaction).resolves.toBe(true);
    } finally {await mutator.query('ROLLBACK');if(transaction)await Promise.allSettled([transaction]);mutator.release();}
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".test_data`)).rows[0].n).toBe(0);
  });
});
it.skipIf(!enabled)('PRIVATE-DEVICE-HTTP-PG: signed device access checks owner, registration, revocation and schema; no old sync route mounted', async () => {
  await isolated(async (pool,schema) => {
    const f=await fixture(pool,schema),issuer=f.owner.issuer,keys=await generateKeyPair('ES256',{extractable:true}),jwk={...await exportJWK(keys.publicKey),kid:'fixture',alg:'ES256'};
    const verifier=sessionVerifier({issuer,audience:'authenticated',jwksUrl:issuer+'/.well-known/jwks.json',algorithms:['ES256']},async()=>new Response(JSON.stringify({keys:[jwk]})));
    const app=await createPrivateApp(verifier,new PostgresPrivateAccessStore(pool,schema),f.bootstrap,f.transactions);
    try {
      await app.listen(0,'127.0.0.1');const base=await app.getUrl(),jwt=(sub:string)=>new SignJWT({sub,iss:issuer,aud:'authenticated',exp:Math.floor(Date.now()/1000)+300}).setProtectedHeader({alg:'ES256',kid:'fixture'}).sign(keys.privateKey),owner=await jwt('owner'),other=await jwt('other');
      const access=(token?:string,clientId=f.binding.clientId)=>fetch(base+`/v1/workspaces/${f.binding.workspaceId}/devices/${clientId}/access`,{headers:token?{authorization:'Bearer '+token}:{}});
      expect((await access()).status).toBe(401);expect((await access(other)).status).toBe(403);expect((await access(owner,'invalid')).status).toBe(400);
      const success=await access(owner);expect(success.status).toBe(200);expect(await success.json()).toEqual(f.binding);
      expect((await fetch(base+'/sync/pull')).status).toBe(404);
      await pool.query(`UPDATE "${schema}".private_devices SET revoked=true WHERE id=$1`,[f.binding.clientId]);const denied=await access(owner);expect(denied.status).toBe(403);expect(await denied.json()).toEqual({error:'access_denied'});
      await pool.query(`UPDATE "${schema}".private_schema_version SET version=999`);const unavailable=await access(owner);expect(unavailable.status).toBe(503);expect(await unavailable.json()).toEqual({error:'transaction_unavailable'});
    } finally {await app.close();}
  });
});
it.skipIf(!enabled)('PRIVATE-BOOTSTRAP-EXPIRY-PG: expiry during owner lock wait rolls back a new device registration', async () => {
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema),mutator=await pool.connect(),clientId=newId(),time=Date.now(),owner={...f.owner,expiresAt:Math.floor(time/1000)+1};
    let registration:ReturnType<PostgresPrivateBootstrapStore['bootstrap']>|undefined,clock:ReturnType<typeof vi.spyOn>|undefined;
    try {
      await mutator.query('BEGIN');const pid=(await mutator.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;
      await mutator.query(`SELECT id FROM "${schema}".private_workspaces WHERE id=$1 FOR UPDATE`,[f.binding.workspaceId]);
      registration=f.bootstrap.bootstrap(owner,{clientId});void registration.catch(()=>{});await locked(pool,pid);
      clock=vi.spyOn(Date,'now').mockReturnValue(time+2000);await mutator.query('COMMIT');
      await expect(registration).rejects.toBeInstanceOf(SessionVerificationError);
      expect((await pool.query(`SELECT id FROM "${schema}".private_devices WHERE id=$1`,[clientId])).rowCount).toBe(0);
    } finally {await mutator.query('ROLLBACK');if(registration)await Promise.allSettled([registration]);clock?.mockRestore();mutator.release();}
  });
});
