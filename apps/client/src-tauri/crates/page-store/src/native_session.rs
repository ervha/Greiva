//! Native-only session orchestration. No IPC, HTTP adapter or offline authority.
//! Provider implementations must verify access tokens at the trusted API; a
//! parsed token payload is not a verified identity. Never expose secrets to UI.
use crate::{native_credentials::{CredentialError, CredentialStore, CredentialVault, LogoutResult, Secret}, offline_lease::NativeClock};
use std::{future::Future, pin::Pin, time::Duration};
use tokio::sync::{watch, Mutex};
use zeroize::Zeroizing;

type Result<T> = std::result::Result<T, CredentialError>;
pub type ProviderFuture<'a, T> = Pin<Box<dyn Future<Output = Result<T>> + Send + 'a>>;
pub struct AccessSecret(Zeroizing<Vec<u8>>);
impl AccessSecret {
    pub fn new(bytes: Vec<u8>) -> Result<Self> {
        let bytes = Zeroizing::new(bytes);
        if bytes.is_empty() || bytes.len() > 8192 || std::str::from_utf8(&bytes).is_err() { return Err(CredentialError); }
        Ok(Self(bytes))
    }
    /// Trusted native transport only, never IPC or logs.
    pub fn expose(&self) -> &[u8] { &self.0 }
}
pub struct TokenPair { pub access: AccessSecret, pub refresh: Secret, pub subject: String }
pub struct VerifiedIdentity { pub issuer: String, pub subject: String, pub expires_at: u64 }
pub struct WorkspaceRegistration { pub protocol_version:u8, pub workspace_id:String, pub client_id:String, pub epoch:String }
/// Native-only admission; no public constructor or Deserialize/Serialize.
#[derive(Clone)]
pub struct WorkspaceAdmission { instance:[u8;32], generation:u64, context:crate::WorkspaceContext }
impl WorkspaceAdmission { pub fn context(&self)->&crate::WorkspaceContext {&self.context} }
pub trait NativeProvider: Send + Sync {
    fn password<'a>(&'a self, email: &'a str, password: &'a [u8]) -> ProviderFuture<'a, TokenPair>;
    fn refresh<'a>(&'a self, refresh: &'a Secret) -> ProviderFuture<'a, TokenPair>;
    fn verify<'a>(&'a self, access: &'a AccessSecret) -> ProviderFuture<'a, VerifiedIdentity>;
    fn revoke<'a>(&'a self, _access: &'a AccessSecret) -> ProviderFuture<'a, ()> {
        Box::pin(async { Err(CredentialError) })
    }
    fn bootstrap<'a>(&'a self,_access:&'a AccessSecret,_client:&'a str)->ProviderFuture<'a,WorkspaceRegistration> {Box::pin(async {Err(CredentialError)})}
    fn page_send<'a>(&'a self,_access:&'a AccessSecret,_context:&'a crate::WorkspaceContext,_page:&'a str,_kind:&'a str,_wire:&'a str)->ProviderFuture<'a,serde_json::Value> {Box::pin(async {Err(CredentialError)})}
    fn title_send<'a>(&'a self,_access:&'a AccessSecret,_context:&'a crate::WorkspaceContext,_page:&'a str,_kind:&'a str,_wire:&'a str)->ProviderFuture<'a,serde_json::Value> {Box::pin(async {Err(CredentialError)})}
    fn page_read<'a>(&'a self,_access:&'a AccessSecret,_context:&'a crate::WorkspaceContext,_page:&'a str)->ProviderFuture<'a,serde_json::Value> {Box::pin(async {Err(CredentialError)})}
    fn title_read<'a>(&'a self,_access:&'a AccessSecret,_context:&'a crate::WorkspaceContext,_page:&'a str)->ProviderFuture<'a,serde_json::Value> {Box::pin(async {Err(CredentialError)})}
    fn page_catalog<'a>(&'a self,_access:&'a AccessSecret,_context:&'a crate::WorkspaceContext,_cursor:Option<&'a str>)->ProviderFuture<'a,serde_json::Value> {Box::pin(async {Err(CredentialError)})}
    fn structured_send<'a>(&'a self,_access:&'a AccessSecret,_context:&'a crate::WorkspaceContext,_wire:&'a str)->ProviderFuture<'a,serde_json::Value> {Box::pin(async {Err(CredentialError)})}
    fn structured_pull<'a>(&'a self,_access:&'a AccessSecret,_context:&'a crate::WorkspaceContext,_request:&'a serde_json::Value)->ProviderFuture<'a,serde_json::Value> {Box::pin(async {Err(CredentialError)})}
    fn offline_grant<'a>(&'a self,_access:&'a AccessSecret,_context:&'a crate::WorkspaceContext,_nonce:&'a str)->ProviderFuture<'a,String> {Box::pin(async {Err(CredentialError)})}
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Phase { Locked, Authenticating, Refreshing, Verified }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SessionSnapshot { pub phase: Phase, pub expires_at: Option<u64> }
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SessionLogout { pub local_locked:bool, pub persistent_locked:bool, pub cleanup_pending:Option<bool>, pub provider_confirmed:bool }
struct Active { access: AccessSecret, identity: VerifiedIdentity, durable_generation:i64 }
struct State { generation: u64, phase: Phase, active: Option<Active>, high_water: u64, durable_generation:Option<i64> }
pub struct NativeSession<S: CredentialStore, P: NativeProvider, C: NativeClock> {
    vault: CredentialVault<S>, provider: P, clock: C, issuer: String,
    state: Mutex<State>, changed: watch::Sender<u64>,
    instance:[u8;32],
}
impl<S: CredentialStore, P: NativeProvider, C: NativeClock> NativeSession<S, P, C> {
    pub(crate) fn issuer(&self)->&str{&self.issuer}
    /// issuer is trusted deployment configuration, never a WebView parameter.
    pub fn new(vault: CredentialVault<S>, provider: P, clock: C, issuer: String) -> Result<Self> {
        if issuer.is_empty() || issuer.len() > 2048 || issuer.chars().any(char::is_control) { return Err(CredentialError); }
        let (changed, _) = watch::channel(0);
        let mut instance=[0u8;32];getrandom::getrandom(&mut instance).map_err(|_|CredentialError)?;
        Ok(Self { vault, provider, clock, issuer, changed, instance, state: Mutex::new(State { generation:0, phase:Phase::Locked, active:None, high_water:0, durable_generation:None }) })
    }
    fn advance(&self, state: &mut State, phase: Phase) -> Result<u64> {
        state.active = None; state.phase = Phase::Locked;
        state.generation = state.generation.checked_add(1).ok_or(CredentialError)?;
        self.changed.send_replace(state.generation);
        state.phase = phase;
        Ok(state.generation)
    }
    fn time(&self, state: &mut State) -> Result<u64> {
        let now = self.clock.now()?;
        if now < state.high_water { return Err(CredentialError); }
        state.high_water = now; Ok(now)
    }
    async fn bounded<T>(&self, generation: u64, work: impl Future<Output=Result<T>>) -> Result<T> {
        let mut changed = self.changed.subscribe();
        if *changed.borrow() != generation { return Err(CredentialError); }
        tokio::select! {
            biased;
            _ = changed.changed() => Err(CredentialError),
            result = tokio::time::timeout(Duration::from_secs(15), work) => result.map_err(|_| CredentialError)?,
        }
    }
    async fn fail(&self, generation: u64) {
        let mut state = self.state.lock().await;
        if state.generation == generation {
            let _ = self.advance(&mut state, Phase::Locked);
            self.lock_owned(&state).await;
        }
    }
    async fn lock_owned(&self,state:&State) {
        if let Some(generation)=state.durable_generation {let _=self.vault.logout_generation(generation).await;}
    }
    /// Email/password remain only in this native call; the password buffer is
    /// zeroized even on cancellation. Failed/abandoned attempts require logout
    /// or explicit login; no automatic retry of refresh credentials.
    pub async fn login(&self, email: &str, password: Vec<u8>) -> Result<SessionSnapshot> {
        let password = Zeroizing::new(password);
        if email.trim().is_empty() || email.len() > 320 || email.chars().any(char::is_control) || password.is_empty() || password.len() > 4096 { return Err(CredentialError); }
        let mut state = self.state.lock().await;
        if matches!(state.phase, Phase::Authenticating | Phase::Refreshing) { return Err(CredentialError); }
        let generation = self.advance(&mut state, Phase::Authenticating)?;
        if self.time(&mut state).is_err() { state.phase=Phase::Locked; self.lock_owned(&state).await; return Err(CredentialError); }
        let ticket = match self.vault.begin_login().await { Ok(t) => t, Err(e) => { state.phase=Phase::Locked; return Err(e); } };
        state.durable_generation=Some(ticket.generation());
        drop(state);
        let result = async {
            let pair = self.bounded(generation, self.provider.password(email, &password)).await?;
            self.finish(generation, ticket, pair).await
        }.await;
        if result.is_err() { self.fail(generation).await; }
        result
    }
    /// Restoring/refreshing first durably locks the old rotating credential.
    /// A failed exchange cannot be retried by invoking restore again.
    pub async fn restore(&self) -> Result<SessionSnapshot> {
        let mut state = self.state.lock().await;
        if matches!(state.phase, Phase::Authenticating | Phase::Refreshing) { return Err(CredentialError); }
        let generation = self.advance(&mut state, Phase::Refreshing)?;
        if self.time(&mut state).is_err() { state.phase=Phase::Locked; self.lock_owned(&state).await; return Err(CredentialError); }
        let lease = match self.vault.begin_restore().await { Ok(l) => l, Err(e) => { state.phase=Phase::Locked; return Err(e); } };
        state.durable_generation=Some(lease.ticket.generation());
        drop(state);
        let result = async {
            let pair = self.bounded(generation, self.provider.refresh(&lease.secret)).await?;
            self.finish(generation, lease.ticket, pair).await
        }.await;
        if result.is_err() { self.fail(generation).await; }
        result
    }
    async fn finish(&self, generation: u64, ticket: crate::native_credentials::Ticket, pair: TokenPair) -> Result<SessionSnapshot> {
        let identity = self.bounded(generation, self.provider.verify(&pair.access)).await?;
        let mut state = self.state.lock().await;
        if state.generation != generation || !matches!(state.phase, Phase::Authenticating | Phase::Refreshing) { return Err(CredentialError); }
        if identity.issuer != self.issuer || identity.subject != pair.subject || identity.subject.trim().is_empty() || identity.subject.len()>512 || identity.subject.chars().any(char::is_control) || identity.expires_at <= self.time(&mut state)? { return Err(CredentialError); }
        let durable_generation=ticket.generation();
        self.vault.complete(ticket, &identity.subject, pair.refresh).await?;
        if identity.expires_at <= self.time(&mut state)? { return Err(CredentialError); }
        let expires_at = identity.expires_at;
        state.active = Some(Active { access:pair.access, identity, durable_generation }); state.phase=Phase::Verified;
        self.admit(&mut state).await?;
        let _ = self.vault.cleanup().await;
        Ok(SessionSnapshot { phase:Phase::Verified, expires_at:Some(expires_at) })
    }
    async fn admit(&self, state: &mut State) -> Result<()> {
        let now = self.time(state)?;
        let active = state.active.as_ref().ok_or(CredentialError)?;
        if state.phase != Phase::Verified || active.identity.expires_at <= now { return Err(CredentialError); }
        // Cross-process logout fences both admission and delivery. No refresh
        // token leaves this gate; a failed OS read/write locks persistent state.
        self.vault.update_generation(&active.identity.subject, active.durable_generation, |secret| Ok((Secret::new(secret.expose().to_vec())?, ()))).await
    }
    pub async fn snapshot(&self) -> SessionSnapshot {
        let mut state = self.state.lock().await;
        if state.phase == Phase::Verified && self.admit(&mut state).await.is_err() {
            let _ = self.advance(&mut state, Phase::Locked); self.lock_owned(&state).await;
        }
        SessionSnapshot { phase:state.phase, expires_at:state.active.as_ref().map(|a|a.identity.expires_at) }
    }
    /// Native transport returns a buffered result only after a second admission
    /// check. The callback must not commit workspace state/ACKs itself. This
    /// cannot undo HTTP side effects already sent before cancellation.
    pub async fn authorized<T>(&self, work: impl for<'a> FnOnce(&'a AccessSecret) -> ProviderFuture<'a,T>) -> Result<T> {
        let mut state = self.state.lock().await;
        if self.admit(&mut state).await.is_err() {
            let _ = self.advance(&mut state, Phase::Locked); self.lock_owned(&state).await; return Err(CredentialError);
        }
        let generation=state.generation;
        let access=AccessSecret::new(state.active.as_ref().ok_or(CredentialError)?.access.expose().to_vec())?;
        drop(state);
        let result=self.bounded(generation, work(&access)).await;
        let mut state=self.state.lock().await;
        if state.generation != generation { return Err(CredentialError); }
        if self.admit(&mut state).await.is_err() {
            let _ = self.advance(&mut state, Phase::Locked); self.lock_owned(&state).await; return Err(CredentialError);
        }
        result
    }
    /// Local lock is immediate in memory. Persistent-lock failure is returned,
    /// never labelled confirmed. Provider revocation is a separate adapter step.
    pub async fn logout(&self) -> Result<LogoutResult> {
        let mut state=self.state.lock().await;
        self.advance(&mut state, Phase::Locked)?;
        self.vault.logout().await
    }
    pub async fn bootstrap(&self,client:&str)->Result<WorkspaceAdmission> {
        if !crate::structured::uuid_v7(client){return Err(CredentialError)}
        let mut state=self.state.lock().await;
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        let generation=state.generation;let active=state.active.as_ref().ok_or(CredentialError)?;
        let access=AccessSecret::new(active.access.expose().to_vec())?;
        let issuer=active.identity.issuer.clone();let subject_id=active.identity.subject.clone();drop(state);
        let result=self.bounded(generation,self.provider.bootstrap(&access,client)).await;
        let mut state=self.state.lock().await;
        if state.generation!=generation{return Err(CredentialError)}
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        let response=result?;
        if response.protocol_version!=1 || response.client_id!=client || !crate::structured::uuid_v7(&response.workspace_id) || !crate::structured::uuid_v7(&response.epoch){return Err(CredentialError)}
        Ok(WorkspaceAdmission {instance:self.instance,generation,context:crate::WorkspaceContext{issuer,subject_id,workspace_id:response.workspace_id,client_id:response.client_id,stream_epoch:response.epoch}})
    }
    /// Send native-prepared bytes only under the original admission. Never
    /// reuse a newly authenticated account's token for an old workspace frame.
    pub(crate) async fn page_send(&self,admission:&WorkspaceAdmission,page:&str,kind:&str,wire:&str)->Result<serde_json::Value> {
        let mut state=self.state.lock().await;
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        let active=state.active.as_ref().ok_or(CredentialError)?;
        if admission.instance!=self.instance || admission.generation!=state.generation || admission.context.issuer!=active.identity.issuer || admission.context.subject_id!=active.identity.subject {return Err(CredentialError)}
        let generation=state.generation;let access=AccessSecret::new(active.access.expose().to_vec())?;drop(state);
        let result=self.bounded(generation,self.provider.page_send(&access,admission.context(),page,kind,wire)).await;
        let mut state=self.state.lock().await;
        if state.generation!=generation{return Err(CredentialError)}
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        result
    }
    pub(crate) async fn title_send(&self,admission:&WorkspaceAdmission,page:&str,kind:&str,wire:&str)->Result<serde_json::Value> {
        let mut state=self.state.lock().await;
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        let active=state.active.as_ref().ok_or(CredentialError)?;
        if admission.instance!=self.instance || admission.generation!=state.generation || admission.context.issuer!=active.identity.issuer || admission.context.subject_id!=active.identity.subject {return Err(CredentialError)}
        let generation=state.generation;let access=AccessSecret::new(active.access.expose().to_vec())?;drop(state);
        let result=self.bounded(generation,self.provider.title_send(&access,admission.context(),page,kind,wire)).await;
        let mut state=self.state.lock().await;
        if state.generation!=generation{return Err(CredentialError)}
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        result
    }
    /// Native-owned read request, bound to the original admission.
    pub(crate) async fn page_read(&self,admission:&WorkspaceAdmission,page:&str)->Result<serde_json::Value> {
        let mut state=self.state.lock().await;
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        let active=state.active.as_ref().ok_or(CredentialError)?;
        if admission.instance!=self.instance || admission.generation!=state.generation || admission.context.issuer!=active.identity.issuer || admission.context.subject_id!=active.identity.subject {return Err(CredentialError)}
        let generation=state.generation;let access=AccessSecret::new(active.access.expose().to_vec())?;drop(state);
        let result=self.bounded(generation,self.provider.page_read(&access,admission.context(),page)).await;
        let mut state=self.state.lock().await;
        if state.generation!=generation{return Err(CredentialError)}
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        result
    }
    pub(crate) async fn title_read(&self,admission:&WorkspaceAdmission,page:&str)->Result<serde_json::Value> {
        let mut state=self.state.lock().await;
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        let active=state.active.as_ref().ok_or(CredentialError)?;
        if admission.instance!=self.instance || admission.generation!=state.generation || admission.context.issuer!=active.identity.issuer || admission.context.subject_id!=active.identity.subject {return Err(CredentialError)}
        let generation=state.generation;let access=AccessSecret::new(active.access.expose().to_vec())?;drop(state);
        let result=self.bounded(generation,self.provider.title_read(&access,admission.context(),page)).await;
        let mut state=self.state.lock().await;
        if state.generation!=generation{return Err(CredentialError)}
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        result
    }
    pub(crate) async fn structured_send(&self,admission:&WorkspaceAdmission,wire:&str)->Result<serde_json::Value> {
        let mut state=self.state.lock().await;
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        let active=state.active.as_ref().ok_or(CredentialError)?;
        if admission.instance!=self.instance || admission.generation!=state.generation || admission.context.issuer!=active.identity.issuer || admission.context.subject_id!=active.identity.subject {return Err(CredentialError)}
        let generation=state.generation;let access=AccessSecret::new(active.access.expose().to_vec())?;drop(state);
        let result=self.bounded(generation,self.provider.structured_send(&access,admission.context(),wire)).await;
        let mut state=self.state.lock().await;
        if state.generation!=generation{return Err(CredentialError)}
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        result
    }
    pub(crate) async fn structured_pull(&self,admission:&WorkspaceAdmission,request:&serde_json::Value)->Result<serde_json::Value> {
        let mut state=self.state.lock().await;
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        let active=state.active.as_ref().ok_or(CredentialError)?;
        if admission.instance!=self.instance || admission.generation!=state.generation || admission.context.issuer!=active.identity.issuer || admission.context.subject_id!=active.identity.subject {return Err(CredentialError)}
        let generation=state.generation;let access=AccessSecret::new(active.access.expose().to_vec())?;drop(state);
        let result=self.bounded(generation,self.provider.structured_pull(&access,admission.context(),request)).await;
        let mut state=self.state.lock().await;
        if state.generation!=generation{return Err(CredentialError)}
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        result
    }
    pub(crate) async fn page_catalog(&self,admission:&WorkspaceAdmission,cursor:Option<&str>)->Result<serde_json::Value> {
        let mut state=self.state.lock().await;
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        let active=state.active.as_ref().ok_or(CredentialError)?;
        if admission.instance!=self.instance || admission.generation!=state.generation || admission.context.issuer!=active.identity.issuer || admission.context.subject_id!=active.identity.subject {return Err(CredentialError)}
        let generation=state.generation;let access=AccessSecret::new(active.access.expose().to_vec())?;drop(state);
        let result=self.bounded(generation,self.provider.page_catalog(&access,admission.context(),cursor)).await;
        let mut state=self.state.lock().await;
        if state.generation!=generation{return Err(CredentialError)}
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        result
    }
    pub(crate) async fn offline_grant(&self,admission:&WorkspaceAdmission,nonce:&str)->Result<String> {
        let mut state=self.state.lock().await;
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        let active=state.active.as_ref().ok_or(CredentialError)?;
        if admission.instance!=self.instance || admission.generation!=state.generation || admission.context.issuer!=active.identity.issuer || admission.context.subject_id!=active.identity.subject {return Err(CredentialError)}
        let generation=state.generation;let access=AccessSecret::new(active.access.expose().to_vec())?;drop(state);
        let result=self.bounded(generation,self.provider.offline_grant(&access,admission.context(),nonce)).await;
        let mut state=self.state.lock().await;if state.generation!=generation{return Err(CredentialError)}
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}result
    }
    /// Trusted local SQLite work only, under the session gate through commit.
    /// A commit already admitted can finish before logout; late success after
    /// expiry is withheld without deleting durable pending data.
    pub async fn local<T>(&self,admission:Option<&WorkspaceAdmission>,work:impl for<'a> FnOnce(&'a VerifiedIdentity)->ProviderFuture<'a,T>)->Result<T> {
        let mut state=self.state.lock().await;
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        let identity=&state.active.as_ref().ok_or(CredentialError)?.identity;
        if admission.is_some_and(|a|a.instance!=self.instance || a.generation!=state.generation || a.context.issuer!=identity.issuer || a.context.subject_id!=identity.subject){return Err(CredentialError)}
        let result=work(identity).await;
        if self.admit(&mut state).await.is_err(){let _=self.advance(&mut state,Phase::Locked);self.lock_owned(&state).await;return Err(CredentialError)}
        result
    }
    /// Local lock precedes remote revocation. An unknown durable commit or
    /// remote result is reported separately; neither reopens the session.
    pub async fn logout_with_revoke(&self)->SessionLogout {
        let mut state=self.state.lock().await;
        let access=state.active.take().map(|a|a.access);
        let generation=match self.advance(&mut state,Phase::Locked) {Ok(g)=>g,Err(_)=>return SessionLogout {local_locked:true,persistent_locked:false,cleanup_pending:None,provider_confirmed:false}};
        let persistent=self.vault.logout().await;
        drop(state);
        let confirmed=if let Some(access)=access {self.bounded(generation,self.provider.revoke(&access)).await.is_ok()}else{false};
        SessionLogout {local_locked:true,persistent_locked:persistent.is_ok(),cleanup_pending:persistent.ok().map(|r|r.cleanup_pending),provider_confirmed:confirmed}
    }
    pub async fn close(self) { self.vault.close().await; }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashMap, path::PathBuf, sync::{Arc, Mutex as StdMutex, atomic::{AtomicU64, AtomicUsize, Ordering}}};
    use tokio::sync::Notify;
    #[derive(Default)]
    struct OsState { values:HashMap<String,Vec<u8>>, unknown_write:bool, fail_delete:bool, expire_on_write:Option<Clock> }
    #[derive(Clone,Default)]
    struct Os(Arc<StdMutex<OsState>>);
    impl CredentialStore for Os {
        fn read(&self,t:&str)->Result<Option<Secret>> { self.0.lock().unwrap().values.get(t).map(|v|Secret::new(v.clone())).transpose() }
        fn write(&self,t:&str,s:&Secret)->Result<()> { let mut os=self.0.lock().unwrap();os.values.insert(t.into(),s.expose().to_vec());if let Some(clock)=&os.expire_on_write {clock.0.store(200,Ordering::SeqCst);}if os.unknown_write {Err(CredentialError)} else {Ok(())} }
        fn delete(&self,t:&str)->Result<()> { let mut os=self.0.lock().unwrap();if os.fail_delete {return Err(CredentialError)}os.values.remove(t);Ok(()) }
    }
    #[derive(Clone)]
    struct Clock(Arc<AtomicU64>);
    impl NativeClock for Clock { fn now(&self)->Result<u64> {Ok(self.0.load(Ordering::SeqCst))} }
    struct ProviderState { subject:String, issuer:String, expires:u64, fail_refresh:bool, hold:bool, hold_verify:bool, verified_subject:Option<String> }
    struct ProviderInner { state:StdMutex<ProviderState>, entered:Notify, release:Notify, calls:AtomicUsize }
    #[derive(Clone)]
    struct Provider(Arc<ProviderInner>);
    impl Provider {
        fn new()->Self {Self(Arc::new(ProviderInner {state:StdMutex::new(ProviderState {subject:"synthetic-owner".into(),issuer:"https://trusted.invalid/auth/v1".into(),expires:200,fail_refresh:false,hold:false,hold_verify:false,verified_subject:None}),entered:Notify::new(),release:Notify::new(),calls:AtomicUsize::new(0)}))}
        async fn pair(&self, refresh:bool)->Result<TokenPair> {
            let count=self.0.calls.fetch_add(1,Ordering::SeqCst)+1;
            let hold=self.0.state.lock().unwrap().hold;
            self.0.entered.notify_one();
            if hold {self.0.release.notified().await;}
            let s=self.0.state.lock().unwrap();
            if refresh && s.fail_refresh {return Err(CredentialError)}
            Ok(TokenPair {access:AccessSecret::new(b"synthetic-access-only-memory".to_vec())?,refresh:Secret::new(format!("synthetic-rotating-{count}").into_bytes())?,subject:s.subject.clone()})
        }
    }
    impl NativeProvider for Provider {
        fn password<'a>(&'a self,_:&'a str,_:&'a [u8])->ProviderFuture<'a,TokenPair> {Box::pin(self.pair(false))}
        fn refresh<'a>(&'a self,_:&'a Secret)->ProviderFuture<'a,TokenPair> {Box::pin(self.pair(true))}
        fn verify<'a>(&'a self,_:&'a AccessSecret)->ProviderFuture<'a,VerifiedIdentity> {Box::pin(async {let hold=self.0.state.lock().unwrap().hold_verify;if hold {self.0.entered.notify_one();self.0.release.notified().await;}let s=self.0.state.lock().unwrap();Ok(VerifiedIdentity {issuer:s.issuer.clone(),subject:s.verified_subject.clone().unwrap_or_else(||s.subject.clone()),expires_at:s.expires})})}
    }
    type Session=NativeSession<Os,Provider,Clock>;
    async fn fixture()->(Arc<Session>,Os,Provider,Clock,PathBuf) {
        let mut bytes=[0u8;16];getrandom::getrandom(&mut bytes).unwrap();
        let path=std::env::temp_dir().join(format!("greiva-session-{:x}.sqlite",u128::from_le_bytes(bytes)));
        let os=Os::default();let provider=Provider::new();let clock=Clock(Arc::new(AtomicU64::new(100)));
        let vault=CredentialVault::open(&path,"synthetic-session-deployment",os.clone()).await.unwrap();
        (Arc::new(Session::new(vault,provider.clone(),clock.clone(),"https://trusted.invalid/auth/v1".into()).unwrap()),os,provider,clock,path)
    }
    async fn login(s:&Session) {assert_eq!(s.login("synthetic@example.invalid",b"synthetic-password".to_vec()).await.unwrap().phase,Phase::Verified);}
    async fn dispose(s:Arc<Session>,path:PathBuf) { match Arc::try_unwrap(s) {Ok(s)=>s.close().await,Err(_)=>panic!("session still shared")};for suffix in ["","-wal","-shm"] {let _=std::fs::remove_file(format!("{}{suffix}",path.display()));} }
    #[tokio::test]
    async fn native_session_rotation_restart_and_secret_absence() {
        let (s,os,p,c,path)=fixture().await;login(&s).await;
        assert_eq!(s.authorized(|access|Box::pin(async move {assert_eq!(access.expose(),b"synthetic-access-only-memory");Ok(7)})).await.unwrap(),7);
        for suffix in ["","-wal","-shm"] {let bytes=std::fs::read(format!("{}{suffix}",path.display())).unwrap_or_default();
        for private in ["synthetic@example.invalid","synthetic-password","synthetic-owner","synthetic-access-only-memory","synthetic-rotating"] {assert!(!bytes.windows(private.len()).any(|w|w==private.as_bytes()));}}
        Arc::try_unwrap(s).ok().unwrap().close().await;
        let vault=CredentialVault::open(&path,"synthetic-session-deployment",os.clone()).await.unwrap();
        let s=Arc::new(Session::new(vault,p.clone(),c,"https://trusted.invalid/auth/v1".into()).unwrap());
        assert_eq!(s.snapshot().await.phase,Phase::Locked);
        assert_eq!(s.restore().await.unwrap().phase,Phase::Verified);
        assert_eq!(p.0.calls.load(Ordering::SeqCst),2);
        assert_eq!(os.0.lock().unwrap().values.len(),1);
        assert!(os.0.lock().unwrap().values.values().any(|v|v==b"synthetic-rotating-2"));
        assert!(s.logout().await.unwrap().locked);assert!(os.0.lock().unwrap().values.is_empty());
        assert!(s.restore().await.is_err());dispose(s,path).await;
    }
    #[tokio::test]
    async fn native_session_rejects_foreign_issuer_owner_expiry_and_rollback() {
        for case in 0..4 {
            let (s,_,p,c,path)=fixture().await;login(&s).await;
            match case {0=>p.0.state.lock().unwrap().issuer="https://foreign.invalid/auth/v1".into(),1=>p.0.state.lock().unwrap().subject="other-owner".into(),2=>p.0.state.lock().unwrap().expires=100,_=>c.0.store(99,Ordering::SeqCst)};
            assert!(s.restore().await.is_err());assert_eq!(s.snapshot().await.phase,Phase::Locked);
            let count=p.0.calls.load(Ordering::SeqCst);assert!(s.restore().await.is_err());assert_eq!(p.0.calls.load(Ordering::SeqCst),count);
            dispose(s,path).await;
        }
    }
    #[tokio::test]
    async fn native_session_unknown_os_write_and_refresh_failure_never_retry() {
        for write in [false,true] {
            let (s,os,p,_,path)=fixture().await;login(&s).await;
            if write {os.0.lock().unwrap().unknown_write=true;}else {p.0.state.lock().unwrap().fail_refresh=true;}
            assert!(s.restore().await.is_err());assert_eq!(s.snapshot().await.phase,Phase::Locked);
            let count=p.0.calls.load(Ordering::SeqCst);assert!(s.restore().await.is_err());assert_eq!(p.0.calls.load(Ordering::SeqCst),count);
            os.0.lock().unwrap().unknown_write=false;login(&s).await;dispose(s,path).await;
        }
    }
    #[tokio::test]
    async fn native_session_logout_cancels_pending_login_and_refresh() {
        for refresh in [false,true] {
            let (s,_,p,_,path)=fixture().await;if refresh {login(&s).await;p.0.entered.notified().await;}
            p.0.state.lock().unwrap().hold=true;
            let copy=s.clone();let task=tokio::spawn(async move {if refresh {copy.restore().await}else {copy.login("synthetic@example.invalid",b"password".to_vec()).await}});
            p.0.entered.notified().await;
            assert!(s.login("synthetic@example.invalid",b"password".to_vec()).await.is_err());
            s.logout().await.unwrap();assert!(task.await.unwrap().is_err());
            p.0.release.notify_one();assert_eq!(s.snapshot().await.phase,Phase::Locked);assert!(s.restore().await.is_err());dispose(s,path).await;
        }
    }
    #[tokio::test]
    async fn native_session_expiry_during_request_discards_result() {
        let (s,_,_,clock,path)=fixture().await;login(&s).await;
        assert!(s.authorized(|_|Box::pin(async move {clock.0.store(200,Ordering::SeqCst);Ok("must not deliver")})).await.is_err());
        assert_eq!(s.snapshot().await.phase,Phase::Locked);assert!(s.restore().await.is_err());dispose(s,path).await;
    }
    #[tokio::test]
    async fn native_session_cross_process_logout_and_cleanup_failure() {
        let (s,os,_,_,path)=fixture().await;login(&s).await;
        let other=CredentialVault::open(&path,"synthetic-session-deployment",os.clone()).await.unwrap();
        os.0.lock().unwrap().fail_delete=true;let result=other.logout().await.unwrap();assert!(result.locked && result.cleanup_pending);
        assert!(s.authorized(|_|Box::pin(async {Ok(1)})).await.is_err());assert_eq!(s.snapshot().await.phase,Phase::Locked);
        os.0.lock().unwrap().fail_delete=false;other.cleanup().await.unwrap();other.close().await;dispose(s,path).await;
    }
    #[tokio::test]
    async fn native_session_timeout_locks_consumed_refresh() {
        let (s,_,p,_,path)=fixture().await;login(&s).await;p.0.state.lock().unwrap().hold=true;
        assert!(s.restore().await.is_err());let count=p.0.calls.load(Ordering::SeqCst);
        assert!(s.restore().await.is_err());assert_eq!(p.0.calls.load(Ordering::SeqCst),count);assert_eq!(s.snapshot().await.phase,Phase::Locked);dispose(s,path).await;
    }
    #[tokio::test]
    async fn native_session_verification_mismatch_and_expiry_after_os_commit_lock() {
        for expiry in [false,true] {
            let (s,os,p,c,path)=fixture().await;
            if expiry {os.0.lock().unwrap().expire_on_write=Some(c);}else {p.0.state.lock().unwrap().verified_subject=Some("mismatched-proof".into());}
            assert!(s.login("synthetic@example.invalid",b"password".to_vec()).await.is_err());
            assert_eq!(s.snapshot().await.phase,Phase::Locked);assert!(s.restore().await.is_err());dispose(s,path).await;
        }
    }
    #[tokio::test]
    async fn native_session_clock_rollback_while_verifying_and_logout_drop_proof() {
        for logout in [false,true] {
            let (s,_,p,c,path)=fixture().await;p.0.state.lock().unwrap().hold_verify=true;
            let copy=s.clone();let task=tokio::spawn(async move {copy.login("synthetic@example.invalid",b"password".to_vec()).await});
            // First notification is password exchange; then wait for verify.
            p.0.entered.notified().await;
            if logout {s.logout().await.unwrap();}else {c.0.store(99,Ordering::SeqCst);p.0.release.notify_one();}
            assert!(task.await.unwrap().is_err());assert_eq!(s.snapshot().await.phase,Phase::Locked);assert!(s.restore().await.is_err());dispose(s,path).await;
        }
    }
    #[tokio::test]
    async fn native_session_logout_cancels_authorized_delivery() {
        let (s,_,_,_,path)=fixture().await;login(&s).await;
        let entered=Arc::new(Notify::new());let started=entered.clone();let copy=s.clone();
        let task=tokio::spawn(async move {copy.authorized(|_|Box::pin(async move {started.notify_one();std::future::pending::<Result<()>>().await})).await});
        entered.notified().await;s.logout().await.unwrap();assert!(task.await.unwrap().is_err());assert_eq!(s.snapshot().await.phase,Phase::Locked);dispose(s,path).await;
    }
    #[tokio::test]
    async fn native_session_same_owner_new_generation_rejects_old_access() {
        let (s,os,_,_,path)=fixture().await;login(&s).await;
        let other=CredentialVault::open(&path,"synthetic-session-deployment",os).await.unwrap();
        let ticket=other.begin_login().await.unwrap();other.complete(ticket,"synthetic-owner",Secret::new(b"other-instance-refresh".to_vec()).unwrap()).await.unwrap();
        assert!(s.authorized(|_|Box::pin(async {Ok(1)})).await.is_err());assert_eq!(s.snapshot().await.phase,Phase::Locked);
        assert_eq!(other.begin_restore().await.unwrap().secret.expose(),b"other-instance-refresh");
        other.close().await;dispose(s,path).await;
    }
    #[tokio::test]
    async fn native_session_stale_login_failure_preserves_new_instance_marker() {
        let (s,os,p,_,path)=fixture().await;p.0.state.lock().unwrap().hold=true;
        let copy=s.clone();let task=tokio::spawn(async move {copy.login("synthetic@example.invalid",b"password".to_vec()).await});
        p.0.entered.notified().await;
        let other=CredentialVault::open(&path,"synthetic-session-deployment",os).await.unwrap();
        let ticket=other.begin_login().await.unwrap();other.complete(ticket,"synthetic-owner",Secret::new(b"new-instance-refresh".to_vec()).unwrap()).await.unwrap();
        p.0.release.notify_one();assert!(task.await.unwrap().is_err());assert_eq!(s.snapshot().await.phase,Phase::Locked);
        assert_eq!(other.begin_restore().await.unwrap().secret.expose(),b"new-instance-refresh");other.close().await;dispose(s,path).await;
    }
}
