import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [sourceList,output,environment]=process.argv.slice(2);
const files=JSON.parse(readFileSync(sourceList,'utf8')),hash=createHash('sha256');
for(const file of files){hash.update(file);hash.update('\0');hash.update(readFileSync(file));}
const sha256=hash.digest('hex');if(sha256!=='c0f39a8a19274ef4150c4c770189fce4b927e21befb9c542bb24402975846205')throw Error('Canonical product source differs');
const report={at:new Date().toISOString(),environment,sourceFiles:files.length,sha256,productSourceMatchesVerified065:true,scope:'Canonical 130 source files only. Probe source/build outputs remain in ignored diagnostic paths; no product imports of the diagnostic module. Source restored after build; no production regression claim.'};
writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
