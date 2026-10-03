import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,existsSync,openSync} from 'node:fs';
const root='/tmp/greiva-native-network';mkdirSync(root,{recursive:true});
const modePath=`${root}/mode.json`;
if(!existsSync(modePath))writeFileSync(modePath,JSON.stringify({reject:true,holdPush:true,holdPull:false}));
const mode=()=>JSON.parse(readFileSync(modePath,'utf8'));
const event=(value)=>appendFileSync(`${root}/proxy-events.jsonl`,JSON.stringify({at:new Date().toISOString(),...value})+'\n');
const children=[];
for(const [name,path,extra] of [['api','apps/api/dist/main.js',{}],['collaboration','apps/collaboration/dist/main.js',{COLLABORATION_DATA_DIR:`${root}/collaboration`}]]){
 const fd=openSync(`${root}/${name}.log`,'a');children.push(spawn('node',[path],{env:{...process.env,...extra},stdio:['ignore',fd,fd]}));
}
let sequence=0;
const server=createServer(async(req,res)=>{
 const id=++sequence;const path=req.url;let raw='';for await(const chunk of req)raw+=chunk;
 if(mode().reject){res.writeHead(503,{'Access-Control-Allow-Origin':req.headers.origin??'http://tauri.localhost'});res.end('Native test network unavailable');return;}
 try{
  const headers={...(req.headers['content-type']?{'Content-Type':req.headers['content-type']}:{})};
  for(const name of ['origin','access-control-request-method','access-control-request-headers'])if(req.headers[name])headers[name]=req.headers[name];
  const upstream=await fetch(`http://127.0.0.1:3001${path}`,{method:req.method,headers,...(!['GET','HEAD','OPTIONS'].includes(req.method)?{body:raw}:{})});
  const body=await upstream.text();
  if(req.method==='POST'&&path.startsWith('/sync/'))event({id,event:'upstream-response',path,request:JSON.parse(raw),status:upstream.status,body:JSON.parse(body)});
  const holdKey=path==='/sync/push'?'holdPush':path==='/sync/pull'?'holdPull':null;
  if(req.method==='POST'&&holdKey&&mode()[holdKey]){
   const marker={id,at:new Date().toISOString(),path,request:JSON.parse(raw),status:upstream.status,body:JSON.parse(body)};
   writeFileSync(`${root}/${holdKey}-marker.json`,JSON.stringify(marker,null,2)+'\n');event({id,event:'holding-response',path});
   while(mode()[holdKey]&&!res.destroyed)await new Promise(done=>setTimeout(done,100));
  }
  if(res.destroyed){event({id,event:'client-disconnected',path});return;}
  const replyHeaders=Object.fromEntries(upstream.headers);delete replyHeaders['content-length'];delete replyHeaders['transfer-encoding'];res.writeHead(upstream.status,replyHeaders);res.end(body);
 }catch(error){event({id,event:'proxy-error',path,error:String(error)});if(!res.destroyed){res.writeHead(503,{'Access-Control-Allow-Origin':req.headers.origin??'http://tauri.localhost'});res.end('Test upstream unavailable');}}
});
await new Promise(done=>server.listen(3000,'0.0.0.0',done));event({event:'proxy-listening',schema:process.env.GREIVA_DB_SCHEMA,version:'0.6.11'});
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close();for(const child of children)child.kill('SIGTERM');setTimeout(()=>process.exit(0),1000);});
