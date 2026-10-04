import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

assert(fs.existsSync('/.dockerenv'), 'Run this diagnostic in the development Docker container');
const directory=path.resolve(process.argv[2]??`.data/render-isolation-${Date.now()}`);
assert(!fs.existsSync(directory), 'Refusing an existing diagnostic directory');
fs.mkdirSync(directory,{recursive:true});
const files=['apps/client/src/editor/PageEditor.tsx','apps/client/src/structured/TaskPanel.tsx'];
const originals=files.map(file=>fs.readFileSync(file));
for(let i=0;i<files.length;i++){
  assert(!originals[i].includes('greivaRenderProbe'), 'Source already contains a render probe');
  fs.writeFileSync(path.join(directory,`original-${i}.tsx`),originals[i]);
}
const results=[];
try {
  for(const variant of ['legacy','memo']){
    for(const [index,file] of files.entries()){
      const name=index===0?'PageEditor':'TaskPanel';let source=originals[index].toString();
      if(variant==='legacy'){
        assert(source.includes(`export const ${name} = memo(function ${name}`));
        source=source.replace(`export const ${name} = memo(function ${name}`,`export function ${name}`).replace(/\}\);\s*$/,'}\n');
      }
      const needle=index===0?'  // Save/ACK indicators':'  const store = useMemo';assert(source.includes(needle));
      const probe=`  const probe = (window as unknown as {greivaRenderProbe?:Record<string,number>}).greivaRenderProbe ??= {}; probe.${name}=(probe.${name}??0)+1;\n`;
      fs.writeFileSync(file,source.replace(needle,probe+needle));
    }
    const output=path.join(directory,variant);fs.mkdirSync(output);
    const result=spawnSync('npm',['exec','--','playwright','test','--config=playwright.render-diagnostic.config.ts'],{
      encoding:'utf8',maxBuffer:128*1024*1024,
      env:{...process.env,GREIVA_EVIDENCE_DIR:output,GREIVA_EXPECT_RENDER_ISOLATION:variant==='memo'?'1':'0'},
    });
    fs.writeFileSync(path.join(output,'run.log'),(result.stdout??'')+(result.stderr??'')+(result.error?.message??''));
    results.push({variant,exit:result.status});console.log(`${variant}: ${result.status}`);
    assert.equal(result.status,0,`${variant} diagnostic failed`);
  }
} finally {
  for(const [index,file] of files.entries())fs.writeFileSync(file,originals[index]);
  const hashes=files.map((file,index)=>{
    assert(fs.readFileSync(file).equals(originals[index]));
    return {file,sha256:createHash('sha256').update(originals[index]).digest('hex')};
  });
  fs.writeFileSync(path.join(directory,'source-restored.json'),JSON.stringify({results,hashes,diagnosticSourcesRestored:true},null,2)+'\n');
}
