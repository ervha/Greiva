//! New native entry: server bootstrap + instance/generation-bound admission.
//! Raw context, remote ACK/pull and secrets are never accepted from a caller.
use crate::{native_credentials::{CredentialError,CredentialStore},native_session::{NativeSession,NativeProvider,SessionSnapshot,SessionLogout,WorkspaceAdmission},offline_lease::NativeClock,WorkspaceHandle,WorkspaceOwner,WorkspaceRegistry};
use std::{path::PathBuf,sync::Arc};
use tokio::sync::Mutex;
type Result<T>=std::result::Result<T,CredentialError>;
struct GateState {generation:u64,active:Option<(WorkspaceHandle,WorkspaceAdmission)>}
pub struct NativeWorkspaceGate<S:CredentialStore,P:NativeProvider,C:NativeClock> {
    session:NativeSession<S,P,C>,registry:Arc<WorkspaceRegistry>,
    active:Mutex<GateState>,
}
impl<S:CredentialStore,P:NativeProvider,C:NativeClock> NativeWorkspaceGate<S,P,C> {
    pub fn new(session:NativeSession<S,P,C>,root:PathBuf)->Self {Self {session,registry:Arc::new(WorkspaceRegistry::new(root)),active:Mutex::new(GateState{generation:0,active:None})}}
    async fn close_active(&self,state:&mut GateState){state.active=None;state.generation=state.generation.checked_add(1).unwrap_or(u64::MAX);self.registry.close_all().await;}
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
    pub async fn cancel_open(&self){let mut active=self.active.lock().await;self.close_active(&mut active).await;}
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
    struct Inner {state:StdMutex<ProviderState>,hold:AtomicBool,entered:Notify,release:Notify}
    #[derive(Clone)]struct Provider(Arc<Inner>);
    impl NativeProvider for Provider {
        fn password<'a>(&'a self,_:&'a str,_:&'a [u8])->ProviderFuture<'a,TokenPair>{Box::pin(async {Ok(TokenPair{access:AccessSecret::new(b"fixture-access".to_vec())?,refresh:Secret::new(b"fixture-refresh".to_vec())?,subject:self.0.state.lock().unwrap().owner.clone()})})}
        fn refresh<'a>(&'a self,_:&'a Secret)->ProviderFuture<'a,TokenPair>{self.password("",b"")}
        fn verify<'a>(&'a self,_:&'a AccessSecret)->ProviderFuture<'a,VerifiedIdentity>{Box::pin(async {Ok(VerifiedIdentity{issuer:"https://auth.invalid/auth/v1".into(),subject:self.0.state.lock().unwrap().owner.clone(),expires_at:200})})}
        fn bootstrap<'a>(&'a self,_:&'a AccessSecret,client:&'a str)->ProviderFuture<'a,WorkspaceRegistration>{Box::pin(async move {
            if self.0.hold.swap(false,Ordering::SeqCst){self.0.entered.notify_one();self.0.release.notified().await;}
            let s=self.0.state.lock().unwrap();Ok(WorkspaceRegistration{protocol_version:1,workspace_id:if s.owner=="owner-A"{"01900000-0000-7000-8000-000000000001"}else{"01900000-0000-7000-8000-000000000009"}.into(),client_id:if s.bad_client {PAGE}else{client}.into(),epoch:"01900000-0000-7000-8000-000000000003".into()})
        })}
    }
    type Gate=NativeWorkspaceGate<Os,Provider,Clock>;
    struct Fixture {root:PathBuf,os:Os,provider:Provider,clock:Clock}
    impl Fixture {
        fn new()->Self {let mut b=[0u8;16];getrandom::getrandom(&mut b).unwrap();let root=std::env::temp_dir().join(format!("greiva-gate-{:x}",u128::from_le_bytes(b)));std::fs::create_dir(&root).unwrap();Self{root,os:Os::default(),provider:Provider(Arc::new(Inner{state:StdMutex::new(ProviderState{owner:"owner-A".into(),bad_client:false}),hold:AtomicBool::new(false),entered:Notify::new(),release:Notify::new()})),clock:Clock(Arc::new(AtomicU64::new(100)))}}
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
}
