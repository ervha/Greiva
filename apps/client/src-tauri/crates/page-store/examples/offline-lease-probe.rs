// Windows-only synthetic native verification. Fixed test signer never enters
// the application binary/config; secret/token values are never printed.
#[cfg(windows)]
#[tokio::main]
async fn main()->Result<(),Box<dyn std::error::Error>>{
    use greiva_page_store::{WorkspaceContext,native_credentials::WindowsCredentialStore,offline_grant::OfflineGrantVerifier,offline_lease::{OfflineLeaseStore,OfflineWorkspaceRegistry,SystemClock}};
    use ed25519_dalek::{Signer,SigningKey};use base64::{engine::general_purpose::URL_SAFE_NO_PAD,Engine};use serde_json::json;use sha2::{Digest,Sha256};use std::{path::PathBuf,time::{SystemTime,UNIX_EPOCH}};
    let args:Vec<_>=std::env::args().collect();if args.len()!=3{return Err("Synthetic root and phase required".into())}
    let root=PathBuf::from(&args[1]).canonicalize()?;if !root.file_name().and_then(|n|n.to_str()).is_some_and(|n|n.starts_with("greiva-offline-probe-")){return Err("Synthetic root required".into())}
    let scope=format!("synthetic-windows-offline-{:x}",Sha256::digest(root.to_string_lossy().as_bytes()));let key=SigningKey::from_bytes(&[42;32]);
    let context=WorkspaceContext{issuer:"https://auth.fixture.invalid".into(),subject_id:"synthetic-owner".into(),workspace_id:"01900000-0000-7000-8000-000000000001".into(),client_id:"01900000-0000-7000-8000-000000000002".into(),stream_epoch:"01900000-0000-7000-8000-000000000003".into()};
    let verifier=OfflineGrantVerifier::new("https://api.fixture.invalid".into(),"synthetic-native".into(),vec![("fixture".into(),key.verifying_key().to_bytes())])?;
    let lease=OfflineLeaseStore::open(&root.join("marker.sqlite"),&scope,WindowsCredentialStore,verifier,SystemClock::new()?).await?;let registry=OfflineWorkspaceRegistry::new(lease,root.join("workspaces"));let page="01900000-0000-7000-8000-000000000004";
    if args[2]=="install"{
        let challenge=registry.begin_online().await?;let now=SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();let input=format!("{}.{}",URL_SAFE_NO_PAD.encode(json!({"alg":"EdDSA","typ":"greiva-offline-v1+jwt","kid":"fixture"}).to_string()),URL_SAFE_NO_PAD.encode(json!({"iss":"https://api.fixture.invalid","aud":"synthetic-native","sub":context.subject_id,"authIssuer":context.issuer,"workspaceId":context.workspace_id,"clientId":context.client_id,"streamEpoch":context.stream_epoch,"iat":now,"exp":now+604800,"nonce":challenge.nonce()}).to_string()));let token=format!("{}.{}",input,URL_SAFE_NO_PAD.encode(key.sign(input.as_bytes()).to_bytes()));registry.accept_online(challenge,context.clone(),token).await?;
        let handle=registry.open(context).await?;registry.execute(&handle.handle,json!({"command":"page_create","pageId":page,"title":"synthetic offline pending","update":[0,0]})).await?;
        let pending=registry.execute(&handle.handle,json!({"command":"page_prepare","pageId":page})).await?;println!("{}",json!({"phase":"install","pendingSha256":format!("{:x}",Sha256::digest(pending.to_string().as_bytes()))}));registry.close(&handle.handle).await?;
    }else if args[2]=="resume"{
        let handle=registry.open(context).await?;let pending=registry.execute(&handle.handle,json!({"command":"page_prepare","pageId":page})).await?;let result=registry.logout().await?;assert!(!result.cleanup_pending);println!("{}",json!({"phase":"resume","pendingSha256":format!("{:x}",Sha256::digest(pending.to_string().as_bytes())),"locked":result.locked,"cleanupConfirmed":true}));
    }else if args[2]=="locked"{assert!(registry.open(context).await.is_err());println!("{{\"phase\":\"locked\",\"restartRemainsLocked\":true}}");}
    else if args[2]=="cleanup"{let result=registry.logout().await?;assert!(!result.cleanup_pending);}
    else{return Err("Unknown synthetic phase".into())}Ok(())
}
#[cfg(not(windows))]
fn main(){eprintln!("Windows native check required");std::process::exit(1);}
