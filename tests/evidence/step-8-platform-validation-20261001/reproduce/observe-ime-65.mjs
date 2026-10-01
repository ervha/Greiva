import {HocuspocusProvider} from '@hocuspocus/provider';
import * as Y from 'yjs';
import {readFile,writeFile} from 'node:fs/promises';
const runDirectory='/workspace/.data/host-ime/remote65-2026-10-01T13-46-06-804Z';
const events=JSON.parse(await readFile(`${runDirectory}/peer-events.json`,'utf8'));
const before=events.records.find(r=>r.type==='ready').beforeXml;
const expected=before.replace('<paragraph>IME65 local </paragraph>','<paragraph>[remote65-3][remote65-2][remote65-1]IME65 local 日本語</paragraph>');
if(before===expected)throw new Error('Baseline target mismatch');
const document=new Y.Doc();const provider=new HocuspocusProvider({url:'ws://127.0.0.1:1234?clientId=native65-final-readonly',name:`page:${events.pageId}`,document});
const deadline=Date.now()+15000;
try{
 while(!provider.isSynced||provider.unsyncedChanges){if(Date.now()>deadline)throw new Error('Sync timeout');await new Promise(r=>setTimeout(r,100));}
 const bodyXml=document.getXmlFragment('body').toString();
 const report={at:new Date().toISOString(),pageId:events.pageId,readOnlyObserver:true,expectedFullXml:expected,bodyXml,fullXmlMatches:bodyXml===expected,stateVector:Buffer.from(Y.encodeStateVector(document)).toString('base64'),nativeImeResult:'Only native observations establish composition result'};
 await writeFile(`${runDirectory}/peer-after-redo.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));if(!report.fullXmlMatches)throw new Error('Full XML mismatch');
}finally{provider.destroy();document.destroy();}
