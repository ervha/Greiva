import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {HocuspocusProvider} from '@hocuspocus/provider';
import * as Y from 'yjs';
const [databasePath,outputPath]=process.argv.slice(2);
const cases=[{id:'01a0f808-b90b-775f-9bd2-24f83b2f40af',expected:'<paragraph>MS65 local 日本語</paragraph>'},{id:'01a0f813-c52c-71a6-a885-c030269b0788',expected:'<paragraph>[ms65-6][ms65-5][ms65-4][ms65-3][ms65-2][ms65-1]MS65 local 日本語</paragraph>'}];
const reports=[];
for(const test of cases){
 const result=spawnSync('.data/native-target/debug/examples/store-driver',[databasePath],{input:JSON.stringify({id:'audit',command:'load',pageId:test.id})+'\n',encoding:'utf8',maxBuffer:64*1024*1024});
 if(result.status!==0)throw Error(result.stderr);const reply=JSON.parse(result.stdout.trim());if(reply.error)throw Error(reply.error);
 const nativeDoc=new Y.Doc();for(const bytes of reply.value.updates)Y.applyUpdate(nativeDoc,Uint8Array.from(bytes),'copied-journal');
 const peer=new Y.Doc(),provider=new HocuspocusProvider({url:'ws://127.0.0.1:1234?clientId=recheck-audit-readonly',name:`page:${test.id}`,document:peer});
 try{
  const deadline=Date.now()+15000;while(!provider.isSynced||provider.unsyncedChanges){if(Date.now()>deadline)throw Error('Peer sync timeout');await new Promise(r=>setTimeout(r,100));}
  const xml=nativeDoc.getXmlFragment('body').toString(),peerXml=peer.getXmlFragment('body').toString();
  const clocks=d=>[...Y.decodeStateVector(Y.encodeStateVector(d))].sort((a,b)=>a[0]-b[0]);
  reports.push({pageId:test.id,expectedFullXml:test.expected,nativeXml:xml,peerXml,nativeMatchesExpected:xml===test.expected,peerMatchesExpected:peerXml===test.expected,nativeAndPeerMatch:xml===peerXml,allClocksMatch:JSON.stringify(clocks(nativeDoc))===JSON.stringify(clocks(peer)),nativeClocks:clocks(nativeDoc),peerClocks:clocks(peer),journalUpdates:reply.value.updates.length,journalBytes:reply.value.updates.reduce((n,v)=>n+v.length,0)});
 }finally{provider.destroy();peer.destroy();nativeDoc.destroy();}
}
const report={at:new Date().toISOString(),databaseCopy:databasePath,cases:reports,scope:'Actual saved state and fresh read-only peer after unobserved application close. Not a deliberate crash-test result or native reconversion completion proof.'};
writeFileSync(outputPath,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
