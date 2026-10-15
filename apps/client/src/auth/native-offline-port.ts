import {invoke,isTauri} from '@tauri-apps/api/core';
import {workspaceLocalContextSchema} from '@greiva/protocol/workspace';
import type {NativeWorkspaceHandle} from './native-session-port.js';

type InvokePort=(command:string,args?:Record<string,unknown>)=>Promise<unknown>;
// Deliberately not the shape of an online auth handle or an auth snapshot.
export type NativeOfflineWorkspace=Readonly<{mode:'offline';workspace:NativeWorkspaceHandle;expiresAt:number}>;
export class NativeOfflinePortError extends Error{constructor(readonly stage:'configuration'|'busy'|'closed'|'protocol'|'unavailable'){super(`Native offline ${stage}`);this.name='NativeOfflinePortError';}}
function object(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new NativeOfflinePortError('protocol');const row=value as Record<string,unknown>;
 if(Object.keys(row).length!==keys.length||keys.some(key=>!Object.hasOwn(row,key)))throw new NativeOfflinePortError('protocol');return row;
}
function deadline(value:unknown):number{if(!Number.isSafeInteger(value)||(value as number)<=0||(value as number)>8640000000000)throw new NativeOfflinePortError('protocol');return value as number;}
function restored(value:unknown):NativeOfflineWorkspace{
 const row=object(value,['workspace','expiresAt']),workspace=object(row.workspace,['handle','context']),parsed=workspaceLocalContextSchema.safeParse(workspace.context);
 if(typeof workspace.handle!=='string'||!workspace.handle||workspace.handle.length>256||/[\u0000-\u001f\u007f]/u.test(workspace.handle)||!parsed.success)throw new NativeOfflinePortError('protocol');
 return Object.freeze({mode:'offline',workspace:Object.freeze({handle:workspace.handle,context:Object.freeze(parsed.data)}),expiresAt:deadline(row.expiresAt)});
}
// No caller context, time, token, key, endpoint, online fallback or send/read API.
export class NativeOfflinePort{
 #revision=0;#disposed=false;#opening=false;#handle:NativeOfflineWorkspace|null=null;
 constructor(private readonly invokePort:InvokePort=invoke){if(invokePort===invoke&&!isTauri())throw new NativeOfflinePortError('configuration');}
 get handle(){return this.#handle;}
 #check(revision=this.#revision){if(this.#disposed||revision!==this.#revision)throw new NativeOfflinePortError('closed');}
 async #closeNative(handle:NativeOfflineWorkspace){const call=this.invokePort;await call('native_offline_close',{handle:handle.workspace.handle});}
 async resume():Promise<NativeOfflineWorkspace>{
  this.#check();if(this.#opening)throw new NativeOfflinePortError('busy');const revision=++this.#revision;this.#opening=true;this.#handle=null;
  try{const call=this.invokePort;let value:unknown;try{value=await call('native_offline_open');}catch{this.#check(revision);throw new NativeOfflinePortError('unavailable');}const handle=restored(value);
   if(this.#disposed||revision!==this.#revision){await this.#closeNative(handle).catch(()=>{});throw new NativeOfflinePortError('closed');}this.#handle=handle;return handle;
  }finally{if(revision===this.#revision)this.#opening=false;}
 }
 async #call(handle:NativeOfflineWorkspace,command:string,args:Record<string,unknown>):Promise<unknown>{
  this.#check();if(this.#handle!==handle)throw new NativeOfflinePortError('closed');const revision=this.#revision;
  try{const call=this.invokePort;const value=await call(command,args);this.#check(revision);if(this.#handle!==handle)throw new NativeOfflinePortError('closed');return value;}
  catch(error){if(!this.#disposed&&revision===this.#revision&&this.#handle===handle){++this.#revision;this.#handle=null;await this.#closeNative(handle).catch(()=>{});}if(error instanceof NativeOfflinePortError)throw error;throw new NativeOfflinePortError('unavailable');}
 }
 async check(handle:NativeOfflineWorkspace):Promise<number>{
  const value=await this.#call(handle,'native_offline_check',{handle:handle.workspace.handle});
  try{const row=object(value,['expiresAt']);const expiry=deadline(row.expiresAt);if(expiry!==handle.expiresAt)throw new NativeOfflinePortError('protocol');return expiry;}
  catch(error){if(this.#handle===handle)await this.close().catch(()=>{});throw error;}
 }
 async execute(handle:NativeOfflineWorkspace,request:Record<string,unknown>):Promise<unknown>{
  let captured:Record<string,unknown>;try{captured=JSON.parse(JSON.stringify(request)) as Record<string,unknown>;}catch{throw new NativeOfflinePortError('protocol');}
  return this.#call(handle,'native_offline_execute',{handle:handle.workspace.handle,request:captured});
 }
 async close(){const handle=this.#handle;this.#check();++this.#revision;this.#opening=false;this.#handle=null;if(handle){try{await this.#closeNative(handle);}catch{throw new NativeOfflinePortError('unavailable');}}}
 dispose(){if(this.#disposed)return;const handle=this.#handle;this.#disposed=true;++this.#revision;this.#opening=false;this.#handle=null;if(handle)void this.#closeNative(handle).catch(()=>{});}
}
