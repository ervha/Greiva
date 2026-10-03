import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {cpus,platform,release} from 'node:os';
import pg from 'pg';
import {newId} from '@greiva/shared';
if(!process.env.DATABASE_URL) throw new Error('Performance tests require the Docker PostgreSQL DATABASE_URL');
const directory=resolve(process.env.GREIVA_EVIDENCE_DIR ?? `tests/evidence/runs/performance-${new Date().toISOString().replaceAll(':','-')}`);
mkdirSync(directory,{recursive:true});
const schema=`greiva_test_${newId().replaceAll('-','')}`;
const env={...process.env,GREIVA_EVIDENCE_DIR:directory,GREIVA_DB_SCHEMA:schema,
  GREIVA_TEST_STORE_DIR:`../../.data/${schema}-stores`,
  GREIVA_STORE_DRIVER:'../../.data/performance-target/release/examples/store-driver',
  COLLABORATION_DATA_DIR:resolve(`.data/${schema}-collaboration`),
  VITE_GREIVA_TEST_HOOKS:'1',VITE_GREIVA_TEST_SQLITE:'1'};
const results=[];
function run(id,command,args){
  const start=new Date().toISOString();
  const result=spawnSync(command,args,{env,encoding:'utf8',maxBuffer:64*1024*1024});
  writeFileSync(`${directory}/${id}.log`,`${result.stdout??''}${result.stderr??''}${result.error?.message??''}`);
  results.push({id,command:[command,...args],startedAt:start,finishedAt:new Date().toISOString(),exitCode:result.status,signal:result.signal});
  console.log(`${id}: ${result.status===0 ? 'Pass':'Fail'}`);return result.status===0;
}
const admin=new pg.Client({connectionString:env.DATABASE_URL});await admin.connect();
try {
  const built=run('PERF-STORE-RELEASE','cargo',['build','--release','--locked','--manifest-path','apps/client/src-tauri/crates/page-store/Cargo.toml','--example','store-driver','--target-dir','.data/performance-target']) &&
    run('PERF-BUILD-PACKAGES','npm',['run','build:packages']) && run('PERF-BUILD-SERVERS','npm',['run','build:servers']) &&
    run('PERF-BUILD-CLIENT','npm',['exec','-w','@greiva/client','--','vite','build','--outDir','dist-performance']);
  if(built) run('PERF-PLAYWRIGHT','npm',['exec','--','playwright','test','--config=playwright.performance.config.ts',...process.argv.slice(2)]);
} finally {
  await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  const remaining=await admin.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[schema]);
  await admin.end();
  writeFileSync(`${directory}/environment.json`,JSON.stringify({capturedAt:new Date().toISOString(),version:readFileSync('VERSION','utf8').trim(),
    platform:platform(),os:release(),cpu:cpus()[0]?.model,node:process.version,schema,remainingSchemas:remaining.rowCount,results,
    build:'Vite production bundle with read-only diagnostics and test-only Rust bridge; release Rust repository. Not a Windows Tauri release startup measurement.',
    scope:'Navigation/startup, 1000-block restore and actual key input, 100 Yjs edits/reconnect, 1000 durable Task operations through the actual UI sync engine. No native IME or mobile OS claim.'},null,2));
  if(remaining.rowCount!==0) throw new Error('Owned performance schema cleanup failed');
  process.exitCode=results.some(result=>result.exitCode!==0) || !results.some(result=>result.id==='PERF-PLAYWRIGHT') ? 1:0;
}
