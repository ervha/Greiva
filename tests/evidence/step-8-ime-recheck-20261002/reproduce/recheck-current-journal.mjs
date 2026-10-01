import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import * as Y from 'yjs';
const [databasePath,auditPath,outputPath]=process.argv.slice(2);
const audit=JSON.parse(readFileSync(auditPath,'utf8'));
const cases=[];
for(const expected of audit.cases){
 const result=spawnSync('.data/native-target/debug/examples/store-driver',[databasePath],{input:JSON.stringify({id:'ordered-audit',command:'load',pageId:expected.pageId})+'\n',encoding:'utf8',maxBuffer:64*1024*1024});
 if(result.status!==0)throw Error(result.stderr);
 const reply=JSON.parse(result.stdout.trim());if(reply.error)throw Error(reply.error);
 const doc=new Y.Doc(),records=[];
 for(const [index,bytes] of reply.value.updates.entries()){
  const update=Uint8Array.from(bytes),decoded=Y.decodeUpdate(update),before=doc.getXmlFragment('body').toString();
  Y.applyUpdate(doc,update,'copied-journal');
  records.push({journalIndex:index+1,bytes:bytes.length,before,after:doc.getXmlFragment('body').toString(),deleteRanges:[...decoded.ds.clients.entries()].flatMap(([client,ranges])=>ranges.map(r=>({client,clock:r.clock,length:r.len}))),structs:decoded.structs.length});
 }
 const finalXml=doc.getXmlFragment('body').toString();
 if(finalXml!==expected.nativeXml||finalXml!==expected.peerXml)throw Error('Replay differs from native/peer audit');
 const losses=records.filter(r=>r.before.includes('MS65 local 日本語</paragraph>') && r.after.endsWith('MS65 loc</paragraph>'));
 cases.push({pageId:expected.pageId,journalUpdates:records.length,finalXml,finalXmlMatchesNativeAndPeer:true,lossTransitions:losses,records});
 doc.destroy();
}
if(cases[0].lossTransitions.length!==0||cases[1].lossTransitions.length!==1)throw Error('Unexpected loss transition count');
const report={at:new Date().toISOString(),databaseCopy:databasePath,cases,scope:'Ordered replay of copied native journal. Journal order is known; event/key timestamps, trusted key identity, DOM target ranges and composition state are absent. Cannot identify the responsible input layer or shutdown cause.'};
writeFileSync(outputPath,JSON.stringify(report,null,2));
console.log(JSON.stringify(cases.map(c=>({pageId:c.pageId,journalUpdates:c.journalUpdates,finalXmlMatchesNativeAndPeer:c.finalXmlMatchesNativeAndPeer,lossTransitions:c.lossTransitions})),null,2));
