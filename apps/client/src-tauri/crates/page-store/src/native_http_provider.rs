//! Fixed native deployment HTTP provider. No UI-supplied origin or token proof.
use crate::{native_credentials::{CredentialError, Secret}, native_session::{AccessSecret, NativeProvider, ProviderFuture, TokenPair, VerifiedIdentity,WorkspaceRegistration}};
use reqwest::{Client, Method, header::{HeaderValue, AUTHORIZATION, CONTENT_TYPE, CACHE_CONTROL}};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use url::Url;
use zeroize::Zeroizing;
type Result<T> = std::result::Result<T, CredentialError>;
const MAX_RESPONSE:usize=65536;
pub struct NativeHttpProvider { client:Client, issuer:String, api:String, key:HeaderValue }
fn origin(raw:&str, provider:bool)->Result<String> {
    let url=Url::parse(raw).map_err(|_|CredentialError)?;
    let loopback=matches!(url.host_str(),Some("127.0.0.1"|"localhost"|"[::1]"));
    if raw!=url.origin().ascii_serialization() || !url.username().is_empty() || url.password().is_some()
        || !(url.scheme()=="https" || !provider && url.scheme()=="http" && loopback) {return Err(CredentialError)}
    Ok(raw.into())
}
fn identifier(raw:&str)->Result<()> {
    if raw.trim().is_empty() || raw.len()>512 || raw.chars().any(char::is_control) {Err(CredentialError)}else{Ok(())}
}
fn bearer(access:&AccessSecret)->Result<HeaderValue> {
    let mut value=Zeroizing::new(Vec::with_capacity(access.expose().len()+7));value.extend_from_slice(b"Bearer ");value.extend_from_slice(access.expose());
    let mut header=HeaderValue::from_bytes(&value).map_err(|_|CredentialError)?;header.set_sensitive(true);Ok(header)
}
impl NativeHttpProvider {
    pub fn new(project:&str, api:&str, key:&str)->Result<Self> {
        let project=origin(project,true)?;let api=origin(api,false)?;
        if !key.starts_with("sb_publishable_") || key.len()<=15 || key.len()>1024 || !key.bytes().all(|b|b.is_ascii_alphanumeric() || b==b'_' || b==b'-') {return Err(CredentialError)}
        let client=Client::builder().redirect(reqwest::redirect::Policy::none()).retry(reqwest::retry::never())
            .no_proxy().referer(false).timeout(Duration::from_secs(15)).connect_timeout(Duration::from_secs(5))
            .build().map_err(|_|CredentialError)?;
        Ok(Self {client,issuer:format!("{project}/auth/v1"),api,key:HeaderValue::from_str(key).map_err(|_|CredentialError)?})
    }
    pub fn issuer(&self)->&str {&self.issuer}
    /// Trust-scope input for CredentialVault; never supplied by WebView.
    pub fn deployment_scope(&self,app_id:&str)->Result<String> {
        if app_id.is_empty() || app_id.len()>256 || !app_id.bytes().all(|b|b.is_ascii_alphanumeric() || b==b'.' || b==b'-') {return Err(CredentialError)}
        Ok(format!("{app_id}\n{}\n{}",self.issuer,self.api))
    }
    async fn call(&self,method:Method,url:String,access:Option<&AccessSecret>,body:Option<Zeroizing<Vec<u8>>>,provider:bool)->Result<Zeroizing<Vec<u8>>> {
        self.call_limited(method,url,access,body,provider,MAX_RESPONSE).await
    }
    async fn call_limited(&self,method:Method,url:String,access:Option<&AccessSecret>,body:Option<Zeroizing<Vec<u8>>>,provider:bool,max_response:usize)->Result<Zeroizing<Vec<u8>>> {
        let mut request=self.client.request(method,url).header(CACHE_CONTROL,"no-store").header("accept","application/json");
        if provider {request=request.header("apikey",self.key.clone());}
        if let Some(access)=access {request=request.header(AUTHORIZATION,bearer(access)?);}
        if let Some(body)=body {request=request.header(CONTENT_TYPE,"application/json").body(body.to_vec());}
        let mut response=request.send().await.map_err(|_|CredentialError)?;
        if !response.status().is_success() || response.content_length().is_some_and(|n|n>max_response as u64) {return Err(CredentialError)}
        let content=response.headers().get(CONTENT_TYPE).and_then(|h|h.to_str().ok()).ok_or(CredentialError)?;
        if !content.split(';').next().is_some_and(|s|s.trim().eq_ignore_ascii_case("application/json")) {return Err(CredentialError)}
        let mut bytes=Zeroizing::new(Vec::new());
        while let Some(chunk)=response.chunk().await.map_err(|_|CredentialError)? {
            if chunk.len()>max_response-bytes.len(){return Err(CredentialError)}bytes.extend_from_slice(&chunk);
        }
        Ok(bytes)
    }
    async fn exchange<T:Serialize>(&self,grant:&str,body:&T)->Result<TokenPair> {
        let body=Zeroizing::new(serde_json::to_vec(body).map_err(|_|CredentialError)?);
        let bytes=self.call(Method::POST,format!("{}/token?grant_type={grant}",self.issuer),None,Some(body),true).await?;
        let value:TokenResponse<'_>=serde_json::from_slice(&bytes).map_err(|_|CredentialError)?;
        let parts:Vec<_>=value.access_token.split('.').collect();
        if value.token_type!="bearer" || parts.len()!=3 || parts.iter().any(|p|p.is_empty() || !p.bytes().all(|b|b.is_ascii_alphanumeric() || b==b'_' || b==b'-'))
            || value.refresh_token.is_empty() || value.refresh_token.chars().any(char::is_control) {return Err(CredentialError)}
        identifier(value.user.id)?;
        Ok(TokenPair {access:AccessSecret::new(value.access_token.as_bytes().to_vec())?,refresh:Secret::new(value.refresh_token.as_bytes().to_vec())?,subject:value.user.id.into()})
    }
    /// Adapter entry for local-first logout. A 2xx is provider confirmation;
    /// transport/status/redirect failure must remain unconfirmed in the UI.
    pub async fn revoke(&self,access:&AccessSecret)->Result<()> {
        let response=self.client.post(format!("{}/logout?scope=local",self.issuer)).header("apikey",self.key.clone())
            .header(AUTHORIZATION,bearer(access)?).header(CACHE_CONTROL,"no-store").header(CONTENT_TYPE,"application/json").body("{}").send().await.map_err(|_|CredentialError)?;
        if response.status().is_success(){Ok(())}else{Err(CredentialError)}
    }
}
#[derive(Deserialize)]
struct User<'a> { #[serde(borrow)] id:&'a str }
#[derive(Deserialize)]
struct TokenResponse<'a> {
    #[serde(borrow)] access_token:&'a str, #[serde(borrow)] refresh_token:&'a str,
    #[serde(borrow)] token_type:&'a str, #[serde(borrow)] user:User<'a>,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields,rename_all="camelCase")]
struct SessionResponse<'a> { #[serde(borrow)] issuer:&'a str, #[serde(borrow)] subject_id:&'a str, expires_at:u64 }
#[derive(Deserialize)]
#[serde(deny_unknown_fields,rename_all="camelCase")]
struct BootstrapResponse {protocol_version:u8,workspace_id:String,client_id:String,epoch:String}
impl NativeProvider for NativeHttpProvider {
    fn password<'a>(&'a self,email:&'a str,password:&'a [u8])->ProviderFuture<'a,TokenPair> {
        Box::pin(async move {
            #[derive(Serialize)]struct Body<'a>{email:&'a str,password:&'a str}
            if email.trim().is_empty() || email.len()>320 || email.chars().any(char::is_control) || password.is_empty() || password.len()>4096 {return Err(CredentialError)}
            self.exchange("password",&Body{email,password:std::str::from_utf8(password).map_err(|_|CredentialError)?}).await
        })
    }
    fn refresh<'a>(&'a self,refresh:&'a Secret)->ProviderFuture<'a,TokenPair> {
        Box::pin(async move {
            #[derive(Serialize)]struct Body<'a>{refresh_token:&'a str}
            let value=std::str::from_utf8(refresh.expose()).map_err(|_|CredentialError)?;
            if value.chars().any(char::is_control){return Err(CredentialError)}
            self.exchange("refresh_token",&Body{refresh_token:value}).await
        })
    }
    fn verify<'a>(&'a self,access:&'a AccessSecret)->ProviderFuture<'a,VerifiedIdentity> {
        Box::pin(async move {
            let bytes=self.call(Method::GET,format!("{}/v1/session",self.api),Some(access),None,false).await?;
            let value:SessionResponse<'_>=serde_json::from_slice(&bytes).map_err(|_|CredentialError)?;
            if value.issuer!=self.issuer || value.expires_at>9_007_199_254_740_991 || value.expires_at==0 {return Err(CredentialError)}
            identifier(value.subject_id)?;
            Ok(VerifiedIdentity {issuer:value.issuer.into(),subject:value.subject_id.into(),expires_at:value.expires_at})
        })
    }
    fn revoke<'a>(&'a self,access:&'a AccessSecret)->ProviderFuture<'a,()> {Box::pin(NativeHttpProvider::revoke(self,access))}
    fn bootstrap<'a>(&'a self,access:&'a AccessSecret,client:&'a str)->ProviderFuture<'a,WorkspaceRegistration> {
        Box::pin(async move {
            if !crate::structured::uuid_v7(client){return Err(CredentialError)}
            #[derive(Serialize)]#[serde(rename_all="camelCase")]struct Body<'a>{client_id:&'a str}
            let body=Zeroizing::new(serde_json::to_vec(&Body{client_id:client}).map_err(|_|CredentialError)?);
            let bytes=self.call(Method::POST,format!("{}/v1/workspaces/bootstrap",self.api),Some(access),Some(body),false).await?;
            let value:BootstrapResponse=serde_json::from_slice(&bytes).map_err(|_|CredentialError)?;
            if value.protocol_version!=1 || value.client_id!=client || !crate::structured::uuid_v7(&value.workspace_id) || !crate::structured::uuid_v7(&value.epoch){return Err(CredentialError)}
            Ok(WorkspaceRegistration{protocol_version:value.protocol_version,workspace_id:value.workspace_id,client_id:value.client_id,epoch:value.epoch})
        })
    }
    fn page_send<'a>(&'a self,access:&'a AccessSecret,context:&'a crate::WorkspaceContext,page:&'a str,kind:&'a str,wire:&'a str)->ProviderFuture<'a,serde_json::Value> {
        Box::pin(async move {
            // Includes JSON-escaped title plus a maximum-size binary frame.
            // Receipt vectors can grow beyond the 64 KiB auth response bound.
            if context.issuer!=self.issuer || !crate::structured::uuid_v7(&context.workspace_id) || !crate::structured::uuid_v7(page) || !matches!(kind,"bootstrap"|"append") || wire.is_empty() || wire.len()>2*1024*1024 {return Err(CredentialError)}
            let bytes=self.call_limited(Method::POST,format!("{}/v1/workspaces/{}/pages/{}/document/{kind}",self.api,context.workspace_id,page),Some(access),Some(Zeroizing::new(wire.as_bytes().to_vec())),false,8*1024*1024).await?;
            // Scope/digest/order/metadata validation is performed by the
            // original native SQLite ACK transaction, never by the WebView.
            serde_json::from_slice(&bytes).map_err(|_|CredentialError)
        })
    }
    fn page_read<'a>(&'a self,access:&'a AccessSecret,context:&'a crate::WorkspaceContext,page:&'a str)->ProviderFuture<'a,serde_json::Value> {
        Box::pin(async move {
            if context.issuer!=self.issuer || !crate::structured::uuid_v7(&context.workspace_id) || !crate::structured::uuid_v7(&context.client_id) || !crate::structured::uuid_v7(page){return Err(CredentialError)}
            // Rust does not derive a Yjs vector from the journal. An empty
            // vector requests the full state, avoiding caller-owned progress.
            let body=Zeroizing::new(serde_json::to_vec(&serde_json::json!({"protocolVersion":1,"clientId":context.client_id,"editorSchemaVersion":1,"stateVector":"AA"})).map_err(|_|CredentialError)?);
            let bytes=self.call_limited(Method::POST,format!("{}/v1/workspaces/{}/pages/{page}/document/read",self.api,context.workspace_id),Some(access),Some(body),false,8*1024*1024).await?;
            serde_json::from_slice(&bytes).map_err(|_|CredentialError)
        })
    }
    fn page_catalog<'a>(&'a self,access:&'a AccessSecret,context:&'a crate::WorkspaceContext,cursor:Option<&'a str>)->ProviderFuture<'a,serde_json::Value>{Box::pin(self.catalog(access,context,cursor))}

}

impl NativeHttpProvider {
    async fn catalog(&self,access:&AccessSecret,context:&crate::WorkspaceContext,cursor:Option<&str>)->Result<serde_json::Value>{
        if context.issuer!=self.issuer||!crate::structured::uuid_v7(&context.workspace_id)||!crate::structured::uuid_v7(&context.client_id)||cursor.is_some_and(|c|c.is_empty()||c.len()>8192||c.chars().any(char::is_control)){return Err(CredentialError)}
        let body=Zeroizing::new(serde_json::to_vec(&serde_json::json!({"protocolVersion":1,"clientId":context.client_id,"cursor":cursor,"limit":20})).map_err(|_|CredentialError)?);
        let bytes=self.call_limited(Method::POST,format!("{}/v1/workspaces/{}/pages/query",self.api,context.workspace_id),Some(access),Some(body),false,8*1024*1024).await?;
        serde_json::from_slice(&bytes).map_err(|_|CredentialError)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use crate::{native_credentials::{CredentialStore,CredentialVault},native_session::{NativeSession,Phase},offline_lease::SystemClock};
    use std::{collections::HashMap,sync::{Arc,Mutex}};
    use sha2::Digest;
    #[derive(Clone,Default)]struct Os(Arc<Mutex<HashMap<String,Vec<u8>>>>);
    impl CredentialStore for Os {
        fn read(&self,t:&str)->Result<Option<Secret>>{self.0.lock().unwrap().get(t).map(|b|Secret::new(b.clone())).transpose()}
        fn write(&self,t:&str,s:&Secret)->Result<()>{self.0.lock().unwrap().insert(t.into(),s.expose().to_vec());Ok(())}
        fn delete(&self,t:&str)->Result<()>{self.0.lock().unwrap().remove(t);Ok(())}
    }
    #[test]
    fn native_http_fixed_origins_and_public_key_are_strict() {
        for project in ["http://localhost:1234","https://host.invalid/","https://user@host.invalid","https://host.invalid/path","https://host.invalid#x","https://host.invalid?x"," https://host.invalid"] {assert!(NativeHttpProvider::new(project,"https://api.invalid","sb_publishable_fixture").is_err());}
        for api in ["http://remote.invalid","https://api.invalid/path","https://user:pass@api.invalid","https://api.invalid/"] {assert!(NativeHttpProvider::new("https://project.invalid",api,"sb_publishable_fixture").is_err());}
        for key in ["sb_secret_fixture","sb_publishable_","sb_publishable_fixture\r\nother:x"] {assert!(NativeHttpProvider::new("https://project.invalid","https://api.invalid",key).is_err());}
        let p=NativeHttpProvider::new("https://project.invalid","http://127.0.0.1:1443","sb_publishable_fixture").unwrap();
        assert_eq!(p.issuer(),"https://project.invalid/auth/v1");assert!(p.deployment_scope("app\nforged").is_err());
    }
    fn trusted_fixture(project:&str,api:&str,cert:&[u8])->NativeHttpProvider {
        let mut p=NativeHttpProvider::new(project,api,"sb_publishable_fixture").unwrap();
        // Only compiled in tests. Production never accepts a supplied CA/client.
        p.client=Client::builder().redirect(reqwest::redirect::Policy::none()).retry(reqwest::retry::never()).no_proxy().referer(false)
            .timeout(Duration::from_secs(15)).connect_timeout(Duration::from_secs(5))
            .add_root_certificate(reqwest::Certificate::from_pem(cert).unwrap()).build().unwrap();p
    }
    #[tokio::test]
    #[ignore="run scripts/test-native-http-provider.mjs for TLS/API fixture"]
    async fn native_http_actual_tls_signed_session_and_failure_boundaries() {
        let project=std::env::var("GREIVA_FIXTURE_PROJECT").unwrap();let api=std::env::var("GREIVA_FIXTURE_API").unwrap();
        let cert=std::fs::read(std::env::var("GREIVA_FIXTURE_CA").unwrap()).unwrap();
        // Untrusted self-signed certificate is rejected by the production ctor.
        let strict=NativeHttpProvider::new(&project,&api,"sb_publishable_fixture").unwrap();
        assert!(strict.password("tls-untrusted@example.invalid",b"fixture-password").await.is_err());
        for mode in ["normal","revoke-fail","expired","bad-signature","mismatch","foreign-issuer","bad-session","extra-session","redirect","wrong-type","oversize","duplicate","refresh-fail"] {
            let provider=trusted_fixture(&project,&api,&cert);let scope=provider.deployment_scope("dev.greiva.fixture").unwrap();let issuer=provider.issuer().to_string();
            let mut nonce=[0u8;16];getrandom::getrandom(&mut nonce).unwrap();let path=std::env::temp_dir().join(format!("greiva-http-{:x}.sqlite",u128::from_le_bytes(nonce)));
            let os=Os::default();let vault=CredentialVault::open(&path,&scope,os.clone()).await.unwrap();
            let session=NativeSession::new(vault,provider,SystemClock::new().unwrap(),issuer).unwrap();
            let result=session.login(&format!("{mode}@example.invalid"),b"fixture-password".to_vec()).await;
            if matches!(mode,"normal"|"revoke-fail"|"refresh-fail") {
                assert_eq!(result.unwrap().phase,Phase::Verified);
                if mode=="refresh-fail" {assert!(session.restore().await.is_err());assert!(session.restore().await.is_err());assert_eq!(session.snapshot().await.phase,Phase::Locked);}
                else {assert_eq!(session.restore().await.unwrap().phase,Phase::Verified);let closed=session.logout_with_revoke().await;assert!(closed.local_locked && closed.persistent_locked);assert_eq!(closed.provider_confirmed,mode=="normal");assert!(session.restore().await.is_err());}
            } else {assert!(result.is_err(),"fixture mode {mode} accepted");assert_eq!(session.snapshot().await.phase,Phase::Locked);assert!(session.restore().await.is_err());}
            session.close().await;for suffix in ["","-wal","-shm"] {let _=std::fs::remove_file(format!("{}{suffix}",path.display()));}
        }
    }
    #[tokio::test]
    #[ignore="run scripts/test-native-http-provider.mjs --workspace for TLS/API/PG fixture"]
    async fn native_http_actual_workspace_bootstrap_restart_pending_and_revoked_device() {
        use crate::native_workspace_gate::NativeWorkspaceGate;
        use serde_json::json;
        let project=std::env::var("GREIVA_FIXTURE_PROJECT").unwrap();let api=std::env::var("GREIVA_FIXTURE_API").unwrap();let cert=std::fs::read(std::env::var("GREIVA_FIXTURE_CA").unwrap()).unwrap();
        let mut nonce=[0u8;16];getrandom::getrandom(&mut nonce).unwrap();let root=std::env::temp_dir().join(format!("greiva-http-gate-{:x}",u128::from_le_bytes(nonce)));std::fs::create_dir(&root).unwrap();let os=Os::default();
        let make=||async {let p=trusted_fixture(&project,&api,&cert);let issuer=p.issuer().into();let scope=p.deployment_scope("dev.greiva.fixture").unwrap();let vault=CredentialVault::open(&root.join("session.sqlite"),&scope,os.clone()).await.unwrap();NativeWorkspaceGate::new(NativeSession::new(vault,p,SystemClock::new().unwrap(),issuer).unwrap(),root.join("workspaces"))};
        let client="01900000-0000-7000-8000-000000000052";let page="01900000-0000-7000-8000-000000000053";
        let gate=make().await;gate.login("workspace@example.invalid",b"fixture-password".to_vec()).await.unwrap();let first=gate.open(client).await.unwrap();
        gate.execute(&first.handle,json!({"command":"page_create","pageId":page,"title":"TLS authenticated pending","update":[0,0]})).await.unwrap();let request=json!({"command":"page_prepare","pageId":page});let wire=gate.execute(&first.handle,request.clone()).await.unwrap();assert!(!wire.is_null());gate.shutdown().await;
        let gate=make().await;gate.restore().await.unwrap();let next=gate.open(page).await.unwrap();assert_eq!(first.context,next.context);assert_eq!(gate.execute(&next.handle,request.clone()).await.unwrap(),wire);
        let result=gate.logout().await;assert!(result.local_locked && result.persistent_locked && result.provider_confirmed);assert!(gate.execute(&next.handle,request.clone()).await.is_err());
        gate.login("workspace-revoked@example.invalid",b"fixture-password".to_vec()).await.unwrap();assert!(gate.open(client).await.is_err());assert!(gate.execute(&next.handle,request).await.is_err());gate.shutdown().await;
        // The rejected bootstrap never mutates or removes already saved wires.
        let store=crate::WorkspaceStore::open(&root.join("workspaces").join(format!("{:x}.sqlite",sha2::Sha256::digest(serde_json::to_vec(&first.context).unwrap()))),first.context).await.unwrap();
        assert_eq!(store.page_prepare(page).await.unwrap(),wire);drop(store);std::fs::remove_dir_all(root).unwrap();
    }
    #[tokio::test]
    #[ignore="run scripts/test-native-http-provider.mjs --pages for native Page TLS/API/PG fixture"]
    async fn native_http_actual_page_send_unknown_receipt_retry_and_durable_ack() {
        let frames=std::env::var("GREIVA_FIXTURE_PAGE_FRAMES").expect("--pages fixture required");
        let frames:Vec<Vec<u8>>=serde_json::from_str(&frames).unwrap();assert_eq!(frames.len(),2);
        let project=std::env::var("GREIVA_FIXTURE_PROJECT").unwrap();let api=std::env::var("GREIVA_FIXTURE_API").unwrap();let cert=std::fs::read(std::env::var("GREIVA_FIXTURE_CA").unwrap()).unwrap();
        let root=std::env::temp_dir().join(format!("greiva-page-http-{}",std::process::id()));std::fs::create_dir(&root).unwrap();
        let provider=trusted_fixture(&project,&api,&cert);let issuer=provider.issuer().to_string();let vault=CredentialVault::open(&root.join("session.sqlite"),"page-http-fixture",Os::default()).await.unwrap();
        let gate=crate::native_workspace_gate::NativeWorkspaceGate::new(NativeSession::new(vault,provider,SystemClock::new().unwrap(),issuer).unwrap(),root.join("workspaces"));
        gate.login("page-sync@example.invalid",b"fixture-password".to_vec()).await.unwrap();let handle=gate.open("01900000-0000-7000-8000-000000000060").await.unwrap();let page="01900000-0000-7000-8000-000000000061";
        gate.execute(&handle.handle,serde_json::json!({"command":"page_create","pageId":page,"title":"synthetic HTTP Page","update":frames[0]})).await.unwrap();
        let request=serde_json::json!({"command":"page_prepare","pageId":page});let before=gate.execute(&handle.handle,request.clone()).await.unwrap();
        assert!(gate.send_page(&handle.handle,page).await.is_err());assert_eq!(gate.execute(&handle.handle,request.clone()).await.unwrap(),before);
        assert!(gate.send_page(&handle.handle,page).await.is_err());assert_eq!(gate.execute(&handle.handle,request.clone()).await.unwrap(),before);
        assert!(gate.send_page(&handle.handle,page).await.unwrap());
        gate.execute(&handle.handle,serde_json::json!({"command":"page_append","pageId":page,"update":frames[1]})).await.unwrap();assert!(gate.send_page(&handle.handle,page).await.unwrap());assert!(!gate.send_page(&handle.handle,page).await.unwrap());
        let local=gate.execute(&handle.handle,serde_json::json!({"command":"page_load","pageId":page})).await.unwrap();assert_eq!(local["pending"],0);assert_eq!(local["page"]["updates"],serde_json::json!(frames));gate.shutdown().await;
        let store=crate::WorkspaceStore::open(&root.join("workspaces").join(format!("{:x}.sqlite",sha2::Sha256::digest(serde_json::to_vec(&handle.context).unwrap()))),handle.context).await.unwrap();assert_eq!(store.page_prepare(page).await.unwrap(),serde_json::Value::Null);drop(store);std::fs::remove_dir_all(root).unwrap();
    }
    #[tokio::test]
    #[ignore="run scripts/test-native-http-provider.mjs --read for native read TLS/API/PG fixture"]
    async fn native_http_actual_page_read_adopts_remote_and_keeps_local_pending(){
        use crate::native_workspace_gate::{NativeWorkspaceGate,PageReadStatus};use serde_json::json;
        let project=std::env::var("GREIVA_FIXTURE_PROJECT").unwrap();let api=std::env::var("GREIVA_FIXTURE_API").unwrap();let cert=std::fs::read(std::env::var("GREIVA_FIXTURE_CA").unwrap()).unwrap();let frames:Vec<Vec<u8>>=serde_json::from_str(&std::env::var("GREIVA_FIXTURE_PAGE_FRAMES").unwrap()).unwrap();let local:Vec<u8>=serde_json::from_str(&std::env::var("GREIVA_FIXTURE_LOCAL_FRAME").unwrap()).unwrap();
        let mut nonce=[0u8;16];getrandom::getrandom(&mut nonce).unwrap();let root=std::env::temp_dir().join(format!("greiva-read-http-{:x}",u128::from_le_bytes(nonce)));std::fs::create_dir(&root).unwrap();
        let make=|name:&'static str|{let root=root.clone();let project=project.clone();let api=api.clone();let cert=cert.clone();async move{let provider=trusted_fixture(&project,&api,&cert);let issuer=provider.issuer().to_string();let vault=CredentialVault::open(&root.join(format!("{name}.sqlite")),"read-http-fixture",Os::default()).await.unwrap();NativeWorkspaceGate::new(NativeSession::new(vault,provider,SystemClock::new().unwrap(),issuer).unwrap(),root.join(name))}};
        let writer=make("writer").await;writer.login("read-writer@example.invalid",b"fixture-password".to_vec()).await.unwrap();let w=writer.open("01900000-0000-7000-8000-000000000070").await.unwrap();let page="01900000-0000-7000-8000-000000000071";
        writer.execute(&w.handle,json!({"command":"page_create","pageId":page,"title":"synthetic native read","update":frames[0]})).await.unwrap();assert!(writer.send_page(&w.handle,page).await.unwrap());writer.execute(&w.handle,json!({"command":"page_append","pageId":page,"update":frames[1]})).await.unwrap();assert!(writer.send_page(&w.handle,page).await.unwrap());
        let reader=make("reader").await;reader.login("read-reader@example.invalid",b"fixture-password".to_vec()).await.unwrap();let r=reader.open("01900000-0000-7000-8000-000000000072").await.unwrap();assert_eq!(r.context.workspace_id,w.context.workspace_id);assert_ne!(r.context.client_id,w.context.client_id);
        for _ in 0..3{assert_eq!(reader.read_page(&r.handle,page).await.unwrap(),PageReadStatus::ReadUnknown);assert_eq!(reader.execute(&r.handle,json!({"command":"page_exists","pageId":page})).await.unwrap(),false);}
        assert_eq!(reader.read_page(&r.handle,page).await.unwrap(),PageReadStatus::Received);reader.execute(&r.handle,json!({"command":"page_append","pageId":page,"update":local})).await.unwrap();let before=reader.execute(&r.handle,json!({"command":"page_prepare","pageId":page})).await.unwrap();assert_eq!(reader.read_page(&r.handle,page).await.unwrap(),PageReadStatus::Received);assert_eq!(reader.execute(&r.handle,json!({"command":"page_prepare","pageId":page})).await.unwrap(),before);
        let loaded=reader.execute(&r.handle,json!({"command":"page_load","pageId":page})).await.unwrap();assert_eq!(loaded["pending"],1);assert_eq!(loaded["page"]["updates"].as_array().unwrap().len(),2);std::fs::write(std::env::var("GREIVA_FIXTURE_READ_RESULT").unwrap(),serde_json::to_vec(&loaded["page"]["updates"]).unwrap()).unwrap();writer.shutdown().await;reader.shutdown().await;
        let store=crate::WorkspaceStore::open(&root.join("reader").join(format!("{:x}.sqlite",sha2::Sha256::digest(serde_json::to_vec(&r.context).unwrap()))),r.context).await.unwrap();assert_eq!(store.page_load(page).await.unwrap(),loaded);assert_eq!(store.page_prepare(page).await.unwrap(),before);drop(store);std::fs::remove_dir_all(root).unwrap();
    }
    #[tokio::test]
    #[ignore="run scripts/test-native-http-provider.mjs --catalog for native catalog TLS/API/PG fixture"]
    async fn native_http_actual_page_catalog_paginates_without_receiving_body(){
        use crate::native_workspace_gate::NativeWorkspaceGate;use serde_json::json;
        let project=std::env::var("GREIVA_FIXTURE_PROJECT").unwrap();let api=std::env::var("GREIVA_FIXTURE_API").unwrap();let cert=std::fs::read(std::env::var("GREIVA_FIXTURE_CA").unwrap()).unwrap();let root=std::env::temp_dir().join(format!("greiva-catalog-http-{}",std::process::id()));std::fs::create_dir(&root).unwrap();
        let provider=trusted_fixture(&project,&api,&cert);let issuer=provider.issuer().to_string();let vault=CredentialVault::open(&root.join("session.sqlite"),"catalog-http-fixture",Os::default()).await.unwrap();let gate=NativeWorkspaceGate::new(NativeSession::new(vault,provider,SystemClock::new().unwrap(),issuer).unwrap(),root.join("workspaces"));gate.login("catalog-reader@example.invalid",b"fixture-password".to_vec()).await.unwrap();let h=gate.open("01900000-0000-7000-8000-000000000080").await.unwrap();
        assert!(gate.catalog_pages(&h.handle,false).await.is_err());assert!(gate.catalog_pages(&h.handle,true).await.is_err());let first=gate.catalog_pages(&h.handle,false).await.unwrap();assert_eq!(first.pages.len(),20);assert!(first.has_more);assert!(gate.catalog_pages(&h.handle,true).await.is_err());let next=gate.catalog_pages(&h.handle,true).await.unwrap();assert!(!next.has_more);let ids:Vec<String>=first.pages.into_iter().chain(next.pages).map(|p|p.id).collect();assert!(ids.windows(2).all(|w|w[0]<w[1]));for i in 100..121{assert!(ids.contains(&format!("01900000-0000-7000-8000-{i:012}")));}let rows=gate.execute(&h.handle,json!({"command":"page_list","after":null,"limit":50})).await.unwrap();assert_eq!(rows["pages"],json!([]));gate.shutdown().await;std::fs::remove_dir_all(root).unwrap();
    }}
