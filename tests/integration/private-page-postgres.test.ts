import { it,expect,vi } from 'vitest';
import pg from 'pg';
import * as Y from 'yjs';
import { newId } from '@greiva/shared';
import { emptyPageUpdate } from '@greiva/sync';
import { PrivateWorkspaceAccessDenied } from '@greiva/application';
import { installPrivateWorkspaceSchema,verifyPrivateWorkspaceSchema } from '../../apps/api/src/private-workspace-schema.js';
import { installPrivateStructuredSchema } from '../../apps/api/src/private-structured-schema.js';
import { installPrivatePageSchema } from '../../apps/api/src/private-page-schema.js';
import { PostgresPrivateBootstrapStore } from '../../apps/api/src/private-bootstrap-store.js';
import { PostgresPrivatePageStore } from '../../apps/api/src/private-page-store.js';
import { PrivatePageInvalidRequest } from '../../apps/api/src/private-page-codec.js';
import { PrivateTransactionUnavailable } from '../../apps/api/src/private-transactions.js';
import { SessionVerificationError } from '../../apps/api/src/session-verifier.js';
import {pageCatalogCursor} from '../../apps/api/src/private-page-catalog.js';

const real=it.skipIf(process.env.GREIVA_TEST_POSTGRES!=='1');
const actor=(subjectId='owner',issuer='https://auth.fixture.invalid/auth/v1')=>({subjectId,issuer,expiresAt:Math.floor(Date.now()/1000)+300});
async function isolated(run:(pool:pg.Pool,schema:string)=>Promise<void>){const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:8,connectionTimeoutMillis:5000,statement_timeout:5000}),schema='greiva_private_'+newId().replaceAll('-','');try{await installPrivateWorkspaceSchema(pool,schema);await installPrivateStructuredSchema(pool,schema);await run(pool,schema);}finally{try{await pool.query(`DROP SCHEMA "${schema}" CASCADE`);}finally{await pool.end();}}}
function page(text='日本語'){const doc=new Y.Doc({gc:false});Y.applyUpdate(doc,emptyPageUpdate());const paragraph=doc.getXmlFragment('body').get(0) as Y.XmlElement;paragraph.insert(0,[new Y.XmlText(text)]);return doc;}
const encoded=(bytes:Uint8Array)=>Buffer.from(bytes).toString('base64url');
real('PRIVATE-PAGE-CATALOG-PG: keyset pages survive reopen, hide tombstones/foreign owners and bind epoch',async()=>{
  await isolated(async(pool,schema)=>{const f=await fixture(pool,schema);try{
    const ids=[f.id,newId(),newId()].sort();for(const id of ids)await f.store.bootstrap(f.owner,f.binding.workspaceId,id,{...f.request,title:'title '+id});
    const query={protocolVersion:1,clientId:f.binding.clientId,limit:1},first=await f.store.query(f.owner,f.binding.workspaceId,query);expect(first.pages.map(p=>p.id)).toEqual([ids[0]]);expect(first.hasMore).toBe(true);
    const second=await new PostgresPrivatePageStore(pool,schema).query(f.owner,f.binding.workspaceId,{...query,cursor:first.nextCursor});expect(second.pages.map(p=>p.id)).toEqual([ids[1]]);
    const last=await f.store.query(f.owner,f.binding.workspaceId,{...query,cursor:second.nextCursor});expect(last.pages.map(p=>p.id)).toEqual([ids[2]]);expect(last.nextCursor).toBeNull();expect(last.hasMore).toBe(false);
    await pool.query(`UPDATE "${schema}".private_resources SET deleted=true WHERE id=$1`,[ids[1]]);expect((await f.store.query(f.owner,f.binding.workspaceId,{...query,limit:100})).pages.map(p=>p.id)).toEqual([ids[0],ids[2]]);
    const stranger=actor('stranger'),other=await f.bootstrap.bootstrap(stranger,{clientId:newId()});expect((await f.store.query(stranger,other.workspaceId,{protocolVersion:1,clientId:other.clientId})).pages).toEqual([]);
    await expect(f.store.query(stranger,f.binding.workspaceId,{...query,clientId:other.clientId})).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
    await expect(f.store.query(f.owner,f.binding.workspaceId,{...query,cursor:first.nextCursor+'x'})).rejects.toMatchObject({code:'invalid_cursor'});
    const secret=(await pool.query(`SELECT secret FROM "${schema}".private_structured_config`)).rows[0].secret;await expect(f.store.query(f.owner,f.binding.workspaceId,{...query,cursor:pageCatalogCursor(secret,other.workspaceId,other.epoch,ids[0]!)})).rejects.toMatchObject({code:'invalid_cursor'});
    await pool.query(`UPDATE "${schema}".private_workspaces SET epoch=$2 WHERE id=$1`,[f.binding.workspaceId,newId()]);await expect(f.store.query(f.owner,f.binding.workspaceId,{...query,cursor:first.nextCursor})).rejects.toMatchObject({code:'invalid_cursor'});
    await pool.query(`UPDATE "${schema}".private_devices SET revoked=true WHERE id=$1`,[f.binding.clientId]);await expect(f.store.query(f.owner,f.binding.workspaceId,query)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
  }finally{f.doc.destroy();}});
});
real('PRIVATE-PAGE-CATALOG-CORRUPTION-PG: corrupt lookahead refuses partial results without modifying binary or regenerating key',async()=>{
  await isolated(async(pool,schema)=>{const f=await fixture(pool,schema);try{const ids=[f.id,newId()].sort();for(const id of ids)await f.store.bootstrap(f.owner,f.binding.workspaceId,id,f.request);const secret=(await pool.query(`SELECT secret FROM "${schema}".private_structured_config`)).rows[0].secret;
    await pool.query(`UPDATE "${schema}".private_page_documents SET metadata=jsonb_set(metadata,'{yDocId}','"wrong"') WHERE page_id=$1`,[ids[1]]);await expect(f.store.query(f.owner,f.binding.workspaceId,{protocolVersion:1,clientId:f.binding.clientId,limit:1})).rejects.toBeInstanceOf(PrivateTransactionUnavailable);
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_page_updates`)).rows[0].n).toBe(2);expect((await pool.query(`SELECT secret FROM "${schema}".private_structured_config`)).rows[0].secret).toEqual(secret);
  }finally{f.doc.destroy();}});
});
real('PRIVATE-PAGE-CATALOG-EXPIRY-PG: expiry during resource lock wait cannot return metadata',async()=>{
  await isolated(async(pool,schema)=>{let time=Date.now();const clock=vi.spyOn(Date,'now').mockImplementation(()=>time),f=await fixture(pool,schema),blocker=await pool.connect();let pending:ReturnType<typeof f.store.query>|undefined;try{
    await f.create();await blocker.query('BEGIN');await blocker.query(`SELECT id FROM "${schema}".private_resources WHERE id=$1 FOR UPDATE`,[f.id]);pending=f.store.query(f.owner,f.binding.workspaceId,{protocolVersion:1,clientId:f.binding.clientId});void pending.catch(()=>{});
    await expect.poll(async()=>(await pool.query("SELECT 1 FROM pg_stat_activity WHERE query LIKE $1 AND wait_event_type='Lock'",[`SELECT d.page_id%"${schema}".private_page_documents%FOR SHARE OF r`])).rowCount).toBe(1);time+=301000;await blocker.query('COMMIT');await expect(pending).rejects.toBeInstanceOf(SessionVerificationError);expect((await pool.query(`SELECT head_order FROM "${schema}".private_page_documents WHERE page_id=$1`,[f.id])).rows[0].head_order).toBe('1');
  }finally{await blocker.query('ROLLBACK');if(pending)await Promise.allSettled([pending]);blocker.release();clock.mockRestore();f.doc.destroy();}});
});
async function fixture(pool:pg.Pool,schema:string){await installPrivatePageSchema(pool,schema);const owner=actor(),bootstrap=new PostgresPrivateBootstrapStore(pool,schema),binding=await bootstrap.bootstrap(owner,{clientId:newId()}),id=newId(),store=new PostgresPrivatePageStore(pool,schema),doc=page();const request={protocolVersion:1,clientId:binding.clientId,editorSchemaVersion:1,title:'日本語 Page',initialUpdate:encoded(Y.encodeStateAsUpdate(doc))};const create=()=>store.bootstrap(owner,binding.workspaceId,id,request),append=(update:Uint8Array)=>store.append(owner,binding.workspaceId,id,{protocolVersion:1,clientId:binding.clientId,editorSchemaVersion:1,update:encoded(update)}),read=(stateVector='AA')=>store.read(owner,binding.workspaceId,id,{protocolVersion:1,clientId:binding.clientId,editorSchemaVersion:1,stateVector});return{owner,bootstrap,binding,id,store,doc,request,create,append,read};}
real('PRIVATE-PAGE-SCHEMA-PG: explicit upgrade retains structured key/metadata and refuses orphan/partial/reinstall without inventing an empty body',async()=>{
  await isolated(async(pool,schema)=>{
    const binding=await new PostgresPrivateBootstrapStore(pool,schema).bootstrap(actor(),{clientId:newId()}),key=(await pool.query(`SELECT secret FROM "${schema}".private_structured_config`)).rows[0].secret;
    await pool.query(`CREATE TABLE "${schema}".private_page_updates (unexpected boolean)`);await expect(installPrivatePageSchema(pool,schema)).rejects.toThrow();expect(await verifyPrivateWorkspaceSchema(pool,schema)).toBe(2);expect((await pool.query('SELECT 1 FROM information_schema.tables WHERE table_schema=$1 AND table_name=$2',[schema,'private_page_documents'])).rowCount).toBe(0);
    await pool.query(`DROP TABLE "${schema}".private_page_updates`);await installPrivatePageSchema(pool,schema);expect(await verifyPrivateWorkspaceSchema(pool,schema)).toBe(3);await expect(installPrivatePageSchema(pool,schema)).rejects.toThrow();expect((await pool.query(`SELECT secret FROM "${schema}".private_structured_config`)).rows[0].secret).toEqual(key);expect((await pool.query(`SELECT epoch FROM "${schema}".private_workspaces WHERE id=$1`,[binding.workspaceId])).rows[0].epoch).toBe(binding.epoch);
  });
  await isolated(async(pool,schema)=>{const binding=await new PostgresPrivateBootstrapStore(pool,schema).bootstrap(actor(),{clientId:newId()});await pool.query(`INSERT INTO "${schema}".private_resources VALUES('page',$1,$2,false)`,[newId(),binding.workspaceId]);await expect(installPrivatePageSchema(pool,schema)).rejects.toThrow();expect(await verifyPrivateWorkspaceSchema(pool,schema)).toBe(2);});
});
real('PRIVATE-PAGE-BOOTSTRAP-PG: create/retry preserves initial title/binary identity; changed request, foreign owner/device/page and unknown schema are denied',async()=>{
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema);try{
      const first=await f.create();expect(await f.create()).toEqual(first);expect(first.metadata).toMatchObject({title:'日本語 Page',yDocId:`page:${f.id}`});
      await expect(f.store.bootstrap(f.owner,f.binding.workspaceId,f.id,{...f.request,title:'changed'})).rejects.toMatchObject({code:'page_id_reused'});
      await expect(f.store.bootstrap(f.owner,f.binding.workspaceId,f.id,{...f.request,editorSchemaVersion:2})).rejects.toMatchObject({code:'unsupported_document_schema'});
      const other=await f.bootstrap.bootstrap(actor('other'),{clientId:newId()});await expect(f.store.bootstrap(actor('other'),other.workspaceId,f.id,{...f.request,clientId:other.clientId})).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
      await expect(f.store.read(actor('other'),f.binding.workspaceId,f.id,{protocolVersion:1,clientId:other.clientId,editorSchemaVersion:1,stateVector:'AA'})).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
      await expect(f.store.read(actor('owner','https://other.fixture.invalid'),f.binding.workspaceId,f.id,{protocolVersion:1,clientId:f.binding.clientId,editorSchemaVersion:1,stateVector:'AA'})).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
      expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_page_updates`)).rows[0].n).toBe(1);
    }finally{f.doc.destroy();}
  });
});
real('PRIVATE-PAGE-BINARY-PG: duplicate updates retain order; reopen and state-vector diffs converge without losing unknown XML blocks/attrs',async()=>{
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema),peer=new Y.Doc({gc:false});try{
      await f.create();const first=await f.read();Y.applyUpdate(peer,Buffer.from(first.update,'base64url'));const updates:Uint8Array[]=[];f.doc.on('update',value=>updates.push(value));
      const future=new Y.XmlElement('future-block');future.setAttribute('future-value','保持');future.insert(0,[new Y.XmlText('未知の内容')]);f.doc.getXmlFragment('body').insert(1,[future]);const update=updates[0]!;
      const receipt=await f.append(update);expect(receipt).toMatchObject({serverOrder:'2',headOrder:'2'});expect(await f.append(update)).toEqual(receipt);
      const reopened=new PostgresPrivatePageStore(pool,schema),response=await reopened.read(f.owner,f.binding.workspaceId,f.id,{protocolVersion:1,clientId:f.binding.clientId,editorSchemaVersion:1,stateVector:encoded(Y.encodeStateVector(peer))});Y.applyUpdate(peer,Buffer.from(response.update,'base64url'));
      expect(peer.getXmlFragment('body').toString()).toBe(f.doc.getXmlFragment('body').toString());expect(encoded(Y.encodeStateVector(peer))).toBe(response.stateVector);expect(encoded(Y.encodeStateAsUpdate(peer))).toBe(encoded(Y.encodeStateAsUpdate(f.doc)));expect((peer.getXmlFragment('body').get(1) as Y.XmlElement).getAttribute('future-value')).toBe('保持');
      const idle=await f.read(encoded(Y.encodeStateVector(peer)));expect(Buffer.from(idle.update,'base64url')).toEqual(Buffer.from([0,0]));
    }finally{f.doc.destroy();peer.destroy();}
  });
});
real('PRIVATE-PAGE-CAUSAL-PG: out-of-order dependency and deletion frames survive reopening; append-only journal restores all content/clocks',async()=>{
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema),peer=new Y.Doc({gc:false});try{
      await f.create();const updates:Uint8Array[]=[];f.doc.on('update',value=>updates.push(value));const text=(f.doc.getXmlFragment('body').get(0) as Y.XmlElement).get(0) as Y.XmlText;text.insert(text.length,'A');text.insert(text.length,'B');
      await f.append(updates[1]!);const reopened=new PostgresPrivatePageStore(pool,schema);await reopened.append(f.owner,f.binding.workspaceId,f.id,{protocolVersion:1,clientId:f.binding.clientId,editorSchemaVersion:1,update:encoded(updates[0]!)});
      text.delete(0,1);await f.append(updates[2]!);const result=await f.read();Y.applyUpdate(peer,Buffer.from(result.update,'base64url'));expect(peer.getXmlFragment('body').toString()).toBe(f.doc.getXmlFragment('body').toString());expect(encoded(Y.encodeStateVector(peer))).toBe(encoded(Y.encodeStateVector(f.doc)));expect(result.headOrder).toBe('4');expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_page_updates`)).rows[0].n).toBe(4);
    }finally{f.doc.destroy();peer.destroy();}
  });
});
real('PRIVATE-PAGE-CORRUPTION-PG: malformed input never advances head; missing/corrupt journal or orphan document fails closed without reset',async()=>{
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema);try{
      await f.create();await expect(f.store.append(f.owner,f.binding.workspaceId,f.id,{protocolVersion:1,clientId:f.binding.clientId,editorSchemaVersion:1,update:'_w'})).rejects.toBeInstanceOf(PrivatePageInvalidRequest);await expect(f.read('AA=')).rejects.toBeInstanceOf(PrivatePageInvalidRequest);
      expect((await f.read()).headOrder).toBe('1');await pool.query(`UPDATE "${schema}".private_page_updates SET update=decode('ffff','hex') WHERE page_id=$1`,[f.id]);await expect(f.read()).rejects.toBeInstanceOf(PrivateTransactionUnavailable);await expect(f.create()).rejects.toBeInstanceOf(PrivateTransactionUnavailable);expect((await pool.query(`SELECT head_order FROM "${schema}".private_page_documents WHERE page_id=$1`,[f.id])).rows[0].head_order).toBe('1');
      await pool.query(`DELETE FROM "${schema}".private_page_updates WHERE page_id=$1`,[f.id]);await expect(f.read()).rejects.toBeInstanceOf(PrivateTransactionUnavailable);expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_page_updates`)).rows[0].n).toBe(0);
      const orphan=newId();await pool.query(`INSERT INTO "${schema}".private_resources VALUES('page',$1,$2,false)`,[orphan,f.binding.workspaceId]);await expect(f.store.bootstrap(f.owner,f.binding.workspaceId,orphan,f.request)).rejects.toBeInstanceOf(PrivateTransactionUnavailable);expect((await pool.query(`SELECT page_id FROM "${schema}".private_page_documents WHERE page_id=$1`,[orphan])).rowCount).toBe(0);
    }finally{f.doc.destroy();}
  });
});
real('PRIVATE-PAGE-LARGE-DIFF-PG: combined committed updates can exceed the input frame limit and still restore intact',async()=>{
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema),large=page('a'.repeat(300000)),peer=new Y.Doc({gc:false});try{
      const create={...f.request,initialUpdate:encoded(Y.encodeStateAsUpdate(large))};await f.store.bootstrap(f.owner,f.binding.workspaceId,f.id,create);let update:Uint8Array|undefined;large.on('update',value=>{update=value;});const text=(large.getXmlFragment('body').get(0) as Y.XmlElement).get(0) as Y.XmlText;text.insert(text.length,'b'.repeat(300000));await f.append(update!);
      const result=await f.read();expect(Buffer.from(result.update,'base64url').length).toBeGreaterThan(512*1024);Y.applyUpdate(peer,Buffer.from(result.update,'base64url'));expect(((peer.getXmlFragment('body').get(0) as Y.XmlElement).get(0) as Y.XmlText).toString()).toBe('a'.repeat(300000)+'b'.repeat(300000));expect(result.headOrder).toBe('2');
    }finally{f.doc.destroy();large.destroy();peer.destroy();}
  });
});
real('PRIVATE-PAGE-PERMISSION-PG: revoked/deleted resources reject binary read/write; expiry during document lock rolls back before journal append',async()=>{
  await isolated(async(pool,schema)=>{
    let time=Date.now();const clock=vi.spyOn(Date,'now').mockImplementation(()=>time);
    const f=await fixture(pool,schema),blocker=await pool.connect();let pending:ReturnType<typeof f.append>|undefined;
    try{
      await f.create();let update:Uint8Array|undefined;f.doc.on('update',value=>{update=value;});((f.doc.getXmlFragment('body').get(0) as Y.XmlElement).get(0) as Y.XmlText).insert(0,'queued');
      await blocker.query('BEGIN');await blocker.query(`SELECT head_order FROM "${schema}".private_page_documents WHERE page_id=$1 FOR UPDATE`,[f.id]);pending=f.append(update!);void pending.catch(()=>{});
      await expect.poll(async()=>(await pool.query("SELECT 1 FROM pg_stat_activity WHERE query LIKE $1 AND wait_event_type='Lock'",[`SELECT head_order%"${schema}".private_page_documents%FOR UPDATE`])).rowCount).toBe(1);
      time+=301000;await blocker.query('COMMIT');await expect(pending).rejects.toBeInstanceOf(SessionVerificationError);time-=301000;
      expect((await pool.query(`SELECT head_order FROM "${schema}".private_page_documents WHERE page_id=$1`,[f.id])).rows[0].head_order).toBe('1');
      await pool.query(`UPDATE "${schema}".private_devices SET revoked=true WHERE id=$1`,[f.binding.clientId]);await expect(f.append(update!)).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);await expect(f.read()).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
      const peer=await f.bootstrap.bootstrap(f.owner,{clientId:newId()});await pool.query(`UPDATE "${schema}".private_resources SET deleted=true WHERE type='page' AND id=$1`,[f.id]);await expect(f.store.read(f.owner,f.binding.workspaceId,f.id,{protocolVersion:1,clientId:peer.clientId,editorSchemaVersion:1,stateVector:'AA'})).rejects.toBeInstanceOf(PrivateWorkspaceAccessDenied);
      expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_page_updates`)).rows[0].n).toBe(1);
    }finally{await blocker.query('ROLLBACK');if(pending)await Promise.allSettled([pending]);clock.mockRestore();blocker.release();f.doc.destroy();}
  });
});
real('PRIVATE-PAGE-CONCURRENT-PG: six independent edits plus duplicate frames serialize the journal and converge all binary content',async()=>{
  await isolated(async(pool,schema)=>{
    const f=await fixture(pool,schema),peers:Y.Doc[]=[];try{
      await f.create();const initial=Y.encodeStateAsUpdate(f.doc),updates=Array.from({length:6},(_,index)=>{const peer=new Y.Doc({gc:false});peers.push(peer);Y.applyUpdate(peer,initial);let update:Uint8Array|undefined;peer.on('update',value=>{update=value;});((peer.getXmlFragment('body').get(0) as Y.XmlElement).get(0) as Y.XmlText).insert(0,`peer${index}`);return update!;});
      const results=await Promise.all(updates.map(update=>f.append(update)));expect(results.map(row=>BigInt(row.serverOrder)).sort((a,b)=>a<b?-1:1)).toEqual([2n,3n,4n,5n,6n,7n]);
      for(const update of updates)await f.append(update);const response=await f.read();expect(response.headOrder).toBe('7');const full=Buffer.from(response.update,'base64url');
      for(const peer of peers){Y.applyUpdate(peer,full);expect(encoded(Y.encodeStateVector(peer))).toBe(response.stateVector);for(let i=0;i<6;i++)expect(peer.getXmlFragment('body').toString()).toContain(`peer${i}`);}
      expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_page_updates`)).rows[0].n).toBe(7);
    }finally{f.doc.destroy();for(const peer of peers)peer.destroy();}
  });
});
