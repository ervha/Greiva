import {it,expect} from 'vitest';
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import pg from 'pg';
import {newId} from '@greiva/shared';
import type {PushOperation,PushResult} from '@greiva/protocol';
import {StructuredSyncEngine,httpStructuredTransport,type StructuredReport} from '@greiva/sync';
import {StructuredDevice} from '../support/structured-device.js';
import {StructuredRepository} from '../../apps/api/dist/structured-repository.js';

const real=it.skipIf(process.env.GREIVA_TEST_POSTGRES!=='1');
const url=process.env.DATABASE_URL ?? '';
for(const boundary of ['before-commit','after-commit'] as const) {
  real(`STEP7-API-SIGKILL-${boundary}: an actual API process crash preserves immutable wire, cursor and exactly one final operation`,async()=> {
    const directory=mkdtempSync(join(tmpdir(),'greiva-api-crash-'));
    const schema=`greiva_test_${newId().replaceAll('-','')}`;
    const admin=new pg.Client({connectionString:url}); await admin.connect();
    const blocker=new pg.Client({connectionString:url}); await blocker.connect();
    const repository=await StructuredRepository.open(url,schema);
    const device=new StructuredDevice(join(directory,'device.sqlite'));
    const peer=new StructuredDevice(join(directory,'peer.sqlite'));
    const children:ChildProcessWithoutNullStreams[]=[];
    const engines:StructuredSyncEngine[]=[];
    const kills:unknown[]=[];
    let releaseResponse=()=>{};
    let port='0'; let address=''; let locked=false;
    async function startApi() {
      const child=spawn(process.execPath,[resolve('apps/api/dist/main.js')],{env:{...process.env,DATABASE_URL:url,GREIVA_DB_SCHEMA:schema,API_HOST:'127.0.0.1',API_PORT:port},stdio:['pipe','pipe','pipe']});
      children.push(child); let stderr=''; child.stderr.on('data',data=> {stderr+=String(data);});
      address=await new Promise<string>((done,reject)=> {
        const timeout=setTimeout(()=>reject(new Error(`API startup timeout: ${stderr}`)),10_000);
        const lines=createInterface({input:child.stdout});
        lines.on('line',line=> {
          let event: {event?:string;address?:string}; try {event=JSON.parse(line) as typeof event;} catch {return;}
          if(event.event==='listening' && event.address) {clearTimeout(timeout);done(event.address);}
        });
        child.once('error',error=> {clearTimeout(timeout);reject(error);});
        child.once('exit',(code,signal)=> {clearTimeout(timeout);lines.close();reject(new Error(`API exited ${code ?? signal}: ${stderr}`));});
      });
      port=new URL(address).port; return child;
    }
    async function kill(child:ChildProcessWithoutNullStreams) {
      if(child.exitCode!==null || child.signalCode!==null) return;
      const exited=new Promise<NodeJS.Signals|null>(done=>child.once('exit',(_code,signal)=>done(signal)));
      expect(child.pid).toBeGreaterThan(0); child.kill('SIGKILL');
      const signal=await exited; expect(signal).toBe('SIGKILL');
      kills.push({pid:child.pid,signal,at:new Date().toISOString()});
    }
    try {
      const clientId=newId(); await device.request('structured-client-id',{candidate:clientId});
      await peer.request('structured-client-id',{candidate:newId()});
      const create:PushOperation={operationId:newId(),clientId,entityId:newId(),entityType:'task',kind:'create',baseVersion:null,payload:{title:'API process crash',status:'todo',due:null}};
      await device.mutate(create); const prepared=await device.prepare(); expect(prepared).toEqual(create);
      const child=await startApi(); const state={latest:null as StructuredReport|null};
      const entered=new Promise<void>(done=> {
        releaseResponse=done;
      });
      let committed=()=>{};
      const commitSeen=new Promise<void>(done=> {committed=done;});
      const transport=httpStructuredTransport(address,async(input,init)=> {
        const response=await fetch(input,init);
        if(boundary==='after-commit' && String(input).endsWith('/push')) {
          await response.clone().json(); committed(); await entered;
          throw new TypeError('ACK intentionally lost after actual API process SIGKILL');
        }
        return response;
      });
      if(boundary==='before-commit') {
        await blocker.query('BEGIN'); locked=true;
        await blocker.query(`SELECT last_sequence FROM "${schema}".stream_state WHERE singleton=1 FOR UPDATE`);
      }
      const first=new StructuredSyncEngine(device,transport,report=> {state.latest=report;},{pollMs:100}); engines.push(first); first.start();
      if(boundary==='before-commit') {
        await expect.poll(async()=> (await admin.query("SELECT pid FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE $1",[`%${schema}%FOR UPDATE%`])).rowCount,{timeout:10_000}).toBe(1);
        expect((await repository.pull(null)).operations).toEqual([]);
      } else {
        await commitSeen;
        const durable=(await repository.pull(null)).operations;
        expect(durable.map(operation=>operation.operationId)).toEqual([create.operationId]);
        expect(state.latest?.phase).not.toBe('synced');
      }
      const originalCursor=(await device.snapshot()).state.cursor;
      await kill(child); releaseResponse();
      if(locked) {await blocker.query('ROLLBACK');locked=false;}
      await expect.poll(()=>state.latest?.phase,{timeout:10_000}).toBe('retrying'); first.stop();
      expect(await device.prepare()).toEqual(prepared);
      expect((await device.snapshot()).state.cursor).toBe(originalCursor);
      expect((await device.snapshot()).operations[0]?.status).toBe('pending');
      await device.close('SIGKILL'); expect(await device.prepare()).toEqual(prepared);
      await startApi();
      const recovered={latest:null as StructuredReport|null};
      const second=new StructuredSyncEngine(device,httpStructuredTransport(address),report=> {recovered.latest=report;},{pollMs:100}); engines.push(second);second.start();
      await expect.poll(()=>recovered.latest?.phase,{timeout:12_000}).toBe('synced');
      const peerState={latest:null as StructuredReport|null};
      const third=new StructuredSyncEngine(peer,httpStructuredTransport(address),report=> {peerState.latest=report;},{pollMs:100});engines.push(third);third.start();
      await expect.poll(()=>peerState.latest?.phase,{timeout:12_000}).toBe('synced');
      const local=await device.snapshot(); const remote=await peer.snapshot();
      expect(local.tasks).toEqual(remote.tasks); expect(local.tasks).toEqual(await repository.tasks(true));
      const stream=await repository.pull(null); expect(stream.operations).toHaveLength(1);
      expect(stream.operations[0]).toMatchObject({operationId:create.operationId,status:'acknowledged',serverOrder:'1'} satisfies Partial<PushResult>);
      expect(local.operations[0]?.status).toBe('acknowledged'); expect(local.state.cursor).toBe(stream.headCursor);
      if(process.env.GREIVA_EVIDENCE_DIR) {
        mkdirSync(process.env.GREIVA_EVIDENCE_DIR,{recursive:true});
        writeFileSync(join(process.env.GREIVA_EVIDENCE_DIR,`api-sigkill-${boundary}.json`),JSON.stringify({boundary,kills,prepared,originalCursor,local,remote,stream},null,2));
      }
    } finally {
      releaseResponse(); for(const engine of engines) engine.stop();
      for(const child of children) await kill(child);
      if(locked) await blocker.query('ROLLBACK');
      await device.close(); await peer.close(); await repository.close(); await blocker.end();
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end();
      rmSync(directory,{recursive:true,force:true});
    }
  },40_000);
}
