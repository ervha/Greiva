import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const directory='/tmp/native-release-0611';mkdirSync(directory,{recursive:true});
const inventory=JSON.parse(readFileSync('/tmp/native-release-source-inventory.json','utf8'));
for(const file of inventory){const sha256=createHash('sha256').update(readFileSync(file.path)).digest('hex');if(sha256!==file.sha256)throw Error(`Source mismatch: ${file.path}`);}
const override={identifier:'dev.greiva.poc.bench20261003v611',app:{windows:[{label:'main',title:'Greiva PoC',width:1000,height:700,url:'index.html?page=01a10230-0000-7000-8000-000000000001'}]}};
const env={...process.env,VITE_GREIVA_TEST_HOOKS:'0',VITE_GREIVA_TEST_SQLITE:'0',CARGO_BUILD_JOBS:'2',TAURI_CONFIG:JSON.stringify(override)};
const results=[];let artifact=null,features=null;
function run(id,command,args){const startedAt=new Date().toISOString();const result=spawnSync(command,args,{env,encoding:'utf8',maxBuffer:128*1024*1024});writeFileSync(`${directory}/${id}.log`,`${result.stdout??''}${result.stderr??''}${result.error?.message??''}`);results.push({id,command:[command,...args],startedAt,finishedAt:new Date().toISOString(),exitCode:result.status,signal:result.signal});console.log(`${id}: ${result.status===0?'Pass':'Fail'}`);return result;}
try{
 if(run('RELEASE-FRONTEND','npm',['run','build']).status===0){
  const graph=run('RELEASE-FEATURES','cargo',['metadata','--offline','--locked','--format-version','1','--manifest-path','apps/client/src-tauri/Cargo.toml','--filter-platform','x86_64-pc-windows-msvc','--features','custom-protocol']);
  if(graph.status===0){const meta=JSON.parse(graph.stdout),pkg=meta.packages.find(p=>p.name==='greiva-page-store');features=meta.resolve.nodes.find(n=>n.id===pkg.id).features;if(features.includes('crash-test-hooks'))throw Error('Crash hooks enabled');
   if(run('RELEASE-CROSS-BUILD','cargo',['xwin','build','--release','--offline','--locked','--manifest-path','apps/client/src-tauri/Cargo.toml','--target','x86_64-pc-windows-msvc','--features','custom-protocol','--target-dir','.data/windows-target']).status===0){const path='.data/windows-target/x86_64-pc-windows-msvc/release/greiva-poc.exe';artifact={path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),bytes:statSync(path).size};}
  }
 }
}finally{writeFileSync(`${directory}/build.json`,JSON.stringify({at:new Date().toISOString(),version:'0.6.11',checkpoint:'d55044e4b660c3c26e774bf1111de5a619a685eb',configurationOverride:override,scope:'Configuration-only isolated native release candidate; normal product code, embedded frontend, no test hooks. Host observations are separate.',sourceFiles:inventory,testFrontendFlags:0,storeFeatures:features,artifact,results},null,2)+'\n');console.log(JSON.stringify({artifact}));process.exitCode=artifact?0:1;}
