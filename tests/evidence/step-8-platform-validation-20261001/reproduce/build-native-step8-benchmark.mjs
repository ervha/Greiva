import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const directory='/evidence/step8-native-benchmark-0.6.5';
mkdirSync(directory,{recursive:true});
const inventory=JSON.parse(readFileSync('/evidence/2026-10-01T09-55-17.294Z/source-files.json','utf8'));
const hash=createHash('sha256');
for(const file of inventory){hash.update(file);hash.update('\0');hash.update(readFileSync(file));}
const sourceSha256=hash.digest('hex');
if(sourceSha256!=='c0f39a8a19274ef4150c4c770189fce4b927e21befb9c542bb24402975846205'||readFileSync('VERSION','utf8').trim()!=='0.6.5')throw Error('Source/version mismatch');
const override={identifier:'dev.greiva.poc.bench20261001',app:{windows:[{label:'main',title:'Greiva PoC',width:1000,height:700,url:'index.html?page=01a0f900-0000-7000-8000-000000000001'}]}};
const env={...process.env,VITE_GREIVA_TEST_HOOKS:'0',VITE_GREIVA_TEST_SQLITE:'0',CARGO_BUILD_JOBS:'2',TAURI_CONFIG:JSON.stringify(override)};
const results=[];
function run(id,command,args){
 const startedAt=new Date().toISOString(); const r=spawnSync(command,args,{env,encoding:'utf8',maxBuffer:128*1024*1024});
 writeFileSync(`${directory}/${id}.log`,`${r.stdout??''}${r.stderr??''}${r.error?.message??''}`);
 results.push({id,command:[command,...args],startedAt,finishedAt:new Date().toISOString(),exitCode:r.status,signal:r.signal});
 console.log(`${id}: ${r.status===0?'Pass':'Fail'}`);return r;
}
let artifact=null,features=null;
try{
 if(run('RELEASE-FRONTEND','npm',['run','build']).status===0){
  const graph=run('RELEASE-FEATURES','cargo',['metadata','--offline','--locked','--format-version','1','--manifest-path','apps/client/src-tauri/Cargo.toml','--filter-platform','x86_64-pc-windows-msvc','--features','custom-protocol']);
  if(graph.status===0){
   const metadata=JSON.parse(graph.stdout),pkg=metadata.packages.find(p=>p.name==='greiva-page-store');
   features=metadata.resolve.nodes.find(n=>n.id===pkg.id).features;
   if(features.includes('crash-test-hooks'))throw Error('Crash hooks enabled');
   if(run('RELEASE-CROSS-BUILD','cargo',['xwin','build','--release','--offline','--locked','--manifest-path','apps/client/src-tauri/Cargo.toml','--target','x86_64-pc-windows-msvc','--features','custom-protocol','--target-dir','.data/windows-target']).status===0){
    const path='.data/windows-target/x86_64-pc-windows-msvc/release/greiva-poc.exe';
    artifact={path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),bytes:statSync(path).size};
   }
  }
 }
}finally{
 writeFileSync(`${directory}/build.json`,JSON.stringify({capturedAt:new Date().toISOString(),version:'0.6.5',checkpointCommit:'c6b1c8bde39996cd7b5bcbca5f737b6106789680',sourceSha256,sourceFileCount:inventory.length,scope:'Configuration-only isolated Windows release benchmark variant. Identifier and initial Page URL overridden; normal production frontend and native implementation. Actual startup observations are separate.',configurationOverride:override,testFrontendFlags:0,storeFeatures:features,artifact,results},null,2));
 console.log(JSON.stringify({artifact,sourceSha256}));process.exitCode=artifact?0:1;
}
