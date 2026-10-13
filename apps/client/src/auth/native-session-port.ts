import {invoke,isTauri} from '@tauri-apps/api/core';
import {idSchema} from '@greiva/shared';
import {workspaceLocalContextSchema} from '@greiva/protocol/workspace';
import type {WorkspaceSyncContext} from '@greiva/sync';
export type NativeAuthSnapshot=Readonly<{available:boolean;phase:'unavailable'|'locked'|'authenticating'|'refreshing'|'verified';expiresAt:number|null}>;
export type NativeLogout=Readonly<{localLocked:true;persistentLocked:boolean;cleanupPending:boolean|null;providerConfirmed:boolean}>;
export class NativeSessionPortError extends Error {constructor(readonly stage:'configuration'|'closed'|'busy'|'credentials'|'protocol'|'unavailable'){super(`Native session ${stage}`);this.name='NativeSessionPortError';}}
type InvokePort=(command:string,args?:Record<string,unknown>)=>Promise<unknown>;
type Handle=Readonly<{handle:string;context:WorkspaceSyncContext}>;
function object(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value || typeof value!=='object' || Array.isArray(value))throw new NativeSessionPortError('protocol');
 const row=value as Record<string,unknown>;if(Object.keys(row).length!==keys.length || keys.some(key=>!Object.hasOwn(row,key)))throw new NativeSessionPortError('protocol');return row;
}
function snapshot(value:unknown):NativeAuthSnapshot {
 const row=object(value,['available','phase','expiresAt']);
 if(typeof row.available!=='boolean' || !['unavailable','locked','authenticating','refreshing','verified'].includes(String(row.phase))
  || (row.phase==='verified'? !row.available || !Number.isSafeInteger(row.expiresAt) || (row.expiresAt as number)<=0 : row.expiresAt!==null)
  || row.available===(row.phase==='unavailable'))throw new NativeSessionPortError('protocol');
 return Object.freeze(row as unknown as NativeAuthSnapshot);
}
// Optional native-only port, not mounted into the existing preview yet. No
// endpoint, raw token/identity or caller-owned context enters the command wire.
export class NativeSessionPort {
 #revision=0;#disposed=false;#busy=false;#handle:Handle|null=null;
 #snapshot:NativeAuthSnapshot=Object.freeze({available:false,phase:'unavailable',expiresAt:null});
 constructor(private readonly invokePort:InvokePort=invoke,private readonly now=()=>Math.floor(Date.now()/1000)){
  if(invokePort===invoke && !isTauri())throw new NativeSessionPortError('configuration');
 }
 get current():NativeAuthSnapshot {return this.#snapshot.phase==='verified' && this.#snapshot.expiresAt!<=this.now()?Object.freeze({available:true,phase:'locked',expiresAt:null}):this.#snapshot;}
 get handle():Handle|null {return this.current.phase==='verified'?this.#handle:null;}
 #check(revision=this.#revision){if(this.#disposed || revision!==this.#revision)throw new NativeSessionPortError('closed');}
 #begin(){this.#check();const revision=++this.#revision;this.#handle=null;return revision;}
 async #call(command:string,args:Record<string,unknown>|undefined,revision:number){
  this.#check(revision);let value:unknown;try{const port=this.invokePort;value=await port(command,args);}catch{this.#check(revision);throw new NativeSessionPortError('unavailable');}this.#check(revision);return value;
 }
 async status(){const revision=this.#revision;const next=snapshot(await this.#call('native_auth_status',undefined,revision));this.#snapshot=next;if(next.phase!=='verified')this.#handle=null;return this.current;}
 async #authenticate(command:'native_auth_login'|'native_auth_restore',args?:Record<string,unknown>){
  if(this.#busy)throw new NativeSessionPortError('busy');const revision=this.#begin();this.#busy=true;this.#snapshot=Object.freeze({available:true,phase:command==='native_auth_login'?'authenticating':'refreshing',expiresAt:null});
  try{const next=snapshot(await this.#call(command,args,revision));if(next.phase!=='verified' || next.expiresAt!<=this.now())throw new NativeSessionPortError('unavailable');this.#snapshot=next;return next;}
  catch(error){if(revision===this.#revision)this.#snapshot=Object.freeze({available:true,phase:'locked',expiresAt:null});throw error;}
  finally{if(revision===this.#revision)this.#busy=false;}
 }
 async login(email:string,password:string){
  if(!email.trim() || email.length>320 || /[\u0000-\u001f\u007f]/u.test(email) || !password || password.length>4096)throw new NativeSessionPortError('credentials');
  return this.#authenticate('native_auth_login',{email,password});
 }
 async restore(){return this.#authenticate('native_auth_restore');}
 async open(candidate:string):Promise<Handle>{
  if(this.#busy)throw new NativeSessionPortError('busy');this.#check();if(this.current.phase!=='verified')throw new NativeSessionPortError('unavailable');
  try{idSchema.parse(candidate);}catch{throw new NativeSessionPortError('protocol');}const revision=this.#begin();
  const row=object(await this.#call('native_workspace_open',{candidate},revision),['handle','context']);
  const parsed=workspaceLocalContextSchema.safeParse(row.context);if(typeof row.handle!=='string' || !row.handle || row.handle.length>256 || /[\u0000-\u001f\u007f]/u.test(row.handle) || !parsed.success)throw new NativeSessionPortError('protocol');
  if(this.current.phase!=='verified')throw new NativeSessionPortError('unavailable');
  this.#handle=Object.freeze({handle:row.handle,context:Object.freeze({...parsed.data})});return this.#handle;
 }
 async execute(request:Record<string,unknown>):Promise<unknown>{
  this.#check();const handle=this.handle;if(!handle)throw new NativeSessionPortError('unavailable');const revision=this.#revision;
  let captured:Record<string,unknown>;try{captured=JSON.parse(JSON.stringify(request)) as Record<string,unknown>;}catch{throw new NativeSessionPortError('protocol');}
  const result=await this.#call('native_workspace_execute',{handle:handle.handle,request:captured},revision);
  if(this.handle!==handle)throw new NativeSessionPortError('closed');return result;
 }
 async cancel(){const revision=this.#begin();await this.#call('native_workspace_cancel',undefined,revision);}
 async logout():Promise<NativeLogout>{
  const revision=this.#begin();this.#busy=false;this.#snapshot=Object.freeze({available:true,phase:'locked',expiresAt:null});
  const row=object(await this.#call('native_auth_logout',undefined,revision),['localLocked','persistentLocked','cleanupPending','providerConfirmed']);
  if(row.localLocked!==true || typeof row.persistentLocked!=='boolean' || typeof row.providerConfirmed!=='boolean' || !(row.cleanupPending===null || typeof row.cleanupPending==='boolean') || (row.persistentLocked?row.cleanupPending===null:row.cleanupPending!==null))throw new NativeSessionPortError('protocol');
  return Object.freeze(row as unknown as NativeLogout);
 }
 dispose(){if(this.#disposed)return;this.#disposed=true;++this.#revision;this.#handle=null;this.#snapshot=Object.freeze({available:true,phase:'locked',expiresAt:null});const port=this.invokePort;void Promise.resolve().then(()=>port('native_workspace_cancel')).catch(()=>{});}
}
