import { SignJWT } from 'jose';
import { z } from 'zod';
import { idSchema } from '@greiva/shared';
import { PrivateWorkspaceAccessDenied } from '@greiva/application';
import { PrivateTransactionInvalidRequest, PostgresPrivateTransactions } from './private-transactions.js';
import type { VerifiedSession } from './session-verifier.js';
export const offlineSeconds=604800;
const request=z.strictObject({clientId:idSchema,epoch:idSchema,nonce:z.string().regex(/^[0-9a-f]{64}$/)});
export interface PrivateOfflineGrants {issue(session:VerifiedSession,workspaceId:string,candidate:unknown):Promise<Readonly<{protocolVersion:1;grant:string}>>;}
export class PrivateOfflineGrantUnavailable extends Error {constructor(){super('Offline grant unavailable');}}
// Trusted server composition supplies a distinct signing key. No body key,
// requester time/TTL, email/profile, token logging or default key generation.
export class PostgresPrivateOfflineGrants implements PrivateOfflineGrants {
  readonly #issuer:string;readonly #audience:string;readonly #kid:string;readonly #key:CryptoKey;
  constructor(private readonly transactions:PostgresPrivateTransactions,configuration:Readonly<{issuer:string;audience:string;kid:string;key:CryptoKey}>,private readonly now:()=>number=()=>Math.floor(Date.now()/1000)){
    const {issuer,audience,kid,key}=configuration;
    try{const url=new URL(issuer);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||issuer!==issuer.trim()||issuer.length>2048||!audience.trim()||audience.length>256||/[\x00-\x1f\x7f]/.test(audience)||!/^[a-zA-Z0-9_-]{1,64}$/.test(kid)||key.type!=='private'||key.algorithm.name!=='Ed25519'||!key.usages.includes('sign'))throw Error();}catch{throw new PrivateOfflineGrantUnavailable();}
    this.#issuer=issuer;this.#audience=audience;this.#kid=kid;this.#key=key;
  }
  async issue(session:VerifiedSession,workspaceId:string,candidate:unknown){
    const parsed=request.safeParse(candidate);if(!parsed.success)throw new PrivateTransactionInvalidRequest();
    const {clientId,epoch,nonce}=parsed.data;
    return this.transactions.run(session,workspaceId,clientId,[],async({context})=>{
      if(context.epoch!==epoch)throw new PrivateWorkspaceAccessDenied();
      const issued=this.now();if(!Number.isSafeInteger(issued)||issued<=0||!Number.isSafeInteger(issued+offlineSeconds)||session.expiresAt<=issued)throw new PrivateOfflineGrantUnavailable();
      const grant=await new SignJWT({authIssuer:context.issuer,workspaceId:context.workspaceId,clientId:context.clientId,streamEpoch:context.epoch,nonce})
        .setProtectedHeader({alg:'EdDSA',typ:'greiva-offline-v1+jwt',kid:this.#kid}).setIssuer(this.#issuer).setAudience(this.#audience).setSubject(context.subjectId).setIssuedAt(issued).setExpirationTime(issued+offlineSeconds).sign(this.#key);
      const finished=this.now();if(finished<issued||finished>=session.expiresAt||finished>=issued+offlineSeconds)throw new PrivateOfflineGrantUnavailable();
      return Object.freeze({protocolVersion:1 as const,grant});
    });
  }
}
