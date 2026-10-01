import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import * as Y from 'yjs';
const peer=JSON.parse(readFileSync('/workspace/.data/host-ime/ms65-2026-10-01T14-01-52-599Z/peer-after-reconvert.json','utf8'));
const result=spawnSync('.data/native-target/debug/examples/store-driver',['/workspace/.data/host-ime/ms65-audit/greiva.sqlite'],{input:JSON.stringify({id:'ordered-audit',command:'load',pageId:peer.pageId})+'\n',encoding:'utf8',maxBuffer:64*1024*1024});
if(result.status!==0)throw Error(result.stderr);
const reply=JSON.parse(result.stdout.trim());if(reply.error)throw Error(reply.error);
const doc=new Y.Doc(),records=[];let previous='';
for(const [index,bytes] of reply.value.updates.entries()){
  const update=Uint8Array.from(bytes), decoded=Y.decodeUpdate(update);
  Y.applyUpdate(doc,update,'copied-journal');
  const last=doc.getXmlFragment('body').toArray().at(-1)?.toString()??'';
  if(last.includes('MS65 ') && last!==previous){records.push({journalIndex:index+1,bytes:bytes.length,before:last.includes('MS65')?previous:null,after:last,deleteRanges:[...decoded.ds.clients.entries()].flatMap(([client,ranges])=>ranges.map(r=>({client,clock:r.clock,length:r.len}))),structs:decoded.structs.length});}
  previous=last;
}
const losses=records.filter(r=>r.before?.includes('MS65 local 日本語</paragraph>') && r.after.endsWith('MS65 loc</paragraph>'));
const report={at:new Date().toISOString(),pageId:peer.pageId,journalUpdates:reply.value.updates.length,finalXmlMatchesPriorPeer:doc.getXmlFragment('body').toString()===peer.bodyXml,lossTransitions:losses,records,scope:'Ordered replay of previously copied native journal only; no per-key timestamps or input origin in journal. Cannot distinguish manual key error from application/IME range error.'};
writeFileSync('/workspace/.data/host-ime/ms65-audit/ordered-replay.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({journalUpdates:report.journalUpdates,finalXmlMatchesPriorPeer:report.finalXmlMatchesPriorPeer,lossTransitions:report.lossTransitions},null,2));doc.destroy();
