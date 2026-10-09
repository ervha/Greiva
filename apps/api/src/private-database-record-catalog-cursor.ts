import {createHmac,timingSafeEqual} from 'node:crypto';
import {idSchema} from '@greiva/shared';
import {structuredOrderSchema} from '@greiva/protocol/workspace';
import {PrivateTransactionInvalidRequest} from './private-transactions.js';
export function databaseRecordCatalogCursor(workspaceId:string,epoch:string,clientId:string,sourceId:string,secret:Uint8Array){
 const scope=[workspaceId,epoch,clientId,sourceId].map(value=>idSchema.parse(value)),key=Buffer.from(secret);if(key.length<32)throw Error('Database cursor key unavailable');
 const sign=(content:string)=>createHmac('sha256',key).update('gdr1.'+content).digest();
 return Object.freeze({
  encode(afterOrder:string,headOrder:string){const after=structuredOrderSchema.parse(afterOrder),head=structuredOrderSchema.parse(headOrder);if(BigInt(after)>BigInt(head))throw new PrivateTransactionInvalidRequest();const content=Buffer.from(JSON.stringify([...scope,after,head])).toString('base64url');return'gdr1.'+content+'.'+sign(content).toString('base64url');},
  decode(candidate:unknown,currentHead:string):Readonly<{after:string;head:string}>{
   const current=structuredOrderSchema.parse(currentHead);if(candidate===null)return Object.freeze({after:'0',head:current});
   try{if(typeof candidate!=='string'||candidate.length>1024)throw Error();const parts=candidate.split('.');if(parts.length!==3||parts[0]!=='gdr1'||!/^[A-Za-z0-9_-]+$/.test(parts[1]!)||!/^[A-Za-z0-9_-]{43}$/.test(parts[2]!))throw Error();const payload=Buffer.from(parts[1]!,'base64url'),signature=Buffer.from(parts[2]!,'base64url');if(payload.toString('base64url')!==parts[1]||signature.toString('base64url')!==parts[2]||signature.length!==32||!timingSafeEqual(signature,sign(parts[1]!)))throw Error();const value:unknown=JSON.parse(payload.toString('utf8'));if(!Array.isArray(value)||value.length!==6||scope.some((id,index)=>id!==value[index]))throw Error();const after=structuredOrderSchema.parse(value[4]),head=structuredOrderSchema.parse(value[5]);if(BigInt(after)>BigInt(head)||BigInt(head)>BigInt(current))throw Error();return Object.freeze({after,head});}catch{throw new PrivateTransactionInvalidRequest();}
  },
 });
}
