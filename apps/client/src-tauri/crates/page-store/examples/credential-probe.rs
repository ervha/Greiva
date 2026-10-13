// Manual Windows native adapter check with a dedicated synthetic target only.
// Never enumerates or reads another application's credentials.
#[cfg(windows)]
fn main() -> Result<(), Box<dyn std::error::Error>> {
    use greiva_page_store::native_credentials::{CredentialStore, Secret, WindowsCredentialStore};
    use std::time::{SystemTime, UNIX_EPOCH};
    let store=WindowsCredentialStore;
    let target=format!("Greiva/native-session/v1/synthetic-probe/{}-{}",std::process::id(),SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos());
    let result=(|| {
        assert!(store.read(&target)?.is_none());
        store.write(&target,&Secret::new(b"synthetic-only-first".to_vec())?)?;
        assert_eq!(store.read(&target)?.unwrap().expose(),b"synthetic-only-first");
        store.write(&target,&Secret::new(b"synthetic-only-replaced".to_vec())?)?;
        assert_eq!(store.read(&target)?.unwrap().expose(),b"synthetic-only-replaced");
        store.delete(&target)?;assert!(store.read(&target)?.is_none());store.delete(&target)?;
        Ok::<_,greiva_page_store::native_credentials::CredentialError>(())
    })();
    let cleanup=store.delete(&target);
    result?;cleanup?;
    println!("{{\"syntheticOnly\":true,\"windowsCredentialManager\":true,\"writeReadReplaceDelete\":true,\"cleanupConfirmed\":true}}");Ok(())
}
#[cfg(not(windows))]
fn main() { eprintln!("Windows native adapter check required");std::process::exit(1); }
