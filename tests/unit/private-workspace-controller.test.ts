import {it,expect,vi} from 'vitest';
import {PrivateLoginController} from '../../apps/client/src/auth/private-login.js';
import {nativeWorkspaceDevice} from '../../apps/client/src/workspace/native-workspace-device.js';
import {PrivateWorkspaceController} from '../../apps/client/src/workspace/private-workspace-controller.js';
import {privateWorkspaceFixture} from '../support/private-workspace-fixture.js';
const deferred=()=>{let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return {promise,resolve};};
async function fixture(){const f=privateWorkspaceFixture(),login=new PrivateLoginController(f.configuration,f.fetchPort,(identity,signal)=>nativeWorkspaceDevice(identity,signal,f.invoke)),workspace=new PrivateWorkspaceController(f.invoke);await login.login('fixture@example.invalid','fixture-password');await login.register();return {...f,login,workspace,async dispose(){await workspace.dispose();login.dispose();f.cleanup();}};}

it('WORKSPACE-UI: local create/edit/logout/re-login keeps captured store and exact pending; remote catalog is explicit',async()=>{
 const f=await fixture();try{await f.workspace.connect(f.login.activeConnection!);expect(f.workspace.snapshot).toMatchObject({phase:'ready',remoteStatus:'unloaded',localPages:[]});
 await f.workspace.createPage('local');const page=f.workspace.editor!;f.edit(page.document,'durable');await page.durable();const before=f.local.get(page.pageId)!.queue.map(value=>value.wire);
 await f.workspace.close();await f.login.logout();expect(f.workspace.snapshot).toMatchObject({phase:'closed',localPages:[],selectedPageId:null});expect(f.login.activeConnection).toBeNull();
 await f.login.login('fixture@example.invalid','fixture-password');await f.login.register();await f.workspace.connect(f.login.activeConnection!);await f.workspace.openPage(page.pageId);
 expect(f.workspace.editor!.document.getXmlFragment('body').toString()).toContain('durable');expect(f.local.get(page.pageId)!.queue.map(value=>value.wire)).toEqual(before);expect(f.workspace.editor!.snapshot.synced).toBe(false);
 await f.workspace.editor!.sync();expect(f.workspace.snapshot.localPages.find(value=>value.metadata.id===page.pageId)?.pending).toBe(0);await f.workspace.loadRemote();expect(f.workspace.snapshot.remotePages.map(value=>value.id)).toEqual([page.pageId]);
 }finally{await f.dispose();}
});
it('WORKSPACE-UI: remote selection uses local pending even outside first local pagination; missing local downloads without implicit sync',async()=>{
 const f=await fixture();try{for(let i=0;i<51;i++)await f.seedLocal('local '+i);const id=[...f.local.keys()].sort().at(-1)!;f.seedRemote('server copy','server',id);await f.workspace.connect(f.login.activeConnection!);expect(f.workspace.snapshot.localPages.some(value=>value.metadata.id===id)).toBe(false);await f.workspace.loadRemote();await f.workspace.openPage(id);
 expect(f.state.readCalls).toEqual([]);expect(f.workspace.editor!.snapshot.pending).toBe(1);expect(f.workspace.editor!.snapshot.synced).toBe(false);const remote=f.seedRemote('remote only');await f.workspace.loadRemote();await f.workspace.openPage(remote);expect(f.state.readCalls).toContain(remote);expect(f.workspace.editor!.document.getXmlFragment('body').toString()).toContain('remote');expect(f.workspace.editor!.snapshot.synced).toBe(false);
 }finally{await f.dispose();}
});
it('WORKSPACE-UI: ignored-abort slow native open is serialized and cleaned before replacement opens; old Auth abort cannot cancel new connect',async()=>{
 const f=await fixture(),wait=deferred();try{let first=true;f.state.nativeHook=async command=>{if(command==='workspace_open'&&first){first=false;await wait.promise;}};const old=f.workspace.connect(f.login.activeConnection!);await vi.waitFor(()=>expect(f.calls.some(value=>value.command==='workspace_open')).toBe(true));
 await f.login.refresh();await f.login.register();const next=f.workspace.connect(f.login.activeConnection!);wait.resolve();await Promise.all([old,next]);expect(f.workspace.snapshot.phase).toBe('ready');const events=f.calls.map(value=>value.command);expect(events.indexOf('workspace_close')).toBeLessThan(events.lastIndexOf('workspace_open'));
 }finally{wait.resolve();await f.dispose();}
});
it('WORKSPACE-UI: close removes titles/editor and ignored-abort catalog never repopulates them',async()=>{
 const f=await fixture(),wait=deferred();try{f.seedRemote('private remote');await f.workspace.connect(f.login.activeConnection!);f.state.queryHook=()=>wait.promise;const query=f.workspace.loadRemote();await vi.waitFor(()=>expect(f.workspace.snapshot.busy).toBe(true));const close=f.workspace.close();wait.resolve();await Promise.all([query,close]);expect(f.workspace.snapshot).toMatchObject({phase:'closed',remotePages:[],localPages:[],selectedPageId:null,busy:false});expect(f.workspace.editor).toBeNull();
 }finally{wait.resolve();await f.dispose();}
});
it('WORKSPACE-UI: uncertain create retries same ID; composition and failed draft block navigation and preserve copyable body',async()=>{
 const f=await fixture();try{await f.workspace.connect(f.login.activeConnection!);f.state.loseCreateReply=true;await f.workspace.createPage('unknown result');expect(f.workspace.snapshot.retryCreate).toBe(true);expect(f.workspace.snapshot.error).toBe('storage');await f.workspace.createPage('changed title');expect(f.local.size).toBe(1);await f.workspace.createPage('unknown result');const creates=f.calls.filter(value=>value.request?.command==='page_create');expect(creates[0]!.request!.pageId).toBe(creates[1]!.request!.pageId);expect(f.local.size).toBe(1);
 const page=f.workspace.editor!;page.setComposing(true);await f.workspace.createPage('blocked');expect(f.workspace.editor).toBe(page);page.setComposing(false);f.state.storageFailure=true;f.edit(page.document,'copy me');await expect(page.durable()).rejects.toThrow();await f.workspace.createPage('blocked');expect(f.workspace.editor).toBe(page);expect(page.document.getXmlFragment('body').toString()).toContain('copy me');expect(f.workspace.snapshot.navigationBlocked).toBe(true);
 }finally{await f.dispose();}
});
it('WORKSPACE-UI: catalog transport errors retain same-account local Pages and never expose private causes',async()=>{
 const f=await fixture();try{const id=await f.seedLocal('retained');await f.workspace.connect(f.login.activeConnection!);f.state.catalogFailure=true;await f.workspace.loadRemote();expect(f.workspace.snapshot).toMatchObject({phase:'ready',remoteStatus:'error',error:'transport'});expect(JSON.stringify(f.workspace.snapshot)).not.toContain('fixture-private-token');await f.workspace.openPage(id);expect(f.workspace.editor!.snapshot.phase).toBe('ready');
 }finally{await f.dispose();}
});
it('WORKSPACE-UI: initial snapshot is immutable; malformed local presence never falls back to a remote download',async()=>{
 const f=await fixture();const bad=new PrivateWorkspaceController(async(command,args)=>{if(command==='workspace_execute'&&(args?.request as {command?:string})?.command==='page_exists')return 'yes';return f.invoke(command,args);});
 try{expect(Object.isFrozen(bad.snapshot.localPages)).toBe(true);expect(Object.isFrozen(bad.snapshot.remotePages)).toBe(true);const id=f.seedRemote('remote');await bad.connect(f.login.activeConnection!);await bad.loadRemote();await bad.openPage(id);expect(bad.snapshot.error).toBe('protocol');expect(bad.editor).toBeNull();expect(f.state.readCalls).toEqual([]);}
 finally{await bad.dispose();await f.dispose();}
});
