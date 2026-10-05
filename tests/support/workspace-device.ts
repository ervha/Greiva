import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import type { WorkspaceSyncContext, WorkspaceSessionStore } from '@greiva/sync';
import type { WorkspacePushRequest, WorkspacePullResponse, verifyWorkspacePushResponse } from '@greiva/protocol/workspace';
export class WorkspaceDevice implements WorkspaceSessionStore {
  readonly context: WorkspaceSyncContext;
  private child: ChildProcessWithoutNullStreams | null = null;
  private sequence = 0;
  private pending = new Map<number,{resolve(value:unknown):void;reject(error:Error):void}>();
  constructor(readonly path:string,context:WorkspaceSyncContext,private options:{crashRoot?:string}={}) {this.context=Object.freeze({...context});}
  request(command:string,fields:Record<string,unknown>={}):Promise<any> {
    if(!this.child) {
      const child=spawn(resolve(`.data/${this.options.crashRoot?'crash-target':'native-target'}/debug/examples/workspace-driver`),[this.path,JSON.stringify(this.context)],{stdio:['pipe','pipe','pipe'],env:{...process.env,...(this.options.crashRoot?{GREIVA_CRASH_BARRIER_ROOT:this.options.crashRoot}:{})}});this.child=child;
      const lines=createInterface({input:child.stdout});let stderr='';child.stderr.on('data',value=>{stderr+=String(value);});
      lines.on('line',line=>{const reply=JSON.parse(line);const pending=this.pending.get(reply.id);this.pending.delete(reply.id);if(reply.error)pending?.reject(Error(reply.error));else pending?.resolve(reply.value);});
      const end=()=>{if(this.child!==child)return;this.child=null;lines.close();for(const item of this.pending.values())item.reject(Error('Workspace driver stopped: '+stderr));this.pending.clear();};child.on('exit',end);child.on('error',end);
    }
    const child=this.child,id=++this.sequence;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({id,command,...fields})+'\n');});
  }
  private check(context:WorkspaceSyncContext) {if(Object.entries(this.context).some(([key,value])=>context[key as keyof WorkspaceSyncContext]!==value))throw Error('Workspace port context mismatch');}
  async acknowledge(context:WorkspaceSyncContext,_prepared:WorkspacePushRequest,response:ReturnType<typeof verifyWorkspacePushResponse>,wire:string) {this.check(context);await this.request('ack',{wire,response});}
  async applyPull(context:WorkspaceSyncContext,request:unknown,response:WorkspacePullResponse) {this.check(context);await this.request('pull',{request,response});}
  async close(signal:NodeJS.Signals='SIGTERM') {const child=this.child;if(!child)return;await new Promise<void>(done=>{child.once('exit',()=>done());child.kill(signal);});}
}
