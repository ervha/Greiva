#[cfg(feature="crash-test-hooks")]
mod driver {
    use greiva_page_store::native_credentials::*;
    use std::path::PathBuf;
    use sha2::{Digest,Sha256};
    // Presence-only OS double. No token input and no credential file fallback
    // in product code; this fake returns a fixed synthetic value in memory.
    struct FakeOs(PathBuf);
    impl FakeOs {fn path(&self,target:&str)->PathBuf{self.0.join(format!("{:x}",Sha256::digest(target.as_bytes())))}}
    impl CredentialStore for FakeOs {
        fn read(&self,target:&str)->Result<Option<Secret>,CredentialError>{Ok(if self.path(target).exists(){Some(Secret::new(b"synthetic-only-crash-test".to_vec())?)}else{None})}
        fn write(&self,target:&str,_secret:&Secret)->Result<(),CredentialError>{let file=std::fs::File::create(self.path(target)).map_err(|_|CredentialError)?;file.sync_all().map_err(|_|CredentialError)}
        fn delete(&self,target:&str)->Result<(),CredentialError>{match std::fs::remove_file(self.path(target)){Ok(())=>Ok(()),Err(e) if e.kind()==std::io::ErrorKind::NotFound=>Ok(()),_=>Err(CredentialError)}}
    }
    pub async fn run()->Result<(),CredentialError>{
        let args:Vec<_>=std::env::args().collect();if args.len()!=3{return Err(CredentialError)}
        let root=PathBuf::from(&args[1]);std::fs::create_dir_all(root.join("fake-os")).map_err(|_|CredentialError)?;
        let vault=CredentialVault::open(&root.join("marker.sqlite"),"synthetic-crash-scope",FakeOs(root.join("fake-os"))).await?;
        match args[2].as_str(){
            "activate"=>{let t=vault.begin_login().await?;vault.complete(t,"synthetic-owner",Secret::new(b"synthetic-only-crash-test".to_vec())?).await?;},
            "restore"=>{let lease=vault.begin_restore().await?;vault.complete(lease.ticket,"synthetic-owner",Secret::new(b"synthetic-only-crash-test".to_vec())?).await?;},
            "logout"=>{vault.logout().await?;},
            "probe"=>{println!("{{\"restorable\":{}}}",vault.begin_restore().await.is_ok());},
            _=>return Err(CredentialError),
        }vault.close().await;Ok(())
    }
}
#[cfg(feature="crash-test-hooks")]
#[tokio::main]
async fn main(){if driver::run().await.is_err(){eprintln!("Native credential unavailable");std::process::exit(1);}}
#[cfg(not(feature="crash-test-hooks"))]
fn main(){eprintln!("Test-only driver disabled");std::process::exit(1);}
