//! New native entry: server bootstrap + instance/generation-bound admission.
//! Raw context, remote ACK/pull and secrets are never accepted from a caller.
use crate::{native_credentials::{CredentialError,CredentialStore},native_session::{NativeSession,NativeProvider,SessionSnapshot,SessionLogout,WorkspaceAdmission},offline_lease::NativeClock,WorkspaceHandle,WorkspaceOwner,WorkspaceRegistry};
use std::{path::PathBuf,sync::Arc};
use tokio::sync::Mutex;
#[path="native_structured.rs"] mod structured_transport;
pub use structured_transport::{StructuredSendStatus,StructuredPullStatus};
type Result<T>=std::result::Result<T,CredentialError>;
#[derive(Clone)]
struct PendingPageAck {prepared:serde_json::Value,response:serde_json::Value}
struct CatalogProgress {cursor:Option<String>,last:Option<String>}
struct GateState {structured_ack:Option<(String,serde_json::Value)>,structured_received:Option<(serde_json::Value,serde_json::Value)>,generation:u64,active:Option<(WorkspaceHandle,WorkspaceAdmission)>,offline_handle:Option<(WorkspaceHandle,crate::offline_lease::LocalAccess)>,receipts:std::collections::HashMap<String,PendingPageAck>,title_receipts:std::collections::HashMap<String,PendingPageAck>,title_reads:std::collections::HashMap<String,serde_json::Value>,reads:std::collections::HashMap<String,serde_json::Value>,catalog:Option<CatalogProgress>}
#[derive(serde::Serialize)]
#[serde(rename_all="camelCase")]
pub struct NativePageCatalog {pub pages:Vec<crate::PageMetadata>,pub has_more:bool}
#[derive(serde::Serialize,Debug,PartialEq,Eq)]#[serde(rename_all="camelCase")]
pub struct OfflinePreparation {pub available:bool,pub expires_at:Option<u64>}
#[derive(serde::Serialize)]#[serde(rename_all="camelCase")]
pub struct OfflineWorkspace {pub workspace:WorkspaceHandle,pub expires_at:u64}
#[derive(serde::Serialize)]#[serde(rename_all="camelCase")]
pub struct OfflineDeadline {pub expires_at:u64}
fn catalog_response(context:&crate::WorkspaceContext,value:&serde_json::Value,after:Option<&str>)->Result<(NativePageCatalog,CatalogProgress)>{
    let keys=["protocolVersion","workspaceId","workspaceEpoch","pages","nextCursor","hasMore"];let object=value.as_object().ok_or(CredentialError)?;
    if object.len()!=keys.len()||keys.iter().any(|key|!object.contains_key(*key))||value["protocolVersion"]!=1||value["workspaceId"]!=context.workspace_id||value["workspaceEpoch"]!=context.stream_epoch{return Err(CredentialError)}
    let raw=value["pages"].as_array().filter(|p|p.len()<=20).ok_or(CredentialError)?;let mut pages=Vec::new();let mut last=after.map(str::to_string);
    for row in raw{let id=row["id"].as_str().ok_or(CredentialError)?;if !crate::structured::uuid_v7(id)||last.as_ref().is_some_and(|old|id<=old.as_str()){return Err(CredentialError)}pages.push(crate::private_page::metadata(row,id).map_err(|_|CredentialError)?);last=Some(id.into());}
    let cursor=if value["nextCursor"].is_null(){None}else{let cursor=value["nextCursor"].as_str().filter(|c|!c.is_empty()&&c.len()<=8192&&!c.chars().any(char::is_control)).ok_or(CredentialError)?;Some(cursor.into())};let has_more=value["hasMore"].as_bool().ok_or(CredentialError)?;
    if has_more!=cursor.is_some()||has_more&&pages.is_empty(){return Err(CredentialError)}Ok((NativePageCatalog{pages,has_more},CatalogProgress{cursor,last}))
}
#[derive(Clone,Copy,Debug,PartialEq,Eq,serde::Serialize)]
#[serde(rename_all="snake_case")]
pub enum PageSendStatus {Idle,Acked,SendUnknown,AckPending}
#[derive(Clone,Copy,Debug,PartialEq,Eq,serde::Serialize)]
#[serde(rename_all="snake_case")]
pub enum TitleSendStatus {Idle,Applied,Conflict,Rejected,SendUnknown,AckPending}
#[derive(Clone,Copy,Debug,PartialEq,Eq,serde::Serialize)]
#[serde(rename_all="snake_case")]
pub enum PageReadStatus {Received,ReadUnknown,StorePending}
pub struct NativeWorkspaceGate<S:CredentialStore,P:NativeProvider,C:NativeClock> {
    session:NativeSession<S,P,C>,registry:Arc<WorkspaceRegistry>,
    active:Mutex<GateState>,structured_io:Mutex<()>,
    page_send:Mutex<()>,title_send:Mutex<()>,title_read:Mutex<()>,
    page_read:Mutex<()>,
    page_catalog:Mutex<()>,
    offline:Option<Arc<crate::offline_lease::OfflineLeaseStore<S,C>>>,offline_prepare:Mutex<()>,
    #[cfg(test)]ack_failure:std::sync::atomic::AtomicU8,
    #[cfg(test)]read_failure:std::sync::atomic::AtomicU8,
}
impl<S:CredentialStore+'static,P:NativeProvider,C:NativeClock+'static> NativeWorkspaceGate<S,P,C> {
    pub fn new(session:NativeSession<S,P,C>,root:PathBuf)->Self {Self {session,registry:Arc::new(WorkspaceRegistry::new(root)),active:Mutex::new(GateState{structured_ack:None,structured_received:None,generation:0,active:None,offline_handle:None,receipts:std::collections::HashMap::new(),title_receipts:std::collections::HashMap::new(),title_reads:std::collections::HashMap::new(),reads:std::collections::HashMap::new(),catalog:None}),structured_io:Mutex::new(()),page_send:Mutex::new(()),title_send:Mutex::new(()),title_read:Mutex::new(()),page_read:Mutex::new(()),page_catalog:Mutex::new(()),offline:None,offline_prepare:Mutex::new(()),#[cfg(test)]ack_failure:std::sync::atomic::AtomicU8::new(0),#[cfg(test)]read_failure:std::sync::atomic::AtomicU8::new(0)}}
    async fn close_active(&self,state:&mut GateState){state.structured_ack=None;state.structured_received=None;state.active=None;state.offline_handle=None;state.receipts.clear();state.title_receipts.clear();state.title_reads.clear();state.reads.clear();state.catalog=None;state.generation=state.generation.checked_add(1).unwrap_or(u64::MAX);self.registry.close_all().await;}
    pub fn with_offline(mut self,lease:crate::offline_lease::OfflineLeaseStore<S,C>)->Self{self.offline=Some(Arc::new(lease));self}
    async fn invalidate_offline(&self)->Result<()>{if let Some(lease)=&self.offline{if lease.logout().await.is_err(){let _=self.session.logout().await;return Err(CredentialError)}}Ok(())}
    pub async fn login(&self,email:&str,password:Vec<u8>)->Result<SessionSnapshot>{
        {let mut active=self.active.lock().await;self.close_active(&mut active).await;}
        self.invalidate_offline().await?;
        self.session.login(email,password).await
    }
    pub async fn restore(&self)->Result<SessionSnapshot>{
        {let mut active=self.active.lock().await;self.close_active(&mut active).await;}
        self.invalidate_offline().await?;
        self.session.restore().await
    }
    pub async fn snapshot(&self)->SessionSnapshot {
        let mut active=self.active.lock().await;let snapshot=self.session.snapshot().await;
        if snapshot.phase!=crate::native_session::Phase::Verified&&active.active.is_some(){self.close_active(&mut active).await;}snapshot
    }
    /// Caller supplies only a UUID candidate. Owner is native verified; the
    /// stable device ID is loaded locally before authenticated server bootstrap.
    pub async fn open(&self,candidate:&str)->Result<WorkspaceHandle>{
        let generation={let mut active=self.active.lock().await;self.close_active(&mut active).await;if active.generation==u64::MAX{return Err(CredentialError)}active.generation};
        let registry=self.registry.clone();let candidate=candidate.to_string();
        let device=self.session.local(None,|identity|Box::pin(async move {
            registry.device(WorkspaceOwner{issuer:identity.issuer.clone(),subject_id:identity.subject.clone()},&candidate).await.map_err(|_|CredentialError)
        })).await?;
        let admission=self.session.bootstrap(&device.client_id).await?;
        let mut active=self.active.lock().await;if active.generation!=generation{return Err(CredentialError)}
        let context=admission.context().clone();let registry=self.registry.clone();
        match self.session.local(Some(&admission),|_|Box::pin(async move {registry.open(context).await.map_err(|_|CredentialError)})).await {
            Ok(handle)=>{active.active=Some((handle.clone(),admission));Ok(handle)},
            Err(error)=>{self.registry.close_all().await;Err(error)},
        }
    }
    pub async fn close(&self,handle:&str)->Result<()> {
        let mut active=self.active.lock().await;if active.active.as_ref().is_none_or(|(h,_)|h.handle!=handle){return Err(CredentialError)}
        self.close_active(&mut active).await;Ok(())
    }
    pub async fn execute(&self,handle:&str,request:serde_json::Value)->Result<serde_json::Value>{
        let mut active=self.active.lock().await;
        let (_,admission)=active.active.as_ref().filter(|(h,_)|h.handle==handle).ok_or(CredentialError)?;
        // Remote effects will be native HTTP transport operations, never a
        // WebView's assertion that a wire was ACKed or a pull was authorized.
        if !crate::workspace_registry::local_command(&request){return Err(CredentialError)}
        let registry=self.registry.clone();let handle=handle.to_string();
        let result=self.session.local(Some(admission),|_|Box::pin(async move {registry.execute(&handle,request).await.map_err(|_|CredentialError)})).await;
        if result.is_err(){self.close_active(&mut active).await;}result
    }
    pub async fn logout(&self)->SessionLogout {
        let mut active=self.active.lock().await;self.close_active(&mut active).await;
        let offline=if let Some(lease)=&self.offline{Some(lease.logout().await)}else{None};let mut result=self.session.logout_with_revoke().await;
        match offline{Some(Err(_))=>{result.persistent_locked=false;result.cleanup_pending=None;},Some(Ok(lock))=>{if let Some(pending)=&mut result.cleanup_pending{*pending|=lock.cleanup_pending;}},None=>{}}result
    }
    /// One explicit FIFO frame. Caller supplies no wire, receipt, identity or
    /// bearer. False means no pending frame; true follows durable native ACK.
    /// Error is unknown delivery/ACK, not proof that the server rejected it.
    pub async fn send_page(&self,handle:&str,page:&str)->Result<bool> {
        match self.send_page_status(handle,page).await? {PageSendStatus::Idle=>Ok(false),PageSendStatus::Acked=>Ok(true),_=>Err(CredentialError)}
    }
    /// Sanitized IPC status. A validated receipt stays native in memory until
    /// its original ACK is confirmed or the handle is closed. No automatic retry.
    pub async fn send_page_status(&self,handle:&str,page:&str)->Result<PageSendStatus> {
        if !crate::structured::uuid_v7(page){return Err(CredentialError)}
        let _send=self.page_send.lock().await;
        let (generation,admission,cached,prepared)={
            let active=self.active.lock().await;
            let (_,admission)=active.active.as_ref().filter(|(h,_)|h.handle==handle).ok_or(CredentialError)?;
            let registry=self.registry.clone();let h=handle.to_string();let p=page.to_string();
            let cached=active.receipts.get(page).cloned();
            if cached.is_none() && active.receipts.len()>=8{return Err(CredentialError)}
            let prepared=if let Some(receipt)=&cached {receipt.prepared.clone()}else{self.session.local(Some(admission),|_|Box::pin(async move {registry.execute(&h,serde_json::json!({"command":"page_prepare","pageId":p})).await.map_err(|_|CredentialError)})).await?};
            (active.generation,admission.clone(),cached,prepared)
        };
        if prepared.is_null(){return Ok(PageSendStatus::Idle)}
        let kind=prepared["kind"].as_str().ok_or(CredentialError)?;
        let wire=prepared["wire"].as_str().ok_or(CredentialError)?;
        let response=if let Some(receipt)=cached {receipt.response}else{match self.session.page_send(&admission,page,kind,wire).await {Ok(response)=>response,Err(_)=>return Ok(PageSendStatus::SendUnknown)}};
        if crate::private_page::validate_ack_response(&admission.context().workspace_id,page,kind,prepared["digest"].as_str().ok_or(CredentialError)?,&response).is_err(){return Ok(PageSendStatus::SendUnknown)}
        let mut active=self.active.lock().await;
        if active.generation!=generation || active.active.as_ref().is_none_or(|(h,_)|h.handle!=handle){return Err(CredentialError)}
        active.receipts.insert(page.into(),PendingPageAck{prepared:prepared.clone(),response:response.clone()});
        let registry=self.registry.clone();let h=handle.to_string();let p=page.to_string();let wire=wire.to_string();let sequence=prepared["sequence"].clone();
        #[cfg(test)]let failure=self.ack_failure.swap(0,std::sync::atomic::Ordering::SeqCst);
        let result=self.session.local(Some(&admission),|_|Box::pin(async move {
            #[cfg(test)]if failure==1{return Err(CredentialError)}
            let value=registry.execute(&h,serde_json::json!({"command":"page_ack","pageId":p,"sequence":sequence,"wire":wire,"response":response})).await.map_err(|_|CredentialError)?;
            #[cfg(test)]if failure==2{return Err(CredentialError)}
            Ok(value)
        })).await;
        if result.is_err(){return Ok(PageSendStatus::AckPending)}
        active.receipts.remove(page);Ok(PageSendStatus::Acked)
    }
    pub async fn send_title_status(&self,handle:&str,page:&str)->Result<TitleSendStatus> {
        if !crate::structured::uuid_v7(page){return Err(CredentialError)}
        let _send=self.title_send.lock().await;
        let (generation,admission,cached,prepared)={
            let active=self.active.lock().await;
            let (_,admission)=active.active.as_ref().filter(|(h,_)|h.handle==handle).ok_or(CredentialError)?;
            let registry=self.registry.clone();let h=handle.to_string();let p=page.to_string();
            let cached=active.title_receipts.get(page).cloned();
            if cached.is_none() && active.title_receipts.len()>=8{return Err(CredentialError)}
            let prepared=if let Some(receipt)=&cached {receipt.prepared.clone()}else{self.session.local(Some(admission),|_|Box::pin(async move {registry.execute(&h,serde_json::json!({"command":"title_prepare","pageId":p})).await.map_err(|_|CredentialError)})).await?};
            (active.generation,admission.clone(),cached,prepared)
        };
        if prepared.is_null(){return Ok(TitleSendStatus::Idle)}
        let kind="rename";
        let wire=prepared["wire"].as_str().ok_or(CredentialError)?;
        let response=if let Some(receipt)=cached {receipt.response}else{match self.session.title_send(&admission,page,kind,wire).await {Ok(response)=>response,Err(_)=>return Ok(TitleSendStatus::SendUnknown)}};
        if crate::private_title::validate_native_receipt(admission.context(),page,&prepared,&response).is_err(){return Ok(TitleSendStatus::SendUnknown)}
        let status=match response["result"]["status"].as_str(){Some("applied")=>TitleSendStatus::Applied,Some("conflict")=>TitleSendStatus::Conflict,Some("rejected")=>TitleSendStatus::Rejected,_=>return Ok(TitleSendStatus::SendUnknown)};
        let mut active=self.active.lock().await;
        if active.generation!=generation || active.active.as_ref().is_none_or(|(h,_)|h.handle!=handle){return Err(CredentialError)}
        // Reject semantically invalid receipts before caching. SQLite compares
        // the native-captured base title, predecessor and immutable wire.
        let registry=self.registry.clone();let h=handle.to_string();let p=page.to_string();let check=prepared.clone();let reply=response.clone();
        if self.session.local(Some(&admission),|_|Box::pin(async move {registry.execute(&h,serde_json::json!({"command":"title_validate","pageId":p,"sequence":check["sequence"],"wire":check["wire"],"response":reply})).await.map_err(|_|CredentialError)})).await.is_err(){return Ok(TitleSendStatus::SendUnknown)}
        active.title_receipts.insert(page.into(),PendingPageAck{prepared:prepared.clone(),response:response.clone()});
        let registry=self.registry.clone();let h=handle.to_string();let p=page.to_string();let wire=wire.to_string();let sequence=prepared["sequence"].clone();
        #[cfg(test)]let failure=self.ack_failure.swap(0,std::sync::atomic::Ordering::SeqCst);
        let result=self.session.local(Some(&admission),|_|Box::pin(async move {
            #[cfg(test)]if failure==1{return Err(CredentialError)}
            let value=registry.execute(&h,serde_json::json!({"command":"title_ack","pageId":p,"sequence":sequence,"wire":wire,"response":response})).await.map_err(|_|CredentialError)?;
            #[cfg(test)]if failure==2{return Err(CredentialError)}
            Ok(value)
        })).await;
        if result.is_err(){return Ok(TitleSendStatus::AckPending)}
        active.title_receipts.remove(page);Ok(status)
    }
    pub async fn cancel_open(&self){let mut active=self.active.lock().await;if active.offline_handle.is_none(){self.close_active(&mut active).await;}}
    /// Native read and transactional receive. No caller-owned diff/vector or
    /// response enters the gate. Received means local commit was confirmed.
    pub async fn read_page(&self,handle:&str,page:&str)->Result<PageReadStatus> {
        if !crate::structured::uuid_v7(page){return Err(CredentialError)}
        let _read=self.page_read.lock().await;
        let (generation,admission,cached)={let active=self.active.lock().await;
            let (_,admission)=active.active.as_ref().filter(|(h,_)|h.handle==handle).ok_or(CredentialError)?;
            let cached=active.reads.get(page).cloned();if cached.is_none()&&active.reads.len()>=8{return Err(CredentialError)}
            // Even a cached response needs a currently admitted session.
            self.session.local(Some(admission),|_|Box::pin(async{Ok(())})).await?;
            (active.generation,admission.clone(),cached)
        };
        let response=if let Some(response)=cached {response}else{match self.session.page_read(&admission,page).await {Ok(response)=>response,Err(_)=>return Ok(PageReadStatus::ReadUnknown)}};
        if crate::private_page::validate_read_response(&admission.context().workspace_id,page,&response).is_err(){return Ok(PageReadStatus::ReadUnknown)}
        let mut active=self.active.lock().await;
        if active.generation!=generation||active.active.as_ref().is_none_or(|(h,_)|h.handle!=handle){return Err(CredentialError)}
        active.reads.insert(page.into(),response.clone());
        let registry=self.registry.clone();let h=handle.to_string();let p=page.to_string();
        #[cfg(test)]let failure=self.read_failure.swap(0,std::sync::atomic::Ordering::SeqCst);
        let result=self.session.local(Some(&admission),|_|Box::pin(async move {
            #[cfg(test)]if failure==1{return Err(CredentialError)}
            let value=registry.execute(&h,serde_json::json!({"command":"page_receive","pageId":p,"response":response})).await.map_err(|_|CredentialError)?;
            #[cfg(test)]if failure==2{return Err(CredentialError)}
            Ok(value)
        })).await;
        if result.is_err(){return Ok(PageReadStatus::StorePending)}
        active.reads.remove(page);Ok(PageReadStatus::Received)
    }
    /// Read-only query. Cursor stays native and never becomes a receive/ACK.
    pub async fn read_title(&self,handle:&str,page:&str)->Result<PageReadStatus> {
        if !crate::structured::uuid_v7(page){return Err(CredentialError)}
        let _read=self.title_read.lock().await;
        let (generation,admission,cached)={let active=self.active.lock().await;
            let (_,admission)=active.active.as_ref().filter(|(h,_)|h.handle==handle).ok_or(CredentialError)?;
            let cached=active.title_reads.get(page).cloned();if cached.is_none()&&active.title_reads.len()>=8{return Err(CredentialError)}
            // Even a cached response needs a currently admitted session.
            self.session.local(Some(admission),|_|Box::pin(async{Ok(())})).await?;
            (active.generation,admission.clone(),cached)
        };
        let response=if let Some(response)=cached {response}else{match self.session.title_read(&admission,page).await {Ok(response)=>response,Err(_)=>return Ok(PageReadStatus::ReadUnknown)}};
        if crate::private_title::validate_native_read(admission.context(),page,&response).is_err(){return Ok(PageReadStatus::ReadUnknown)}
        let mut active=self.active.lock().await;
        if active.generation!=generation||active.active.as_ref().is_none_or(|(h,_)|h.handle!=handle){return Err(CredentialError)}
        active.title_reads.insert(page.into(),response.clone());
        let registry=self.registry.clone();let h=handle.to_string();let p=page.to_string();let client=admission.context().client_id.clone();
        #[cfg(test)]let failure=self.read_failure.swap(0,std::sync::atomic::Ordering::SeqCst);
        let result=self.session.local(Some(&admission),|_|Box::pin(async move {
            #[cfg(test)]if failure==1{return Err(CredentialError)}
            let value=registry.execute(&h,serde_json::json!({"command":"title_receive","pageId":p,"request":{"protocolVersion":1,"clientId":client,"afterConflict":null,"limit":50},"response":response})).await.map_err(|_|CredentialError)?;
            #[cfg(test)]if failure==2{return Err(CredentialError)}
            Ok(value)
        })).await;
        if result.is_err(){return Ok(PageReadStatus::StorePending)}
        active.title_reads.remove(page);Ok(PageReadStatus::Received)
    }
    pub async fn catalog_pages(&self,handle:&str,more:bool)->Result<NativePageCatalog>{
        let _query=self.page_catalog.try_lock().map_err(|_|CredentialError)?;
        let (generation,admission,cursor,after)={let mut active=self.active.lock().await;
            if active.active.as_ref().is_none_or(|(h,_)|h.handle!=handle){return Err(CredentialError)}
            if !more{active.catalog=None;}
            let (cursor,after)=if more{let progress=active.catalog.as_ref().ok_or(CredentialError)?;(Some(progress.cursor.clone().ok_or(CredentialError)?),progress.last.clone())}else{(None,None)};
            (active.generation,active.active.as_ref().unwrap().1.clone(),cursor,after)
        };
        let value=self.session.page_catalog(&admission,cursor.as_deref()).await?;let (response,progress)=catalog_response(admission.context(),&value,after.as_deref())?;
        if cursor.is_some()&&cursor==progress.cursor{return Err(CredentialError)}
        let mut active=self.active.lock().await;if active.generation!=generation||active.active.as_ref().is_none_or(|(h,_)|h.handle!=handle){return Err(CredentialError)}
        self.session.local(Some(&admission),|_|Box::pin(async{Ok(())})).await?;active.catalog=Some(progress);Ok(response)
    }
    pub async fn offline_status(&self,handle:&str)->Result<OfflinePreparation>{
        let active=self.active.lock().await;let (_,admission)=active.active.as_ref().filter(|(h,_)|h.handle==handle).ok_or(CredentialError)?;
        let context=admission.context().clone();let lease=self.offline.clone();self.session.local(Some(admission),|_|Box::pin(async move{
            match lease{None=>Ok(OfflinePreparation{available:false,expires_at:None}),Some(lease)=>Ok(OfflinePreparation{available:true,expires_at:lease.check_access(&context).await.ok().map(|a|a.expires_at())})}
        })).await
    }
    pub async fn prepare_offline(&self,handle:&str)->Result<OfflinePreparation>{
        let _prepare=self.offline_prepare.try_lock().map_err(|_|CredentialError)?;let lease=self.offline.clone().ok_or(CredentialError)?;
        let (generation,admission,challenge)={let active=self.active.lock().await;let (_,admission)=active.active.as_ref().filter(|(h,_)|h.handle==handle).ok_or(CredentialError)?;
            let copy=lease.clone();let challenge=self.session.local(Some(admission),|_|Box::pin(async move{copy.begin_online().await})).await?;(active.generation,admission.clone(),challenge)};
        let token=self.session.offline_grant(&admission,challenge.nonce()).await?;
        let active=self.active.lock().await;if active.generation!=generation||active.active.as_ref().is_none_or(|(h,_)|h.handle!=handle){return Err(CredentialError)}let context=admission.context().clone();
        let cleanup=lease.clone();let result=self.session.local(Some(&admission),|_|Box::pin(async move{lease.accept_online(challenge,context.clone(),token).await?;let access=lease.check_access(&context).await?;Ok(OfflinePreparation{available:true,expires_at:Some(access.expires_at())})})).await;
        // The OS write may finish just as online admission expires. Withholding
        // success alone must not leave that newly saved authority active.
        if result.is_err(){let _=cleanup.logout().await;}result
    }
    pub async fn resume_offline(&self)->Result<OfflineWorkspace>{
        let lease=self.offline.as_ref().ok_or(CredentialError)?;let mut active=self.active.lock().await;self.close_active(&mut active).await;
        let proof=lease.restore_access().await?;if proof.context().issuer!=self.session.issuer(){let _=lease.logout().await;return Err(CredentialError)}
        let handle=self.registry.open_existing(proof.context().clone()).await.map_err(|_|CredentialError)?;
        if lease.check_bound(&proof).await.is_err(){self.registry.close_all().await;return Err(CredentialError)}
        let result=OfflineWorkspace{workspace:handle.clone(),expires_at:proof.expires_at()};active.offline_handle=Some((handle,proof));Ok(result)
    }
    pub async fn check_offline(&self,handle:&str)->Result<OfflineDeadline>{
        let lease=self.offline.as_ref().ok_or(CredentialError)?;let mut active=self.active.lock().await;let (_,proof)=active.offline_handle.as_ref().filter(|(h,_)|h.handle==handle).ok_or(CredentialError)?;
        let expires_at=proof.expires_at();if lease.check_bound(proof).await.is_err(){self.close_active(&mut active).await;return Err(CredentialError)}Ok(OfflineDeadline{expires_at})
    }
    pub async fn execute_offline(&self,handle:&str,request:serde_json::Value)->Result<serde_json::Value>{
        if !crate::workspace_registry::local_command(&request){return Err(CredentialError)}
        let lease=self.offline.as_ref().ok_or(CredentialError)?;let mut active=self.active.lock().await;let (_,proof)=active.offline_handle.as_ref().filter(|(h,_)|h.handle==handle).ok_or(CredentialError)?;
        if lease.check_bound(proof).await.is_err(){self.close_active(&mut active).await;return Err(CredentialError)}
        let result=self.registry.execute(handle,request).await.map_err(|_|CredentialError);let valid=lease.check_bound(proof).await;
        if result.is_err()||valid.is_err(){self.close_active(&mut active).await;}valid?;result
    }
    pub async fn close_offline(&self,handle:&str)->Result<()>{let mut active=self.active.lock().await;if active.offline_handle.as_ref().is_none_or(|(h,_)|h.handle!=handle){return Err(CredentialError)}self.close_active(&mut active).await;Ok(())}
    pub async fn shutdown(self){self.registry.close_all().await;self.session.close().await;if let Some(lease)=self.offline{if let Ok(lease)=Arc::try_unwrap(lease){lease.close().await;}}}
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{native_credentials::{CredentialVault,Secret},native_session::{AccessSecret,ProviderFuture,TokenPair,VerifiedIdentity,WorkspaceRegistration,Phase}};
    use serde_json::json;
    use std::{collections::HashMap,sync::{Mutex as StdMutex,atomic::{AtomicU64,AtomicBool,Ordering}}};
    use tokio::sync::Notify;
    const CLIENT:&str="01900000-0000-7000-8000-000000000002";
    const PAGE:&str="01900000-0000-7000-8000-000000000004";
    #[derive(Clone,Default)]struct Os(Arc<StdMutex<HashMap<String,Vec<u8>>>>,Arc<AtomicBool>,Arc<StdMutex<Option<Clock>>>);
    impl CredentialStore for Os {
        fn read(&self,t:&str)->Result<Option<Secret>>{self.0.lock().unwrap().get(t).map(|b|Secret::new(b.clone())).transpose()}
        fn write(&self,t:&str,s:&Secret)->Result<()>{if s.expose().starts_with(b"{"){if let Some(clock)=self.2.lock().unwrap().as_ref(){clock.0.store(200,Ordering::SeqCst);}}let existed=self.0.lock().unwrap().contains_key(t);self.0.lock().unwrap().insert(t.into(),s.expose().to_vec());if self.1.load(Ordering::SeqCst)&&!existed{Err(CredentialError)}else{Ok(())}}
        fn delete(&self,t:&str)->Result<()>{self.0.lock().unwrap().remove(t);Ok(())}
    }
    #[derive(Clone)]struct Clock(Arc<AtomicU64>,Arc<AtomicU64>);impl NativeClock for Clock {fn now(&self)->Result<u64>{let count=self.1.load(Ordering::SeqCst);if count!=u64::MAX{if count==0{self.0.store(604900,Ordering::SeqCst);}else{self.1.fetch_sub(1,Ordering::SeqCst);}}Ok(self.0.load(Ordering::SeqCst))}}
    struct ProviderState {owner:String,bad_client:bool}
    struct Inner {state:StdMutex<ProviderState>,hold:AtomicBool,entered:Notify,release:Notify,send_hold:AtomicBool,bad_receipt:AtomicBool,sends:StdMutex<Vec<String>>,read_hold:AtomicBool,read_mutation:std::sync::atomic::AtomicU8,reads:std::sync::atomic::AtomicUsize,catalog_hold:AtomicBool,catalog_mutation:std::sync::atomic::AtomicU8,catalog_calls:StdMutex<Vec<Option<String>>>,grant_hold:AtomicBool,grant_mutation:std::sync::atomic::AtomicU8,grants:std::sync::atomic::AtomicUsize,expires:AtomicU64}
    #[derive(Clone)]struct Provider(Arc<Inner>);
    impl NativeProvider for Provider {
        fn password<'a>(&'a self,_:&'a str,_:&'a [u8])->ProviderFuture<'a,TokenPair>{Box::pin(async {Ok(TokenPair{access:AccessSecret::new(b"fixture-access".to_vec())?,refresh:Secret::new(b"fixture-refresh".to_vec())?,subject:self.0.state.lock().unwrap().owner.clone()})})}
        fn refresh<'a>(&'a self,_:&'a Secret)->ProviderFuture<'a,TokenPair>{self.password("",b"")}
        fn verify<'a>(&'a self,_:&'a AccessSecret)->ProviderFuture<'a,VerifiedIdentity>{Box::pin(async {Ok(VerifiedIdentity{issuer:"https://auth.invalid/auth/v1".into(),subject:self.0.state.lock().unwrap().owner.clone(),expires_at:self.0.expires.load(Ordering::SeqCst)})})}
        fn bootstrap<'a>(&'a self,_:&'a AccessSecret,client:&'a str)->ProviderFuture<'a,WorkspaceRegistration>{Box::pin(async move {
            if self.0.hold.swap(false,Ordering::SeqCst){self.0.entered.notify_one();self.0.release.notified().await;}
            let s=self.0.state.lock().unwrap();Ok(WorkspaceRegistration{protocol_version:1,workspace_id:if s.owner=="owner-A"{"01900000-0000-7000-8000-000000000001"}else{"01900000-0000-7000-8000-000000000009"}.into(),client_id:if s.bad_client {PAGE}else{client}.into(),epoch:"01900000-0000-7000-8000-000000000003".into()})
        })}
        fn structured_send<'a>(&'a self,_:&'a AccessSecret,c:&'a crate::WorkspaceContext,wire:&'a str)->ProviderFuture<'a,serde_json::Value>{Box::pin(async move{
            self.0.sends.lock().unwrap().push(wire.to_owned());if self.0.send_hold.swap(false,Ordering::SeqCst){self.0.entered.notify_one();self.0.release.notified().await;}
            let mutation=self.0.read_mutation.swap(0,Ordering::SeqCst);if mutation==3{return Err(CredentialError)}
            let mut result=structured_result(wire);
            if mutation==2{result["entityId"]=json!(CLIENT);}
            if mutation==4{result["status"]=json!("conflict");result["entity"]["title"]=json!("remote title");result["conflicts"]=json!([{"id":"01900000-0000-7000-8000-000000000088","operationId":result["operationId"],"entityType":"task","entityId":result["entityId"],"field":"title","base":"base title","local":"local title","remote":"remote title","createdAt":"2026-10-24T00:00:00.000Z","status":"open","resolvedBy":null}]);}
            if mutation==5{result["status"]=json!("rejected");result["entity"]=serde_json::Value::Null;result["error"]=json!({"code":"fixture_rejection","message":"synthetic rejection","retryable":false});}
            let mut response=json!({"protocolVersion":1,"workspaceId":c.workspace_id,"streamEpoch":c.stream_epoch,"results":[result]});if self.0.bad_receipt.swap(false,Ordering::SeqCst){response["workspaceId"]=json!(PAGE);}Ok(response)
        })}
        fn structured_pull<'a>(&'a self,_:&'a AccessSecret,c:&'a crate::WorkspaceContext,request:&'a serde_json::Value)->ProviderFuture<'a,serde_json::Value>{Box::pin(async move{
            assert_eq!(request["clientId"],c.client_id);assert_eq!(request["workspaceId"],c.workspace_id);assert_eq!(request["limit"],1);
            self.0.catalog_calls.lock().unwrap().push(request["cursor"].as_str().map(str::to_owned));self.0.reads.fetch_add(1,Ordering::SeqCst);
            if self.0.read_hold.swap(false,Ordering::SeqCst){self.0.entered.notify_one();self.0.release.notified().await;}
            let mutation=self.0.read_mutation.swap(0,Ordering::SeqCst);if mutation==3{return Err(CredentialError)}
            let mut response=json!({"protocolVersion":1,"workspaceId":c.workspace_id,"streamEpoch":c.stream_epoch,"operations":[],"cursor":"cursor-0","headCursor":"cursor-0","hasMore":false,"serverTime":"2026-10-24T00:00:00.000Z"});if mutation==1{response["streamEpoch"]=json!(PAGE);}if mutation==2{response["serverTime"]=json!("invalid");}Ok(response)
        })}
        fn title_send<'a>(&'a self,_:&'a AccessSecret,c:&'a crate::WorkspaceContext,page:&'a str,kind:&'a str,wire:&'a str)->ProviderFuture<'a,serde_json::Value>{Box::pin(async move {
            assert_eq!(kind,"rename");self.0.sends.lock().unwrap().push(wire.to_string());
            if self.0.send_hold.swap(false,Ordering::SeqCst){self.0.entered.notify_one();self.0.release.notified().await;}
            let request:serde_json::Value=serde_json::from_str(wire).unwrap();
            let mut response=json!({"protocolVersion":1,"workspaceId":c.workspace_id,"workspaceEpoch":c.stream_epoch,"pageId":page,"metadata":{"id":page,"title":request["title"],"yDocId":format!("page:{page}"),"createdAt":"2026-10-13T00:00:00.000Z","updatedAt":"2026-10-13T00:00:00.000Z"},"version":request["baseVersion"].as_i64().unwrap()+1,"operationId":request["operationId"],"result":{"status":"applied"}});
            if self.0.bad_receipt.swap(false,Ordering::SeqCst){response["workspaceId"]=json!(PAGE);}if self.0.read_mutation.swap(0,Ordering::SeqCst)==2{response["metadata"]["title"]=json!("invalid applied title");}Ok(response)
        })}
        fn title_read<'a>(&'a self,_:&'a AccessSecret,c:&'a crate::WorkspaceContext,page:&'a str)->ProviderFuture<'a,serde_json::Value>{Box::pin(async move {
            self.0.reads.fetch_add(1,Ordering::SeqCst);if self.0.read_hold.swap(false,Ordering::SeqCst){self.0.entered.notify_one();self.0.release.notified().await;}
            let mut response=json!({"protocolVersion":1,"workspaceId":c.workspace_id,"workspaceEpoch":c.stream_epoch,"pageId":page,"metadata":{"id":page,"title":"synthetic send","yDocId":format!("page:{page}"),"createdAt":"2026-10-13T00:00:00.000Z","updatedAt":"2026-10-13T00:00:00.000Z"},"version":0,"conflicts":[],"nextAfter":null});
            if self.0.read_mutation.swap(0,Ordering::SeqCst)!=0{response["workspaceEpoch"]=json!(PAGE);}Ok(response)
        })}
        fn page_send<'a>(&'a self,_:&'a AccessSecret,c:&'a crate::WorkspaceContext,page:&'a str,kind:&'a str,wire:&'a str)->ProviderFuture<'a,serde_json::Value>{Box::pin(async move {
            self.0.sends.lock().unwrap().push(wire.to_string());
            if self.0.send_hold.swap(false,Ordering::SeqCst){self.0.entered.notify_one();self.0.release.notified().await;}
            let request:serde_json::Value=serde_json::from_str(wire).unwrap();let update=crate::private_page::decode(request[if kind=="bootstrap"{"initialUpdate"}else{"update"}].as_str().unwrap()).unwrap();
            use sha2::Digest;let digest=format!("{:x}",sha2::Sha256::digest(update));
            let mut receipt=json!({"protocolVersion":1,"workspaceId":c.workspace_id,"pageId":page,"documentName":format!("page:{page}"),"editorSchemaVersion":1});
            if kind=="bootstrap"{receipt["metadata"]=json!({"id":page,"title":request["title"],"yDocId":format!("page:{page}"),"createdAt":"2026-10-13T00:00:00.000Z","updatedAt":"2026-10-13T00:00:00.000Z"});receipt["initialDigest"]=json!(digest);}else{receipt["digest"]=json!(digest);receipt["serverOrder"]=json!("2");receipt["headOrder"]=json!("2");receipt["stateVector"]=json!("AA");}
            if self.0.bad_receipt.swap(false,Ordering::SeqCst){receipt["workspaceId"]=json!(PAGE);}Ok(receipt)
        })}
        fn offline_grant<'a>(&'a self,_:&'a AccessSecret,c:&'a crate::WorkspaceContext,nonce:&'a str)->ProviderFuture<'a,String>{Box::pin(async move{
            use ed25519_dalek::{SigningKey,Signer};use base64::{engine::general_purpose::URL_SAFE_NO_PAD as B,Engine};self.0.grants.fetch_add(1,Ordering::SeqCst);if self.0.grant_hold.swap(false,Ordering::SeqCst){self.0.entered.notify_one();self.0.release.notified().await;}let mutation=self.0.grant_mutation.swap(0,Ordering::SeqCst);if mutation==5{return Err(CredentialError)}
            let mut claims=json!({"iss":"https://api.invalid","aud":"native","sub":c.subject_id,"authIssuer":c.issuer,"workspaceId":c.workspace_id,"clientId":c.client_id,"streamEpoch":c.stream_epoch,"iat":100,"exp":604900,"nonce":nonce});let mut header=json!({"alg":"EdDSA","typ":"greiva-offline-v1+jwt","kid":"fixture"});match mutation{1=>claims["nonce"]=json!("0".repeat(64)),2=>claims["workspaceId"]=json!(PAGE),4=>header["kid"]=json!("foreign"),6=>{claims["iat"]=json!(101);claims["exp"]=json!(604901);},7=>claims["extra"]=json!(true),_=>{}}
            let input=format!("{}.{}",B.encode(header.to_string()),B.encode(claims.to_string()));let key=SigningKey::from_bytes(&[if mutation==3{43}else{42};32]);Ok(format!("{}.{}",input,B.encode(key.sign(input.as_bytes()).to_bytes())))
        })}
        fn page_catalog<'a>(&'a self,_:&'a AccessSecret,c:&'a crate::WorkspaceContext,cursor:Option<&'a str>)->ProviderFuture<'a,serde_json::Value>{Box::pin(async move{
            self.0.catalog_calls.lock().unwrap().push(cursor.map(str::to_owned));if self.0.catalog_hold.swap(false,Ordering::SeqCst){self.0.entered.notify_one();self.0.release.notified().await;}
            let mutation=self.0.catalog_mutation.swap(0,Ordering::SeqCst);if mutation==9{return Err(CredentialError)}
            let id=if cursor.is_some(){"01900000-0000-7000-8000-000000000005"}else{PAGE};let mut response=json!({"protocolVersion":1,"workspaceId":c.workspace_id,"workspaceEpoch":c.stream_epoch,"pages":[{"id":id,"title":"catalog fixture","yDocId":format!("page:{id}"),"createdAt":"2026-10-15T00:00:00.000Z","updatedAt":"2026-10-15T00:00:00.000Z"}],"nextCursor":if cursor.is_some(){None}else{Some("fixture-next")},"hasMore":cursor.is_none()});
            match mutation{1=>response["workspaceId"]=json!(PAGE),2=>response["workspaceEpoch"]=json!(PAGE),3=>response["pages"][0]["yDocId"]=json!("page:foreign"),4=>response["extra"]=json!(true),5=>{response["pages"]=json!([]);response["hasMore"]=json!(true);response["nextCursor"]=json!("other");},6=>{response["nextCursor"]=json!("fixture-next");response["hasMore"]=json!(true);},7=>{response["pages"][0]["id"]=json!(PAGE);response["pages"][0]["yDocId"]=json!(format!("page:{PAGE}"));},8=>response["pages"]=json!([response["pages"][0].clone(),response["pages"][0].clone()]),_=>{}}Ok(response)
        })}
        fn page_read<'a>(&'a self,_:&'a AccessSecret,c:&'a crate::WorkspaceContext,page:&'a str)->ProviderFuture<'a,serde_json::Value>{Box::pin(self.read(c,page))}
    }
    impl Provider {
        async fn read(&self,c:&crate::WorkspaceContext,page:&str)->Result<serde_json::Value>{
            self.0.reads.fetch_add(1,Ordering::SeqCst);if self.0.read_hold.swap(false,Ordering::SeqCst){self.0.entered.notify_one();self.0.release.notified().await;}
            use sha2::Digest;let mut response=json!({"protocolVersion":1,"workspaceId":c.workspace_id,"pageId":page,"documentName":format!("page:{page}"),"editorSchemaVersion":1,"metadata":{"id":page,"title":"remote fixture","yDocId":format!("page:{page}"),"createdAt":"2026-10-15T00:00:00.000Z","updatedAt":"2026-10-15T00:00:00.000Z"},"headOrder":"2","update":"AAA","digest":format!("{:x}",sha2::Sha256::digest([0,0])),"stateVector":"AA"});
            match self.0.read_mutation.swap(0,Ordering::SeqCst){1=>response["workspaceId"]=json!(PAGE),2=>response["digest"]=json!("0".repeat(64)),3=>response["documentName"]=json!("page:foreign"),4=>response["editorSchemaVersion"]=json!(2),5=>response["stateVector"]=json!("AA="),6=>response["extra"]=json!(true),_=>{}}
            Ok(response)
        }
    }
    type Gate=NativeWorkspaceGate<Os,Provider,Clock>;
    struct Fixture {root:PathBuf,os:Os,provider:Provider,clock:Clock}
    impl Fixture {
        fn new()->Self {let mut b=[0u8;16];getrandom::getrandom(&mut b).unwrap();let root=std::env::temp_dir().join(format!("greiva-gate-{:x}",u128::from_le_bytes(b)));std::fs::create_dir(&root).unwrap();Self{root,os:Os::default(),provider:Provider(Arc::new(Inner{state:StdMutex::new(ProviderState{owner:"owner-A".into(),bad_client:false}),hold:AtomicBool::new(false),entered:Notify::new(),release:Notify::new(),send_hold:AtomicBool::new(false),bad_receipt:AtomicBool::new(false),sends:StdMutex::new(Vec::new()),read_hold:AtomicBool::new(false),read_mutation:std::sync::atomic::AtomicU8::new(0),reads:std::sync::atomic::AtomicUsize::new(0),catalog_hold:AtomicBool::new(false),catalog_mutation:std::sync::atomic::AtomicU8::new(0),catalog_calls:StdMutex::new(Vec::new()),grant_hold:AtomicBool::new(false),grant_mutation:std::sync::atomic::AtomicU8::new(0),grants:std::sync::atomic::AtomicUsize::new(0),expires:AtomicU64::new(200)})),clock:Clock(Arc::new(AtomicU64::new(100)),Arc::new(AtomicU64::new(u64::MAX)))}}
        async fn open(&self)->Arc<Gate>{let vault=CredentialVault::open(&self.root.join("session.sqlite"),"fixture-gate",self.os.clone()).await.unwrap();Arc::new(Gate::new(NativeSession::new(vault,self.provider.clone(),self.clock.clone(),"https://auth.invalid/auth/v1".into()).unwrap(),self.root.join("workspaces")))}
    }
    impl Fixture{async fn open_offline(&self)->Arc<Gate>{let vault=CredentialVault::open(&self.root.join("session.sqlite"),"fixture-gate",self.os.clone()).await.unwrap();let verifier=crate::offline_grant::OfflineGrantVerifier::new("https://api.invalid".into(),"native".into(),vec![("fixture".into(),ed25519_dalek::SigningKey::from_bytes(&[42;32]).verifying_key().to_bytes())]).unwrap();let lease=crate::offline_lease::OfflineLeaseStore::open(&self.root.join("offline.sqlite"),"fixture-offline",self.os.clone(),verifier,self.clock.clone()).await.unwrap();Arc::new(Gate::new(NativeSession::new(vault,self.provider.clone(),self.clock.clone(),"https://auth.invalid/auth/v1".into()).unwrap(),self.root.join("workspaces")).with_offline(lease))}}
    impl Drop for Fixture {fn drop(&mut self){let _=std::fs::remove_dir_all(&self.root);}}
    async fn login(g:&Gate){assert_eq!(g.login("fixture@example.invalid",b"fixture-password".to_vec()).await.unwrap().phase,Phase::Verified);}
    async fn shutdown(g:Arc<Gate>){Arc::try_unwrap(g).ok().unwrap().shutdown().await;}
    #[tokio::test]
    async fn native_gate_restart_device_binding_and_pending_survive_logout(){
        let f=Fixture::new();let g=f.open().await;assert!(g.open(CLIENT).await.is_err());login(&g).await;let h=g.open(CLIENT).await.unwrap();
        g.execute(&h.handle,json!({"command":"page_create","pageId":PAGE,"title":"synthetic retained","update":[0,0]})).await.unwrap();
        let request=json!({"command":"page_prepare","pageId":PAGE});let wire=g.execute(&h.handle,request.clone()).await.unwrap();assert!(!wire.is_null());
        for command in ["ack","pull","page_ack","page_receive","structured_pull_request","structured_validate_ack","structured_validate_pull","title_validate","title_ack","title_receive","changes_receive","database_source_receive"] {assert!(g.execute(&h.handle,json!({"command":command})).await.is_err());}
        assert_eq!(g.execute(&h.handle,request.clone()).await.unwrap(),wire);
        shutdown(g).await;let g=f.open().await;assert_eq!(g.snapshot().await.phase,Phase::Locked);g.restore().await.unwrap();
        let next=g.open(PAGE).await.unwrap();assert_eq!(next.context,h.context);assert_eq!(g.execute(&next.handle,request.clone()).await.unwrap(),wire);
        let closed=g.logout().await;assert!(closed.local_locked && closed.persistent_locked);assert!(!closed.provider_confirmed);
        assert!(g.execute(&next.handle,request.clone()).await.is_err());assert!(g.restore().await.is_err());
        login(&g).await;let last=g.open(PAGE).await.unwrap();assert_eq!(last.context,h.context);assert_eq!(g.execute(&last.handle,request).await.unwrap(),wire);shutdown(g).await;
    }
    #[tokio::test]
    async fn native_gate_expiry_and_account_change_do_not_rebind_old_handle(){
        let f=Fixture::new();let g=f.open().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();
        g.execute(&h.handle,json!({"command":"page_create","pageId":PAGE,"title":"owner-A","update":[0,0]})).await.unwrap();
        f.clock.0.store(200,Ordering::SeqCst);assert!(g.execute(&h.handle,json!({"command":"page_append","pageId":PAGE,"update":[0,0]})).await.is_err());assert_eq!(g.snapshot().await.phase,Phase::Locked);
        shutdown(g).await;f.clock.0.store(100,Ordering::SeqCst);f.provider.0.state.lock().unwrap().owner="owner-B".into();let g=f.open().await;login(&g).await;
        let other=g.open("01900000-0000-7000-8000-000000000007").await.unwrap();assert_ne!(other.context.subject_id,h.context.subject_id);assert_ne!(other.context.client_id,h.context.client_id);
        assert!(g.execute(&h.handle,json!({"command":"page_load","pageId":PAGE})).await.is_err());
        assert_eq!(g.execute(&other.handle,json!({"command":"page_exists","pageId":PAGE})).await.unwrap(),json!(false));shutdown(g).await;
        f.provider.0.state.lock().unwrap().owner="owner-A".into();let g=f.open().await;login(&g).await;let back=g.open(CLIENT).await.unwrap();assert!(g.execute(&back.handle,json!({"command":"page_load","pageId":PAGE})).await.is_ok());shutdown(g).await;
    }
    #[tokio::test]
    async fn native_gate_wrong_registration_and_cancelled_old_bootstrap_refuse(){
        let f=Fixture::new();let g=f.open().await;login(&g).await;f.provider.0.state.lock().unwrap().bad_client=true;assert!(g.open(CLIENT).await.is_err());f.provider.0.state.lock().unwrap().bad_client=false;
        f.provider.0.hold.store(true,Ordering::SeqCst);let copy=g.clone();let task=tokio::spawn(async move {copy.open(CLIENT).await});f.provider.0.entered.notified().await;
        g.cancel_open().await;let new=g.open(CLIENT).await.unwrap();f.provider.0.release.notify_one();assert!(task.await.unwrap().is_err());assert!(g.execute(&new.handle,json!({"command":"page_list","after":null,"limit":20})).await.is_ok());shutdown(g).await;
    }
    #[tokio::test]
    async fn native_gate_logout_cancels_bootstrap_and_closes_store(){
        let f=Fixture::new();let g=f.open().await;login(&g).await;f.provider.0.hold.store(true,Ordering::SeqCst);
        let copy=g.clone();let task=tokio::spawn(async move {copy.open(CLIENT).await});f.provider.0.entered.notified().await;g.logout().await;
        assert!(task.await.unwrap().is_err());f.provider.0.release.notify_one();assert_eq!(g.snapshot().await.phase,Phase::Locked);assert!(g.open(CLIENT).await.is_err());shutdown(g).await;
    }
    async fn page_fixture(f:&Fixture)->(Arc<Gate>,WorkspaceHandle,serde_json::Value){let g=f.open().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();g.execute(&h.handle,json!({"command":"page_create","pageId":PAGE,"title":"synthetic send","update":[0,0]})).await.unwrap();let original=g.execute(&h.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap();(g,h,original)}
    #[tokio::test]
    async fn native_page_fifo_and_wrong_receipt_retains_original_wire(){
        let f=Fixture::new();let (g,h,original)=page_fixture(&f).await;f.provider.0.bad_receipt.store(true,Ordering::SeqCst);assert!(g.send_page(&h.handle,PAGE).await.is_err());assert_eq!(g.execute(&h.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap(),original);
        assert!(g.send_page(&h.handle,PAGE).await.unwrap());g.execute(&h.handle,json!({"command":"page_append","pageId":PAGE,"update":[0,1]})).await.unwrap();assert!(g.send_page(&h.handle,PAGE).await.unwrap());assert!(!g.send_page(&h.handle,PAGE).await.unwrap());let calls=f.provider.0.sends.lock().unwrap().clone();assert_eq!(calls.len(),3);assert_eq!(calls[0],calls[1]);assert_ne!(calls[1],calls[2]);assert_eq!(g.execute(&h.handle,json!({"command":"page_load","pageId":PAGE})).await.unwrap()["pending"],0);shutdown(g).await;
    }
    #[tokio::test]
    async fn native_page_close_while_remote_waiting_refuses_late_ack(){
        let f=Fixture::new();let (g,h,original)=page_fixture(&f).await;f.provider.0.send_hold.store(true,Ordering::SeqCst);let copy=g.clone();let old=h.handle.clone();let task=tokio::spawn(async move{copy.send_page(&old,PAGE).await});f.provider.0.entered.notified().await;
        g.cancel_open().await;let next=g.open(CLIENT).await.unwrap();f.provider.0.release.notify_one();assert!(task.await.unwrap().is_err());assert_eq!(g.execute(&next.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap(),original);assert!(g.send_page(&next.handle,PAGE).await.unwrap());shutdown(g).await;
    }
    #[tokio::test]
    async fn native_page_logout_cancels_remote_wait_and_preserves_pending(){
        let f=Fixture::new();let (g,h,original)=page_fixture(&f).await;f.provider.0.send_hold.store(true,Ordering::SeqCst);let copy=g.clone();let old=h.handle.clone();let task=tokio::spawn(async move{copy.send_page(&old,PAGE).await});f.provider.0.entered.notified().await;
        let locked=g.logout().await;assert!(locked.local_locked && locked.persistent_locked);assert!(task.await.unwrap().is_err());login(&g).await;let next=g.open(CLIENT).await.unwrap();assert_eq!(g.execute(&next.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap(),original);assert_eq!(f.provider.0.sends.lock().unwrap().len(),1);shutdown(g).await;
    }
    #[tokio::test]
    async fn native_page_expiry_during_send_withholds_ack(){
        let f=Fixture::new();let (g,h,original)=page_fixture(&f).await;f.provider.0.send_hold.store(true,Ordering::SeqCst);let copy=g.clone();let old=h.handle.clone();let task=tokio::spawn(async move{copy.send_page(&old,PAGE).await});f.provider.0.entered.notified().await;f.clock.0.store(200,Ordering::SeqCst);f.provider.0.release.notify_one();assert!(task.await.unwrap().is_err());assert_eq!(g.snapshot().await.phase,Phase::Locked);shutdown(g).await;
        f.clock.0.store(100,Ordering::SeqCst);let g=f.open().await;login(&g).await;let next=g.open(CLIENT).await.unwrap();assert_eq!(g.execute(&next.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap(),original);shutdown(g).await;
    }
    #[tokio::test]
    async fn native_page_concurrent_sends_keep_fifo_without_blocking_local_input(){
        let f=Fixture::new();let (g,h,_)=page_fixture(&f).await;f.provider.0.send_hold.store(true,Ordering::SeqCst);let copy=g.clone();let first=h.handle.clone();let one=tokio::spawn(async move{copy.send_page(&first,PAGE).await});f.provider.0.entered.notified().await;
        g.execute(&h.handle,json!({"command":"page_append","pageId":PAGE,"update":[0,1]})).await.unwrap();let copy=g.clone();let second=h.handle.clone();let two=tokio::spawn(async move{copy.send_page(&second,PAGE).await});f.provider.0.release.notify_one();assert!(one.await.unwrap().unwrap());assert!(two.await.unwrap().unwrap());assert_eq!(f.provider.0.sends.lock().unwrap().len(),2);assert_eq!(g.execute(&h.handle,json!({"command":"page_load","pageId":PAGE})).await.unwrap()["pending"],0);shutdown(g).await;
    }
    #[tokio::test]
    async fn native_page_known_receipt_retries_ack_without_network(){
        let f=Fixture::new();let (g,h,original)=page_fixture(&f).await;g.ack_failure.store(1,Ordering::SeqCst);
        assert_eq!(g.send_page_status(&h.handle,PAGE).await.unwrap(),PageSendStatus::AckPending);assert_eq!(g.execute(&h.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap(),original);
        assert_eq!(g.send_page_status(&h.handle,PAGE).await.unwrap(),PageSendStatus::Acked);assert_eq!(f.provider.0.sends.lock().unwrap().len(),1);assert_eq!(g.send_page_status(&h.handle,PAGE).await.unwrap(),PageSendStatus::Idle);shutdown(g).await;
    }
    #[tokio::test]
    async fn native_page_unknown_ack_commit_rechecks_original_pair_before_new_frame(){
        let f=Fixture::new();let (g,h,_)=page_fixture(&f).await;g.ack_failure.store(2,Ordering::SeqCst);assert_eq!(g.send_page_status(&h.handle,PAGE).await.unwrap(),PageSendStatus::AckPending);
        g.execute(&h.handle,json!({"command":"page_append","pageId":PAGE,"update":[0,1]})).await.unwrap();let next=g.execute(&h.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap();assert_eq!(next["kind"],"append");
        assert_eq!(g.send_page_status(&h.handle,PAGE).await.unwrap(),PageSendStatus::Acked);assert_eq!(f.provider.0.sends.lock().unwrap().len(),1);assert_eq!(g.execute(&h.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap(),next);
        assert!(g.send_page(&h.handle,PAGE).await.unwrap());assert_eq!(f.provider.0.sends.lock().unwrap().len(),2);shutdown(g).await;
    }
    #[tokio::test]
    async fn native_page_cached_receipt_does_not_cross_closed_admission(){
        let f=Fixture::new();let (g,h,original)=page_fixture(&f).await;g.ack_failure.store(1,Ordering::SeqCst);assert_eq!(g.send_page_status(&h.handle,PAGE).await.unwrap(),PageSendStatus::AckPending);assert_eq!(g.active.lock().await.receipts.len(),1);
        g.logout().await;assert!(g.active.lock().await.receipts.is_empty());assert!(g.send_page_status(&h.handle,PAGE).await.is_err());login(&g).await;let next=g.open(CLIENT).await.unwrap();assert_eq!(g.execute(&next.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap(),original);assert!(g.send_page(&next.handle,PAGE).await.unwrap());assert_eq!(f.provider.0.sends.lock().unwrap().len(),2);shutdown(g).await;
    }
    #[tokio::test]
    async fn native_page_read_validates_before_adoption_and_repeated_read_deduplicates(){
        let f=Fixture::new();let g=f.open().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();
        for mutation in 1..=6{f.provider.0.read_mutation.store(mutation,Ordering::SeqCst);assert_eq!(g.read_page(&h.handle,PAGE).await.unwrap(),PageReadStatus::ReadUnknown);assert_eq!(g.execute(&h.handle,json!({"command":"page_exists","pageId":PAGE})).await.unwrap(),false);assert!(g.active.lock().await.reads.is_empty());}
        assert_eq!(g.read_page(&h.handle,PAGE).await.unwrap(),PageReadStatus::Received);assert_eq!(g.read_page(&h.handle,PAGE).await.unwrap(),PageReadStatus::Received);let local=g.execute(&h.handle,json!({"command":"page_load","pageId":PAGE})).await.unwrap();assert_eq!(local["pending"],0);assert_eq!(local["page"]["updates"],json!([[0,0]]));assert_eq!(local["page"]["metadata"]["title"],"remote fixture");shutdown(g).await;
    }
    #[tokio::test]
    async fn native_page_read_save_before_or_after_commit_rechecks_without_network(){
        for failure in [1,2]{let f=Fixture::new();let g=f.open().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();g.read_failure.store(failure,Ordering::SeqCst);
            assert_eq!(g.read_page(&h.handle,PAGE).await.unwrap(),PageReadStatus::StorePending);assert_eq!(g.execute(&h.handle,json!({"command":"page_exists","pageId":PAGE})).await.unwrap(),failure==2);
            if failure==2{g.execute(&h.handle,json!({"command":"page_append","pageId":PAGE,"update":[0,1]})).await.unwrap();}
            assert_eq!(g.read_page(&h.handle,PAGE).await.unwrap(),PageReadStatus::Received);assert_eq!(f.provider.0.reads.load(Ordering::SeqCst),1);assert!(g.active.lock().await.reads.is_empty());let local=g.execute(&h.handle,json!({"command":"page_load","pageId":PAGE})).await.unwrap();assert_eq!(local["pending"],if failure==2{1}else{0});assert_eq!(local["page"]["updates"].as_array().unwrap().len(),if failure==2{2}else{1});shutdown(g).await;
        }
    }
    #[tokio::test]
    async fn native_page_read_keeps_local_pending_and_metadata(){
        let f=Fixture::new();let (g,h,original)=page_fixture(&f).await;assert_eq!(g.read_page(&h.handle,PAGE).await.unwrap(),PageReadStatus::Received);assert_eq!(g.execute(&h.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap(),original);let local=g.execute(&h.handle,json!({"command":"page_load","pageId":PAGE})).await.unwrap();assert_eq!(local["pending"],1);assert_eq!(local["page"]["metadata"]["title"],"synthetic send");shutdown(g).await;
    }
    #[tokio::test]
    async fn native_page_read_late_response_refuses_close_logout_expiry_and_account_switch(){
        for action in ["close","logout","expiry","account"]{let f=Fixture::new();let (g,h,original)=page_fixture(&f).await;f.provider.0.read_hold.store(true,Ordering::SeqCst);let copy=g.clone();let old=h.handle.clone();let task=tokio::spawn(async move{copy.read_page(&old,PAGE).await});f.provider.0.entered.notified().await;
            if action=="close"{g.cancel_open().await;}else if action=="expiry"{f.clock.0.store(200,Ordering::SeqCst);}else{g.logout().await;}
            if action=="account"{f.provider.0.state.lock().unwrap().owner="owner-B".into();login(&g).await;let other=g.open("01900000-0000-7000-8000-000000000007").await.unwrap();assert_eq!(g.execute(&other.handle,json!({"command":"page_exists","pageId":PAGE})).await.unwrap(),false);}
            f.provider.0.release.notify_one();assert_ne!(task.await.unwrap().ok(),Some(PageReadStatus::Received));shutdown(g).await;f.clock.0.store(100,Ordering::SeqCst);f.provider.0.state.lock().unwrap().owner="owner-A".into();let g=f.open().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();assert_eq!(g.execute(&h.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap(),original);let local=g.execute(&h.handle,json!({"command":"page_load","pageId":PAGE})).await.unwrap();assert_eq!(local["page"]["updates"],json!([[0,0]]));shutdown(g).await;
        }
    }
    #[tokio::test]
    async fn native_page_read_cached_response_does_not_cross_admission(){
        let f=Fixture::new();let g=f.open().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();g.read_failure.store(1,Ordering::SeqCst);assert_eq!(g.read_page(&h.handle,PAGE).await.unwrap(),PageReadStatus::StorePending);g.cancel_open().await;assert!(g.active.lock().await.reads.is_empty());let next=g.open(CLIENT).await.unwrap();assert_eq!(g.read_page(&next.handle,PAGE).await.unwrap(),PageReadStatus::Received);assert_eq!(f.provider.0.reads.load(Ordering::SeqCst),2);shutdown(g).await;
    }
    #[tokio::test]
    async fn native_catalog_is_read_only_and_cursor_stays_in_current_admission(){
        let f=Fixture::new();let g=f.open().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();
        assert!(g.catalog_pages(&h.handle,true).await.is_err());let first=g.catalog_pages(&h.handle,false).await.unwrap();assert_eq!(first.pages.len(),1);assert!(first.has_more);
        assert_eq!(g.execute(&h.handle,json!({"command":"page_exists","pageId":PAGE})).await.unwrap(),false);
        let next=g.catalog_pages(&h.handle,true).await.unwrap();assert!(!next.has_more);assert!(next.pages[0].id>first.pages[0].id);assert!(g.catalog_pages(&h.handle,true).await.is_err());
        assert_eq!(*f.provider.0.catalog_calls.lock().unwrap(),vec![None,Some("fixture-next".into())]);g.cancel_open().await;let next=g.open(CLIENT).await.unwrap();assert!(g.catalog_pages(&next.handle,true).await.is_err());shutdown(g).await;
    }
    #[tokio::test]
    async fn native_catalog_failure_retries_same_cursor_and_failed_refresh_invalidates_it(){
        let f=Fixture::new();let g=f.open().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();g.catalog_pages(&h.handle,false).await.unwrap();
        for mutation in [1,2,3,4,5,6,7,8,9]{f.provider.0.catalog_mutation.store(mutation,Ordering::SeqCst);assert!(g.catalog_pages(&h.handle,true).await.is_err());}
        assert!(!g.catalog_pages(&h.handle,true).await.unwrap().has_more);assert!(f.provider.0.catalog_calls.lock().unwrap()[1..].iter().all(|c|c.as_deref()==Some("fixture-next")));
        g.catalog_pages(&h.handle,false).await.unwrap();f.provider.0.catalog_mutation.store(9,Ordering::SeqCst);assert!(g.catalog_pages(&h.handle,false).await.is_err());let calls=f.provider.0.catalog_calls.lock().unwrap().len();assert!(g.catalog_pages(&h.handle,true).await.is_err());assert_eq!(f.provider.0.catalog_calls.lock().unwrap().len(),calls);shutdown(g).await;
    }
    #[tokio::test]
    async fn native_catalog_late_results_and_concurrent_queries_refuse(){
        for action in ["close","logout","expiry","account"]{let f=Fixture::new();let g=f.open().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();f.provider.0.catalog_hold.store(true,Ordering::SeqCst);let copy=g.clone();let old=h.handle.clone();let task=tokio::spawn(async move{copy.catalog_pages(&old,false).await});f.provider.0.entered.notified().await;
            assert!(g.catalog_pages(&h.handle,false).await.is_err());if action=="close"{g.cancel_open().await;}else if action=="expiry"{f.clock.0.store(200,Ordering::SeqCst);}else{g.logout().await;}
            if action=="account"{f.provider.0.state.lock().unwrap().owner="owner-B".into();login(&g).await;g.open("01900000-0000-7000-8000-000000000007").await.unwrap();}
            f.provider.0.release.notify_one();assert!(task.await.unwrap().is_err());assert!(g.active.lock().await.catalog.is_none());shutdown(g).await;
        }
    }    #[tokio::test]
    async fn native_reconnect_keeps_original_pending_but_drops_receipt_read_cache_and_catalog_cursor(){
        let f=Fixture::new();let (g,h,wire)=page_fixture(&f).await;g.ack_failure.store(1,Ordering::SeqCst);assert_eq!(g.send_page_status(&h.handle,PAGE).await.unwrap(),PageSendStatus::AckPending);g.read_failure.store(1,Ordering::SeqCst);assert_eq!(g.read_page(&h.handle,PAGE).await.unwrap(),PageReadStatus::StorePending);g.catalog_pages(&h.handle,false).await.unwrap();
        assert_eq!(g.restore().await.unwrap().phase,Phase::Verified);{let active=g.active.lock().await;assert!(active.receipts.is_empty()&&active.reads.is_empty()&&active.catalog.is_none());}
        let next=g.open(CLIENT).await.unwrap();assert_eq!(next.context,h.context);assert_ne!(next.handle,h.handle);assert!(g.execute(&h.handle,json!({"command":"page_load","pageId":PAGE})).await.is_err());assert!(g.catalog_pages(&next.handle,true).await.is_err());assert_eq!(g.execute(&next.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap(),wire);assert_eq!(g.execute(&next.handle,json!({"command":"page_load","pageId":PAGE})).await.unwrap()["pending"],1);
        assert_eq!(g.read_page(&next.handle,PAGE).await.unwrap(),PageReadStatus::Received);assert_eq!(f.provider.0.reads.load(Ordering::SeqCst),2);assert_eq!(g.send_page_status(&next.handle,PAGE).await.unwrap(),PageSendStatus::Acked);assert_eq!(*f.provider.0.sends.lock().unwrap(),vec![wire["wire"].as_str().unwrap().to_owned(),wire["wire"].as_str().unwrap().to_owned()]);shutdown(g).await;
    }    #[tokio::test]
    async fn offline_preparation_is_optional_and_validated_before_os_ready(){
        let f=Fixture::new();let g=f.open().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();assert_eq!(g.offline_status(&h.handle).await.unwrap(),OfflinePreparation{available:false,expires_at:None});assert!(g.prepare_offline(&h.handle).await.is_err());assert_eq!(f.provider.0.grants.load(Ordering::SeqCst),0);shutdown(g).await;
        let g=f.open_offline().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();for mutation in 1..=7{f.provider.0.grant_mutation.store(mutation,Ordering::SeqCst);assert!(g.prepare_offline(&h.handle).await.is_err());assert_eq!(g.offline_status(&h.handle).await.unwrap().expires_at,None);}
        assert_eq!(g.prepare_offline(&h.handle).await.unwrap().expires_at,Some(604900));let calls=f.provider.0.grants.load(Ordering::SeqCst);assert_eq!(g.offline_status(&h.handle).await.unwrap().expires_at,Some(604900));assert_eq!(f.provider.0.grants.load(Ordering::SeqCst),calls);shutdown(g).await;
    }
    #[tokio::test]
    async fn offline_preparation_reauth_and_logout_revoke_lease_but_keep_pending(){
        let f=Fixture::new();let g=f.open_offline().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();g.execute(&h.handle,json!({"command":"page_create","pageId":PAGE,"title":"retained pending","update":[0,0]})).await.unwrap();let before=g.execute(&h.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap();g.prepare_offline(&h.handle).await.unwrap();g.restore().await.unwrap();let next=g.open(CLIENT).await.unwrap();assert_eq!(g.offline_status(&next.handle).await.unwrap().expires_at,None);assert_eq!(g.execute(&next.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap(),before);g.prepare_offline(&next.handle).await.unwrap();assert!(g.logout().await.persistent_locked);login(&g).await;let last=g.open(CLIENT).await.unwrap();assert_eq!(g.offline_status(&last.handle).await.unwrap().expires_at,None);shutdown(g).await;
    }
    #[tokio::test]
    async fn offline_preparation_late_and_parallel_requests_never_activate_lease(){
        for action in ["close","logout","expiry","reauth"]{let f=Fixture::new();let g=f.open_offline().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();f.provider.0.grant_hold.store(true,Ordering::SeqCst);let copy=g.clone();let old=h.handle.clone();let work=tokio::spawn(async move{copy.prepare_offline(&old).await});f.provider.0.entered.notified().await;assert!(g.prepare_offline(&h.handle).await.is_err());match action{"close"=>g.cancel_open().await,"logout"=>{g.logout().await;},"expiry"=>{f.clock.0.store(200,Ordering::SeqCst);},_=>{g.restore().await.unwrap();}}f.provider.0.release.notify_one();assert!(work.await.unwrap().is_err());if action!="expiry"{if action=="logout"{login(&g).await;}let next=g.open(CLIENT).await.unwrap();assert_eq!(g.offline_status(&next.handle).await.unwrap().expires_at,None);}shutdown(g).await;}
    }
    #[tokio::test]
    async fn offline_status_exact_expiry_and_unknown_os_write_never_report_ready(){
        let f=Fixture::new();f.provider.0.expires.store(1000000,Ordering::SeqCst);let g=f.open_offline().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();g.prepare_offline(&h.handle).await.unwrap();f.clock.0.store(604899,Ordering::SeqCst);assert_eq!(g.offline_status(&h.handle).await.unwrap().expires_at,Some(604900));f.clock.0.store(604900,Ordering::SeqCst);assert_eq!(g.offline_status(&h.handle).await.unwrap().expires_at,None);shutdown(g).await;
        let f=Fixture::new();let g=f.open_offline().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();f.os.1.store(true,Ordering::SeqCst);assert!(g.prepare_offline(&h.handle).await.is_err());f.os.1.store(false,Ordering::SeqCst);assert_eq!(g.offline_status(&h.handle).await.unwrap().expires_at,None);assert_eq!(g.snapshot().await.phase,Phase::Verified);shutdown(g).await;
    }
    #[tokio::test]
    async fn offline_lock_failure_cannot_be_reported_as_confirmed_logout_or_reauthentication(){
        for action in ["logout","restore","login"]{let f=Fixture::new();let g=f.open_offline().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();g.prepare_offline(&h.handle).await.unwrap();let pool=sqlx::SqlitePool::connect_with(sqlx::sqlite::SqliteConnectOptions::new().filename(f.root.join("offline.sqlite"))).await.unwrap();sqlx::query("DROP TABLE session_marker").execute(&pool).await.unwrap();pool.close().await;
            if action=="logout"{let result=g.logout().await;assert!(result.local_locked);assert!(!result.persistent_locked);assert_eq!(result.cleanup_pending,None);}else if action=="restore"{assert!(g.restore().await.is_err());}else{assert!(g.login("fixture@example.invalid",b"fixture-password".to_vec()).await.is_err());}assert_eq!(g.snapshot().await.phase,Phase::Locked);shutdown(g).await;
        }
    }
    #[tokio::test]
    async fn offline_prepare_expiry_during_os_commit_revokes_just_saved_grant(){
        let f=Fixture::new();let g=f.open_offline().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();*f.os.2.lock().unwrap()=Some(f.clock.clone());assert!(g.prepare_offline(&h.handle).await.is_err());assert_eq!(g.snapshot().await.phase,Phase::Locked);assert!(g.offline.as_ref().unwrap().check_access(&h.context).await.is_err());shutdown(g).await;
    }    async fn offline_fixture(f:&Fixture)->(Arc<Gate>,WorkspaceHandle,serde_json::Value){let g=f.open_offline().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();g.execute(&h.handle,json!({"command":"page_create","pageId":PAGE,"title":"offline retained","update":[0,0]})).await.unwrap();let wire=g.execute(&h.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap();g.prepare_offline(&h.handle).await.unwrap();(g,h,wire)}
    fn workspace_path(f:&Fixture,c:&crate::WorkspaceContext)->PathBuf{use sha2::Digest;f.root.join("workspaces").join(format!("{:x}.sqlite",sha2::Sha256::digest(serde_json::to_vec(c).unwrap())))}
    #[tokio::test]
    async fn offline_restart_recovers_signed_context_pending_and_never_calls_remote(){
        let f=Fixture::new();let (g,h,wire)=offline_fixture(&f).await;shutdown(g).await;let g=f.open_offline().await;assert_eq!(g.snapshot().await.phase,Phase::Locked);let restored=g.resume_offline().await.unwrap();assert_eq!(restored.workspace.context,h.context);let handle=&restored.workspace.handle;assert_eq!(g.snapshot().await.phase,Phase::Locked);assert_eq!(g.check_offline(handle).await.unwrap().expires_at,604900);
        assert_eq!(g.execute_offline(handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap(),wire);g.execute_offline(handle,json!({"command":"page_append","pageId":PAGE,"update":[0,1]})).await.unwrap();assert_eq!(g.execute_offline(handle,json!({"command":"page_load","pageId":PAGE})).await.unwrap()["pending"],2);
        for command in ["page_ack","page_receive","structured_pull_request","structured_validate_ack","structured_validate_pull","title_validate","title_ack","title_receive","ack","pull","changes_receive","database_source_receive"]{assert!(g.execute_offline(handle,json!({"command":command})).await.is_err());}assert!(g.execute(handle,json!({"command":"page_load","pageId":PAGE})).await.is_err());assert!(g.send_page_status(handle,PAGE).await.is_err());assert!(g.read_page(handle,PAGE).await.is_err());assert!(g.read_title(handle,PAGE).await.is_err());assert!(g.send_structured(handle).await.is_err());assert!(g.pull_structured(handle).await.is_err());assert!(g.send_title_status(handle,PAGE).await.is_err());assert!(g.catalog_pages(handle,false).await.is_err());assert!(g.prepare_offline(handle).await.is_err());assert_eq!(f.provider.0.grants.load(Ordering::SeqCst),1);assert_eq!(f.provider.0.reads.load(Ordering::SeqCst),0);assert!(f.provider.0.sends.lock().unwrap().is_empty());shutdown(g).await;
    }
    #[tokio::test]
    async fn offline_missing_blank_or_corrupt_store_does_not_initialize_new_workspace(){
        for kind in ["missing","blank","corrupt"]{let f=Fixture::new();let (g,h,_)=offline_fixture(&f).await;shutdown(g).await;let path=workspace_path(&f,&h.context);if kind=="missing"{std::fs::remove_file(&path).unwrap();}else{std::fs::write(&path,if kind=="blank"{b"".as_slice()}else{b"corrupt".as_slice()}).unwrap();}let g=f.open_offline().await;assert!(g.resume_offline().await.is_err());if kind=="missing"{assert!(!path.exists());}assert!(g.active.lock().await.offline_handle.is_none());shutdown(g).await;}
    }
    #[tokio::test]
    async fn offline_old_handle_does_not_follow_another_process_new_same_owner_lease(){
        let f=Fixture::new();let (g,_,wire)=offline_fixture(&f).await;let old=g.resume_offline().await.unwrap();let other=f.open_offline().await;login(&other).await;let h=other.open(CLIENT).await.unwrap();other.prepare_offline(&h.handle).await.unwrap();assert!(g.check_offline(&old.workspace.handle).await.is_err());let next=g.resume_offline().await.unwrap();assert_ne!(next.workspace.handle,old.workspace.handle);assert_eq!(g.execute_offline(&next.workspace.handle,json!({"command":"page_prepare","pageId":PAGE})).await.unwrap(),wire);shutdown(g).await;shutdown(other).await;
    }
    #[tokio::test]
    async fn offline_commit_expiry_withholds_success_closes_handle_but_keeps_durable_edit(){
        let f=Fixture::new();let (g,h,wire)=offline_fixture(&f).await;let restored=g.resume_offline().await.unwrap();f.clock.1.store(1,Ordering::SeqCst);assert!(g.execute_offline(&restored.workspace.handle,json!({"command":"page_append","pageId":PAGE,"update":[0,1]})).await.is_err());assert!(g.active.lock().await.offline_handle.is_none());f.clock.1.store(u64::MAX,Ordering::SeqCst);f.clock.0.store(100,Ordering::SeqCst);assert!(g.resume_offline().await.is_err());shutdown(g).await;let store=crate::WorkspaceStore::open_existing(&workspace_path(&f,&h.context),h.context).await.unwrap();assert_eq!(store.page_load(PAGE).await.unwrap()["pending"],2);assert_eq!(store.page_prepare(PAGE).await.unwrap(),wire);
    }
    #[tokio::test]
    async fn offline_online_cancel_and_stale_close_do_not_cross_mode_or_revive_lease(){
        let f=Fixture::new();let (g,_,_)=offline_fixture(&f).await;let old=g.resume_offline().await.unwrap();g.cancel_open().await;g.check_offline(&old.workspace.handle).await.unwrap();g.restore().await.unwrap();let next=g.open(CLIENT).await.unwrap();assert!(g.close_offline(&old.workspace.handle).await.is_err());assert!(g.execute(&next.handle,json!({"command":"page_load","pageId":PAGE})).await.is_ok());assert!(g.resume_offline().await.is_err());shutdown(g).await;
    }
    #[tokio::test]
    async fn offline_signed_foreign_auth_issuer_is_refused_and_locked(){
        let f=Fixture::new();let (g,h,_)=offline_fixture(&f).await;let lease=g.offline.as_ref().unwrap();let challenge=lease.begin_online().await.unwrap();let mut context=h.context;context.issuer="https://other.invalid/auth/v1".into();let access=AccessSecret::new(b"fixture".to_vec()).unwrap();let token=f.provider.offline_grant(&access,&context,challenge.nonce()).await.unwrap();lease.accept_online(challenge,context,token).await.unwrap();assert!(g.resume_offline().await.is_err());assert!(lease.restore_access().await.is_err());shutdown(g).await;
    }    async fn title_fixture(f:&Fixture)->(Arc<Gate>,WorkspaceHandle,serde_json::Value){
        let (g,h,_)=page_fixture(f).await;
        assert_eq!(g.execute(&h.handle,json!({"command":"title_ready","pageId":PAGE})).await.unwrap(),false);
        assert_eq!(g.send_page_status(&h.handle,PAGE).await.unwrap(),PageSendStatus::Acked);
        assert_eq!(g.execute(&h.handle,json!({"command":"title_ready","pageId":PAGE})).await.unwrap(),false);
        assert_eq!(g.read_title(&h.handle,PAGE).await.unwrap(),PageReadStatus::Received);
        assert_eq!(g.execute(&h.handle,json!({"command":"title_ready","pageId":PAGE})).await.unwrap(),true);
        g.execute(&h.handle,json!({"command":"title_enqueue","pageId":PAGE,"intent":{"operationId":"01900000-0000-7000-8000-000000000008","title":"renamed"}})).await.unwrap();
        let prepared=g.execute(&h.handle,json!({"command":"title_prepare","pageId":PAGE})).await.unwrap();(g,h,prepared)
    }
    #[tokio::test]
    async fn title_native_unknown_scope_retains_original_wire_and_cached_ack_retries_without_http(){
        for failure in [1,2]{let f=Fixture::new();let (g,h,prepared)=title_fixture(&f).await;f.provider.0.bad_receipt.store(true,Ordering::SeqCst);
            assert_eq!(g.send_title_status(&h.handle,PAGE).await.unwrap(),TitleSendStatus::SendUnknown);
            assert_eq!(g.execute(&h.handle,json!({"command":"title_prepare","pageId":PAGE})).await.unwrap(),prepared);
            assert!(g.active.lock().await.title_receipts.is_empty());f.provider.0.read_mutation.store(2,Ordering::SeqCst);assert_eq!(g.send_title_status(&h.handle,PAGE).await.unwrap(),TitleSendStatus::SendUnknown);assert!(g.active.lock().await.title_receipts.is_empty());
            g.ack_failure.store(failure,Ordering::SeqCst);assert_eq!(g.send_title_status(&h.handle,PAGE).await.unwrap(),TitleSendStatus::AckPending);
            let calls=f.provider.0.sends.lock().unwrap().len();assert_eq!(g.send_title_status(&h.handle,PAGE).await.unwrap(),TitleSendStatus::Applied);assert_eq!(f.provider.0.sends.lock().unwrap().len(),calls);
            assert!(g.execute(&h.handle,json!({"command":"title_prepare","pageId":PAGE})).await.unwrap().is_null());
            assert_eq!(g.execute(&h.handle,json!({"command":"page_load","pageId":PAGE})).await.unwrap()["page"]["metadata"]["title"],"renamed");shutdown(g).await;
        }
    }
    #[tokio::test]
    async fn title_native_read_scope_and_local_commit_uncertainty_are_distinct(){
        for failure in [1,2]{let f=Fixture::new();let (g,h,_)=page_fixture(&f).await;g.send_page_status(&h.handle,PAGE).await.unwrap();f.provider.0.read_mutation.store(1,Ordering::SeqCst);
            assert_eq!(g.read_title(&h.handle,PAGE).await.unwrap(),PageReadStatus::ReadUnknown);assert!(g.active.lock().await.title_reads.is_empty());
            g.read_failure.store(failure,Ordering::SeqCst);assert_eq!(g.read_title(&h.handle,PAGE).await.unwrap(),PageReadStatus::StorePending);
            let calls=f.provider.0.reads.load(Ordering::SeqCst);assert_eq!(g.read_title(&h.handle,PAGE).await.unwrap(),PageReadStatus::Received);assert_eq!(f.provider.0.reads.load(Ordering::SeqCst),calls);shutdown(g).await;
        }
    }
    #[tokio::test]
    async fn title_native_late_send_and_read_never_commit_after_close_logout_expiry_or_reauth(){
        for read in [false,true]{for action in ["close","logout","expiry","reauth"]{let f=Fixture::new();let (g,h,original)=title_fixture(&f).await;
            if read{f.provider.0.read_hold.store(true,Ordering::SeqCst);}else{f.provider.0.send_hold.store(true,Ordering::SeqCst);}
            let copy=g.clone();let handle=h.handle.clone();let work=tokio::spawn(async move {if read{copy.read_title(&handle,PAGE).await.map(|_|())}else{copy.send_title_status(&handle,PAGE).await.map(|_|())}});f.provider.0.entered.notified().await;
            match action{"close"=>g.cancel_open().await,"logout"=>{g.logout().await;},"expiry"=>{f.clock.0.store(200,Ordering::SeqCst);},_=>{g.restore().await.unwrap();}}
            f.provider.0.release.notify_one();let _=work.await.unwrap();
            if action=="expiry"{f.provider.0.expires.store(400,Ordering::SeqCst);}login(&g).await;let next=g.open(CLIENT).await.unwrap();
            assert_eq!(g.execute(&next.handle,json!({"command":"title_prepare","pageId":PAGE})).await.unwrap(),original);
            assert!(g.send_title_status(&h.handle,PAGE).await.is_err());assert!(g.read_title(&h.handle,PAGE).await.is_err());shutdown(g).await;
        }}
    }
    fn structured_result(wire:&str)->serde_json::Value{
        let request:serde_json::Value=serde_json::from_str(wire).unwrap();let operation=&request["operations"][0];
        let mut entity=operation["payload"].clone();entity["id"]=operation["entityId"].clone();entity["version"]=json!(1);entity["createdAt"]=json!("2026-10-24T00:00:00.000Z");entity["updatedAt"]=entity["createdAt"].clone();entity["deletedAt"]=serde_json::Value::Null;
        json!({"operationId":operation["operationId"],"clientId":operation["clientId"],"entityType":operation["entityType"],"entityId":operation["entityId"],"serverOrder":"1","conflicts":[],"status":"acknowledged","entity":entity})
    }
    async fn structured_fixture(f:&Fixture)->(Arc<Gate>,WorkspaceHandle,serde_json::Value){let g=f.open().await;login(&g).await;let h=g.open(CLIENT).await.unwrap();g.execute(&h.handle,json!({"command":"mutate","operation":{"operationId":"01900000-0000-7000-8000-000000000080","clientId":h.context.client_id,"entityType":"task","entityId":PAGE,"kind":"create","baseVersion":null,"payload":{"title":"local title","status":"todo","due":null}}})).await.unwrap();let wire=g.execute(&h.handle,json!({"command":"prepare"})).await.unwrap();(g,h,wire)}
    #[tokio::test]
    async fn structured_unknown_and_invalid_receipt_keep_original_wire_cached_ack_never_resends(){
        for failure in [1,2]{let f=Fixture::new();let (g,h,wire)=structured_fixture(&f).await;
            for mutation in [1,2,3]{if mutation==1{f.provider.0.bad_receipt.store(true,Ordering::SeqCst);}else{f.provider.0.read_mutation.store(mutation,Ordering::SeqCst);}assert_eq!(g.send_structured(&h.handle).await.unwrap(),StructuredSendStatus::SendUnknown);assert!(g.active.lock().await.structured_ack.is_none());assert_eq!(g.execute(&h.handle,json!({"command":"prepare"})).await.unwrap(),wire);}
            g.ack_failure.store(failure,Ordering::SeqCst);assert_eq!(g.send_structured(&h.handle).await.unwrap(),StructuredSendStatus::AckPending);let snapshot=g.execute(&h.handle,json!({"command":"snapshot"})).await.unwrap();assert_eq!(snapshot["snapshot"]["operations"][0]["status"],if failure==1{"pending"}else{"acknowledged"});assert!(g.pull_structured(&h.handle).await.is_err());let calls=f.provider.0.sends.lock().unwrap().len();assert_eq!(g.send_structured(&h.handle).await.unwrap(),StructuredSendStatus::Acknowledged);assert_eq!(calls,f.provider.0.sends.lock().unwrap().len());assert_eq!(g.send_structured(&h.handle).await.unwrap(),StructuredSendStatus::Idle);assert!(f.provider.0.sends.lock().unwrap().iter().all(|v|v==wire.as_str().unwrap()));shutdown(g).await;
        }
    }
    #[tokio::test]
    async fn structured_conflict_and_permanent_rejection_remain_distinct_durable_outcomes(){
        for (mutation,status) in [(4,StructuredSendStatus::Conflict),(5,StructuredSendStatus::Rejected)]{let f=Fixture::new();let (g,h,_)=structured_fixture(&f).await;f.provider.0.read_mutation.store(mutation,Ordering::SeqCst);assert_eq!(g.send_structured(&h.handle).await.unwrap(),status);let snapshot=g.execute(&h.handle,json!({"command":"snapshot"})).await.unwrap();if mutation==4{assert_eq!(snapshot["snapshot"]["conflicts"].as_array().unwrap().len(),1);}else{assert_eq!(snapshot["snapshot"]["errors"].as_array().unwrap().len(),1);}shutdown(g).await;}
    }
    #[tokio::test]
    async fn structured_pull_validates_scope_progress_and_rechecks_commit_without_http(){
        for failure in [1,2]{let f=Fixture::new();let (g,h,_)=structured_fixture(&f).await;for mutation in [1,2,3]{f.provider.0.read_mutation.store(mutation,Ordering::SeqCst);assert_eq!(g.pull_structured(&h.handle).await.unwrap(),StructuredPullStatus::ReadUnknown);let snapshot=g.execute(&h.handle,json!({"command":"snapshot"})).await.unwrap();assert!(snapshot["snapshot"]["state"]["cursor"].is_null());}
            g.read_failure.store(failure,Ordering::SeqCst);assert_eq!(g.pull_structured(&h.handle).await.unwrap(),StructuredPullStatus::StorePending);let snapshot=g.execute(&h.handle,json!({"command":"snapshot"})).await.unwrap();if failure==1{assert!(snapshot["snapshot"]["state"]["cursor"].is_null());}else{assert_eq!(snapshot["snapshot"]["state"]["cursor"],"cursor-0");}assert!(g.send_structured(&h.handle).await.is_err());let calls=f.provider.0.reads.load(Ordering::SeqCst);assert_eq!(g.pull_structured(&h.handle).await.unwrap(),StructuredPullStatus::Received{has_more:false});assert_eq!(f.provider.0.reads.load(Ordering::SeqCst),calls);assert_eq!(g.execute(&h.handle,json!({"command":"snapshot"})).await.unwrap()["snapshot"]["state"]["cursor"],"cursor-0");assert!(f.provider.0.catalog_calls.lock().unwrap().iter().all(Option::is_none));shutdown(g).await;
        }
    }
    #[tokio::test]
    async fn structured_late_delivery_cannot_adopt_after_close_logout_expiry_reauth_or_account_change(){
        for read in [false,true]{for action in ["close","logout","expiry","reauth","account"]{let f=Fixture::new();let (g,h,wire)=structured_fixture(&f).await;if read{f.provider.0.read_hold.store(true,Ordering::SeqCst);}else{f.provider.0.send_hold.store(true,Ordering::SeqCst);}let copy=g.clone();let handle=h.handle.clone();let work=tokio::spawn(async move{if read{copy.pull_structured(&handle).await.map(|_|())}else{copy.send_structured(&handle).await.map(|_|())}});f.provider.0.entered.notified().await;
            match action{"close"=>g.cancel_open().await,"logout"=>{g.logout().await;},"expiry"=>{f.clock.0.store(200,Ordering::SeqCst);},"account"=>{f.provider.0.state.lock().unwrap().owner="owner-B".into();login(&g).await;},_=>{g.restore().await.unwrap();}}f.provider.0.release.notify_one();let _=work.await.unwrap();if action=="expiry"{f.provider.0.expires.store(400,Ordering::SeqCst);}f.provider.0.state.lock().unwrap().owner="owner-A".into();login(&g).await;let next=g.open(CLIENT).await.unwrap();assert_eq!(g.execute(&next.handle,json!({"command":"prepare"})).await.unwrap(),wire);assert!(g.execute(&next.handle,json!({"command":"snapshot"})).await.unwrap()["snapshot"]["state"]["cursor"].is_null());assert!(g.send_structured(&h.handle).await.is_err());assert!(g.pull_structured(&h.handle).await.is_err());shutdown(g).await;
        }}
    }
    #[tokio::test]
    async fn structured_restart_discards_cached_receipt_but_preserves_original_request(){
        let f=Fixture::new();let (g,h,wire)=structured_fixture(&f).await;g.ack_failure.store(1,Ordering::SeqCst);g.send_structured(&h.handle).await.unwrap();shutdown(g).await;let g=f.open().await;g.restore().await.unwrap();let next=g.open(CLIENT).await.unwrap();assert_eq!(g.execute(&next.handle,json!({"command":"prepare"})).await.unwrap(),wire);assert_eq!(g.send_structured(&next.handle).await.unwrap(),StructuredSendStatus::Acknowledged);assert_eq!(f.provider.0.sends.lock().unwrap().len(),2);shutdown(g).await;
    }
}
