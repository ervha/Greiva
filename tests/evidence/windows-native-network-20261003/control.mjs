import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const root='/tmp/greiva-native-network';const action=process.argv[2];
if(action==='mode'){
 const value=JSON.parse(process.argv[3]);writeFileSync(`${root}/mode.json`,JSON.stringify(value));console.log(JSON.stringify(value));
}else if(action==='wait-push'){
 const end=Date.now()+10_000;while(!existsSync(`${root}/holdPush-marker.json`)&&Date.now()<end)await new Promise(done=>setTimeout(done,100));
 const marker=JSON.parse(readFileSync(`${root}/holdPush-marker.json`,'utf8'));console.log(JSON.stringify({at:marker.at,operationId:marker.request.operations[0].operationId,status:marker.body.results[0].status,serverOrder:marker.body.results[0].serverOrder}));
}else if(action==='health'){
 const result=await fetch('http://127.0.0.1:3001/health');console.log(JSON.stringify(await result.json()));
}
