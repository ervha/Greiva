use super::{PageStore,StoreResult,WorkspaceContext};
use super::private_database::{exact,text,id,source_value,source_snapshot};
use serde_json::{json,Value};
use super::private_database_record::hash;
use sqlx::{Row,Sqlite,Transaction,sqlite::SqliteRow};
const WIRE_BYTES:usize=4*1024*1024;
fn seq(raw:&str)->StoreResult<i64>{let n=raw.parse::<i64>().map_err(|_|"Invalid Source sequence")?;if n<1||n.to_string()!=raw{return Err("Invalid Source sequence".into());}Ok(n)}
fn intent(c:&WorkspaceContext,v:&Value)->StoreResult<()> {exact(v,&["operationId","source"])?;id(text(v,"operationId")?)?;source_value(c,&v["source"],text(&v["source"],"id")?)?;if v["source"]["schemaVersion"]!=1{return Err("Initial Source schema required".into());}Ok(())}
fn wire(c:&WorkspaceContext,operation_id:&str,source:&Value)->StoreResult<String>{let raw=json!({"protocolVersion":1,"clientId":c.client_id,"operationId":operation_id,"source":source}).to_string();if raw.len()>WIRE_BYTES{return Err("Source wire too large".into());}Ok(raw)}
fn reply(c:&WorkspaceContext,operation_id:&str,source:&Value,v:&Value)->StoreResult<()> {
 exact(v,&["protocolVersion","workspaceId","workspaceEpoch","clientId","operationId","snapshot","result"])?;exact(&v["result"],&["status"])?;
 if v["protocolVersion"]!=1||v["workspaceId"]!=c.workspace_id||v["workspaceEpoch"]!=c.stream_epoch||v["clientId"]!=c.client_id||v["operationId"]!=operation_id||v["result"]["status"]!="created"||v["snapshot"]["version"]!=1||v["snapshot"]["source"]!=*source{return Err("Source ACK identity/definition mismatch".into());}source_snapshot(c,&v["snapshot"],text(source,"id")?)?;Ok(())
}
struct Operation{sequence:i64,operation_id:String,source:Value,wire:Option<String>,response:Option<Value>}
fn operation(c:&WorkspaceContext,row:&SqliteRow)->StoreResult<Operation>{
 let sequence=row.get::<i64,_>("seq");if sequence<1{return Err("Invalid Source sequence".into());}let operation_id=row.get::<String,_>("operation_id");let source_id=row.get::<String,_>("source_id");let source:Value=serde_json::from_str(&row.get::<String,_>("definition")).map_err(|_|"Corrupt Source intent")?;intent(c,&json!({"operationId":operation_id,"source":source}))?;if source["id"]!=source_id{return Err("Source operation index mismatch".into());}
 if row.get::<String,_>("definition_hash")!=hash(&json!({"context":c,"operationId":operation_id,"source":source})){return Err("Source intent checksum mismatch".into());}let prepared=row.get::<Option<String>,_>("wire");let wire_hash=row.get::<Option<String>,_>("wire_hash");if let Some(raw)=&prepared{let request:Value=serde_json::from_str(raw).map_err(|_|"Corrupt Source wire")?;if raw.len()>WIRE_BYTES||wire_hash.as_deref()!=Some(hash(&Value::String(raw.clone())).as_str())||request!=json!({"protocolVersion":1,"clientId":c.client_id,"operationId":operation_id,"source":source}){return Err("Source prepared wire changed".into());}}else if wire_hash.is_some(){return Err("Source wire checksum without prepared bytes".into());}
 let response=row.get::<Option<String>,_>("response").map(|raw|serde_json::from_str::<Value>(&raw).map_err(|_|"Corrupt Source ACK".to_string())).transpose()?;if let Some(value)=&response{if prepared.is_none(){return Err("Source ACK without prepared wire".into());}reply(c,&operation_id,&source,value)?;}Ok(Operation{sequence,operation_id,source,wire:prepared,response})
}
fn local(row:&Operation)->Value{json!({"sequence":row.sequence.to_string(),"intent":{"operationId":row.operation_id,"source":row.source},"wire":row.wire,"response":row.response})}
pub(super) async fn verify_receipt(tx:&mut Transaction<'_,Sqlite>,c:&WorkspaceContext,value:&Value)->StoreResult<()> {
 let operation_id=text(value,"operationId")?;let row=sqlx::query("SELECT seq,operation_id,source_id,definition,definition_hash,wire,wire_hash,response FROM workspace_database_source_operations WHERE operation_id=?").bind(operation_id).fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;let row=operation(c,&row)?;if row.response.as_ref()!=Some(value){return Err("Source cache ACK lacks original operation proof".into());}Ok(())
}
async fn observed(tx:&mut Transaction<'_,Sqlite>,c:&WorkspaceContext,row:&Operation)->StoreResult<()> {
 let source_id=text(&row.source,"id")?;let current=super::private_database::load(tx,c,source_id).await?;
 if let Some(ack)=&row.response{let current=current.ok_or("Missing confirmed Source cache")?;let old=sqlx::query("SELECT snapshot,response FROM workspace_database_source_history WHERE source_id=? AND version=1").bind(source_id).fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;let snapshot:Value=serde_json::from_str(&old.get::<String,_>("snapshot")).map_err(|_|"Corrupt created Source history")?;let receipt:Value=serde_json::from_str(&old.get::<String,_>("response")).map_err(|_|"Corrupt created Source receipt")?;super::private_database::checked_receipt(tx,c,source_id,&receipt).await?;if snapshot!=ack["snapshot"]||receipt["snapshot"]!=snapshot||current["creationOrder"]!=snapshot["creationOrder"]{return Err("Source ACK differs from cache/history".into());}}
 Ok(())
}
#[cfg(feature="crash-test-hooks")]
fn barrier(stage:&str)->StoreResult<()>{super::structured_sync::crash_barrier(stage)}
#[cfg(not(feature="crash-test-hooks"))]
fn barrier(_stage:&str)->StoreResult<()>{Ok(())}
pub(super) async fn initialize(tx:&mut Transaction<'_,Sqlite>,old:i64)->StoreResult<()> {
 if [0,5,6,7,8,9,10,11,12].contains(&old){for sql in [
  "CREATE TABLE workspace_database_source_operations(seq INTEGER PRIMARY KEY AUTOINCREMENT CHECK(seq>0),operation_id TEXT NOT NULL UNIQUE,source_id TEXT NOT NULL UNIQUE,definition TEXT NOT NULL CHECK(json_valid(definition)),definition_hash TEXT NOT NULL,wire TEXT,wire_hash TEXT,response TEXT CHECK(response IS NULL OR json_valid(response)),CHECK((wire IS NULL)=(wire_hash IS NULL)),CHECK(response IS NULL OR wire IS NOT NULL)) STRICT",
  "PRAGMA user_version=13"
 ]{sqlx::query(sql).execute(&mut **tx).await.map_err(|e|e.to_string())?;}}
 sqlx::query("SELECT seq,operation_id,source_id,definition,definition_hash,wire,wire_hash,response FROM workspace_database_source_operations LIMIT 0").execute(&mut **tx).await.map_err(|e|e.to_string())?;Ok(())
}
impl PageStore {
 pub(super) async fn database_source_enqueue(&self,c:&WorkspaceContext,candidate:Value)->StoreResult<()> {
  intent(c,&candidate)?;let operation_id=text(&candidate,"operationId")?;let source_id=text(&candidate["source"],"id")?;let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;
  let old=sqlx::query("SELECT seq,operation_id,source_id,definition,definition_hash,wire,wire_hash,response FROM workspace_database_source_operations WHERE operation_id=?").bind(operation_id).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
  if let Some(old)=old{let row=operation(c,&old)?;if row.source!=candidate["source"]{return Err("Source operation ID reused".into());}observed(&mut tx,c,&row).await?;tx.commit().await.map_err(|e|e.to_string())?;return Ok(());}
  if super::private_database::load(&mut tx,c,source_id).await?.is_some(){return Err("Cannot create a confirmed Source".into());}
  sqlx::query("INSERT INTO workspace_database_source_operations(operation_id,source_id,definition,definition_hash) VALUES(?,?,?,?)").bind(operation_id).bind(source_id).bind(candidate["source"].to_string()).bind(hash(&json!({"context":c,"operationId":operation_id,"source":candidate["source"]}))).execute(&mut *tx).await.map_err(|e|e.to_string())?;
  barrier("workspace-database-source-enqueue-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;barrier("workspace-database-source-enqueue-after-commit")
 }
 pub(super) async fn database_source_prepare(&self,c:&WorkspaceContext)->StoreResult<Value>{
  let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;let row=sqlx::query("SELECT seq,operation_id,source_id,definition,definition_hash,wire,wire_hash,response FROM workspace_database_source_operations WHERE response IS NULL ORDER BY seq LIMIT 1").fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
  let result=if let Some(row)=row{let row=operation(c,&row)?;observed(&mut tx,c,&row).await?;let raw=if let Some(raw)=row.wire{raw}else{wire(c,&row.operation_id,&row.source)?};sqlx::query("UPDATE workspace_database_source_operations SET wire=?,wire_hash=? WHERE operation_id=? AND wire IS NULL").bind(&raw).bind(hash(&Value::String(raw.clone()))).bind(&row.operation_id).execute(&mut *tx).await.map_err(|e|e.to_string())?;json!({"sequence":row.sequence.to_string(),"operationId":row.operation_id,"sourceId":row.source["id"],"wire":raw})}else{Value::Null};
  barrier("workspace-database-source-prepare-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;barrier("workspace-database-source-prepare-after-commit")?;Ok(result)
 }
 pub(super) async fn database_source_ack(&self,c:&WorkspaceContext,sequence:&str,raw:&str,value:Value)->StoreResult<()> {
  let sequence=seq(sequence)?;let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;let row=sqlx::query("SELECT seq,operation_id,source_id,definition,definition_hash,wire,wire_hash,response FROM workspace_database_source_operations WHERE seq=?").bind(sequence).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;let row=operation(c,&row)?;if row.wire.as_deref()!=Some(raw){return Err("Source ACK differs from immutable wire".into());}reply(c,&row.operation_id,&row.source,&value)?;
  if let Some(old)=&row.response{if *old!=value{return Err("Source ACK reused".into());}observed(&mut tx,c,&row).await?;tx.commit().await.map_err(|e|e.to_string())?;return Ok(());}
  sqlx::query("UPDATE workspace_database_source_operations SET response=? WHERE seq=? AND response IS NULL").bind(value.to_string()).bind(sequence).execute(&mut *tx).await.map_err(|e|e.to_string())?;super::private_database::save(&mut tx,c,text(&row.source,"id")?,&value).await?;
  let confirmed=Operation{response:Some(value),..row};observed(&mut tx,c,&confirmed).await?;barrier("workspace-database-source-ack-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;barrier("workspace-database-source-ack-after-commit")
 }
 pub(super) async fn database_source_queue(&self,c:&WorkspaceContext,after:Option<&str>,limit:usize,pending_only:bool)->StoreResult<Value>{
  if !(1..=100).contains(&limit){return Err("Invalid Source operation limit".into());}let after=after.map(seq).transpose()?;let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;let rows=sqlx::query("SELECT seq,operation_id,source_id,definition,definition_hash,wire,wire_hash,response FROM workspace_database_source_operations WHERE (?=0 OR response IS NULL) AND (? IS NULL OR seq>?) ORDER BY seq LIMIT ?").bind(pending_only).bind(after).bind(after).bind((limit+1) as i64).fetch_all(&mut *tx).await.map_err(|e|e.to_string())?;let more=rows.len()>limit;let mut operations=Vec::new();for row in rows{let row=operation(c,&row)?;observed(&mut tx,c,&row).await?;operations.push(local(&row));}operations.truncate(limit);let next=if more{operations.last().unwrap()["sequence"].clone()}else{Value::Null};let pending:i64=sqlx::query_scalar("SELECT count(*) FROM workspace_database_source_operations WHERE response IS NULL").fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;if pending>9007199254740991{return Err("Source pending count overflow".into());}tx.commit().await.map_err(|e|e.to_string())?;Ok(json!({"context":c,"pending":pending,"operations":operations,"nextAfter":next}))
 }
}
