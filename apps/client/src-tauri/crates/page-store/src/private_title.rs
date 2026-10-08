use super::{PageStore,StoreResult,WorkspaceContext};
use super::structured::uuid_v7;
use super::private_page::metadata;
use serde::{Deserialize,Serialize};
use serde_json::{json,Value};
use sqlx::{Row,Sqlite,Transaction};
const MAX:i64=9007199254740991;
#[derive(Clone,Debug,PartialEq,Deserialize,Serialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct Resolution {conflict_id:String,choice:String}
#[derive(Clone,Debug,PartialEq,Deserialize,Serialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct Intent {operation_id:String,title:String,#[serde(skip_serializing_if="Option::is_none")]resolution:Option<Resolution>}
fn exact(v:&Value,keys:&[&str])->StoreResult<()> {let o=v.as_object().ok_or("Expected title object")?;if o.len()!=keys.len()||keys.iter().any(|key|!o.contains_key(*key)){return Err("Unexpected title fields".into());}Ok(())}
fn text<'a>(v:&'a Value,key:&str)->StoreResult<&'a str>{v[key].as_str().ok_or("Expected title text".into())}
fn id(v:&str)->StoreResult<()>{if !uuid_v7(v){return Err("Invalid title ID".into());}Ok(())}
fn title(v:&str)->StoreResult<()>{if v.encode_utf16().count()>65536{return Err("Title too large".into());}Ok(())}
fn version(v:&Value,key:&str)->StoreResult<i64>{v[key].as_i64().filter(|n|(0..=MAX).contains(n)).ok_or("Invalid title version".into())}
fn sequence(v:&str)->StoreResult<i64>{let n=v.parse::<i64>().map_err(|_|"Invalid title sequence")?;if n<1||n.to_string()!=v{return Err("Invalid title sequence".into());}Ok(n)}
fn intent(v:Value)->StoreResult<Intent>{if v.get("resolution").is_some(){exact(&v,&["operationId","title","resolution"])?;if v["resolution"].is_null(){return Err("Invalid null resolution".into());}}else{exact(&v,&["operationId","title"])?;}let i:Intent=serde_json::from_value(v).map_err(|_|"Invalid title intent")?;id(&i.operation_id)?;title(&i.title)?;if let Some(r)=&i.resolution{id(&r.conflict_id)?;if !["local","remote"].contains(&r.choice.as_str()){return Err("Invalid title choice".into());}}Ok(i)}
fn conflict(v:&Value)->StoreResult<()> {
    exact(v,&["id","operationId","baseVersion","remoteVersion","base","local","remote"])?;id(text(v,"id")?)?;id(text(v,"operationId")?)?;
    if version(v,"baseVersion")?>=version(v,"remoteVersion")?{return Err("Invalid conflict versions".into());}
    for key in ["base","local","remote"]{title(text(v,key)?)?;}
    if v["base"]==v["remote"]||v["local"]==v["base"]||v["local"]==v["remote"]{return Err("Invalid conflict candidates".into());}Ok(())
}
fn scope(v:&Value,c:&WorkspaceContext,page:&str)->StoreResult<()> {
    if v["protocolVersion"]!=1||v["workspaceId"]!=c.workspace_id||v["workspaceEpoch"]!=c.stream_epoch||v["pageId"]!=page{return Err("Title response binding mismatch".into());}
    metadata(&v["metadata"],page)?;version(v,"version")?;Ok(())
}
fn receipt(v:&Value,c:&WorkspaceContext,page:&str)->StoreResult<()> {
    exact(v,&["protocolVersion","workspaceId","workspaceEpoch","pageId","metadata","version","operationId","result"])?;scope(v,c,page)?;id(text(v,"operationId")?)?;
    let result=&v["result"];match text(result,"status")? {
        "applied"=>exact(result,&["status"]),
        "conflict"=>{exact(result,&["status","conflict"])?;let cf=&result["conflict"];conflict(cf)?;if cf["operationId"]!=v["operationId"]||cf["remoteVersion"]!=v["version"]||cf["remote"]!=v["metadata"]["title"]{return Err("Conflict receipt mismatch".into());}Ok(())},
        "rejected"=>{exact(result,&["status","code"])?;if !["base_unknown","resolution_invalid","resolution_stale"].contains(&text(result,"code")?){return Err("Invalid rejection".into());}Ok(())},
        _=>Err("Invalid title result".into())
    }
}
#[cfg(feature="crash-test-hooks")]
fn barrier(stage:&str)->StoreResult<()>{super::structured_sync::crash_barrier(stage)}
#[cfg(not(feature="crash-test-hooks"))]
fn barrier(_stage:&str)->StoreResult<()>{Ok(())}
pub(super) async fn initialize(tx:&mut Transaction<'_,Sqlite>,old:i64)->StoreResult<()> {
    if [0,5,6].contains(&old){for sql in [
        "CREATE TABLE workspace_title_base(page_id TEXT PRIMARY KEY NOT NULL REFERENCES workspace_page_documents(page_id),version INTEGER NOT NULL CHECK(version BETWEEN 0 AND 9007199254740991),metadata TEXT NOT NULL CHECK(json_valid(metadata))) STRICT",
        "CREATE TABLE workspace_title_operations(seq INTEGER PRIMARY KEY AUTOINCREMENT,operation_id TEXT NOT NULL UNIQUE,page_id TEXT NOT NULL REFERENCES workspace_page_documents(page_id),intent TEXT NOT NULL CHECK(json_valid(intent)),base_version INTEGER NOT NULL CHECK(base_version BETWEEN 0 AND 9007199254740991),base_title TEXT NOT NULL,predecessor TEXT REFERENCES workspace_title_operations(operation_id),wire TEXT CHECK(wire IS NULL OR json_valid(wire))) STRICT",
        "CREATE TABLE workspace_title_receipts(operation_id TEXT PRIMARY KEY NOT NULL REFERENCES workspace_title_operations(operation_id),response TEXT NOT NULL CHECK(json_valid(response))) STRICT",
        "CREATE TABLE workspace_title_conflicts(page_id TEXT NOT NULL REFERENCES workspace_page_documents(page_id),id TEXT NOT NULL,record TEXT NOT NULL CHECK(json_valid(record)),resolved_by TEXT REFERENCES workspace_title_operations(operation_id),PRIMARY KEY(page_id,id)) STRICT",
        "CREATE INDEX workspace_title_page ON workspace_title_operations(page_id,seq)",
        "PRAGMA user_version=7"
    ]{sqlx::query(sql).execute(&mut **tx).await.map_err(|e|e.to_string())?;}}
    for sql in ["SELECT page_id,version,metadata FROM workspace_title_base LIMIT 0","SELECT seq,operation_id,page_id,intent,base_version,base_title,predecessor,wire FROM workspace_title_operations LIMIT 0","SELECT operation_id,response FROM workspace_title_receipts LIMIT 0","SELECT page_id,id,record,resolved_by FROM workspace_title_conflicts LIMIT 0"]{sqlx::query(sql).execute(&mut **tx).await.map_err(|e|e.to_string())?;}Ok(())
}
async fn present(tx:&mut Transaction<'_,Sqlite>,page:&str)->StoreResult<()> {id(page)?;let n:i64=sqlx::query_scalar("SELECT count(*) FROM workspace_page_documents WHERE page_id=?").bind(page).fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;if n!=1{return Err("Title Page missing".into());}Ok(())}
async fn base(tx:&mut Transaction<'_,Sqlite>,page:&str)->StoreResult<Value> {
    let row=sqlx::query("SELECT version,metadata FROM workspace_title_base WHERE page_id=?").bind(page).fetch_optional(&mut **tx).await.map_err(|e|e.to_string())?;
    if let Some(row)=row{let meta:Value=serde_json::from_str(&row.get::<String,_>("metadata")).map_err(|_|"Corrupt title base")?;metadata(&meta,page)?;let value=json!({"version":row.get::<i64,_>("version"),"metadata":meta});version(&value,"version")?;Ok(value)}else{let retained=sqlx::query("SELECT 1 FROM workspace_title_operations WHERE page_id=? UNION ALL SELECT 1 FROM workspace_title_conflicts WHERE page_id=? LIMIT 1").bind(page).bind(page).fetch_optional(&mut **tx).await.map_err(|e|e.to_string())?;if retained.is_some(){return Err("Missing retained title base".into());}Ok(Value::Null)}
}
async fn project(tx:&mut Transaction<'_,Sqlite>,page:&str)->StoreResult<()> {
    let local:Option<String>=sqlx::query_scalar("SELECT json_extract(o.intent,'$.title') FROM workspace_title_operations o LEFT JOIN workspace_title_receipts r ON r.operation_id=o.operation_id WHERE o.page_id=? AND r.operation_id IS NULL ORDER BY o.seq DESC LIMIT 1").bind(page).fetch_optional(&mut **tx).await.map_err(|e|e.to_string())?;
    let known=base(tx,page).await?;let value=local.or_else(||known["metadata"]["title"].as_str().map(String::from));
    if let Some(value)=value{title(&value)?;sqlx::query("UPDATE pages SET title=? WHERE id=?").bind(value).bind(page).execute(&mut **tx).await.map_err(|e|e.to_string())?;}Ok(())
}
async fn apply_base(tx:&mut Transaction<'_,Sqlite>,page:&str,v:&Value)->StoreResult<()> {
    let incoming=version(v,"version")?;let old=base(tx,page).await?;
    if !old.is_null(){let previous=version(&old,"version")?;if incoming<previous{return Ok(());}if v["metadata"]["createdAt"]!=old["metadata"]["createdAt"]||(incoming==previous&&v["metadata"]["title"]!=old["metadata"]["title"]){return Err("Title base identity changed".into());}}
    let mut meta=v["metadata"].clone();if !old.is_null()&&text(&old["metadata"],"updatedAt")?>text(&meta,"updatedAt")?{meta["updatedAt"]=old["metadata"]["updatedAt"].clone();}
    sqlx::query("INSERT INTO workspace_title_base VALUES(?,?,?) ON CONFLICT(page_id) DO UPDATE SET version=excluded.version,metadata=excluded.metadata").bind(page).bind(incoming).bind(meta.to_string()).execute(&mut **tx).await.map_err(|e|e.to_string())?;
    sqlx::query("UPDATE pages SET created_at=?,updated_at=CASE WHEN updated_at<? THEN ? ELSE updated_at END WHERE id=?").bind(text(&meta,"createdAt")?).bind(text(&meta,"updatedAt")?).bind(text(&meta,"updatedAt")?).bind(page).execute(&mut **tx).await.map_err(|e|e.to_string())?;Ok(())
}
async fn save_conflict(tx:&mut Transaction<'_,Sqlite>,page:&str,v:&Value)->StoreResult<()> {
    conflict(v)?;let key=text(v,"id")?;let old:Option<String>=sqlx::query_scalar("SELECT record FROM workspace_title_conflicts WHERE page_id=? AND id=?").bind(page).bind(key).fetch_optional(&mut **tx).await.map_err(|e|e.to_string())?;
    if let Some(old)=old{if serde_json::from_str::<Value>(&old).map_err(|_|"Corrupt title conflict")?!=*v{return Err("Immutable title conflict changed".into());}}else{sqlx::query("INSERT INTO workspace_title_conflicts(page_id,id,record) VALUES(?,?,?)").bind(page).bind(key).bind(v.to_string()).execute(&mut **tx).await.map_err(|e|e.to_string())?;}Ok(())
}
async fn effective(tx:&mut Transaction<'_,Sqlite>,c:&WorkspaceContext,row:&sqlx::sqlite::SqliteRow)->StoreResult<(Intent,i64,String,String)> {
    let page:String=row.get("page_id");let stored_id:String=row.get("operation_id");let i=intent(serde_json::from_str(&row.get::<String,_>("intent")).map_err(|_|"Corrupt title intent")?)?;if i.operation_id!=stored_id{return Err("Title intent ID changed".into());}
    let mut ver:i64=row.get("base_version");let mut original:String=row.get("base_title");if !(0..=MAX).contains(&ver){return Err("Corrupt intent base".into());}title(&original)?;
    if let Some(previous)=row.get::<Option<String>,_>("predecessor") {
        id(&previous)?;let prior=sqlx::query("SELECT o.page_id,o.seq,o.intent,r.response FROM workspace_title_operations o JOIN workspace_title_receipts r ON r.operation_id=o.operation_id WHERE o.operation_id=?").bind(previous).fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;
        if prior.get::<String,_>("page_id")!=page||prior.get::<i64,_>("seq")>=row.get::<i64,_>("seq"){return Err("Invalid title predecessor".into());}
        let prior_intent=intent(serde_json::from_str(&prior.get::<String,_>("intent")).map_err(|_|"Corrupt predecessor")?)?;let reply:Value=serde_json::from_str(&prior.get::<String,_>("response")).map_err(|_|"Corrupt predecessor receipt")?;receipt(&reply,c,&page)?;
        if reply["operationId"]!=prior_intent.operation_id{return Err("Predecessor receipt mismatch".into());}
        if reply["result"]["status"]=="applied"&&reply["metadata"]["title"]==prior_intent.title{ver=version(&reply,"version")?;original=prior_intent.title;}
    }
    let mut request=json!({"protocolVersion":1,"clientId":c.client_id,"operationId":i.operation_id,"baseVersion":ver,"title":i.title});if let Some(resolution)=&i.resolution{request["resolution"]=serde_json::to_value(resolution).unwrap();}let wire=request.to_string();
    if row.get::<Option<String>,_>("wire").as_ref().is_some_and(|old|*old!=wire){return Err("Immutable title wire changed".into());}Ok((i,ver,original,wire))
}
impl PageStore {
    pub(super) async fn title_enqueue(&self,_c:&WorkspaceContext,page:&str,value:Value)->StoreResult<()> {
        let i=intent(value)?;let raw=serde_json::to_string(&i).unwrap();let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;present(&mut tx,page).await?;
        let old=sqlx::query("SELECT page_id,intent FROM workspace_title_operations WHERE operation_id=?").bind(&i.operation_id).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
        if let Some(old)=old{if old.get::<String,_>("page_id")!=page||old.get::<String,_>("intent")!=raw{return Err("Title operation ID reused".into());}return Ok(());}
        let known=base(&mut tx,page).await?;if known.is_null(){return Err("Versioned title base required".into());}
        let bootstrap:i64=sqlx::query_scalar("SELECT count(*) FROM workspace_page_pending p LEFT JOIN workspace_page_receipts r ON r.pending_seq=p.seq WHERE p.page_id=? AND p.kind='bootstrap' AND r.pending_seq IS NULL").bind(page).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;if bootstrap!=0{return Err("Page bootstrap receipt required".into());}
        if let Some(r)=&i.resolution{let cf=sqlx::query("SELECT record,resolved_by FROM workspace_title_conflicts WHERE page_id=? AND id=?").bind(page).bind(&r.conflict_id).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;let record:Value=serde_json::from_str(&cf.get::<String,_>("record")).map_err(|_|"Corrupt resolution conflict")?;conflict(&record)?;if record["id"]!=r.conflict_id||cf.get::<Option<String>,_>("resolved_by").is_some()||record[&r.choice]!=i.title{return Err("Resolution candidate mismatch".into());}}
        let predecessor=sqlx::query("SELECT o.operation_id,o.base_version,o.base_title FROM workspace_title_operations o LEFT JOIN workspace_title_receipts r ON r.operation_id=o.operation_id WHERE o.page_id=? AND r.operation_id IS NULL ORDER BY o.seq DESC LIMIT 1").bind(page).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
        // While a local projection is pending, new edits descend from that
        // intent's observed base. A background query must not silently rebase
        // the edit onto remote text the user has not accepted.
        if predecessor.is_some()&&i.resolution.is_some(){return Err("Resolution requires a settled title queue".into());}
        let (captured_version,captured_title,prior)=if let Some(row)=predecessor{let key:String=row.get("operation_id");id(&key)?;let ver:i64=row.get("base_version");if !(0..=MAX).contains(&ver){return Err("Corrupt title predecessor base".into());}let value:String=row.get("base_title");title(&value)?;(ver,value,Some(key))}else{(version(&known,"version")?,text(&known["metadata"],"title")?.to_string(),None)};
        sqlx::query("INSERT INTO workspace_title_operations(operation_id,page_id,intent,base_version,base_title,predecessor) VALUES(?,?,?,?,?,?)").bind(&i.operation_id).bind(page).bind(raw).bind(captured_version).bind(captured_title).bind(prior).execute(&mut *tx).await.map_err(|e|e.to_string())?;
        project(&mut tx,page).await?;sqlx::query("UPDATE pages SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(page).execute(&mut *tx).await.map_err(|e|e.to_string())?;
        barrier("workspace-title-enqueue-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;barrier("workspace-title-enqueue-after-commit")
    }
    pub(super) async fn title_prepare(&self,c:&WorkspaceContext,page:&str)->StoreResult<Value> {
        let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;present(&mut tx,page).await?;base(&mut tx,page).await?;
        let row=sqlx::query("SELECT o.* FROM workspace_title_operations o LEFT JOIN workspace_title_receipts r ON r.operation_id=o.operation_id WHERE o.page_id=? AND r.operation_id IS NULL ORDER BY o.seq LIMIT 1").bind(page).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
        let prepared=if let Some(row)=row{let (i,_,_,wire)=effective(&mut tx,c,&row).await?;sqlx::query("UPDATE workspace_title_operations SET wire=? WHERE operation_id=? AND wire IS NULL").bind(&wire).bind(&i.operation_id).execute(&mut *tx).await.map_err(|e|e.to_string())?;json!({"pageId":page,"sequence":row.get::<i64,_>("seq").to_string(),"operationId":i.operation_id,"wire":wire})}else{Value::Null};
        barrier("workspace-title-prepare-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;barrier("workspace-title-prepare-after-commit")?;Ok(prepared)
    }
    pub(super) async fn title_ack(&self,c:&WorkspaceContext,page:&str,seq:&str,wire:&str,response:Value)->StoreResult<()> {
        id(page)?;receipt(&response,c,page)?;let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;present(&mut tx,page).await?;
        let row=sqlx::query("SELECT * FROM workspace_title_operations WHERE page_id=? AND seq=?").bind(page).bind(sequence(seq)?).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;
        if row.get::<Option<String>,_>("wire").as_deref()!=Some(wire){return Err("Title ACK wire mismatch".into());}let (i,ver,original,expected)=effective(&mut tx,c,&row).await?;if expected!=wire||response["operationId"]!=i.operation_id{return Err("Title ACK identity mismatch".into());}
        let result=&response["result"];match text(result,"status")? {
            "applied"=>{if version(&response,"version")?<ver||(i.title!=original&&response["metadata"]["title"]!=i.title){return Err("Applied title mismatch".into());}},
            "conflict"=>{let cf=&result["conflict"];if i.resolution.is_some()||cf["baseVersion"]!=ver||cf["base"]!=original||cf["local"]!=i.title{return Err("Title conflict intent mismatch".into());}},
            "rejected"=>{if text(result,"code")?!= "base_unknown"&&i.resolution.is_none(){return Err("Resolution rejection without intent".into());}},_=>unreachable!()
        }
        let old:Option<String>=sqlx::query_scalar("SELECT response FROM workspace_title_receipts WHERE operation_id=?").bind(&i.operation_id).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
        if let Some(old)=old{if serde_json::from_str::<Value>(&old).map_err(|_|"Corrupt title receipt")?!=response{return Err("Immutable title receipt changed".into());}return Ok(());}
        let first:i64=sqlx::query_scalar("SELECT o.seq FROM workspace_title_operations o LEFT JOIN workspace_title_receipts r ON r.operation_id=o.operation_id WHERE o.page_id=? AND r.operation_id IS NULL ORDER BY o.seq LIMIT 1").bind(page).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;if first!=sequence(seq)?{return Err("Title ACK skips pending intent".into());}
        sqlx::query("INSERT INTO workspace_title_receipts VALUES(?,?)").bind(&i.operation_id).bind(response.to_string()).execute(&mut *tx).await.map_err(|e|e.to_string())?;
        if result["status"]=="conflict"{save_conflict(&mut tx,page,&result["conflict"]).await?;}
        if result["status"]=="applied"{if let Some(r)=&i.resolution{sqlx::query("UPDATE workspace_title_conflicts SET resolved_by=? WHERE page_id=? AND id=? AND resolved_by IS NULL").bind(&i.operation_id).bind(page).bind(&r.conflict_id).execute(&mut *tx).await.map_err(|e|e.to_string())?;}}
        apply_base(&mut tx,page,&response).await?;project(&mut tx,page).await?;
        barrier("workspace-title-ack-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;barrier("workspace-title-ack-after-commit")
    }
    pub(super) async fn title_receive(&self,c:&WorkspaceContext,page:&str,request:Value,response:Value)->StoreResult<()> {
        exact(&request,&["protocolVersion","clientId","afterConflict","limit"])?;if request["protocolVersion"]!=1||request["clientId"]!=c.client_id{return Err("Title query request mismatch".into());}
        let after=if request["afterConflict"].is_null(){None}else{let s=text(&request,"afterConflict")?;id(s)?;Some(s)};let limit=request["limit"].as_u64().filter(|n|(1..=100).contains(n)).ok_or("Title query limit")? as usize;
        exact(&response,&["protocolVersion","workspaceId","workspaceEpoch","pageId","metadata","version","conflicts","nextAfter"])?;scope(&response,c,page)?;
        let list=response["conflicts"].as_array().filter(|list|list.len()<=limit).ok_or("Title query conflicts")?;let mut previous=after;
        for cf in list{conflict(cf)?;let key=text(cf,"id")?;if previous.is_some_and(|old|key<=old)||version(cf,"remoteVersion")?>version(&response,"version")?{return Err("Title query progress mismatch".into());}previous=Some(key);}
        if !response["nextAfter"].is_null()&&(list.is_empty()||response["nextAfter"]!=list.last().unwrap()["id"]){return Err("Title query next key mismatch".into());}
        let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;present(&mut tx,page).await?;apply_base(&mut tx,page,&response).await?;for cf in list{save_conflict(&mut tx,page,cf).await?;}project(&mut tx,page).await?;
        barrier("workspace-title-receive-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;barrier("workspace-title-receive-after-commit")
    }
    pub(super) async fn title_load(&self,c:&WorkspaceContext,page:&str,after_operation:Option<&str>,after_conflict:Option<&str>,limit:usize)->StoreResult<Value> {
        if !(1..=100).contains(&limit){return Err("Title load limit".into());}let after=after_operation.map(sequence).transpose()?.unwrap_or(0);if let Some(key)=after_conflict{id(key)?;}
        let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;present(&mut tx,page).await?;let known=base(&mut tx,page).await?;
        let pending:i64=sqlx::query_scalar("SELECT count(*) FROM workspace_title_operations o LEFT JOIN workspace_title_receipts r ON r.operation_id=o.operation_id WHERE o.page_id=? AND r.operation_id IS NULL").bind(page).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;
        if !(0..=MAX).contains(&pending){return Err("Title pending count".into());}
        let local_row=sqlx::query("SELECT id,title,y_doc_id,created_at,updated_at FROM pages WHERE id=?").bind(page).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;
        let local=metadata(&json!({"id":local_row.get::<String,_>("id"),"title":local_row.get::<String,_>("title"),"yDocId":local_row.get::<String,_>("y_doc_id"),"createdAt":local_row.get::<String,_>("created_at"),"updatedAt":local_row.get::<String,_>("updated_at")}),page)?.title;
        let latest:Option<String>=sqlx::query_scalar("SELECT o.intent FROM workspace_title_operations o LEFT JOIN workspace_title_receipts r ON r.operation_id=o.operation_id WHERE o.page_id=? AND r.operation_id IS NULL ORDER BY o.seq DESC LIMIT 1").bind(page).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
        let expected=if let Some(latest)=latest{if known.is_null(){return Err("Pending title without base".into());}Some(intent(serde_json::from_str(&latest).map_err(|_|"Corrupt projected intent")?)?.title)}else{known["metadata"]["title"].as_str().map(String::from)};
        if expected.as_ref().is_some_and(|value|*value!=local){return Err("Title projection mismatch".into());}
        let rows=sqlx::query("SELECT o.*,r.response FROM workspace_title_operations o LEFT JOIN workspace_title_receipts r ON r.operation_id=o.operation_id WHERE o.page_id=? AND o.seq>? ORDER BY o.seq LIMIT ?").bind(page).bind(after).bind((limit+1) as i64).fetch_all(&mut *tx).await.map_err(|e|e.to_string())?;
        let more=rows.len()>limit;let mut operations=Vec::new();
        for row in rows{let i=intent(serde_json::from_str(&row.get::<String,_>("intent")).map_err(|_|"Corrupt title intent")?)?;if i.operation_id!=row.get::<String,_>("operation_id"){return Err("Title load identity mismatch".into());}if row.get::<i64,_>("seq")<1{return Err("Invalid stored title sequence".into());}if let Some(key)=row.get::<Option<String>,_>("predecessor"){id(&key)?;let prior=sqlx::query("SELECT page_id,seq FROM workspace_title_operations WHERE operation_id=?").bind(key).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;if prior.get::<String,_>("page_id")!=page||prior.get::<i64,_>("seq")>=row.get::<i64,_>("seq"){return Err("Invalid stored title predecessor".into());}}
            if row.get::<Option<String>,_>("wire").is_some(){effective(&mut tx,c,&row).await?;}
            let reply=row.get::<Option<String>,_>("response").map(|raw|serde_json::from_str::<Value>(&raw).map_err(|_|"Corrupt title receipt".to_string())).transpose()?;if let Some(reply)=&reply{if row.get::<Option<String>,_>("wire").is_none(){return Err("Title receipt without prepared wire".into());}receipt(reply,c,page)?;if reply["operationId"]!=i.operation_id{return Err("Title load receipt mismatch".into());}}
            let value=json!({"sequence":row.get::<i64,_>("seq").to_string(),"intent":i,"baseVersion":row.get::<i64,_>("base_version"),"baseTitle":row.get::<String,_>("base_title"),"predecessor":row.get::<Option<String>,_>("predecessor"),"wire":row.get::<Option<String>,_>("wire"),"response":reply});version(&value,"baseVersion")?;title(text(&value,"baseTitle")?)?;if operations.len()<limit{operations.push(value);}}
        let next_operation=if more{operations.last().unwrap()["sequence"].clone()}else{Value::Null};
        let rows=sqlx::query("SELECT id,record,resolved_by FROM workspace_title_conflicts WHERE page_id=? AND (? IS NULL OR id>?) ORDER BY id LIMIT ?").bind(page).bind(after_conflict).bind(after_conflict).bind((limit+1) as i64).fetch_all(&mut *tx).await.map_err(|e|e.to_string())?;let more=rows.len()>limit;let mut conflicts=Vec::new();for row in rows{let cf:Value=serde_json::from_str(&row.get::<String,_>("record")).map_err(|_|"Corrupt title conflict")?;conflict(&cf)?;if cf["id"]!=row.get::<String,_>("id"){return Err("Title conflict key mismatch".into());}let resolved:Option<String>=row.get("resolved_by");if let Some(key)=&resolved{id(key)?;}if conflicts.len()<limit{conflicts.push(json!({"record":cf,"resolvedBy":resolved}));}}
        let next_conflict=if more{conflicts.last().unwrap()["record"]["id"].clone()}else{Value::Null};tx.commit().await.map_err(|e|e.to_string())?;
        Ok(json!({"context":c,"pageId":page,"base":known,"localTitle":local,"pending":pending,"operations":operations,"nextOperation":next_operation,"conflicts":conflicts,"nextConflict":next_conflict}))
    }
}
