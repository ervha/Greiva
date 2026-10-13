//! No credential/configuration IPC. Deployment config is compiled by build.rs.
use std::path::PathBuf;
use serde_json::{json,Value};
use greiva_page_store::native_session::{SessionSnapshot,Phase};
include!(concat!(env!("OUT_DIR"),"/native-auth-config.rs"));
const REJECTED:&str="Native authentication rejected or unavailable";
type Result<T>=std::result::Result<T,String>;
pub(crate) fn enabled()->bool {CONFIG.is_some()}
fn snapshot(value:SessionSnapshot)->Value {json!({"available":true,"phase":match value.phase {Phase::Locked=>"locked",Phase::Authenticating=>"authenticating",Phase::Refreshing=>"refreshing",Phase::Verified=>"verified"},"expiresAt":value.expires_at})}
#[cfg(windows)]
type Gate=greiva_page_store::native_workspace_gate::NativeWorkspaceGate<greiva_page_store::native_credentials::WindowsCredentialStore,greiva_page_store::native_http_provider::NativeHttpProvider,greiva_page_store::offline_lease::SystemClock>;
pub(crate) struct Runtime {
    #[cfg(windows)]root:PathBuf,
    #[cfg(windows)]app_id:String,
    #[cfg(windows)]gate:tokio::sync::OnceCell<Gate>,
}
impl Runtime {
    pub(crate) fn new(root:PathBuf,app_id:String)->Self {
        #[cfg(not(windows))]let _=(root,app_id);
        Self {#[cfg(windows)]root,#[cfg(windows)]app_id,#[cfg(windows)]gate:tokio::sync::OnceCell::new()}
    }
    #[cfg(windows)]
    async fn get(&self)->Result<&Gate>{
        self.gate.get_or_try_init(||async {
            use greiva_page_store::{native_credentials::{CredentialVault,WindowsCredentialStore},native_http_provider::NativeHttpProvider,native_session::NativeSession,offline_lease::SystemClock,native_workspace_gate::NativeWorkspaceGate};
            let (project,api,key)=CONFIG.ok_or_else(||REJECTED.to_string())?;
            let provider=NativeHttpProvider::new(project,api,key).map_err(|_|REJECTED)?;
            let issuer=provider.issuer().to_string();
            // The app ID comes from native configuration in the constructor.
            let scope=provider.deployment_scope(&self.app_id).map_err(|_|REJECTED)?;
            let vault=CredentialVault::open(&self.root.join("native-session.sqlite"),&scope,WindowsCredentialStore).await.map_err(|_|REJECTED)?;
            let session=NativeSession::new(vault,provider,SystemClock::new().map_err(|_|REJECTED)?,issuer).map_err(|_|REJECTED)?;
            Ok(NativeWorkspaceGate::new(session,self.root.join("private-workspaces")))
        }).await
    }
}
#[tauri::command]
pub(crate) async fn native_auth_status(state:tauri::State<'_,Runtime>)->Result<Value>{
    if !enabled(){return Ok(json!({"available":false,"phase":"unavailable","expiresAt":null}))}
    #[cfg(windows)]{Ok(snapshot(state.get().await?.snapshot().await))}
    #[cfg(not(windows))]{let _=state;Err(REJECTED.into())}
}
#[tauri::command]
pub(crate) async fn native_auth_login(email:String,password:String,state:tauri::State<'_,Runtime>)->Result<Value>{
    let mut password=zeroize::Zeroizing::new(password.into_bytes());
    #[cfg(windows)]{Ok(snapshot(state.get().await?.login(&email,std::mem::take(&mut *password)).await.map_err(|_|REJECTED)?))}
    #[cfg(not(windows))]{let _=(email,password,state);Err(REJECTED.into())}
}
#[tauri::command]
pub(crate) async fn native_auth_restore(state:tauri::State<'_,Runtime>)->Result<Value>{
    #[cfg(windows)]{Ok(snapshot(state.get().await?.restore().await.map_err(|_|REJECTED)?))}
    #[cfg(not(windows))]{let _=state;Err(REJECTED.into())}
}
#[tauri::command]
pub(crate) async fn native_auth_logout(state:tauri::State<'_,Runtime>)->Result<Value>{
    #[cfg(windows)]{let result=state.get().await?.logout().await;Ok(json!({"localLocked":result.local_locked,"persistentLocked":result.persistent_locked,"cleanupPending":result.cleanup_pending,"providerConfirmed":result.provider_confirmed}))}
    #[cfg(not(windows))]{let _=state;Err(REJECTED.into())}
}
#[tauri::command]
pub(crate) async fn native_workspace_open(candidate:String,state:tauri::State<'_,Runtime>)->Result<Value>{
    #[cfg(windows)]{serde_json::to_value(state.get().await?.open(&candidate).await.map_err(|_|REJECTED)?).map_err(|_|REJECTED.into())}
    #[cfg(not(windows))]{let _=(candidate,state);Err(REJECTED.into())}
}
#[tauri::command]
pub(crate) async fn native_workspace_execute(handle:String,request:Value,state:tauri::State<'_,Runtime>)->Result<Value>{
    #[cfg(windows)]{state.get().await?.execute(&handle,request).await.map_err(|_|REJECTED.into())}
    #[cfg(not(windows))]{let _=(handle,request,state);Err(REJECTED.into())}
}
#[tauri::command]
pub(crate) async fn native_workspace_close(handle:String,state:tauri::State<'_,Runtime>)->Result<()>{
    #[cfg(windows)]{state.get().await?.close(&handle).await.map_err(|_|REJECTED.into())}
    #[cfg(not(windows))]{let _=(handle,state);Err(REJECTED.into())}
}
#[tauri::command]
pub(crate) async fn native_workspace_cancel(state:tauri::State<'_,Runtime>)->Result<()>{
    #[cfg(windows)]{state.get().await?.cancel_open().await;Ok(())}
    #[cfg(not(windows))]{let _=state;Err(REJECTED.into())}
}
