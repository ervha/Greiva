import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as Y from '/workspace/node_modules/yjs/dist/yjs.mjs';
import {createHash} from 'node:crypto';
const fixture=JSON.parse(fs.readFileSync('/tmp/windows-native-fixture.json'));
const report=JSON.parse(fs.readFileSync('/tmp/windows-native-report.json'));
const results=report.results.map(result=>{
 const doc=new Y.Doc();for(const update of result.pageUpdates)Y.applyUpdate(doc,Uint8Array.from(update));
 const xml=doc.getXmlFragment('body').toString();assert.equal(xml,result.name==='page-precommit'?fixture.changedXml:fixture.initialXml);
 assert.equal(doc.getXmlFragment('body').length,3);
 assert.equal(result.recoveredSnapshot.operations.length,3);assert(result.recoveredSnapshot.operations.every(operation=>operation.status==='pending'));
 if(result.after){assert.equal(result.after.tasks.length,2);assert.equal(result.after.state.cursor,'native-cursor-1');assert.equal(result.after.operations.length,3);}
 const output={name:result.name,result:'Pass',blocks:3,xml,xmlSha256:createHash('sha256').update(xml).digest('hex'),clocks:Array.from(Y.decodeStateVector(Y.encodeStateVector(doc))).sort(([a],[b])=>a-b)};doc.destroy();return output;
});
fs.writeFileSync('/tmp/windows-native-yjs-audit.json',JSON.stringify({at:new Date().toISOString(),scope:'Independent Docker Yjs reconstruction of update bytes recovered by the actual Windows repository driver; synthetic text only.',results},null,2)+'\n');
console.log('Recovered Windows bytes: 4 full-document matches');
