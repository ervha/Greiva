//! OS-backed signed local lease and high-water clock. No UI clock, plaintext
//! fallback, network credentials or store operations live in this module.
use crate::{WorkspaceContext,native_credentials::{CredentialVault,CredentialStore,CredentialError,Secret,Ticket,LogoutResult},offline_grant::OfflineGrantVerifier};
use serde::{Serialize,Deserialize};
use std::{path::Path,time::{Instant,SystemTime,UNIX_EPOCH}};
type Result<T>=std::result::Result<T,CredentialError>;
pub trait NativeClock:Send+Sync {fn now(&self)->Result<u64>;}
pub struct SystemClock {wall:u64,start:Instant}
fn wall()->Result<u64>{SystemTime::now().duration_since(UNIX_EPOCH).map(|t|t.as_secs()).map_err(|_|CredentialError)}
impl SystemClock {pub fn new()->Result<Self>{Ok(Self{wall:wall()?,start:Instant::now()})}}
impl NativeClock for SystemClock {
    fn now(&self)->Result<u64>{let current=wall()?;let floor=self.wall.checked_add(self.start.elapsed().as_secs()).ok_or(CredentialError)?;
        // One second permits integer sampling boundaries only; returning the
        // maximum prevents this rounding allowance from extending the grant.
        if current.saturating_add(1)<floor{return Err(CredentialError)}Ok(current.max(floor))}
}
#[derive(Serialize,Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct StoredGrant {version:u8,context:WorkspaceContext,grant:String,high_water:u64}
pub struct OnlineChallenge {ticket:Ticket,nonce:String}
impl OnlineChallenge {pub fn nonce(&self)->&str{&self.nonce}}
pub struct LocalAccess {context:WorkspaceContext,expires_at:u64}
impl LocalAccess {pub fn context(&self)->&WorkspaceContext{&self.context}pub fn expires_at(&self)->u64{self.expires_at}}
pub struct OfflineLeaseStore<S:CredentialStore,C:NativeClock> {vault:CredentialVault<S>,verifier:OfflineGrantVerifier,clock:C}
impl<S:CredentialStore,C:NativeClock> OfflineLeaseStore<S,C> {
    pub async fn open(path:&Path,scope:&str,store:S,verifier:OfflineGrantVerifier,clock:C)->Result<Self>{
        Ok(Self{vault:CredentialVault::open(path,scope,store).await?,verifier,clock})
    }
    pub async fn begin_online(&self)->Result<OnlineChallenge>{
        let mut bytes=[0u8;32];getrandom::getrandom(&mut bytes).map_err(|_|CredentialError)?;
        let nonce=bytes.iter().map(|b|format!("{b:02x}")).collect();
        Ok(OnlineChallenge{ticket:self.vault.begin_login().await?,nonce})
    }
    /// Response from the authenticated native transport only. Fixed signature,
    /// scope and pending challenge are checked before making the lease durable.
    pub async fn accept_online(&self,challenge:OnlineChallenge,context:WorkspaceContext,token:String)->Result<()> {
        let now=self.clock.now()?;let verified=self.verifier.verify(&token,&context).map_err(|_|CredentialError)?;
        verified.check_challenge(&challenge.nonce).map_err(|_|CredentialError)?;verified.check_time(now,now).map_err(|_|CredentialError)?;
        let subject=context.subject_id.clone();let stored=StoredGrant{version:1,context,grant:token,high_water:now};
        let secret=Secret::new(serde_json::to_vec(&stored).map_err(|_|CredentialError)?)?;
        self.vault.complete(challenge.ticket,&subject,secret).await?;
        // Old OS entries can remain for later cleanup, but never regain access.
        let _=self.vault.cleanup().await;Ok(())
    }
    /// Native admission check. Call before each read/edit/open, and couple the
    /// returned proof to a session generation until that operation completes.
    pub async fn check_access(&self,expected:&WorkspaceContext)->Result<LocalAccess>{
        self.vault.update_active(&expected.subject_id,|secret|{
            let mut stored:StoredGrant=serde_json::from_slice(secret.expose()).map_err(|_|CredentialError)?;
            if stored.version!=1||stored.context!=*expected{return Err(CredentialError)}
            let verified=self.verifier.verify(&stored.grant,expected).map_err(|_|CredentialError)?;
            let now=self.clock.now()?;verified.check_time(now,stored.high_water).map_err(|_|CredentialError)?;
            stored.high_water=now;let result=LocalAccess{context:expected.clone(),expires_at:verified.expires_at()};
            Ok((Secret::new(serde_json::to_vec(&stored).map_err(|_|CredentialError)?)?,result))
        }).await
    }
    pub async fn logout(&self)->Result<LogoutResult>{self.vault.logout().await}
    pub async fn close(self){self.vault.close().await}
}

/// A native local-only repository boundary. Owns the raw registry so no caller
/// can accidentally use a proof once and bypass subsequent expiry/logout checks.
/// The existing preview registry is not silently promoted to this boundary.
pub struct OfflineWorkspaceRegistry<S:CredentialStore,C:NativeClock> {
    lease:OfflineLeaseStore<S,C>,registry:crate::WorkspaceRegistry,
    active:tokio::sync::Mutex<Option<crate::WorkspaceHandle>>,
}
impl<S:CredentialStore,C:NativeClock> OfflineWorkspaceRegistry<S,C> {
    pub fn new(lease:OfflineLeaseStore<S,C>,workspace_root:std::path::PathBuf)->Self{Self{lease,registry:crate::WorkspaceRegistry::new(workspace_root),active:tokio::sync::Mutex::new(None)}}
    async fn close_active(&self,active:&mut Option<crate::WorkspaceHandle>)->Result<()>{if let Some(old)=active.take(){self.registry.close(&old.handle).await.map_err(|_|CredentialError)?;}Ok(())}
    pub async fn begin_online(&self)->Result<OnlineChallenge>{let mut active=self.active.lock().await;self.close_active(&mut active).await?;self.lease.begin_online().await}
    pub async fn accept_online(&self,challenge:OnlineChallenge,context:WorkspaceContext,token:String)->Result<()>{let _gate=self.active.lock().await;self.lease.accept_online(challenge,context,token).await}
    pub async fn open(&self,context:WorkspaceContext)->Result<crate::WorkspaceHandle>{let mut active=self.active.lock().await;self.close_active(&mut active).await?;self.lease.check_access(&context).await?;
        let handle=self.registry.open(context).await.map_err(|_|CredentialError)?;*active=Some(handle.clone());Ok(handle)}
    pub async fn close(&self,handle:&str)->Result<()>{let mut active=self.active.lock().await;if active.as_ref().is_none_or(|a|a.handle!=handle){return Err(CredentialError)}self.close_active(&mut active).await}
    pub async fn check(&self,handle:&str)->Result<LocalAccess>{let mut active=self.active.lock().await;let context=active.as_ref().filter(|a|a.handle==handle).ok_or(CredentialError)?.context.clone();
        match self.lease.check_access(&context).await{Ok(access)=>Ok(access),Err(error)=>{let _=self.close_active(&mut active).await;Err(error)}}}
    pub async fn execute(&self,handle:&str,request:serde_json::Value)->Result<serde_json::Value>{
        let mut active=self.active.lock().await;let context=active.as_ref().filter(|a|a.handle==handle).ok_or(CredentialError)?.context.clone();
        if self.lease.check_access(&context).await.is_err(){let _=self.close_active(&mut active).await;return Err(CredentialError)}
        // Local queues/immutable prepared wires may be created offline. Remote
        // receive/ACK/pull paths require a separate authenticated transport.
        if !crate::workspace_registry::local_command(&request){return Err(CredentialError)}
        // Serialize through the existing SQLite commit. Logout waits for
        // admitted work, then closes the handle without deleting its data.
        self.registry.execute(handle,request).await.map_err(|_|CredentialError)
    }
    pub async fn logout(&self)->Result<LogoutResult>{let mut active=self.active.lock().await;let closed=self.close_active(&mut active).await;let locked=self.lease.logout().await;closed?;locked}
}

#[cfg(test)]
mod tests {
    use super::*;use ed25519_dalek::{SigningKey,Signer};use base64::{engine::general_purpose::URL_SAFE_NO_PAD,Engine};use serde_json::json;
    use std::{collections::HashMap,sync::{Arc,Mutex,atomic::{AtomicU64,Ordering}}};
    #[derive(Clone)]struct Clock(Arc<AtomicU64>);impl NativeClock for Clock{fn now(&self)->Result<u64>{Ok(self.0.load(Ordering::SeqCst))}}
    #[derive(Default)]struct Values{entries:HashMap<String,Vec<u8>>,fail_write:bool,fail_delete:bool}
    #[derive(Clone,Default)]struct Os(Arc<Mutex<Values>>);
    impl CredentialStore for Os {
        fn read(&self,k:&str)->Result<Option<Secret>>{self.0.lock().unwrap().entries.get(k).map(|v|Secret::new(v.clone())).transpose()}
        fn write(&self,k:&str,v:&Secret)->Result<()>{let mut values=self.0.lock().unwrap();values.entries.insert(k.into(),v.expose().to_vec());if values.fail_write{Err(CredentialError)}else{Ok(())}}
        fn delete(&self,k:&str)->Result<()>{let mut values=self.0.lock().unwrap();if values.fail_delete{return Err(CredentialError)}values.entries.remove(k);Ok(())}
    }
    fn context()->WorkspaceContext{WorkspaceContext{issuer:"https://auth.invalid".into(),subject_id:"synthetic-owner".into(),workspace_id:"01900000-0000-7000-8000-000000000001".into(),client_id:"01900000-0000-7000-8000-000000000002".into(),stream_epoch:"01900000-0000-7000-8000-000000000003".into()}}
    struct Fixture{root:std::path::PathBuf,os:Os,clock:Clock,key:SigningKey}
    impl Fixture {
        fn new()->Self{let root=std::env::temp_dir().join(format!("greiva-offline-lease-{}-{}",std::process::id(),SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));std::fs::create_dir(&root).unwrap();Self{root,os:Os::default(),clock:Clock(Arc::new(AtomicU64::new(1000))),key:SigningKey::from_bytes(&[42;32])}}
        async fn open(&self)->OfflineLeaseStore<Os,Clock>{OfflineLeaseStore::open(&self.root.join("marker.sqlite"),"synthetic-offline-scope",self.os.clone(),OfflineGrantVerifier::new("https://api.invalid".into(),"native".into(),vec![("fixture".into(),self.key.verifying_key().to_bytes())]).unwrap(),self.clock.clone()).await.unwrap()}
        fn token(&self,nonce:&str)->String{let c=context();let input=format!("{}.{}",URL_SAFE_NO_PAD.encode(json!({"alg":"EdDSA","typ":"greiva-offline-v1+jwt","kid":"fixture"}).to_string()),URL_SAFE_NO_PAD.encode(json!({"iss":"https://api.invalid","aud":"native","sub":c.subject_id,"authIssuer":c.issuer,"workspaceId":c.workspace_id,"clientId":c.client_id,"streamEpoch":c.stream_epoch,"iat":1000,"exp":605800,"nonce":nonce}).to_string()));format!("{}.{}",input,URL_SAFE_NO_PAD.encode(self.key.sign(input.as_bytes()).to_bytes()))}
        async fn login(&self,s:&OfflineLeaseStore<Os,Clock>){let c=s.begin_online().await.unwrap();let t=self.token(c.nonce());s.accept_online(c,context(),t).await.unwrap();}
    }
    impl Drop for Fixture{fn drop(&mut self){let _=std::fs::remove_dir_all(&self.root);}}
    #[tokio::test]
    async fn restart_keeps_signed_scope_and_durable_high_water_without_sqlite_grant(){
        let f=Fixture::new();let s=f.open().await;f.login(&s).await;f.clock.0.store(2000,Ordering::SeqCst);assert_eq!(s.check_access(&context()).await.unwrap().expires_at(),605800);s.close().await;
        let s=f.open().await;f.clock.0.store(1999,Ordering::SeqCst);assert!(s.check_access(&context()).await.is_err());f.clock.0.store(2001,Ordering::SeqCst);assert!(s.check_access(&context()).await.is_err());s.close().await;
        for entry in std::fs::read_dir(&f.root).unwrap(){let bytes=std::fs::read(entry.unwrap().path()).unwrap();let text=String::from_utf8_lossy(&bytes);assert!(!text.contains("synthetic-owner"));assert!(!text.contains("greiva-offline"));assert!(!text.contains("highWater"));}
    }
    #[tokio::test]
    async fn exact_expiry_and_logout_persist_even_when_os_cleanup_fails(){
        let f=Fixture::new();let s=f.open().await;f.login(&s).await;f.clock.0.store(605799,Ordering::SeqCst);assert!(s.check_access(&context()).await.is_ok());f.clock.0.store(605800,Ordering::SeqCst);assert!(s.check_access(&context()).await.is_err());s.close().await;
        let s=f.open().await;f.clock.0.store(1000,Ordering::SeqCst);assert!(s.check_access(&context()).await.is_err());f.login(&s).await;f.os.0.lock().unwrap().fail_delete=true;assert!(s.logout().await.unwrap().cleanup_pending);s.close().await;
        let s=f.open().await;assert!(s.check_access(&context()).await.is_err());s.close().await;
    }
    #[tokio::test]
    async fn old_challenge_foreign_scope_corrupt_os_and_unknown_clock_write_deny(){
        let f=Fixture::new();let s=f.open().await;let old=s.begin_online().await.unwrap();let old_token=f.token(old.nonce());let next=s.begin_online().await.unwrap();assert!(s.accept_online(old,context(),old_token).await.is_err());assert!(s.accept_online(next,context(),f.token(&"a".repeat(64))).await.is_err());
        f.login(&s).await;let mut other=context();other.client_id="01900000-0000-7000-8000-000000000004".into();assert!(s.check_access(&other).await.is_err());assert!(s.check_access(&context()).await.is_err());
        f.login(&s).await;f.os.0.lock().unwrap().fail_write=true;assert!(s.check_access(&context()).await.is_err());f.os.0.lock().unwrap().fail_write=false;assert!(s.check_access(&context()).await.is_err());
        f.login(&s).await;for bytes in f.os.0.lock().unwrap().entries.values_mut(){*bytes=b"corrupt OS value".to_vec();}assert!(s.check_access(&context()).await.is_err());s.close().await;
    }
    #[tokio::test]
    async fn real_workspace_pending_survives_logout_and_expiry_without_remote_ack(){
        let f=Fixture::new();let r=OfflineWorkspaceRegistry::new(f.open().await,f.root.join("workspaces"));
        assert!(r.open(context()).await.is_err());let c=r.begin_online().await.unwrap();let t=f.token(c.nonce());r.accept_online(c,context(),t).await.unwrap();let handle=r.open(context()).await.unwrap();
        let page="01900000-0000-7000-8000-000000000004";
        r.execute(&handle.handle,json!({"command":"page_create","pageId":page,"title":"synthetic pending","update":[0,0]})).await.unwrap();
        let prepare=json!({"command":"page_prepare","pageId":page});let before=r.execute(&handle.handle,prepare.clone()).await.unwrap();assert!(!before.is_null());
        assert!(r.execute(&handle.handle,json!({"command":"page_ack","pageId":page,"sequence":"1","response":{}})).await.is_err());
        r.logout().await.unwrap();assert!(r.execute(&handle.handle,json!({"command":"page_load","pageId":page})).await.is_err());assert!(r.open(context()).await.is_err());
        let c=r.begin_online().await.unwrap();let t=f.token(c.nonce());r.accept_online(c,context(),t).await.unwrap();let new=r.open(context()).await.unwrap();assert_ne!(new.handle,handle.handle);assert_eq!(r.execute(&new.handle,prepare.clone()).await.unwrap(),before);
        f.clock.0.store(605800,Ordering::SeqCst);assert!(r.execute(&new.handle,json!({"command":"page_append","pageId":page,"update":[0,0]})).await.is_err());assert!(r.check(&new.handle).await.is_err());
        f.clock.0.store(1000,Ordering::SeqCst);assert!(r.open(context()).await.is_err());let c=r.begin_online().await.unwrap();let t=f.token(c.nonce());r.accept_online(c,context(),t).await.unwrap();let last=r.open(context()).await.unwrap();assert_eq!(r.execute(&last.handle,prepare).await.unwrap(),before);
        r.close(&last.handle).await.unwrap();drop(r);
    }
}
