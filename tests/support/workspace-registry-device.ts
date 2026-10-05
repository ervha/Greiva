import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';import {createInterface} from 'node:readline';import {resolve} from 'node:path';
import type {NativeWorkspaceInvoke} from '../../apps/client/src/workspace/native-workspace-store.js';
export class WorkspaceRegistryDevice {
  private child:ChildProcessWithoutNullStreams|null=null;private sequence=0;
  private pending=new Map<number,{resolve(value:any):void;reject(error:Error):void}>();
  constructor(readonly root:string,private options:{crashRoot?:string}={}){}
  request(command:string,fields:Record<string,unknown>={}):Promise<any>{
    if(!this.child){const child=spawn(resolve(`.data/${this.options.crashRoot?'crash-target':'native-target'}/debug/examples/workspace-registry-driver`),[this.root],{stdio:['pipe','pipe','pipe'],env:{...process.env,...(this.options.crashRoot?{GREIVA_CRASH_BARRIER_ROOT:this.options.crashRoot}:{})}});this.child=child;const lines=createInterface({input:child.stdout});let stderr='';child.stderr.on('data',value=>{stderr+=String(value);});lines.on('line',line=>{const reply=JSON.parse(line),pending=this.pending.get(reply.id);this.pending.delete(reply.id);if(reply.error)pending?.reject(Error(reply.error));else pending?.resolve(reply.value);});const end=()=>{if(this.child!==child)return;this.child=null;lines.close();for(const pending of this.pending.values())pending.reject(Error('Registry driver stopped: '+stderr));this.pending.clear();};child.on('exit',end);child.on('error',end);}
    const child=this.child,id=++this.sequence;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({id,command,...fields})+'\n');});
  }
  readonly invoke:NativeWorkspaceInvoke=async<T>(command:string,args?:Record<string,unknown>)=>this.request(command==='workspace_open'?'open':command==='workspace_close'?'close':command==='workspace_execute'?'execute':'invalid',args) as Promise<T>;
  async close(signal:NodeJS.Signals='SIGTERM'){const child=this.child;if(!child)return;await new Promise<void>(done=>{child.once('exit',()=>done());child.kill(signal);});}
}
