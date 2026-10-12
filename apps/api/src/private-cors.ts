import type {FastifyInstance} from 'fastify';
export function privateClientOrigins(candidate:unknown=undefined):readonly string[]{
 if(candidate===undefined)return Object.freeze([]);if(!Array.isArray(candidate)||candidate.length>8)throw Error('Invalid private client origins');
 const origins=candidate.map(value=>{if(typeof value!=='string')throw Error('Invalid private client origins');let url:URL;try{url=new URL(value);}catch{throw Error('Invalid private client origins');}if(value!==url.origin||url.username||url.password||!(url.protocol==='https:'||url.protocol==='http:'&&(['127.0.0.1','localhost','[::1]'].includes(url.hostname)||value==='http://tauri.localhost')))throw Error('Invalid private client origins');return value;});if(new Set(origins).size!==origins.length)throw Error('Invalid private client origins');return Object.freeze(origins);
}
// Browser read permission only. Every actual request still uses signed Auth and
// the existing workspace/device transaction; Origin never identifies an owner.
export function installPrivateCors(instance:FastifyInstance,candidate:readonly string[]=[]){
 const origins=privateClientOrigins(candidate);if(!origins.length)return;const allowed=new Set(origins);
 instance.addHook('onRequest',async(request,reply)=>{
  reply.header('vary','Origin');const origin=request.headers.origin;if(origin===undefined)return;
  const path=request.url.split('?')[0]??'';
  if(typeof origin!=='string'||!allowed.has(origin)||!path.startsWith('/v1/'))return reply.code(403).send({error:'origin_not_permitted'});
  if(request.method==='OPTIONS'){
   const method=request.headers['access-control-request-method'],headers=request.headers['access-control-request-headers'];
   const keys=typeof headers==='string'?headers.toLowerCase().split(',').map(value=>value.trim()):headers===undefined?[]:['invalid'];
   if(typeof method!=='string'||!['GET','POST'].includes(method)||keys.some(key=>!['authorization','content-type'].includes(key))||new Set(keys).size!==keys.length)return reply.code(403).send({error:'preflight_not_permitted'});
   return reply.header('access-control-allow-origin',origin).header('access-control-allow-methods','GET, POST').header('access-control-allow-headers','authorization, content-type').code(204).send();
  }
  if(!['GET','POST'].includes(request.method))return reply.code(403).send({error:'method_not_permitted'});
  reply.header('access-control-allow-origin',origin);
 });
 instance.options('/v1/*',async(_request,reply)=>reply.code(403).send({error:'preflight_not_permitted'}));
}