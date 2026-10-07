import {createRoot} from 'react-dom/client';
import {PrivateLoginController} from '../../apps/client/src/auth/private-login';
import {nativeWorkspaceDevice} from '../../apps/client/src/workspace/native-workspace-device';
import {PrivateWorkspaceController} from '../../apps/client/src/workspace/private-workspace-controller';
import {PrivateWorkspaceScreen} from '../../apps/client/src/workspace/PrivateWorkspaceScreen';
import {privateWorkspaceFixture} from '../support/private-workspace-fixture';
import '../../apps/client/src/style.css';import '../../apps/client/src/workspace/style.css';
if(import.meta.env.VITE_GREIVA_TEST_HOOKS!=='1')throw Error('Test fixture disabled');
const f=privateWorkspaceFixture(),login=new PrivateLoginController(f.configuration,f.fetchPort,(identity,signal)=>nativeWorkspaceDevice(identity,signal,f.invoke)),workspace=new PrivateWorkspaceController(f.invoke);
createRoot(document.getElementById('root')!).render(<PrivateWorkspaceScreen login={login} workspace={workspace} nativeAvailable/>);
let resume=()=>{};
const test={
 snapshot:()=>({state:workspace.snapshot,pages:[...f.local.values()].map(page=>({id:page.metadata.id,title:page.metadata.title,wires:page.queue.map(frame=>frame.wire)})),reads:f.state.readCalls.slice(),calls:f.calls,sent:f.state.sentWires.slice(),composing:workspace.editor?.isComposing??false}),
 durable:()=>workspace.editor?.durable(),refreshLocal:()=>workspace.loadLocal(),
 loseAck:()=>{f.state.loseAck=true;},loseCreateReply:()=>{f.state.loseCreateReply=true;},failStorage:()=>{f.state.storageFailure=true;},failCatalog:()=>{f.state.catalogFailure=true;},
 holdOpen:()=>{let first=true;const wait=new Promise<void>(resolve=>{resume=resolve;});f.state.nativeHook=async command=>{if(command==='workspace_open'&&first){first=false;await wait;}};},resume:()=>resume(),
 seedPagination:async()=>{for(let i=0;i<51;i++)await f.seedLocal('local '+i);const id=[...f.local.keys()].sort().at(-1)!;f.local.get(id)!.metadata.title='一覧の次のPage';f.seedRemote('サーバーで見える次のPage','server copy',id);await workspace.loadLocal();},
 seedRemote:()=>f.seedRemote('遠隔のPage','remote text'),
};
(window as unknown as {workspaceTest:typeof test}).workspaceTest=test;
window.addEventListener('pagehide',()=>{login.dispose();void workspace.dispose();f.cleanup();},{once:true});
