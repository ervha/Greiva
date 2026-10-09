use super::{PageStore, LocalOperation, PullBatch, StoreResult};
use super::structured::uuid_v7;
use super::structured_sync::{prepare_in_transaction, pull_in_transaction, receive, validate_result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{Sqlite, Transaction};
use std::path::Path;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct WorkspaceContext {
    pub issuer:String, pub subject_id:String, pub workspace_id:String,
    pub client_id:String, pub stream_epoch:String,
}
pub struct WorkspaceStore { inner:PageStore, context:WorkspaceContext }
fn safe<T>(result:StoreResult<T>) -> StoreResult<T> { result.map_err(|_|"Workspace storage rejected or unavailable".into()) }
fn valid(context:&WorkspaceContext) -> bool {
    !context.issuer.trim().is_empty() && !context.subject_id.trim().is_empty() &&
    [&context.workspace_id,&context.client_id,&context.stream_epoch].iter().all(|value|uuid_v7(value))
}
pub(super) async fn initialize(tx:&mut Transaction<'_,Sqlite>,context:&WorkspaceContext,version:i64) -> StoreResult<()> {
    if !valid(context) {return Err("Invalid workspace context".into());}
    if version==0 {
        for sql in [
            "CREATE TABLE workspace_binding(singleton INTEGER PRIMARY KEY CHECK(singleton=1),context TEXT NOT NULL CHECK(json_valid(context))) STRICT",
            "CREATE TRIGGER workspace_binding_no_update BEFORE UPDATE ON workspace_binding BEGIN SELECT RAISE(ABORT,'Immutable workspace binding'); END",
            "CREATE TRIGGER workspace_binding_no_delete BEFORE DELETE ON workspace_binding BEGIN SELECT RAISE(ABORT,'Immutable workspace binding'); END",
            "CREATE TABLE workspace_prepared(operation_id TEXT PRIMARY KEY NOT NULL REFERENCES sync_operations(operation_id),wire TEXT NOT NULL CHECK(json_valid(wire))) STRICT",
            "CREATE TABLE workspace_ack_receipts(operation_id TEXT PRIMARY KEY NOT NULL REFERENCES workspace_prepared(operation_id),response TEXT NOT NULL CHECK(json_valid(response))) STRICT",
            "CREATE TABLE workspace_pull_receipts(base_cursor TEXT NOT NULL,target_cursor TEXT NOT NULL,operations TEXT NOT NULL CHECK(json_valid(operations)),PRIMARY KEY(base_cursor,target_cursor)) STRICT",
        ] {sqlx::query(sql).execute(&mut **tx).await.map_err(|e|e.to_string())?;}
        sqlx::query("INSERT INTO workspace_binding VALUES(1,?)").bind(serde_json::to_string(context).unwrap()).execute(&mut **tx).await.map_err(|e|e.to_string())?;
        sqlx::query("INSERT INTO structured_client VALUES(1,?)").bind(&context.client_id).execute(&mut **tx).await.map_err(|e|e.to_string())?;
        sqlx::query("PRAGMA user_version=5").execute(&mut **tx).await.map_err(|e|e.to_string())?;
    }
    let raw:String=sqlx::query_scalar("SELECT context FROM workspace_binding WHERE singleton=1").fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;
    if serde_json::from_str::<WorkspaceContext>(&raw).map_err(|e|e.to_string())?!=*context {return Err("Workspace binding mismatch".into());}
    let client:String=sqlx::query_scalar("SELECT client_id FROM structured_client WHERE singleton=1").fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;
    if client!=context.client_id {return Err("Workspace client mismatch".into());}
    for sql in ["SELECT operation_id,wire FROM workspace_prepared LIMIT 0","SELECT operation_id,response FROM workspace_ack_receipts LIMIT 0","SELECT base_cursor,target_cursor,operations FROM workspace_pull_receipts LIMIT 0"] {
        sqlx::query(sql).execute(&mut **tx).await.map_err(|e|e.to_string())?;
    }
    super::private_page::initialize(tx,version).await?;
    super::private_title::initialize(tx,version).await?;
    super::private_changes::initialize(tx,version).await?;
    super::private_database::initialize(tx,version).await?;
    super::private_database_record::initialize(tx,version).await?;
    super::private_database_view::initialize(tx,version).await?;
    super::private_database_changes::initialize(tx,version).await?;
    Ok(())
}
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct PushResponse { protocol_version:u8,workspace_id:String,stream_epoch:String,results:Vec<Value> }
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct PullRequest { protocol_version:u8,workspace_id:String,client_id:String,cursor:Value,limit:usize }
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct PullResponse { protocol_version:u8,workspace_id:String,stream_epoch:String,operations:Vec<Value>,cursor:String,head_cursor:String,has_more:bool,server_time:String }
#[cfg(feature="crash-test-hooks")]
fn barrier(stage:&str) -> StoreResult<()> { super::structured_sync::crash_barrier(stage) }
#[cfg(not(feature="crash-test-hooks"))]
fn barrier(_stage:&str) -> StoreResult<()> { Ok(()) }
impl WorkspaceStore {
    pub async fn open(path:&Path,context:WorkspaceContext) -> StoreResult<Self> {
        if !valid(&context) {return Err("Invalid workspace context".into());}
        let inner=safe(PageStore::open_bound(path,Some(&context)).await)?;
        Ok(Self{inner,context})
    }
    pub async fn snapshot(&self) -> StoreResult<Value> {
        let snapshot=safe(self.inner.structured_snapshot().await)?;
        Ok(json!({"context":self.context,"snapshot":snapshot}))
    }
    pub async fn mutate(&self,operation:LocalOperation) -> StoreResult<Value> {
        if operation.client_id!=self.context.client_id {return Err("Workspace client mismatch".into());}
        safe(self.inner.structured_mutate(operation).await)
    }
    pub async fn prepare(&self) -> StoreResult<Option<String>> {safe(self.prepare_inner().await)}
    async fn prepare_inner(&self) -> StoreResult<Option<String>> {
        let mut tx=self.inner.pool.begin().await.map_err(|e|e.to_string())?;
        let Some(operation)=prepare_in_transaction(&mut tx).await? else {tx.commit().await.map_err(|e|e.to_string())?;return Ok(None);};
        if operation["clientId"]!=self.context.client_id {return Err("Workspace prepared client mismatch".into());}
        let id=operation["operationId"].as_str().ok_or("Missing operation ID")?;
        let expected=json!({"protocolVersion":1,"workspaceId":self.context.workspace_id,"clientId":self.context.client_id,"operations":[operation]}).to_string();
        let old:Option<String>=sqlx::query_scalar("SELECT wire FROM workspace_prepared WHERE operation_id=?").bind(id).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
        let wire=if let Some(old)=old {if old!=expected {return Err("Prepared workspace wire changed".into());}old} else {
            sqlx::query("INSERT INTO workspace_prepared VALUES(?,?)").bind(id).bind(&expected).execute(&mut *tx).await.map_err(|e|e.to_string())?;expected
        };
        barrier("workspace-prepare-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;barrier("workspace-prepare-after-commit")?;Ok(Some(wire))
    }
    pub async fn acknowledge(&self,wire:String,response:Value) -> StoreResult<()> {safe(self.ack_inner(wire,response).await)}
    async fn ack_inner(&self,wire:String,response:Value) -> StoreResult<()> {
        let envelope:PushResponse=serde_json::from_value(response.clone()).map_err(|e|e.to_string())?;
        if envelope.protocol_version!=1 || envelope.workspace_id!=self.context.workspace_id || envelope.stream_epoch!=self.context.stream_epoch || envelope.results.len()!=1 {return Err("ACK workspace context mismatch".into());}
        let result=&envelope.results[0];validate_result(result)?;
        let prepared:Value=serde_json::from_str(&wire).map_err(|e|e.to_string())?;
        let operations=prepared["operations"].as_array().ok_or("Missing prepared operations")?;
        if operations.len()!=1 || ["operationId","clientId","entityType","entityId"].iter().any(|key|operations[0][*key]!=result[*key]) {return Err("ACK identity mismatch".into());}
        let id=result["operationId"].as_str().ok_or("Missing ACK ID")?;
        let mut tx=self.inner.pool.begin().await.map_err(|e|e.to_string())?;
        let stored:String=sqlx::query_scalar("SELECT wire FROM workspace_prepared WHERE operation_id=?").bind(id).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;
        if stored!=wire {return Err("ACK wire is not the durable prepared request".into());}
        let old:Option<String>=sqlx::query_scalar("SELECT response FROM workspace_ack_receipts WHERE operation_id=?").bind(id).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
        if let Some(old)=old {if serde_json::from_str::<Value>(&old).map_err(|e|e.to_string())?!=response {return Err("Immutable ACK changed".into());}return Ok(());}
        receive(&mut tx,result).await?;
        sqlx::query("INSERT INTO workspace_ack_receipts VALUES(?,?)").bind(id).bind(response.to_string()).execute(&mut *tx).await.map_err(|e|e.to_string())?;
        barrier("workspace-ack-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;barrier("workspace-ack-after-commit")
    }
    pub async fn apply_pull(&self,request:Value,response:Value) -> StoreResult<()> {safe(self.pull_inner(request,response).await)}
    async fn pull_inner(&self,request:Value,response:Value) -> StoreResult<()> {
        let request:PullRequest=serde_json::from_value(request).map_err(|e|e.to_string())?;
        let response:PullResponse=serde_json::from_value(response).map_err(|e|e.to_string())?;
        if request.protocol_version!=1 || request.workspace_id!=self.context.workspace_id || request.client_id!=self.context.client_id ||
            response.protocol_version!=1 || response.workspace_id!=self.context.workspace_id || response.stream_epoch!=self.context.stream_epoch ||
            !(1..=500).contains(&request.limit) || response.operations.len()>request.limit ||
            (!request.cursor.is_null() && !request.cursor.as_str().is_some_and(|v|!v.is_empty())) ||
            (response.has_more && response.cursor==response.head_cursor) || (!response.operations.is_empty() && request.cursor.as_str()==Some(&response.cursor)) {return Err("Pull workspace context/progress mismatch".into());}
        let base=request.cursor.to_string();let operations=serde_json::to_string(&response.operations).unwrap();
        let mut tx=self.inner.pool.begin().await.map_err(|e|e.to_string())?;
        let old:Option<String>=sqlx::query_scalar("SELECT operations FROM workspace_pull_receipts WHERE base_cursor=? AND target_cursor=?").bind(&base).bind(&response.cursor).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
        if let Some(old)=old {if old!=operations {return Err("Immutable pull page changed".into());}}
        let target=response.cursor.clone();
        pull_in_transaction(&mut tx,request.cursor.as_str().map(String::from),PullBatch{operations:response.operations,cursor:response.cursor,head_cursor:response.head_cursor,has_more:response.has_more,server_time:response.server_time}).await?;
        sqlx::query("INSERT OR IGNORE INTO workspace_pull_receipts VALUES(?,?,?)").bind(base).bind(target).bind(operations).execute(&mut *tx).await.map_err(|e|e.to_string())?;
        barrier("workspace-pull-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;barrier("workspace-pull-after-commit")
    }
    pub async fn page_create(&self,id:&str,title:&str,bytes:&[u8])->StoreResult<()> {safe(self.inner.private_page_create(&self.context.client_id,id,title,bytes).await)}
    pub async fn page_append(&self,id:&str,bytes:&[u8])->StoreResult<()> {safe(self.inner.private_page_append(&self.context.client_id,id,bytes).await)}
    pub async fn page_load(&self,id:&str)->StoreResult<Value> {safe(self.inner.private_page_load(id).await)}
    pub async fn page_exists(&self,id:&str)->StoreResult<bool> {safe(self.inner.private_page_exists(id).await)}
    pub async fn page_list(&self,after:Option<&str>,limit:usize)->StoreResult<Value> {
        let list=safe(self.inner.private_page_list(after,limit).await)?;
        Ok(json!({"context":self.context,"pages":list["pages"],"nextAfter":list["nextAfter"]}))
    }
    pub async fn page_prepare(&self,id:&str)->StoreResult<Value> {safe(self.inner.private_page_prepare(&self.context.client_id,id).await)}
    pub async fn page_ack(&self,id:&str,sequence:&str,wire:&str,response:Value)->StoreResult<()> {safe(self.inner.private_page_ack(&self.context.client_id,&self.context.workspace_id,id,sequence,wire,response).await)}
    pub async fn page_receive(&self,id:&str,response:Value)->StoreResult<()> {safe(self.inner.private_page_receive(&self.context.workspace_id,id,response).await)}
    pub async fn database_changes_receive(&self,source:&str,request:Value,response:Value)->StoreResult<()> {safe(self.inner.database_changes_receive(&self.context,source,request,response).await)}
    pub async fn database_changes_load(&self,source:&str)->StoreResult<Value> {safe(self.inner.database_changes_load(&self.context,source).await)}
    pub async fn database_view_receive(&self,source:&str,id:&str,request:Value,response:Value)->StoreResult<()> {safe(self.inner.database_view_receive(&self.context,source,id,request,response).await)}
    pub async fn database_view_load(&self,source:&str,id:&str,after:Option<&str>,limit:usize)->StoreResult<Value> {safe(self.inner.database_view_load(&self.context,source,id,after,limit).await)}
    pub async fn database_view_list(&self,source:&str,after:Option<&str>,limit:usize)->StoreResult<Value> {safe(self.inner.database_view_list(&self.context,source,after,limit).await)}
    pub async fn database_record_receive(&self,source:&str,id:&str,request:Value,response:Value)->StoreResult<()> {safe(self.inner.database_record_receive(&self.context,source,id,request,response).await)}
    pub async fn database_record_load(&self,source:&str,id:&str,after:Option<&str>,limit:usize)->StoreResult<Value> {safe(self.inner.database_record_load(&self.context,source,id,after,limit).await)}
    pub async fn database_record_list(&self,source:&str,after:Option<&str>,limit:usize)->StoreResult<Value> {safe(self.inner.database_record_list(&self.context,source,after,limit).await)}
    pub async fn database_source_receive(&self,id:&str,request:Value,response:Value)->StoreResult<()> {safe(self.inner.database_source_receive(&self.context,id,request,response).await)}
    pub async fn database_source_load(&self,id:&str)->StoreResult<Value> {safe(self.inner.database_source_load(&self.context,id).await)}
    pub async fn database_source_list(&self,after:Option<&str>,limit:usize)->StoreResult<Value> {safe(self.inner.database_source_list(&self.context,after,limit).await)}
    pub async fn title_enqueue(&self,id:&str,intent:Value)->StoreResult<()> {safe(self.inner.title_enqueue(&self.context,id,intent).await)}
    pub async fn changes_receive(&self,request:Value,response:Value)->StoreResult<()> {safe(self.inner.changes_receive(&self.context,request,response).await)}
    pub async fn changes_load(&self,after:Option<&str>,limit:usize)->StoreResult<Value> {safe(self.inner.changes_load(&self.context,after,limit).await)}
    pub async fn title_prepare(&self,id:&str)->StoreResult<Value> {safe(self.inner.title_prepare(&self.context,id).await)}
    pub async fn title_ack(&self,id:&str,sequence:&str,wire:&str,response:Value)->StoreResult<()> {safe(self.inner.title_ack(&self.context,id,sequence,wire,response).await)}
    pub async fn title_receive(&self,id:&str,request:Value,response:Value)->StoreResult<()> {safe(self.inner.title_receive(&self.context,id,request,response).await)}
    pub async fn title_load(&self,id:&str,after_operation:Option<&str>,after_conflict:Option<&str>,limit:usize)->StoreResult<Value> {safe(self.inner.title_load(&self.context,id,after_operation,after_conflict,limit).await)}

}
