import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
const pageId='01a0f723-8015-71d9-9445-0579cfef41a3';
const clientId=randomUUID();
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const directory=`/workspace/.data/host-ime/ms65-${runId}`;
const signal='/tmp/greiva-ms65-c6b1c8b-send';
await mkdir(directory,{recursive:true});
const doc=new Y.Doc(); const records=[];
function log(type,detail={}){const record={at:new Date().toISOString(),type,...detail};records.push(record);console.log(JSON.stringify(record));}
const provider=new HocuspocusProvider({url:`ws://127.0.0.1:1234?clientId=${clientId}`,name:`page:${pageId}`,document:doc,onStatus:({status})=>log('status',{status}),onSynced:({state})=>log('synced',{state})});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,ms=15000){const deadline=Date.now()+ms;while(!await check()){if(Date.now()>deadline)throw new Error('Timeout');await sleep(100);}}
let outcome='Incomplete';
try{
 await until(()=>provider.isSynced&&provider.unsyncedChanges===0);
 const body=doc.getXmlFragment('body');
 const candidates=body.toArray().filter(n=>n instanceof Y.XmlElement&&n.nodeName==='paragraph'&&n.toString().includes('MS65 local'));
 if(candidates.length!==1)throw new Error(`Expected unique dedicated paragraph, found ${candidates.length}`);
 const target=candidates[0]; const texts=target.toArray().filter(n=>n instanceof Y.XmlText);
 if(texts.length!==1||!texts[0].toString().startsWith('MS65 local'))throw new Error('Target text shape mismatch');
 const text=texts[0];
 log('ready',{pageId,clientId,directory,signal,beforeXml:body.toString(),targetText:text.toString(),nativeResult:'Not inferred'});
 await until(async()=>{try{await access(signal);return true;}catch{return false;}},300000);
 for(let sequence=1;sequence<=6;sequence++){
  if(target.parent!==body)throw new Error('Dedicated paragraph moved');
  doc.transact(()=>text.insert(0,`[ms65-${sequence}]`),'native65-remote-test');
  log('sent',{sequence,target:'same dedicated paragraph',text:text.toString()});
  await until(()=>provider.unsyncedChanges===0);log('acknowledged',{sequence});
  if(sequence===3)await until(async()=>{try{await access('/tmp/greiva-ms65-candidate-send');return true;}catch{return false;}},300000); else if(sequence<6)await sleep(2000);
 }
 outcome='Six same-paragraph updates acknowledged; native result requires observations';
 await sleep(20000);
}catch(error){outcome='Peer failed';log('error',{message:String(error)});process.exitCode=1;}
finally{
 await writeFile(`${directory}/peer-events.json`,JSON.stringify({runId,pageId,clientId,outcome,records},null,2));
 await writeFile(`${directory}/peer-final-state.json`,JSON.stringify({at:new Date().toISOString(),bodyXml:doc.getXmlFragment('body').toString(),stateVector:Buffer.from(Y.encodeStateVector(doc)).toString('base64'),nativeResult:'Not inferred'},null,2));
 log('saved',{directory,outcome});provider.destroy();doc.destroy();
}
