use crate::{StoreResult, structured::uuid_v7};
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use std::{path::Path, time::Duration};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct WorkspaceOwner { pub issuer: String, pub subject_id: String }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDevice { pub issuer: String, pub subject_id: String, pub client_id: String }
const REJECTED: &str = "Private workspace device unavailable";

// Stable local registration metadata, never a credential or Auth grant. The
// caller supplies a verified owner; no email, token, password or profile fields.
pub(crate) async fn resolve(root: &Path, owner: WorkspaceOwner, candidate: &str) -> StoreResult<WorkspaceDevice> {
    if !uuid_v7(candidate) || !owner.issuer.starts_with("https://") || owner.issuer.len() > 2048
        || owner.issuer.trim() != owner.issuer || owner.issuer.chars().any(char::is_control)
        || owner.subject_id.trim().is_empty() || owner.subject_id.len() > 512
        || owner.subject_id.chars().any(char::is_control) { return Err(REJECTED.into()); }
    std::fs::create_dir_all(root).map_err(|_| REJECTED)?;
    let path = root.join("devices.sqlite");
    if !path.exists() {
        // Missing device metadata alongside retained workspaces is ambiguous.
        // Do not silently select a new ID and show an empty replacement store.
        for entry in std::fs::read_dir(root).map_err(|_| REJECTED)? {
            let entry = entry.map_err(|_| REJECTED)?;
            if entry.path().extension().is_some_and(|extension| extension == "sqlite") { return Err(REJECTED.into()); }
        }
    }
    let options = SqliteConnectOptions::new().filename(path).create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal).synchronous(SqliteSynchronous::Full)
        .busy_timeout(Duration::from_secs(5));
    let pool = SqlitePoolOptions::new().max_connections(1).connect_with(options).await.map_err(|_| REJECTED)?;
    let result = async {
        // Serializes first creation across processes, not just this registry.
        let mut tx = pool.begin_with("BEGIN IMMEDIATE").await.map_err(|_| REJECTED)?;
        let check: String = sqlx::query_scalar("PRAGMA quick_check").fetch_one(&mut *tx).await.map_err(|_| REJECTED)?;
        if check != "ok" { return Err(REJECTED.into()); }
        let version: i64 = sqlx::query_scalar("PRAGMA user_version").fetch_one(&mut *tx).await.map_err(|_| REJECTED)?;
        if version == 0 {
            let count: i64 = sqlx::query_scalar("SELECT count(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").fetch_one(&mut *tx).await.map_err(|_| REJECTED)?;
            if count != 0 { return Err(REJECTED.into()); }
            for statement in [
                "CREATE TABLE workspace_devices(issuer TEXT NOT NULL,subject_id TEXT NOT NULL,client_id TEXT NOT NULL UNIQUE,PRIMARY KEY(issuer,subject_id)) STRICT",
                "CREATE TRIGGER workspace_devices_no_update BEFORE UPDATE ON workspace_devices BEGIN SELECT RAISE(ABORT,'Immutable workspace device'); END",
                "CREATE TRIGGER workspace_devices_no_delete BEFORE DELETE ON workspace_devices BEGIN SELECT RAISE(ABORT,'Immutable workspace device'); END",
                "PRAGMA user_version=1",
            ] { sqlx::query(statement).execute(&mut *tx).await.map_err(|_| REJECTED)?; }
        } else if version != 1 { return Err(REJECTED.into()); }
        sqlx::query("INSERT INTO workspace_devices(issuer,subject_id,client_id) VALUES(?,?,?) ON CONFLICT(issuer,subject_id) DO NOTHING")
            .bind(&owner.issuer).bind(&owner.subject_id).bind(candidate).execute(&mut *tx).await.map_err(|_| REJECTED)?;
        let client_id: String = sqlx::query_scalar("SELECT client_id FROM workspace_devices WHERE issuer=? AND subject_id=?")
            .bind(&owner.issuer).bind(&owner.subject_id).fetch_one(&mut *tx).await.map_err(|_| REJECTED)?;
        if !uuid_v7(&client_id) { return Err(REJECTED.into()); }
        #[cfg(feature = "crash-test-hooks")]
        crate::structured_sync::crash_barrier("workspace-device-before-commit").map_err(|_| REJECTED)?;
        tx.commit().await.map_err(|_| REJECTED)?;
        #[cfg(feature = "crash-test-hooks")]
        crate::structured_sync::crash_barrier("workspace-device-after-commit").map_err(|_| REJECTED)?;
        Ok(WorkspaceDevice { issuer: owner.issuer, subject_id: owner.subject_id, client_id })
    }.await;
    pool.close().await;
    result
}
