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
const test={seedRichView:(id:string)=>f.database.seedRichView(id),
 viewSnapshot:()=>({state:workspace.databaseViews?.snapshot??null,queue:f.database.viewQueue,wires:f.database.viewState.wires.slice(),acks:f.database.viewState.acks.slice(),browser:workspace.database?.snapshot??null}),
 remoteView:(id:string,patch:Partial<import('@greiva/domain').DatabaseView>)=>f.database.remoteView(id,patch),
 loseViewEnqueue:()=>{f.database.viewState.loseEnqueue=true;},loseViewHttp:()=>{f.database.viewState.loseHttp=true;},loseViewAck:()=>{f.database.viewState.loseAck=true;},failViewQueueAfterAck:()=>{f.database.viewState.failQueueAfterAck=true;},failViewDetails:()=>{f.database.state.failRead='database_view_load';},restoreViewRead:()=>{f.database.state.failRead=null;},
 databaseCreationSnapshot:()=>({state:workspace.databaseCreation?.snapshot??null,queue:f.database.sourceQueue,wires:f.database.state.sourceSentWires.slice(),acks:f.database.state.sourceAcks.slice(),browser:workspace.database?.snapshot??null}),
 bindHiddenRecordPage:(pageId:string)=>{const source=workspace.database?.snapshot.selected?.source;if(!source)throw Error("Select Source first");const id="ffffffff-ffff-7fff-8fff-ffffffffffff";f.database.records.set(id,{id,workspaceId:source.workspaceId,sourceId:source.id,pageId,version:1,values:{}});},
 failRecordDetails:()=>{f.database.state.failRead="database_record_load";},
 recordUpdateSnapshot:()=>({state:workspace.databaseRecords?.snapshot??null,queue:f.database.updateQueue,wires:f.database.recordState.wires.slice(),acks:f.database.recordState.acks.slice(),browser:workspace.database?.snapshot??null}),
 remoteRecord:(recordId:string,values:Record<string,import("@greiva/domain").DatabaseValue>)=>f.database.remoteRecord(recordId,values),
 recordCreationSnapshot:()=>({state:workspace.databaseRecords?.snapshot??null,queue:f.database.recordQueue,wires:f.database.recordState.wires.slice(),acks:f.database.recordState.acks.slice(),browser:workspace.database?.snapshot??null}),
 loseRecordEnqueue:()=>{f.database.recordState.loseEnqueue=true;},loseRecordHttp:()=>{f.database.recordState.loseHttp=true;},loseRecordAck:()=>{f.database.recordState.loseAck=true;},failRecordQueueAfterAck:()=>{f.database.recordState.failQueueAfterAck=true;},restoreRecordQueue:()=>{f.database.state.failRead=null;},blockRecordPage:()=>{f.database.recordState.blocked='page';},unblockRecordPage:()=>{f.database.recordState.blocked=null;},
 loseDatabaseCreationEnqueue:()=>{f.database.state.loseSourceEnqueueReply=true;},loseDatabaseCreationHttp:()=>{f.database.state.loseSourceHttp=true;},loseDatabaseCreationAck:()=>{f.database.state.loseSourceAckReply=true;},failDatabaseCreationQueueAfterAck:()=>{f.database.state.failQueueAfterAck=true;},restoreDatabaseCreationQueue:()=>{f.database.state.failRead=null;},
 seedDatabase:async(count=3)=>{const seeded=f.database.seed(count);f.seedRemote('既知のPage','known body',seeded.rows[0]!.pageId);f.seedRemote('','blank title body',seeded.rows[1]!.pageId);await workspace.loadRemote();return{sourceId:seeded.source.id,recordIds:seeded.rows.map(row=>row.id),pageIds:seeded.rows.map(row=>row.pageId),views:seeded.savedViews.map(row=>({id:row.id,name:row.name}))};},
 databaseSnapshot:()=>({state:workspace.database?.snapshot??null,calls:f.database.state.fetchCalls.slice(),receives:f.database.state.changeReceives.slice(),sources:f.database.state.sourceReceives.slice()}),
 loseDatabaseChangesReply:()=>{f.database.state.loseChangesReply=true;},
 failDatabaseRecords:()=>{f.database.state.failRead='database_record_list';},restoreDatabaseRecords:()=>{f.database.state.failRead=null;},
 failDatabaseCatalog:()=>{f.database.state.failCatalog=true;},restoreDatabaseCatalog:()=>{f.database.state.failCatalog=false;},
 snapshot:()=>({state:workspace.snapshot,pages:[...f.local.values()].map(page=>({id:page.metadata.id,title:page.metadata.title,wires:page.queue.map(frame=>frame.wire)})),reads:f.state.readCalls.slice(),calls:f.calls,sent:f.state.sentWires.slice(),composing:workspace.editor?.isComposing??false}),
 durable:()=>workspace.editor?.durable(),refreshLocal:()=>workspace.loadLocal(),
 loseAck:()=>{f.state.loseAck=true;},loseCreateReply:()=>{f.state.loseCreateReply=true;},failStorage:()=>{f.state.storageFailure=true;},failCatalog:()=>{f.state.catalogFailure=true;},
 holdOpen:()=>{let first=true;const wait=new Promise<void>(resolve=>{resume=resolve;});f.state.nativeHook=async command=>{if(command==='workspace_open'&&first){first=false;await wait;}};},resume:()=>resume(),
 seedPagination:async()=>{for(let i=0;i<51;i++)await f.seedLocal('local '+i);const id=[...f.local.keys()].sort().at(-1)!;f.local.get(id)!.metadata.title='一覧の次のPage';f.seedRemote('サーバーで見える次のPage','server copy',id);await workspace.loadLocal();},
 seedRemote:()=>f.seedRemote('遠隔のPage','remote text'),
 structuredSnapshot:()=>({data:f.structured,sent:f.state.structuredSent.slice(),state:workspace.structured?.snapshot}),
 rejectStructured:()=>{f.state.structuredReject=true;},loseStructuredAck:()=>{f.state.structuredLoseAck=true;},loseStructuredMutationReply:()=>{f.state.structuredLoseMutationReply=true;},failStructuredStorage:()=>{f.state.structuredStorageFailure=true;},restoreStructuredStorage:()=>{f.state.structuredStorageFailure=false;},
 seedConflict:async()=>{f.seedConflict();await workspace.structured?.sync();},
 titleSnapshot:()=>({state:workspace.title?.snapshot??null,sent:f.title.state.sent.slice(),records:workspace.editor?f.title.snapshot(workspace.editor.pageId)?.operations??[]:[]}),
 loseTitleAck:()=>{f.title.state.loseAck=true;},loseTitleMutationReply:()=>{f.title.state.loseMutation=true;},failTitleStorage:()=>{f.title.state.storageFailure=true;},restoreTitleStorage:()=>{f.title.state.storageFailure=false;},rejectTitle:()=>{f.title.state.reject=true;},
 remoteTitle:(value:string)=>{if(workspace.editor)f.title.remoteEdit(workspace.editor.pageId,value);},
 seedTitleCandidates:()=>{if(workspace.editor)f.title.seedCandidates(workspace.editor.pageId,101);},refreshTitle:()=>workspace.title?.history(),
 changesSnapshot:()=>({state:workspace.snapshot.changes,cached:workspace.snapshot.cachedPages,pulls:f.changes.pulls.slice(),receives:f.changes.receiveCount}),
 loseChangesReply:()=>{f.changes.loseReply=true;},failChangesTransport:()=>{f.changes.transportFailure=true;},restoreChangesTransport:()=>{f.changes.transportFailure=false;},
 holdChanges:()=>{const wait=new Promise<void>(resolve=>{resume=resolve;});f.changes.hook=()=>wait;},
 resolveRemoteTitle:()=>workspace.editor?f.title.resolveRemote(workspace.editor.pageId):null,
};
(window as unknown as {workspaceTest:typeof test}).workspaceTest=test;
window.addEventListener('pagehide',()=>{login.dispose();void workspace.dispose();f.cleanup();},{once:true});
