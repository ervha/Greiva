import {createHmac,timingSafeEqual} from 'node:crypto';
import {idSchema} from '@greiva/shared';
import {structuredOrderSchema} from '@greiva/protocol/workspace';
import {PrivateTransactionInvalidRequest,PrivateTransactionUnavailable} from './private-transactions.js';

export class PrivatePageChangesInvalidCursor extends PrivateTransactionInvalidRequest {}
export function pageChangesCursor(workspaceId:string,epoch:string,secret:unknown){
  if(!Buffer.isBuffer(secret)||secret.length!==32)throw new PrivateTransactionUnavailable();
  const key=Buffer.from(secret),workspace=idSchema.parse(workspaceId),generation=idSchema.parse(epoch);
  const sign=(body:string)=>createHmac('sha256',key).update(body).digest();
  return Object.freeze({encode(order:string){const body='gpm1.'+Buffer.from(JSON.stringify([workspace,'page-metadata',generation,structuredOrderSchema.parse(order)])).toString('base64url');return body+'.'+sign(body).toString('base64url');},
    decode(candidate:string|null,headOrder:string):bigint{if(candidate===null)return 0n;try{const parts=candidate.split('.');if(candidate.length>1024||parts.length!==3||parts[0]!=='gpm1')throw Error();const bytes=Buffer.from(parts[1]!,'base64url'),signature=Buffer.from(parts[2]!,'base64url');if(bytes.toString('base64url')!==parts[1]||signature.toString('base64url')!==parts[2]||signature.length!==32||!timingSafeEqual(signature,sign(parts[0]+'.'+parts[1])))throw Error();const value:unknown=JSON.parse(bytes.toString('utf8'));if(!Array.isArray(value)||value.length!==4||value[0]!==workspace||value[1]!=='page-metadata'||value[2]!==generation)throw Error();const order=BigInt(structuredOrderSchema.parse(value[3]));if(order>BigInt(structuredOrderSchema.parse(headOrder)))throw Error();return order;}catch{throw new PrivatePageChangesInvalidCursor();}}
  });
}
