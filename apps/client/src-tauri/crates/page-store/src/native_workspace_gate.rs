//! New native entry: server bootstrap + instance/generation-bound admission.
//! Raw context, remote ACK/pull and secrets are never accepted from a caller.
use crate::{native_credentials::{CredentialError,CredentialStore},native_session::{NativeSession,NativeProvider,SessionSnapshot,SessionLogout,WorkspaceAdmission},offline_lease::NativeClock,WorkspaceHandle,WorkspaceOwner,WorkspaceRegistry};
use std::{path::PathBuf,sync::Arc};
use tokio::sync::Mutex;
type Result<T>=std::result::Result<T,CredentialError>;
#[derive(Clone)]
struct PendingPageAck {prepared:serde_json::Value,response:serde_json::Value}
struct CatalogProgress {cursor:Option<String>,last:Option<String>}
struct GateState {generation:u64,active:Option<(WorkspaceHandle,WorkspaceAdmission)>,receipts:std::collections::HashMap<String,PendingPageAck>,reads:std::collections::HashMap<String,serde_json::Value>,catalog:Option<CatalogProgress>}
#[derive(serde::Serialize)]
#[serde(rename_all="camelCase")]
pub struct NativePageCatalog {pub pages:Vec<crate::PageMetadata>,pub has_more:bool}
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
pub enum PageReadStatus {Received,ReadUnknown,StorePending}
pub struct NativeWorkspaceGate<S:CredentialStore,P:NativeProvider,C:NativeClock> {
    session:NativeSession<S,P,C>,registry:Arc<WorkspaceRegistry>,
    active:Mutex<GateState>,
    page_send:Mutex<()>,
    page_read:Mutex<()>,
    page_catalog:Mutex<()>,
    #[cfg(test)]ack_failure:std::sync::atomic::AtomicU8,
    #[cfg(test)]read_failure:std::sync::atomic::AtomicU8,
}
impl<S:CredentialStore,P:NativeProvider,C:NativeClock> NativeWorkspaceGate<S,P,C> {
    pub fn new(session:NativeSession<S,P,C>,root:PathBuf)->Self {Self {session,registry:Arc::new(WorkspaceRegistry::new(root)),active:Mutex::new(GateState{generation:0,active:None,receipts:std::collections::HashMap::new(),reads:std::collections::HashMap::new(),catalog:None}),page_send:Mutex::new(()),page_read:Mutex::new(()),page_catalog:Mutex::new(()),#[cfg(test)]ack_failure:std::sync::atomic::AtomicU8::new(0),#[cfg(test)]read_failure:std::sync::atomic::AtomicU8::new(0)}}
    async fn close_active(&self,state:&mut GateState){state.active=None;state.receipts.clear();state.reads.clear();state.catalog=None;state.generation=state.generation.checked_add(1).unwrap_or(u64::MAX);self.registry.close_all().await;}
    pub async fn login(&self,email:&str,password:Vec<u8>)->Result<SessionSnapshot>{
        {let mut active=self.active.lock().await;self.close_active(&mut active).await;}
        self.session.login(email,password).await
    }
    pub async fn restore(&self)->Result<SessionSnapshot>{
        {let mut active=self.active.lock().await;self.close_active(&mut active).await;}
        self.session.restore().await
    }
    pub async fn snapshot(&self)->SessionSnapshot {
        let mut active=self.active.lock().await;let snapshot=self.session.snapshot().await;
        if snapshot.phase!=crate::native_session::Phase::Verified{self.close_active(&mut active).await;}snapshot
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
        let mut active=self.active.lock().await;self.close_active(&mut active).await;self.session.logout_with_revoke().await
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
    pub async fn cancel_open(&self){let mut active=self.active.lock().await;self.close_active(&mut active).await;}
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
    pub async fn shutdown(self){self.registry.close_all().await;self.session.close().await;}
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
    #[derive(Clone,Default)]struct Os(Arc<StdMutex<HashMap<String,Vec<u8>>>>);
    impl CredentialStore for Os {
        fn read(&self,t:&str)->Result<Option<Secret>>{self.0.lock().unwrap().get(t).map(|b|Secret::new(b.clone())).transpose()}
        fn write(&self,t:&str,s:&Secret)->Result<()>{self.0.lock().unwrap().insert(t.into(),s.expose().to_vec());Ok(())}
        fn delete(&self,t:&str)->Result<()>{self.0.lock().unwrap().remove(t);Ok(())}
    }
    #[derive(Clone)]struct Clock(Arc<AtomicU64>);impl NativeClock for Clock {fn now(&self)->Result<u64>{Ok(self.0.load(Ordering::SeqCst))}}
    struct ProviderState {owner:String,bad_client:bool}
    struct Inner {state:StdMutex<ProviderState>,hold:AtomicBool,entered:Notify,release:Notify,send_hold:AtomicBool,bad_receipt:AtomicBool,sends:StdMutex<Vec<String>>,read_hold:AtomicBool,read_mutation:std::sync::atomic::AtomicU8,reads:std::sync::atomic::AtomicUsize,catalog_hold:AtomicBool,catalog_mutation:std::sync::atomic::AtomicU8,catalog_calls:StdMutex<Vec<Option<String>>>}
    #[derive(Clone)]struct Provider(Arc<Inner>);
    impl NativeProvider for Provider {
        fn password<'a>(&'a self,_:&'a str,_:&'a [u8])->ProviderFuture<'a,TokenPair>{Box::pin(async {Ok(TokenPair{access:AccessSecret::new(b"fixture-access".to_vec())?,refresh:Secret::new(b"fixture-refresh".to_vec())?,subject:self.0.state.lock().unwrap().owner.clone()})})}
        fn refresh<'a>(&'a self,_:&'a Secret)->ProviderFuture<'a,TokenPair>{self.password("",b"")}
        fn verify<'a>(&'a self,_:&'a AccessSecret)->ProviderFuture<'a,VerifiedIdentity>{Box::pin(async {Ok(VerifiedIdentity{issuer:"https://auth.invalid/auth/v1".into(),subject:self.0.state.lock().unwrap().owner.clone(),expires_at:200})})}
        fn bootstrap<'a>(&'a self,_:&'a AccessSecret,client:&'a str)->ProviderFuture<'a,WorkspaceRegistration>{Box::pin(async move {
            if self.0.hold.swap(false,Ordering::SeqCst){self.0.entered.notify_one();self.0.release.notified().await;}
            let s=self.0.state.lock().unwrap();Ok(WorkspaceRegistration{protocol_version:1,workspace_id:if s.owner=="owner-A"{"01900000-0000-7000-8000-000000000001"}else{"01900000-0000-7000-8000-000000000009"}.into(),client_id:if s.bad_client {PAGE}else{client}.into(),epoch:"01900000-0000-7000-8000-000000000003".into()})
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
        fn new()->Self {let mut b=[0u8;16];getrandom::getrandom(&mut b).unwrap();let root=std::env::temp_dir().join(format!("greiva-gate-{:x}",u128::from_le_bytes(b)));std::fs::create_dir(&root).unwrap();Self{root,os:Os::default(),provider:Provider(Arc::new(Inner{state:StdMutex::new(ProviderState{owner:"owner-A".into(),bad_client:false}),hold:AtomicBool::new(false),entered:Notify::new(),release:Notify::new(),send_hold:AtomicBool::new(false),bad_receipt:AtomicBool::new(false),sends:StdMutex::new(Vec::new()),read_hold:AtomicBool::new(false),read_mutation:std::sync::atomic::AtomicU8::new(0),reads:std::sync::atomic::AtomicUsize::new(0),catalog_hold:AtomicBool::new(false),catalog_mutation:std::sync::atomic::AtomicU8::new(0),catalog_calls:StdMutex::new(Vec::new())})),clock:Clock(Arc::new(AtomicU64::new(100)))}}
        async fn open(&self)->Arc<Gate>{let vault=CredentialVault::open(&self.root.join("session.sqlite"),"fixture-gate",self.os.clone()).await.unwrap();Arc::new(Gate::new(NativeSession::new(vault,self.provider.clone(),self.clock.clone(),"https://auth.invalid/auth/v1".into()).unwrap(),self.root.join("workspaces")))}
    }
    impl Drop for Fixture {fn drop(&mut self){let _=std::fs::remove_dir_all(&self.root);}}
    async fn login(g:&Gate){assert_eq!(g.login("fixture@example.invalid",b"fixture-password".to_vec()).await.unwrap().phase,Phase::Verified);}
    async fn shutdown(g:Arc<Gate>){Arc::try_unwrap(g).ok().unwrap().shutdown().await;}
    #[tokio::test]
    async fn native_gate_restart_device_binding_and_pending_survive_logout(){
        let f=Fixture::new();let g=f.open().await;assert!(g.open(CLIENT).await.is_err());login(&g).await;let h=g.open(CLIENT).await.unwrap();
        g.execute(&h.handle,json!({"command":"page_create","pageId":PAGE,"title":"synthetic retained","update":[0,0]})).await.unwrap();
        let request=json!({"command":"page_prepare","pageId":PAGE});let wire=g.execute(&h.handle,request.clone()).await.unwrap();assert!(!wire.is_null());
        for command in ["ack","pull","page_ack","page_receive","changes_receive","database_source_receive"] {assert!(g.execute(&h.handle,json!({"command":command})).await.is_err());}
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
    }}
