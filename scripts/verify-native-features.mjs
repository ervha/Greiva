import {spawnSync} from 'node:child_process';
const args=['metadata','--locked','--format-version','1','--manifest-path','apps/client/src-tauri/Cargo.toml'];
const result=spawnSync('cargo',args,{encoding:'utf8',maxBuffer:32*1024*1024});
if(result.status!==0) {process.stderr.write(result.stderr??'');process.exit(result.status??1);}
const metadata=JSON.parse(result.stdout);
const root=metadata.packages.find(value=>value.id===metadata.resolve.root);
const store=metadata.packages.find(value=>value.name==='greiva-page-store');
if(root?.name!=='greiva-poc' || !store) throw new Error('Unexpected native dependency graph');
const features=metadata.resolve.nodes.find(value=>value.id===store.id)?.features;
if(!features || features.includes('crash-test-hooks')) throw new Error('Crash barrier is enabled in the normal Tauri dependency graph');
console.log(JSON.stringify({root:root.name,rootVersion:root.version,store:store.name,storeVersion:store.version,storeFeatures:features,crashBarrierEnabled:false,args},null,2));
