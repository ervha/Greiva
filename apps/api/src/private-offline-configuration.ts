import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import path from 'node:path';
import { importJWK,CompactSign,compactVerify } from 'jose';
import { z } from 'zod';
export type OfflineConfiguration=Readonly<{issuer:string;audience:string;kid:string;keyFile:string}>;
export class OfflineConfigurationError extends Error {constructor(){super('Offline signing configuration unavailable');}}
export function offlineConfiguration(env:Readonly<Record<string,string|undefined>>):OfflineConfiguration|undefined{
  const values=[env.GREIVA_OFFLINE_ISSUER,env.GREIVA_OFFLINE_AUDIENCE,env.GREIVA_OFFLINE_KID,env.GREIVA_OFFLINE_KEY_FILE];
  if(values.every(v=>v===undefined))return undefined;
  try{
    const [issuer,audience,kid,keyFile]=values;if(!issuer||!audience||!kid||!keyFile)throw Error();
    const url=new URL(issuer);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||issuer!==issuer.trim()||issuer.length>2048
      ||audience!==audience.trim()||!audience||audience.length>256||/[\x00-\x1f\x7f]/.test(audience)||!/^[A-Za-z0-9_-]{1,64}$/.test(kid)
      ||!path.isAbsolute(keyFile)||keyFile.includes('\0'))throw Error();
    return Object.freeze({issuer,audience,kid,keyFile});
  }catch{throw new OfflineConfigurationError();}
}
const keySchema=z.strictObject({kty:z.literal('OKP'),crv:z.literal('Ed25519'),x:z.string().regex(/^[A-Za-z0-9_-]{43}$/),d:z.string().regex(/^[A-Za-z0-9_-]{43}$/)});
export async function loadOfflineSigningKey(configuration:OfflineConfiguration):Promise<CryptoKey>{
  let bytes:Buffer|undefined;
  try{
    const file=await open(configuration.keyFile,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    try{
      const before=await file.stat();if(!before.isFile()||before.size<1||before.size>4096||(before.mode&0o077)!==0)throw Error();
      bytes=Buffer.alloc(before.size);let offset=0;while(offset<bytes.length){const read=await file.read(bytes,offset,bytes.length-offset,offset);if(!read.bytesRead)throw Error();offset+=read.bytesRead;}
      if((await file.read(Buffer.alloc(1),0,1,offset)).bytesRead)throw Error();const after=await file.stat();if(after.size!==before.size||after.mtimeMs!==before.mtimeMs)throw Error();
    }finally{await file.close();}
    const jwk=keySchema.parse(JSON.parse(bytes.toString('utf8')));
    for(const value of [jwk.x,jwk.d])if(Buffer.from(value,'base64url').length!==32||Buffer.from(value,'base64url').toString('base64url')!==value)throw Error();
    const key=await importJWK({...jwk,ext:false},'EdDSA'),publicKey=await importJWK({kty:'OKP',crv:'Ed25519',x:jwk.x},'EdDSA');
    if(!(key instanceof CryptoKey)||key.type!=='private'||key.extractable)throw Error();
    // A mismatched x/d pair fails startup, rather than issuing unusable grants.
    const proof=await new CompactSign(new TextEncoder().encode('Greiva offline signing key configuration check')).setProtectedHeader({alg:'EdDSA',typ:'greiva-offline-key-check'}).sign(key);
    await compactVerify(proof,publicKey,{algorithms:['EdDSA']});return key;
  }catch{throw new OfflineConfigurationError();}
  finally{bytes?.fill(0);}
}
