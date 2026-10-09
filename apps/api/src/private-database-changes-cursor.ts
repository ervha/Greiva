import {createHmac,timingSafeEqual} from 'node:crypto';
import {idSchema} from '@greiva/shared';
import {structuredOrderSchema} from '@greiva/protocol/workspace';
import {PrivateTransactionInvalidRequest} from './private-transactions.js';
export function databaseChangesCursor(workspaceId:string,workspaceEpoch:string,clientId:string,sourceId:string,journalEpoch:string,secret:Uint8Array){
 const scope=[workspaceId,workspaceEpoch,clientId,sourceId,journalEpoch].map(value=>{const id=idSchema.parse(value);if(id!==id.toLowerCase())throw new PrivateTransactionInvalidRequest();return id;}),key=Buffer.from(secret);if(key.length<32)throw Error('Database journal key unavailable');
 const sign=(payload:string)=>createHmac('sha256',key).update('gdb1.'+payload).digest();
 return Object.freeze({
  encode(order:string){const after=structuredOrderSchema.parse(order),payload=Buffer.from(JSON.stringify([...scope,after])).toString('base64url');return'gdb1.'+payload+'.'+sign(payload).toString('base64url');},
  decode(candidate:unknown,currentHead:string):string{
   const head=structuredOrderSchema.parse(currentHead);if(candidate===null)return'0';
   try{if(typeof candidate!=='string'||candidate.length>1024)throw Error();const parts=candidate.split('.');if(parts.length!==3||parts[0]!=='gdb1'||!/^[A-Za-z0-9_-]+$/.test(parts[1]!)||!/^[A-Za-z0-9_-]{43}$/.test(parts[2]!))throw Error();const payload=Buffer.from(parts[1]!,'base64url'),signature=Buffer.from(parts[2]!,'base64url');if(payload.toString('base64url')!==parts[1]||signature.toString('base64url')!==parts[2]||signature.length!==32||!timingSafeEqual(signature,sign(parts[1]!)))throw Error();const data:unknown=JSON.parse(payload.toString('utf8'));if(!Array.isArray(data)||data.length!==6||scope.some((id,index)=>id!==data[index]))throw Error();const order=structuredOrderSchema.parse(data[5]);if(BigInt(order)>BigInt(head))throw Error();return order;}catch{throw new PrivateTransactionInvalidRequest();}
  },
 });
}
