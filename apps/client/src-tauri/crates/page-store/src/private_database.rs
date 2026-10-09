use super::{PageStore,StoreResult,WorkspaceContext};
use super::structured::uuid_v7;
use serde_json::{json,Value};
use sqlx::{Row,Sqlite,Transaction};
use std::collections::HashSet;

pub(super) fn exact(v:&Value,keys:&[&str])->StoreResult<()> {let object=v.as_object().ok_or("Expected database object")?;if object.len()!=keys.len()||keys.iter().any(|k|!object.contains_key(*k)){return Err("Unexpected database fields".into());}Ok(())}
pub(super) fn text<'a>(v:&'a Value,key:&str)->StoreResult<&'a str>{v[key].as_str().ok_or("Expected database text".into())}
pub(super) fn id(v:&str)->StoreResult<()> {if !uuid_v7(v){return Err("Invalid database ID".into());}Ok(())}
pub(super) fn version(v:&Value)->StoreResult<i64>{v.as_i64().filter(|n|(1..=9007199254740991).contains(n)).ok_or("Invalid database version".into())}
fn order(v:&Value)->StoreResult<i64>{let raw=v.as_str().ok_or("Expected database order")?;let n=raw.parse::<i64>().map_err(|_|"Invalid database order")?;if n<1||n.to_string()!=raw{return Err("Invalid database order".into());}Ok(n)}
fn js_space(c:char)->bool{matches!(c,'\u{0009}'..='\u{000d}'|'\u{0020}'|'\u{00a0}'|'\u{1680}'|'\u{2000}'..='\u{200a}'|'\u{2028}'|'\u{2029}'|'\u{202f}'|'\u{205f}'|'\u{3000}'|'\u{feff}')}
pub(super) fn label(v:&Value)->StoreResult<()> {let raw=v.as_str().ok_or("Expected database label")?;if raw.chars().count()>120||raw.chars().all(js_space){return Err("Invalid database label".into());}Ok(())}
pub(super) fn source_snapshot(c:&WorkspaceContext,snapshot:&Value,source_id:&str)->StoreResult<(i64,i64)> {
    id(source_id)?;exact(snapshot,&["source","version","creationOrder"])?;let ver=version(&snapshot["version"])?;let at=order(&snapshot["creationOrder"])?;let source=&snapshot["source"];
    exact(source,&["id","workspaceId","name","schemaVersion","properties"])?;if text(source,"id")?!=source_id||text(source,"workspaceId")?!=c.workspace_id||version(&source["schemaVersion"])? > ver{return Err("Database Source binding mismatch".into());}id(text(source,"workspaceId")?)?;label(&source["name"])?;
    let properties=source["properties"].as_array().ok_or("Expected Source properties")?;if !(1..=64).contains(&properties.len()){return Err("Invalid property count".into());}let mut ids=HashSet::new();let mut names=0;
    for property in properties {let kind=text(property,"type")?;if kind=="select"{exact(property,&["id","name","type","options"])?;}else{exact(property,&["id","name","type"])?;}let property_id=text(property,"id")?;id(property_id)?;if !ids.insert(property_id){return Err("Duplicate property ID".into());}label(&property["name"])?;
        match kind {"name"=>names+=1,"text"|"number"|"checkbox"|"date"=>{},"select"=>{let options=property["options"].as_array().ok_or("Expected select options")?;if options.len()>100{return Err("Too many select options".into());}let mut options_ids=HashSet::new();for option in options {exact(option,&["id","name"])?;let option_id=text(option,"id")?;id(option_id)?;label(&option["name"])?;if !options_ids.insert(option_id){return Err("Duplicate option ID".into());}}},_=>return Err("Unsupported property type".into())}
    }
    if names!=1{return Err("Exactly one Page Name required".into());}Ok((ver,at))
}
fn response(c:&WorkspaceContext,id:&str,value:&Value)->StoreResult<(i64,i64)> {exact(value,&["protocolVersion","workspaceId","workspaceEpoch","clientId","snapshot"])?;if value["protocolVersion"]!=1||value["workspaceId"]!=c.workspace_id||value["workspaceEpoch"]!=c.stream_epoch||value["clientId"]!=c.client_id{return Err("Database response scope mismatch".into());}source_snapshot(c,&value["snapshot"],id)}
#[cfg(feature="crash-test-hooks")]
fn barrier(stage:&str)->StoreResult<()>{super::structured_sync::crash_barrier(stage)}
#[cfg(not(feature="crash-test-hooks"))]
fn barrier(_stage:&str)->StoreResult<()>{Ok(())}
pub(super) async fn initialize(tx:&mut Transaction<'_,Sqlite>,old:i64)->StoreResult<()> {
    if [0,5,6,7,8].contains(&old){for sql in [
        "CREATE TABLE workspace_database_source_history(source_id TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>=1 AND version<=9007199254740991),creation_order INTEGER NOT NULL CHECK(creation_order>=1),snapshot TEXT NOT NULL CHECK(json_valid(snapshot)),response TEXT NOT NULL CHECK(json_valid(response)),PRIMARY KEY(source_id,version)) STRICT",
        "CREATE TABLE workspace_database_sources(source_id TEXT PRIMARY KEY NOT NULL,version INTEGER NOT NULL,creation_order INTEGER NOT NULL UNIQUE CHECK(creation_order>=1),FOREIGN KEY(source_id,version) REFERENCES workspace_database_source_history(source_id,version)) STRICT",
        "PRAGMA user_version=9"
    ]{sqlx::query(sql).execute(&mut **tx).await.map_err(|e|e.to_string())?;}}
    for sql in ["SELECT source_id,version,creation_order,snapshot,response FROM workspace_database_source_history LIMIT 0","SELECT source_id,version,creation_order FROM workspace_database_sources LIMIT 0"]{sqlx::query(sql).execute(&mut **tx).await.map_err(|e|e.to_string())?;}Ok(())
}
// This cache preserves admitted server observations. It is not a queue ACK,
// native Auth grant, body import or completed database synchronization.
impl PageStore {
    pub(super) async fn database_source_receive(&self,c:&WorkspaceContext,source_id:&str,request:Value,reply:Value)->StoreResult<()> {
        exact(&request,&["protocolVersion","clientId"])?;if request["protocolVersion"]!=1||request["clientId"]!=c.client_id{return Err("Database request scope mismatch".into());}let (ver,at)=response(c,source_id,&reply)?;
        let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;
        let current=load(&mut tx,c,source_id).await?;if let Some(current)=&current{if order(&current["creationOrder"])?!=at{return Err("Source creation position changed".into());}}
        let old=sqlx::query("SELECT creation_order,snapshot,response FROM workspace_database_source_history WHERE source_id=? AND version=?").bind(source_id).bind(ver).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
        if let Some(old)=old {let saved:Value=serde_json::from_str(&old.get::<String,_>("snapshot")).map_err(|_|"Corrupt Source history")?;let receipt:Value=serde_json::from_str(&old.get::<String,_>("response")).map_err(|_|"Corrupt Source receipt")?;if response(c,source_id,&receipt)?!=(ver,at)||old.get::<i64,_>("creation_order")!=at||receipt["snapshot"]!=saved||saved!=reply["snapshot"]||receipt!=reply{return Err("Source version reused or history corrupt".into());}}
        else {sqlx::query("INSERT INTO workspace_database_source_history VALUES(?,?,?,?,?)").bind(source_id).bind(ver).bind(at).bind(reply["snapshot"].to_string()).bind(reply.to_string()).execute(&mut *tx).await.map_err(|e|e.to_string())?;}
        if current.as_ref().is_none_or(|snapshot|snapshot["version"].as_i64().unwrap()<ver) {sqlx::query("INSERT INTO workspace_database_sources VALUES(?,?,?) ON CONFLICT(source_id) DO UPDATE SET version=excluded.version").bind(source_id).bind(ver).bind(at).execute(&mut *tx).await.map_err(|e|e.to_string())?;}
        barrier("workspace-database-source-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;barrier("workspace-database-source-after-commit")
    }
    pub(super) async fn database_source_load(&self,c:&WorkspaceContext,source_id:&str)->StoreResult<Value> {id(source_id)?;let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;let snapshot=load(&mut tx,c,source_id).await?;tx.commit().await.map_err(|e|e.to_string())?;Ok(json!({"context":c,"snapshot":snapshot}))}
    pub(super) async fn database_source_list(&self,c:&WorkspaceContext,after:Option<&str>,limit:usize)->StoreResult<Value> {if !(1..=100).contains(&limit){return Err("Invalid Source list limit".into());}if let Some(id_value)=after{id(id_value)?;}let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;let ids:Vec<String>=sqlx::query_scalar("SELECT source_id FROM workspace_database_sources WHERE (? IS NULL OR source_id>?) ORDER BY source_id LIMIT ?").bind(after).bind(after).bind((limit+1) as i64).fetch_all(&mut *tx).await.map_err(|e|e.to_string())?;let more=ids.len()>limit;let mut sources=Vec::new();for source_id in ids {id(&source_id)?;sources.push(load(&mut tx,c,&source_id).await?.ok_or("Missing listed Source")?);}sources.truncate(limit);let next=if more{sources.last().unwrap()["source"]["id"].clone()}else{Value::Null};tx.commit().await.map_err(|e|e.to_string())?;Ok(json!({"context":c,"sources":sources,"nextAfter":next}))}
}
async fn load(tx:&mut Transaction<'_,Sqlite>,c:&WorkspaceContext,source_id:&str)->StoreResult<Option<Value>> {
    let row=sqlx::query("SELECT s.version,s.creation_order,h.snapshot,h.response,h.creation_order AS history_order,(SELECT max(version) FROM workspace_database_source_history WHERE source_id=s.source_id) AS latest_version FROM workspace_database_sources s LEFT JOIN workspace_database_source_history h ON h.source_id=s.source_id AND h.version=s.version WHERE s.source_id=?").bind(source_id).fetch_optional(&mut **tx).await.map_err(|e|e.to_string())?;
    let Some(row)=row else{let exists:Option<i64>=sqlx::query_scalar("SELECT 1 FROM workspace_database_source_history WHERE source_id=? LIMIT 1").bind(source_id).fetch_optional(&mut **tx).await.map_err(|e|e.to_string())?;if exists.is_some(){return Err("Missing Source projection".into());}return Ok(None);};let snapshot:Value=serde_json::from_str(&row.get::<Option<String>,_>("snapshot").ok_or("Missing Source history")?).map_err(|_|"Corrupt Source snapshot")?;let receipt:Value=serde_json::from_str(&row.get::<Option<String>,_>("response").ok_or("Missing Source receipt")?).map_err(|_|"Corrupt Source receipt")?;let (ver,at)=response(c,source_id,&receipt)?;
    if source_snapshot(c,&snapshot,source_id)?!=(ver,at)||receipt["snapshot"]!=snapshot||row.get::<i64,_>("version")!=ver||row.get::<i64,_>("creation_order")!=at||row.get::<Option<i64>,_>("history_order")!=Some(at)||row.get::<Option<i64>,_>("latest_version")!=Some(ver){return Err("Source projection differs from receipt/history".into());}Ok(Some(snapshot))
}
pub(super) async fn source_definition(tx:&mut Transaction<'_,Sqlite>,c:&WorkspaceContext,source_id:&str)->StoreResult<Value>{id(source_id)?;Ok(load(tx,c,source_id).await?.ok_or("Missing stored Source")?["source"].clone())}
