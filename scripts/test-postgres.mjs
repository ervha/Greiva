import { spawnSync } from 'node:child_process';
import { readdirSync,readFileSync } from 'node:fs';
// Discover every integration suite guarded by the explicit PostgreSQL flag.
// A static list had omitted five later client/runtime/write suites.
const files=readdirSync('tests/integration').filter(name=>name.endsWith('.test.ts'))
  .map(name=>'tests/integration/'+name).filter(file=>readFileSync(file,'utf8').includes('GREIVA_TEST_POSTGRES')).sort();
if(!files.length)throw new Error('No PostgreSQL suites found');
const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',['exec','--','vitest','run',...files],{
  stdio:'inherit',env:{...process.env,GREIVA_TEST_POSTGRES:'1'},shell:process.platform==='win32',
});
process.exit(result.status??1);
