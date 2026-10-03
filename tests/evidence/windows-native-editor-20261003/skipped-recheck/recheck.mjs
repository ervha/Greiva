import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const dir='/tmp/greiva-skips-0617';
mkdirSync(dir,{recursive:true});
const run={startedAt:new Date().toISOString(),product:JSON.parse(readFileSync('package.json')).version,execution:'Docker greiva-step7-crash-work; isolated test schemas',databaseConfigured:Boolean(process.env.DATABASE_URL),results:[]};
const steps=[['packages',['run','build:packages']],['servers',['run','build:servers']],['postgres',['exec','--','vitest','run','tests/integration/postgres.test.ts','tests/integration/structured-postgres.test.ts','tests/integration/structured-sync-server.test.ts','tests/integration/structured-sync-client.test.ts','tests/integration/structured-process-crash.test.ts','--reporter=default','--reporter=json',`--outputFile.json=${dir}/vitest.json`]]];
for(const [id,args] of steps){
 const start=new Date().toISOString();
 const r=spawnSync('npm',args,{env:{...process.env,GREIVA_TEST_POSTGRES:'1'},encoding:'utf8',maxBuffer:32*1024*1024});
 writeFileSync(`${dir}/${id}.log`,`${r.stdout??''}${r.stderr??''}`);
 run.results.push({id,command:['npm',...args],startedAt:start,finishedAt:new Date().toISOString(),exitCode:r.status});
 console.log(`${id}: ${r.status===0?'Pass':'Fail'}`);
 if(r.status!==0)break;
}
run.finishedAt=new Date().toISOString();
writeFileSync(`${dir}/run.json`,JSON.stringify(run,null,2));
process.exitCode=run.results.length!==steps.length||run.results.some(r=>r.exitCode!==0)?1:0;
