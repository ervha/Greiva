use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous}, Row, SqlitePool};
use std::{path::Path, time::Duration};
mod structured;
mod structured_sync;
mod workspace_store;
mod private_page;
mod private_title;
mod workspace_registry;
mod workspace_device;
pub use workspace_device::{WorkspaceOwner, WorkspaceDevice};
pub use workspace_registry::{WorkspaceRegistry,WorkspaceHandle};
pub use workspace_store::{WorkspaceContext, WorkspaceStore};
pub use structured::{LocalOperation, StructuredSnapshot};
pub use structured_sync::PullBatch;

pub struct PageStore { pool: SqlitePool }
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PageMetadata { pub id: String, pub title: String, pub y_doc_id: String, pub created_at: String, pub updated_at: String }
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredPage { pub metadata: PageMetadata, pub updates: Vec<Vec<u8>> }
type StoreResult<T> = Result<T, String>;

fn page_id(id: &str) -> StoreResult<()> {
    if id.is_empty() || id.len() > 80 || !id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-') { return Err("Invalid Page ID".into()); }
    Ok(())
}
impl PageStore {
    pub async fn open(path: &Path) -> StoreResult<Self> {
        Self::open_bound(path, None).await
    }
    async fn open_bound(path: &Path, workspace: Option<&WorkspaceContext>) -> StoreResult<Self> {
        let options = SqliteConnectOptions::new().filename(path).create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal).synchronous(SqliteSynchronous::Full)
            .foreign_keys(true).busy_timeout(Duration::from_secs(5));
        let pool = SqlitePoolOptions::new().max_connections(1).connect_with(options).await.map_err(|e| e.to_string())?;
        let version: i64 = sqlx::query_scalar("PRAGMA user_version").fetch_one(&pool).await.map_err(|e| e.to_string())?;
        if !(if workspace.is_some() { [0,5,6,7].contains(&version) } else { [0,1,2,3,4].contains(&version) }) { return Err(format!("Unsupported local schema version: {version}")); }
        if workspace.is_some() && version==0 {
            let count:i64=sqlx::query_scalar("SELECT count(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").fetch_one(&pool).await.map_err(|e|e.to_string())?;
            if count!=0 {return Err("Private workspace requires an empty database".into());}
        }
        let integrity: String = sqlx::query_scalar("PRAGMA quick_check").fetch_one(&pool).await.map_err(|e| e.to_string())?;
        if integrity != "ok" { return Err(format!("SQLite integrity check failed: {integrity}")); }
        let mut tx = pool.begin().await.map_err(|e| e.to_string())?;
        if version == 0 {
            for statement in include_str!("../schema.sql").split(';').filter(|statement| !statement.trim().is_empty()) {
                sqlx::query(statement).execute(&mut *tx).await.map_err(|e| e.to_string())?;
            }
        }
        if version == 1 {
            sqlx::query("CREATE TABLE client_page_state (singleton INTEGER PRIMARY KEY CHECK(singleton=1), page_id TEXT NOT NULL REFERENCES pages(id)) STRICT").execute(&mut *tx).await.map_err(|e| e.to_string())?;
            sqlx::query("PRAGMA user_version=2").execute(&mut *tx).await.map_err(|e| e.to_string())?;
        }
        if version < 3 {
            for statement in include_str!("../structured.sql").split(';').filter(|statement| !statement.trim().is_empty()) {
                sqlx::query(statement).execute(&mut *tx).await.map_err(|e| e.to_string())?;
            }
        }
        if version < 4 {
            for statement in include_str!("../structured-sync.sql").split(';').filter(|statement| !statement.trim().is_empty()) {
                sqlx::query(statement).execute(&mut *tx).await.map_err(|e| e.to_string())?;
            }
        }
        // An incompatible existing schema must fail before the editor can claim readiness.
        sqlx::query("SELECT id, title, y_doc_id, created_at, updated_at FROM pages LIMIT 0").execute(&mut *tx).await.map_err(|e| e.to_string())?;
        sqlx::query("SELECT seq, page_id, update_bytes, digest FROM page_updates LIMIT 0").execute(&mut *tx).await.map_err(|e| e.to_string())?;
        sqlx::query("SELECT singleton,page_id FROM client_page_state LIMIT 0").execute(&mut *tx).await.map_err(|e| e.to_string())?;
        structured::validate_schema(&mut tx).await?;
        structured_sync::validate_schema(&mut tx).await?;
        if let Some(context) = workspace { workspace_store::initialize(&mut tx, context, version).await?; }
        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(Self { pool })
    }
    pub async fn load(&self, id: &str) -> StoreResult<StoredPage> {
        page_id(id)?;
        let mut tx = self.pool.begin().await.map_err(|e| e.to_string())?;
        sqlx::query("INSERT OR IGNORE INTO pages(id,title,y_doc_id,created_at,updated_at) VALUES (?,'',?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))")
            .bind(id).bind(format!("page:{id}")).execute(&mut *tx).await.map_err(|e| e.to_string())?;
        let row = sqlx::query("SELECT id,title,y_doc_id,created_at,updated_at FROM pages WHERE id=?").bind(id).fetch_one(&mut *tx).await.map_err(|e| e.to_string())?;
        sqlx::query("INSERT INTO client_page_state(singleton,page_id) VALUES (1,?) ON CONFLICT(singleton) DO UPDATE SET page_id=excluded.page_id").bind(id).execute(&mut *tx).await.map_err(|e| e.to_string())?;
        let metadata = PageMetadata { id: row.get("id"), title: row.get("title"), y_doc_id: row.get("y_doc_id"), created_at: row.get("created_at"), updated_at: row.get("updated_at") };
        if metadata.y_doc_id != format!("page:{id}") { return Err("Page document identity mismatch".into()); }
        let rows = sqlx::query("SELECT update_bytes,digest FROM page_updates WHERE page_id=? ORDER BY seq").bind(id).fetch_all(&mut *tx).await.map_err(|e| e.to_string())?;
        let mut updates = Vec::new();
        for row in rows {
            let bytes: Vec<u8> = row.get("update_bytes");
            let digest: Vec<u8> = row.get("digest");
            if Sha256::digest(&bytes).as_slice() != digest.as_slice() { return Err("Local Yjs update checksum mismatch".into()); }
            updates.push(bytes);
        }
        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(StoredPage { metadata, updates })
    }
    pub async fn list(&self) -> StoreResult<Vec<PageMetadata>> {
        let rows = sqlx::query("SELECT id,title,y_doc_id,created_at,updated_at FROM pages ORDER BY CASE WHEN id=(SELECT page_id FROM client_page_state WHERE singleton=1) THEN 0 ELSE 1 END, updated_at DESC, id")
            .fetch_all(&self.pool).await.map_err(|e| e.to_string())?;
        Ok(rows.into_iter().map(|row| PageMetadata { id: row.get("id"), title: row.get("title"), y_doc_id: row.get("y_doc_id"), created_at: row.get("created_at"), updated_at: row.get("updated_at") }).collect())
    }
    pub async fn append(&self, id: &str, update: &[u8]) -> StoreResult<()> {
        page_id(id)?;
        if update.is_empty() || update.len() > 16 * 1024 * 1024 { return Err("Invalid update size".into()); }
        let mut tx = self.pool.begin().await.map_err(|e| e.to_string())?;
        sqlx::query("INSERT OR IGNORE INTO page_updates(page_id,update_bytes,digest) VALUES (?,?,?)")
            .bind(id).bind(update).bind(Sha256::digest(update).to_vec()).execute(&mut *tx).await.map_err(|e| e.to_string())?;
        sqlx::query("UPDATE pages SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(id).execute(&mut *tx).await.map_err(|e| e.to_string())?;
        #[cfg(feature="crash-test-hooks")]
        structured_sync::crash_barrier("page-append-before-commit")?;
        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(())
    }
    pub async fn set_title(&self, id: &str, title: &str) -> StoreResult<()> {
        page_id(id)?;
        if title.len() > 8000 { return Err("Title exceeds local storage limit".into()); }
        let result = sqlx::query("UPDATE pages SET title=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?")
            .bind(title).bind(id).execute(&self.pool).await.map_err(|e| e.to_string())?;
        if result.rows_affected() != 1 { return Err("Page not found".into()); }
        Ok(())
    }
}
