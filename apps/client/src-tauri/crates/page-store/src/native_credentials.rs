//! Native-only custody. No command/Serialize implementation exposes a secret or
//! accepts a caller's assertion of authentication. The trusted native provider
//! must verify identity before complete(). This module does not grant access.
use sha2::{Digest, Sha256};
use sqlx::{sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous}, Row, SqlitePool};
use std::{path::Path, time::Duration};
use zeroize::Zeroizing;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CredentialError;
impl std::fmt::Display for CredentialError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { f.write_str("Native credential unavailable") }
}
impl std::error::Error for CredentialError {}
type Result<T> = std::result::Result<T, CredentialError>;
pub struct Secret(Zeroizing<Vec<u8>>);
impl Secret {
    pub fn new(bytes: Vec<u8>) -> Result<Self> {
        let bytes = Zeroizing::new(bytes);
        if bytes.is_empty() || bytes.len() > 2560 { return Err(CredentialError); }
        Ok(Self(bytes))
    }
    /// Native provider/OS adapter only; never return these bytes over IPC.
    pub fn expose(&self) -> &[u8] { &self.0 }
}
pub trait CredentialStore: Send + Sync {
    fn read(&self, target: &str) -> Result<Option<Secret>>;
    fn write(&self, target: &str, secret: &Secret) -> Result<()>;
    fn delete(&self, target: &str) -> Result<()>;
}
pub struct Ticket { generation: i64, slot: String, scope: String, owner: Option<String> }
pub struct RefreshLease { pub ticket: Ticket, pub secret: Secret }
#[derive(Debug, PartialEq, Eq)]
pub struct LogoutResult { pub locked: bool, pub cleanup_pending: bool }
pub struct CredentialVault<S: CredentialStore> { pool: SqlitePool, store: S, scope: String }
fn hash(value: &[u8]) -> String { format!("{:x}", Sha256::digest(value)) }
fn marker(value: &str) -> bool { value.len() == 32 && value.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()) }
impl<S: CredentialStore> CredentialVault<S> {
    /// app_scope is a trusted deployment identifier (app ID + issuer + API),
    /// not a WebView argument. The file holds only generations/hashes/OS names.
    pub async fn open(path: &Path, app_scope: &str, store: S) -> Result<Self> {
        if app_scope.is_empty() || app_scope.len() > 8192 { return Err(CredentialError); }
        let scope = hash(app_scope.as_bytes());
        let options = SqliteConnectOptions::new().filename(path).create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal).synchronous(SqliteSynchronous::Full).busy_timeout(Duration::from_secs(5));
        let pool = SqlitePoolOptions::new().max_connections(1).connect_with(options).await.map_err(|_| CredentialError)?;
        let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(|_| CredentialError)?;
        let check: String = sqlx::query_scalar("PRAGMA quick_check").fetch_one(&mut *tx).await.map_err(|_| CredentialError)?;
        if check != "ok" { return Err(CredentialError); }
        let version: i64 = sqlx::query_scalar("PRAGMA user_version").fetch_one(&mut *tx).await.map_err(|_| CredentialError)?;
        if version == 0 {
            let count: i64 = sqlx::query_scalar("SELECT count(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").fetch_one(&mut *tx).await.map_err(|_| CredentialError)?;
            if count != 0 { return Err(CredentialError); }
            for sql in [
                "CREATE TABLE session_marker(id INTEGER PRIMARY KEY CHECK(id=1),scope TEXT NOT NULL,generation INTEGER NOT NULL CHECK(generation>=0),slot TEXT NOT NULL,owner TEXT,active INTEGER NOT NULL CHECK(active IN (0,1))) STRICT",
                "CREATE TABLE retired_credentials(slot TEXT PRIMARY KEY) STRICT",
                "PRAGMA user_version=1",
            ] { sqlx::query(sql).execute(&mut *tx).await.map_err(|_| CredentialError)?; }
            sqlx::query("INSERT INTO session_marker VALUES(1,?,0,lower(hex(randomblob(16))),NULL,0)").bind(&scope).execute(&mut *tx).await.map_err(|_| CredentialError)?;
        } else if version != 1 { return Err(CredentialError); }
        let saved: String = sqlx::query_scalar("SELECT scope FROM session_marker WHERE id=1").fetch_one(&mut *tx).await.map_err(|_| CredentialError)?;
        if saved != scope { return Err(CredentialError); }
        tx.commit().await.map_err(|_| CredentialError)?;
        Ok(Self { pool, store, scope })
    }
    fn target(&self, slot: &str) -> Result<String> {
        if !marker(slot) { return Err(CredentialError); }
        Ok(format!("Greiva/native-session/v1/{}/{}", self.scope, slot))
    }
    async fn transition(&self, restore: bool) -> Result<(Ticket, Option<String>)> {
        let mut tx = self.pool.begin_with("BEGIN IMMEDIATE").await.map_err(|_| CredentialError)?;
        let row = sqlx::query("SELECT generation,slot,owner,active FROM session_marker WHERE id=1 AND scope=?").bind(&self.scope).fetch_one(&mut *tx).await.map_err(|_| CredentialError)?;
        let active: i64 = row.get("active");
        let old: String = row.get("slot"); self.target(&old)?;
        let owner: Option<String> = row.get("owner");
        if restore && (active != 1 || owner.as_ref().is_none_or(|s| s.len() != 64)) { return Err(CredentialError); }
        let generation = row.get::<i64,_>("generation").checked_add(1).filter(|g| *g > 0).ok_or(CredentialError)?;
        let slot: String = sqlx::query_scalar("SELECT lower(hex(randomblob(16)))").fetch_one(&mut *tx).await.map_err(|_| CredentialError)?;
        // Retire old and provisional new slots before any OS call. A crash or
        // unknown write can leave only a tracked, non-restorable credential.
        for value in [&old, &slot] { sqlx::query("INSERT OR IGNORE INTO retired_credentials VALUES(?)").bind(value).execute(&mut *tx).await.map_err(|_| CredentialError)?; }
        let pinned = if restore { owner } else { None };
        sqlx::query("UPDATE session_marker SET generation=?,slot=?,owner=?,active=0 WHERE id=1").bind(generation).bind(&slot).bind(&pinned).execute(&mut *tx).await.map_err(|_| CredentialError)?;
        #[cfg(feature="crash-test-hooks")]
        crate::structured_sync::crash_barrier("credential-lock-before-commit").map_err(|_| CredentialError)?;
        tx.commit().await.map_err(|_| CredentialError)?;
        #[cfg(feature="crash-test-hooks")]
        crate::structured_sync::crash_barrier("credential-lock-after-commit").map_err(|_| CredentialError)?;
        Ok((Ticket { generation, slot, scope:self.scope.clone(), owner:pinned }, if restore { Some(old) } else { None }))
    }
    pub async fn begin_login(&self) -> Result<Ticket> { self.transition(false).await.map(|(ticket,_)|ticket) }
    /// Locks the durable marker before reading. A refresh failure/crash requires
    /// an explicit login; never retry a potentially consumed rotating token.
    pub async fn begin_restore(&self) -> Result<RefreshLease> {
        let (ticket, old) = self.transition(true).await?;
        let secret = self.store.read(&self.target(&old.ok_or(CredentialError)?)?)?.ok_or(CredentialError)?;
        Ok(RefreshLease { ticket, secret })
    }
    /// Only after the native provider has verified issuer + subject. The vault
    /// pins restored identities, but is not itself a JWT verifier or grant.
    pub async fn complete(&self, ticket: Ticket, verified_subject: &str, secret: Secret) -> Result<()> {
        if verified_subject.trim().is_empty() || verified_subject.len() > 512 || verified_subject.chars().any(char::is_control) || ticket.scope != self.scope { return Err(CredentialError); }
        let owner = hash(verified_subject.as_bytes());
        if ticket.owner.as_ref().is_some_and(|expected| expected != &owner) { return Err(CredentialError); }
        let mut tx = self.pool.begin_with("BEGIN IMMEDIATE").await.map_err(|_| CredentialError)?;
        let matches: i64 = sqlx::query_scalar("SELECT count(*) FROM session_marker WHERE id=1 AND scope=? AND generation=? AND slot=? AND active=0")
            .bind(&self.scope).bind(ticket.generation).bind(&ticket.slot).fetch_one(&mut *tx).await.map_err(|_| CredentialError)?;
        if matches != 1 { return Err(CredentialError); }
        self.store.write(&self.target(&ticket.slot)?, &secret)?;
        #[cfg(feature="crash-test-hooks")]
        crate::structured_sync::crash_barrier("credential-os-written").map_err(|_| CredentialError)?;
        sqlx::query("UPDATE session_marker SET owner=?,active=1 WHERE id=1").bind(owner).execute(&mut *tx).await.map_err(|_| CredentialError)?;
        sqlx::query("DELETE FROM retired_credentials WHERE slot=?").bind(&ticket.slot).execute(&mut *tx).await.map_err(|_| CredentialError)?;
        tx.commit().await.map_err(|_| CredentialError)?;
        #[cfg(feature="crash-test-hooks")]
        crate::structured_sync::crash_barrier("credential-activated").map_err(|_| CredentialError)?;
        Ok(())
    }
    pub async fn logout(&self) -> Result<LogoutResult> {
        self.transition(false).await?;
        Ok(LogoutResult { locked:true, cleanup_pending:self.cleanup().await.is_err() })
    }
    pub async fn cleanup(&self) -> Result<()> {
        let mut tx = self.pool.begin_with("BEGIN IMMEDIATE").await.map_err(|_| CredentialError)?;
        // This gate also serializes complete across processes. Never delete an
        // active slot, even if the metadata is corrupt.
        let slots: Vec<String> = sqlx::query_scalar("SELECT slot FROM retired_credentials WHERE slot NOT IN (SELECT slot FROM session_marker) LIMIT 100")
            .fetch_all(&mut *tx).await.map_err(|_| CredentialError)?;
        let mut failed = false;
        for slot in slots {
            if self.store.delete(&self.target(&slot)?).is_ok() { sqlx::query("DELETE FROM retired_credentials WHERE slot=?").bind(slot).execute(&mut *tx).await.map_err(|_| CredentialError)?; }
            else { failed = true; }
        }
        let remaining: i64 = sqlx::query_scalar("SELECT count(*) FROM retired_credentials WHERE slot NOT IN (SELECT slot FROM session_marker)").fetch_one(&mut *tx).await.map_err(|_| CredentialError)?;
        tx.commit().await.map_err(|_| CredentialError)?;
        if failed || remaining != 0 { Err(CredentialError) } else { Ok(()) }
    }
    pub async fn close(self) { self.pool.close().await; }
}

#[cfg(windows)]
mod windows {
    use super::*;
    use windows_sys::Win32::{Foundation::{GetLastError, ERROR_NOT_FOUND}, Security::Credentials::*};
    pub struct WindowsCredentialStore;
    fn target(value: &str) -> Result<Vec<u16>> {
        if !value.starts_with("Greiva/native-session/v1/") || value.len() > 256 || value.contains('\0') { return Err(CredentialError); }
        Ok(value.encode_utf16().chain(Some(0)).collect())
    }
    impl CredentialStore for WindowsCredentialStore {
        fn read(&self, name: &str) -> Result<Option<Secret>> {
            let name = target(name)?; let mut ptr = std::ptr::null_mut();
            // Windows owns the allocation; a successful call supplies its size.
            unsafe {
                if CredReadW(name.as_ptr(), CRED_TYPE_GENERIC, 0, &mut ptr) == 0 {
                    return if GetLastError() == ERROR_NOT_FOUND { Ok(None) } else { Err(CredentialError) };
                }
                if ptr.is_null() { return Err(CredentialError); }
                let value = &*ptr;
                let result = if value.Type != CRED_TYPE_GENERIC || value.CredentialBlob.is_null() || value.CredentialBlobSize == 0 || value.CredentialBlobSize > 2560 { Err(CredentialError) }
                    else { Secret::new(std::slice::from_raw_parts(value.CredentialBlob, value.CredentialBlobSize as usize).to_vec()).map(Some) };
                if !value.CredentialBlob.is_null() && value.CredentialBlobSize <= 2560 { use zeroize::Zeroize; std::slice::from_raw_parts_mut(value.CredentialBlob, value.CredentialBlobSize as usize).zeroize(); }
                CredFree(ptr.cast()); result
            }
        }
        fn write(&self, name: &str, secret: &Secret) -> Result<()> {
            let mut name = target(name)?;
            let mut bytes = Zeroizing::new(secret.expose().to_vec());
            // Input buffers live for the entire synchronous OS call. No user
            // name, email, profile or enterprise roaming metadata is stored.
            let value = CREDENTIALW { Type:CRED_TYPE_GENERIC, TargetName:name.as_mut_ptr(), CredentialBlobSize:bytes.len() as u32, CredentialBlob:bytes.as_mut_ptr(), Persist:CRED_PERSIST_LOCAL_MACHINE, ..unsafe { std::mem::zeroed() } };
            if unsafe { CredWriteW(&value,0) } == 0 { Err(CredentialError) } else { Ok(()) }
        }
        fn delete(&self, name: &str) -> Result<()> {
            let name = target(name)?;
            unsafe { if CredDeleteW(name.as_ptr(),CRED_TYPE_GENERIC,0) != 0 || GetLastError() == ERROR_NOT_FOUND { Ok(()) } else { Err(CredentialError) } }
        }
    }
}
#[cfg(windows)]
pub use windows::WindowsCredentialStore;

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashMap, sync::{Arc, Mutex}, time::{SystemTime,UNIX_EPOCH}};
    #[derive(Default)]
    struct State { values:HashMap<String,Vec<u8>>, fail_write:bool, fail_delete:bool, fail_read:bool }
    #[derive(Clone,Default)]
    struct FakeOs(Arc<Mutex<State>>);
    impl CredentialStore for FakeOs {
        fn read(&self,target:&str)->Result<Option<Secret>> { let s=self.0.lock().unwrap();if s.fail_read{return Err(CredentialError)}s.values.get(target).map(|v|Secret::new(v.clone())).transpose() }
        fn write(&self,target:&str,secret:&Secret)->Result<()> { let mut s=self.0.lock().unwrap();s.values.insert(target.into(),secret.expose().to_vec());if s.fail_write{Err(CredentialError)}else{Ok(())} }
        fn delete(&self,target:&str)->Result<()> { let mut s=self.0.lock().unwrap();if s.fail_delete{return Err(CredentialError)}s.values.remove(target);Ok(()) }
    }
    struct Fixture { root:std::path::PathBuf, os:FakeOs }
    impl Fixture {
        fn new()->Self {let root=std::env::temp_dir().join(format!("greiva-native-credential-{}-{}",std::process::id(),SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos()));std::fs::create_dir(&root).unwrap();Self{root,os:FakeOs::default()}}
        async fn open(&self)->CredentialVault<FakeOs>{CredentialVault::open(&self.root.join("session.sqlite"),"test-app|https://auth.invalid|https://api.invalid",self.os.clone()).await.unwrap()}
    }
    impl Drop for Fixture {fn drop(&mut self){let _=std::fs::remove_dir_all(&self.root);}}
    fn secret(value:&str)->Secret{Secret::new(value.as_bytes().to_vec()).unwrap()}
    #[tokio::test]
    async fn restore_rotation_pins_owner_and_never_puts_secret_in_sqlite() {
        let f=Fixture::new();let v=f.open().await;
        assert!(v.begin_restore().await.is_err());
        let ticket=v.begin_login().await.unwrap();v.complete(ticket,"owner-one",secret("synthetic-refresh-original")).await.unwrap();v.close().await;
        let v=f.open().await;let lease=v.begin_restore().await.unwrap();assert_eq!(lease.secret.expose(),b"synthetic-refresh-original");
        assert!(v.begin_restore().await.is_err());v.cleanup().await.unwrap();
        v.complete(lease.ticket,"owner-one",secret("synthetic-refresh-replaced")).await.unwrap();
        v.cleanup().await.unwrap();assert_eq!(f.os.0.lock().unwrap().values.len(),1);
        let lease=v.begin_restore().await.unwrap();assert!(v.complete(lease.ticket,"other-owner",secret("never-accepted")).await.is_err());
        assert!(v.begin_restore().await.is_err());v.close().await;
        for entry in std::fs::read_dir(&f.root).unwrap(){let bytes=std::fs::read(entry.unwrap().path()).unwrap();let text=String::from_utf8_lossy(&bytes);assert!(!text.contains("synthetic-refresh"));assert!(!text.contains("owner-one"));}
    }
    #[tokio::test]
    async fn logout_persists_before_failed_delete_and_stale_response() {
        let f=Fixture::new();let v=f.open().await;let t=v.begin_login().await.unwrap();v.complete(t,"owner",secret("synthetic-refresh")).await.unwrap();
        let lease=v.begin_restore().await.unwrap();f.os.0.lock().unwrap().fail_delete=true;
        assert_eq!(v.logout().await.unwrap(),LogoutResult{locked:true,cleanup_pending:true});
        assert!(v.complete(lease.ticket,"owner",secret("late-response")).await.is_err());v.close().await;
        let v=f.open().await;assert!(v.begin_restore().await.is_err());f.os.0.lock().unwrap().fail_delete=false;v.cleanup().await.unwrap();assert!(f.os.0.lock().unwrap().values.is_empty());
        let t=v.begin_login().await.unwrap();v.complete(t,"owner",secret("fresh-explicit-login")).await.unwrap();assert!(v.begin_restore().await.is_ok());v.close().await;
    }
    #[tokio::test]
    async fn unknown_os_write_read_failure_and_interrupted_refresh_stay_locked() {
        let f=Fixture::new();let v=f.open().await;f.os.0.lock().unwrap().fail_write=true;
        let t=v.begin_login().await.unwrap();assert!(v.complete(t,"owner",secret("written-but-response-lost")).await.is_err());assert!(!f.os.0.lock().unwrap().values.is_empty());v.close().await;
        let v=f.open().await;assert!(v.begin_restore().await.is_err());f.os.0.lock().unwrap().fail_write=false;
        v.logout().await.unwrap();assert!(f.os.0.lock().unwrap().values.is_empty());
        let t=v.begin_login().await.unwrap();v.complete(t,"owner",secret("stored-refresh")).await.unwrap();f.os.0.lock().unwrap().fail_read=true;assert!(v.begin_restore().await.is_err());v.close().await;
        let v=f.open().await;f.os.0.lock().unwrap().fail_read=false;assert!(v.begin_restore().await.is_err());
        let t=v.begin_login().await.unwrap();v.complete(t,"owner",secret("new-refresh")).await.unwrap();let _lease=v.begin_restore().await.unwrap();v.close().await;
        let v=f.open().await;assert!(v.begin_restore().await.is_err());v.close().await;
    }
    #[tokio::test]
    async fn independent_connections_cannot_accept_old_login_or_foreign_ticket() {
        let f=Fixture::new();let a=f.open().await;let b=f.open().await;let old=a.begin_login().await.unwrap();let current=b.begin_login().await.unwrap();
        assert!(a.complete(old,"old-owner",secret("stale")).await.is_err());b.complete(current,"new-owner",secret("accepted")).await.unwrap();
        let lease=a.begin_restore().await.unwrap();b.logout().await.unwrap();assert!(a.complete(lease.ticket,"new-owner",secret("stale-refresh")).await.is_err());
        let ticket=a.begin_login().await.unwrap();let f2=Fixture::new();let other=f2.open().await;assert!(other.complete(ticket,"owner",secret("wrong-database")).await.is_err());
        other.close().await;a.close().await;b.close().await;
    }
    #[tokio::test]
    async fn corrupt_or_wrong_scope_metadata_and_bad_secrets_refuse() {
        assert!(Secret::new(vec![]).is_err());assert!(Secret::new(vec![0;2561]).is_err());
        let f=Fixture::new();let v=f.open().await;
        assert!(CredentialVault::open(&f.root.join("session.sqlite"),"other-deployment",f.os.clone()).await.is_err());
        sqlx::query("UPDATE session_marker SET slot='bad'").execute(&v.pool).await.unwrap();assert!(v.begin_login().await.is_err());assert!(v.logout().await.is_err());v.close().await;
        std::fs::write(f.root.join("corrupt.sqlite"),b"not a database").unwrap();assert!(CredentialVault::open(&f.root.join("corrupt.sqlite"),"scope",f.os.clone()).await.is_err());
    }
}
