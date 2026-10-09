use super::{PageStore,StoreResult,StoredPage,PageMetadata};
use super::structured::uuid_v7;
use super::structured_sync::timestamp;
#[cfg(feature="crash-test-hooks")]
fn crash_barrier(stage:&str)->StoreResult<()> {super::structured_sync::crash_barrier(stage)}
#[cfg(not(feature="crash-test-hooks"))]
fn crash_barrier(_stage:&str)->StoreResult<()> {Ok(())}
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use sqlx::{Row,Sqlite,Transaction};

const ALPHABET:&[u8;64]=b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
pub(super) fn encode(bytes:&[u8])->String {
    let mut out=String::new();let mut bits=0u32;let mut count=0u8;
    for byte in bytes {bits=(bits<<8)|u32::from(*byte);count+=8;while count>=6 {count-=6;out.push(ALPHABET[((bits>>count)&63) as usize] as char);}}
    if count>0 {out.push(ALPHABET[((bits<<(6-count))&63) as usize] as char);}out
}
pub(super) fn decode(value:&str)->StoreResult<Vec<u8>> {
    if value.is_empty() {return Err("Empty binary".into());}
    let mut bytes=Vec::new();let mut bits=0u32;let mut count=0u8;
    for byte in value.bytes() {let digit=ALPHABET.iter().position(|candidate|*candidate==byte).ok_or("Invalid base64url")?;bits=(bits<<6)|(digit as u32);count+=6;if count>=8 {count-=8;bytes.push(((bits>>count)&255) as u8);}}
    if encode(&bytes)!=value {return Err("Noncanonical base64url".into());}Ok(bytes)
}
fn hex(bytes:&[u8])->String {bytes.iter().map(|b|format!("{b:02x}")).collect()}
fn digest(bytes:&[u8])->Vec<u8> {Sha256::digest(bytes).to_vec()}
fn exact(value:&Value,fields:&[&str])->StoreResult<()> {let object=value.as_object().ok_or("Expected object")?;if object.len()!=fields.len() || fields.iter().any(|field|!object.contains_key(*field)){return Err("Unexpected fields".into());}Ok(())}
fn text<'a>(value:&'a Value,key:&str)->StoreResult<&'a str> {value[key].as_str().ok_or_else(||format!("Missing {key}"))}
fn order(value:&Value,key:&str)->StoreResult<i64> {let raw=text(value,key)?;let number=raw.parse::<i64>().map_err(|_|"Invalid order")?;if number<1 || number.to_string()!=raw{return Err("Invalid order".into());}Ok(number)}
fn validate_id(id:&str)->StoreResult<()> {if !uuid_v7(id){return Err("Invalid private Page ID".into());}Ok(())}
fn input(bytes:&[u8])->StoreResult<()> {if bytes.is_empty() || bytes.len()>512*1024 {return Err("Invalid private Page frame size".into());}Ok(())}
pub(super) fn metadata(value:&Value,id:&str)->StoreResult<PageMetadata> {
    exact(value,&["id","title","yDocId","createdAt","updatedAt"])?;
    let metadata:PageMetadata=serde_json::from_value(value.clone()).map_err(|_|"Invalid Page metadata")?;
    if metadata.id!=id || metadata.y_doc_id!=format!("page:{id}") || metadata.title.encode_utf16().count()>65536 || !timestamp(&metadata.created_at) || !timestamp(&metadata.updated_at){return Err("Invalid Page metadata".into());}Ok(metadata)
}
fn scope(value:&Value,workspace:&str,id:&str)->StoreResult<()> {
    if value["protocolVersion"]!=1 || value["workspaceId"]!=workspace || value["pageId"]!=id || value["documentName"]!=format!("page:{id}") || value["editorSchemaVersion"]!=1 {return Err("Page response binding mismatch".into());}Ok(())
}
fn verify_wire(client:&str,kind:&str,wire:&str,hash:&[u8])->StoreResult<Vec<u8>> {
    let request:Value=serde_json::from_str(wire).map_err(|_|"Invalid prepared wire")?;
    let field=if kind=="bootstrap" {exact(&request,&["protocolVersion","clientId","editorSchemaVersion","title","initialUpdate"])?;if text(&request,"title")?.encode_utf16().count()>65536{return Err("Invalid prepared title".into());}"initialUpdate"}else if kind=="append" {exact(&request,&["protocolVersion","clientId","editorSchemaVersion","update"])?;"update"}else{return Err("Invalid prepared kind".into());};
    if request["protocolVersion"]!=1 || request["editorSchemaVersion"]!=1 || request["clientId"]!=client{return Err("Prepared binding mismatch".into());}
    let bytes=decode(text(&request,field)?)?;input(&bytes)?;if digest(&bytes)!=hash{return Err("Prepared digest mismatch".into());}Ok(bytes)
}
pub(super) async fn initialize(tx:&mut Transaction<'_,Sqlite>,version:i64)->StoreResult<()> {
    if version==0 || version==5 {
        let pages:i64=sqlx::query_scalar("SELECT count(*) FROM pages").fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;
        if pages!=0 {return Err("Unattributed private Page metadata".into());}
        for statement in [
            "CREATE TABLE workspace_page_documents(page_id TEXT PRIMARY KEY NOT NULL REFERENCES pages(id),bootstrap_wire TEXT CHECK(bootstrap_wire IS NULL OR json_valid(bootstrap_wire)),initial_digest BLOB CHECK(initial_digest IS NULL OR length(initial_digest)=32),server_head TEXT) STRICT",
            "CREATE TABLE workspace_page_pending(seq INTEGER PRIMARY KEY AUTOINCREMENT,page_id TEXT NOT NULL REFERENCES workspace_page_documents(page_id),kind TEXT NOT NULL CHECK(kind IN ('bootstrap','append')),digest BLOB NOT NULL CHECK(length(digest)=32),wire TEXT NOT NULL CHECK(json_valid(wire)),UNIQUE(page_id,kind,digest)) STRICT",
            "CREATE TABLE workspace_page_receipts(pending_seq INTEGER PRIMARY KEY REFERENCES workspace_page_pending(seq),response TEXT NOT NULL CHECK(json_valid(response))) STRICT",
        ]{sqlx::query(statement).execute(&mut **tx).await.map_err(|e|e.to_string())?;}
        sqlx::query("PRAGMA user_version=6").execute(&mut **tx).await.map_err(|e|e.to_string())?;
    }
    for statement in ["SELECT page_id,bootstrap_wire,initial_digest,server_head FROM workspace_page_documents LIMIT 0","SELECT seq,page_id,kind,digest,wire FROM workspace_page_pending LIMIT 0","SELECT pending_seq,response FROM workspace_page_receipts LIMIT 0"]{sqlx::query(statement).execute(&mut **tx).await.map_err(|e|e.to_string())?;}
    Ok(())
}
// Creation dependencies are separate from unsent later body frames. A local
// bootstrap needs its original ACK; a received remote Page has a server head.
pub(super) async fn creation_confirmed(tx:&mut Transaction<'_,Sqlite>,c:&super::WorkspaceContext,page_id:&str)->StoreResult<bool>{
 validate_id(page_id)?;let document=sqlx::query("SELECT bootstrap_wire,server_head FROM workspace_page_documents WHERE page_id=?").bind(page_id).fetch_optional(&mut **tx).await.map_err(|e|e.to_string())?;let Some(document)=document else{return Err("Missing local Record Page".into());};
 if let Some(wire)=document.get::<Option<String>,_>("bootstrap_wire") {let row=sqlx::query("SELECT p.digest,p.wire,r.response FROM workspace_page_pending p LEFT JOIN workspace_page_receipts r ON r.pending_seq=p.seq WHERE p.page_id=? AND p.kind='bootstrap'").bind(page_id).fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;let saved:String=row.get("wire");let hash:Vec<u8>=row.get("digest");if saved!=wire{return Err("Record Page bootstrap changed".into());}let bytes=verify_wire(&c.client_id,"bootstrap",&wire,&hash)?;let local:Vec<u8>=sqlx::query_scalar("SELECT update_bytes FROM page_updates WHERE page_id=? AND digest=?").bind(page_id).bind(&hash).fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;if local!=bytes{return Err("Record Page bootstrap binary changed".into());}let Some(raw)=row.get::<Option<String>,_>("response") else{return Ok(false);};let value:Value=serde_json::from_str(&raw).map_err(|_|"Corrupt Record Page bootstrap ACK")?;exact(&value,&["protocolVersion","workspaceId","pageId","documentName","editorSchemaVersion","metadata","initialDigest"])?;scope(&value,&c.workspace_id,page_id)?;let metadata=metadata(&value["metadata"],page_id)?;let created:String=sqlx::query_scalar("SELECT created_at FROM pages WHERE id=?").bind(page_id).fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;if metadata.created_at!=created{return Err("Record Page creation identity changed".into());}if value["initialDigest"]!=hex(&hash){return Err("Record Page bootstrap ACK changed".into());}return Ok(true);}
 if let Some(head)=document.get::<Option<String>,_>("server_head"){let number=head.parse::<i64>().map_err(|_|"Corrupt received Page head")?;if number<1||number.to_string()!=head{return Err("Corrupt received Page head".into());}let count:i64=sqlx::query_scalar("SELECT count(*) FROM page_updates WHERE page_id=?").bind(page_id).fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;if count<1{return Err("Received Page has no binary".into());}return Ok(true);}Ok(false)
}
async fn present(tx:&mut Transaction<'_,Sqlite>,id:&str)->StoreResult<()> {let count:i64=sqlx::query_scalar("SELECT count(*) FROM workspace_page_documents WHERE page_id=?").bind(id).fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;if count!=1{return Err("Private Page missing".into());}Ok(())}
async fn save(tx:&mut Transaction<'_,Sqlite>,id:&str,bytes:&[u8])->StoreResult<bool> {
    let hash=digest(bytes);let previous:Option<Vec<u8>>=sqlx::query_scalar("SELECT update_bytes FROM page_updates WHERE page_id=? AND digest=?").bind(id).bind(&hash).fetch_optional(&mut **tx).await.map_err(|e|e.to_string())?;
    if let Some(previous)=previous {if previous!=bytes {return Err("Private Page digest collision".into());}return Ok(false);}
    sqlx::query("INSERT INTO page_updates(page_id,update_bytes,digest) VALUES(?,?,?)").bind(id).bind(bytes).bind(hash).execute(&mut **tx).await.map_err(|e|e.to_string())?;Ok(true)
}
async fn set_metadata(tx:&mut Transaction<'_,Sqlite>,value:&PageMetadata)->StoreResult<()> {
    sqlx::query("INSERT INTO pages(id,title,y_doc_id,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,updated_at=excluded.updated_at")
        .bind(&value.id).bind(&value.title).bind(&value.y_doc_id).bind(&value.created_at).bind(&value.updated_at).execute(&mut **tx).await.map_err(|e|e.to_string())?;Ok(())
}
async fn advance_head(tx:&mut Transaction<'_,Sqlite>,id:&str,head:i64)->StoreResult<bool> {
    let old:Option<String>=sqlx::query_scalar("SELECT server_head FROM workspace_page_documents WHERE page_id=?").bind(id).fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;
    if let Some(old)=old {let old=old.parse::<i64>().map_err(|_|"Corrupt Page head")?;if old>head{return Ok(false);}}
    sqlx::query("UPDATE workspace_page_documents SET server_head=? WHERE page_id=?").bind(head.to_string()).bind(id).execute(&mut **tx).await.map_err(|e|e.to_string())?;Ok(true)
}
impl PageStore {
    pub(super) async fn private_page_exists(&self,id:&str)->StoreResult<bool> {
        validate_id(id)?;
        let count:i64=sqlx::query_scalar("SELECT count(*) FROM workspace_page_documents WHERE page_id=?").bind(id).fetch_one(&self.pool).await.map_err(|e|e.to_string())?;
        Ok(count==1)
    }
    pub(super) async fn private_page_list(&self,after:Option<&str>,limit:usize)->StoreResult<Value> {
        if !(1..=100).contains(&limit){return Err("Invalid Page list limit".into());}
        if let Some(id)=after{validate_id(id)?;}
        // One read statement keeps metadata and pending counts in one snapshot.
        // Only attributed private documents are listed; no binary or wire leaves
        // this query, and no receipt/queue is consumed by navigation.
        let rows=sqlx::query("SELECT p.id,p.title,p.y_doc_id,p.created_at,p.updated_at,(SELECT count(*) FROM workspace_page_pending q LEFT JOIN workspace_page_receipts r ON r.pending_seq=q.seq WHERE q.page_id=p.id AND r.pending_seq IS NULL) AS pending FROM pages p JOIN workspace_page_documents d ON d.page_id=p.id WHERE (? IS NULL OR p.id>?) ORDER BY p.id LIMIT ?")
            .bind(after).bind(after).bind((limit+1) as i64).fetch_all(&self.pool).await.map_err(|e|e.to_string())?;
        let has_more=rows.len()>limit;let mut pages=Vec::new();
        for row in rows.into_iter().take(limit){
            let page=PageMetadata{id:row.get("id"),title:row.get("title"),y_doc_id:row.get("y_doc_id"),created_at:row.get("created_at"),updated_at:row.get("updated_at")};
            validate_id(&page.id)?;metadata(&serde_json::to_value(&page).unwrap(),&page.id)?;
            let pending:i64=row.get("pending");if !(0..=9007199254740991).contains(&pending){return Err("Invalid Page pending count".into());}
            pages.push(json!({"metadata":page,"pending":pending}));
        }
        let next=if has_more{pages.last().map(|page|page["metadata"]["id"].clone()).unwrap_or(Value::Null)}else{Value::Null};
        Ok(json!({"pages":pages,"nextAfter":next}))
    }
    pub(super) async fn private_page_create(&self,client:&str,id:&str,title:&str,bytes:&[u8])->StoreResult<()> {
        validate_id(id)?;input(bytes)?;if title.encode_utf16().count()>65536{return Err("Invalid Page title".into());}
        let wire=json!({"protocolVersion":1,"clientId":client,"editorSchemaVersion":1,"title":title,"initialUpdate":encode(bytes)}).to_string();let hash=digest(bytes);
        let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;
        let previous:Option<String>=sqlx::query_scalar("SELECT bootstrap_wire FROM workspace_page_documents WHERE page_id=?").bind(id).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?.flatten();
        if let Some(previous)=previous {if previous!=wire{return Err("Page bootstrap changed".into());}tx.commit().await.map_err(|e|e.to_string())?;return Ok(());}
        let count:i64=sqlx::query_scalar("SELECT count(*) FROM pages WHERE id=?").bind(id).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;if count!=0{return Err("Existing Page cannot be adopted".into());}
        sqlx::query("INSERT INTO pages VALUES(?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now'))").bind(id).bind(title).bind(format!("page:{id}")).execute(&mut *tx).await.map_err(|e|e.to_string())?;
        sqlx::query("INSERT INTO workspace_page_documents(page_id,bootstrap_wire,initial_digest) VALUES(?,?,?)").bind(id).bind(&wire).bind(&hash).execute(&mut *tx).await.map_err(|e|e.to_string())?;
        save(&mut tx,id,bytes).await?;
        sqlx::query("INSERT INTO workspace_page_pending(page_id,kind,digest,wire) VALUES(?,'bootstrap',?,?)").bind(id).bind(hash).bind(wire).execute(&mut *tx).await.map_err(|e|e.to_string())?;
        crash_barrier("workspace-page-create-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;crash_barrier("workspace-page-create-after-commit")
    }
    pub(super) async fn private_page_append(&self,client:&str,id:&str,bytes:&[u8])->StoreResult<()> {
        validate_id(id)?;input(bytes)?;let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;present(&mut tx,id).await?;
        if save(&mut tx,id,bytes).await? {
            let wire=json!({"protocolVersion":1,"clientId":client,"editorSchemaVersion":1,"update":encode(bytes)}).to_string();
            sqlx::query("INSERT INTO workspace_page_pending(page_id,kind,digest,wire) VALUES(?,'append',?,?)").bind(id).bind(digest(bytes)).bind(wire).execute(&mut *tx).await.map_err(|e|e.to_string())?;
            sqlx::query("UPDATE pages SET updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(id).execute(&mut *tx).await.map_err(|e|e.to_string())?;
        }
        crash_barrier("workspace-page-append-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;crash_barrier("workspace-page-append-after-commit")
    }
    pub(super) async fn private_page_load(&self,id:&str)->StoreResult<Value> {
        validate_id(id)?;let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;present(&mut tx,id).await?;
        let row=sqlx::query("SELECT id,title,y_doc_id,created_at,updated_at FROM pages WHERE id=?").bind(id).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;
        let page=PageMetadata{id:row.get("id"),title:row.get("title"),y_doc_id:row.get("y_doc_id"),created_at:row.get("created_at"),updated_at:row.get("updated_at")};metadata(&serde_json::to_value(&page).unwrap(),id)?;
        let rows=sqlx::query("SELECT update_bytes,digest FROM page_updates WHERE page_id=? ORDER BY seq").bind(id).fetch_all(&mut *tx).await.map_err(|e|e.to_string())?;let mut updates=Vec::new();for row in rows {let bytes:Vec<u8>=row.get("update_bytes");let hash:Vec<u8>=row.get("digest");if bytes.is_empty() || digest(&bytes)!=hash{return Err("Corrupt private Page binary".into());}updates.push(bytes);}
        if updates.is_empty(){return Err("Missing private Page binary".into());}
        let head:Option<String>=sqlx::query_scalar("SELECT server_head FROM workspace_page_documents WHERE page_id=?").bind(id).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;
        if let Some(head)=&head {let parsed=head.parse::<i64>().map_err(|_|"Corrupt Page head")?;if parsed<1 || parsed.to_string()!=*head{return Err("Corrupt Page head".into());}}
        let pending:i64=sqlx::query_scalar("SELECT count(*) FROM workspace_page_pending p LEFT JOIN workspace_page_receipts r ON r.pending_seq=p.seq WHERE p.page_id=? AND r.pending_seq IS NULL").bind(id).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;
        tx.commit().await.map_err(|e|e.to_string())?;Ok(json!({"page":StoredPage{metadata:page,updates},"serverHead":head,"pending":pending}))
    }
    pub(super) async fn private_page_prepare(&self,client:&str,id:&str)->StoreResult<Value> {
        validate_id(id)?;let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;present(&mut tx,id).await?;
        let row=sqlx::query("SELECT p.seq,p.kind,p.digest,p.wire FROM workspace_page_pending p LEFT JOIN workspace_page_receipts r ON r.pending_seq=p.seq WHERE p.page_id=? AND r.pending_seq IS NULL ORDER BY p.seq LIMIT 1").bind(id).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
        let result=if let Some(row)=row {let hash:Vec<u8>=row.get("digest");let kind:String=row.get("kind");let wire:String=row.get("wire");let bytes=verify_wire(client,&kind,&wire,&hash)?;
            let local:Vec<u8>=sqlx::query_scalar("SELECT update_bytes FROM page_updates WHERE page_id=? AND digest=?").bind(id).bind(&hash).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;if local!=bytes{return Err("Prepared binary missing or changed".into());}
            if kind=="bootstrap" {let original:String=sqlx::query_scalar("SELECT bootstrap_wire FROM workspace_page_documents WHERE page_id=?").bind(id).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;if original!=wire{return Err("Bootstrap wire changed".into());}}
            json!({"sequence":row.get::<i64,_>("seq").to_string(),"pageId":id,"kind":row.get::<String,_>("kind"),"digest":hex(&hash),"wire":row.get::<String,_>("wire")})}else{Value::Null};tx.commit().await.map_err(|e|e.to_string())?;Ok(result)
    }
    pub(super) async fn private_page_ack(&self,client:&str,workspace:&str,id:&str,sequence:&str,wire:&str,response:Value)->StoreResult<()> {
        validate_id(id)?;scope(&response,workspace,id)?;let seq=sequence.parse::<i64>().map_err(|_|"Invalid sequence")?;if seq<1 || seq.to_string()!=sequence{return Err("Invalid sequence".into());}
        let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;present(&mut tx,id).await?;
        let row=sqlx::query("SELECT kind,digest,wire FROM workspace_page_pending WHERE page_id=? AND seq=?").bind(id).bind(seq).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;
        let stored:String=row.get("wire");let kind:String=row.get("kind");let hash:Vec<u8>=row.get("digest");if stored!=wire{return Err("Page ACK wire mismatch".into());}verify_wire(client,&kind,wire,&hash)?;
        let head=if kind=="bootstrap" {
            exact(&response,&["protocolVersion","workspaceId","pageId","documentName","editorSchemaVersion","metadata","initialDigest"])?;
            if response["initialDigest"]!=hex(&hash){return Err("Page bootstrap digest mismatch".into());}let page=metadata(&response["metadata"],id)?;
            let known_created:Option<String>=sqlx::query_scalar("SELECT json_extract(metadata,'$.createdAt') FROM workspace_title_base WHERE page_id=?").bind(id).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
            if known_created.as_ref().is_some_and(|created|*created!=page.created_at){return Err("Page creation identity changed".into());}
            // A bootstrap retry returns current mutable title, not the initial
            // title. Digest still confirms creation; no title replica is applied.
            sqlx::query("UPDATE pages SET created_at=? WHERE id=?").bind(page.created_at).bind(id).execute(&mut *tx).await.map_err(|e|e.to_string())?;None
        }else{
            exact(&response,&["protocolVersion","workspaceId","pageId","documentName","editorSchemaVersion","serverOrder","headOrder","digest","stateVector"])?;
            let appended=order(&response,"serverOrder")?;let head=order(&response,"headOrder")?;if appended>head || response["digest"]!=hex(&hash){return Err("Page ACK digest/order mismatch".into());}decode(text(&response,"stateVector")?)?;Some(head)
        };
        let old:Option<String>=sqlx::query_scalar("SELECT response FROM workspace_page_receipts WHERE pending_seq=?").bind(seq).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;
        if let Some(old)=old {let old:Value=serde_json::from_str(&old).map_err(|_|"Corrupt Page receipt")?;let stable=if kind=="bootstrap" {"initialDigest"}else{"serverOrder"};if old[stable]!=response[stable] || (kind=="bootstrap" && old["metadata"]["createdAt"]!=response["metadata"]["createdAt"]){return Err("Page ACK identity changed".into());}}
        else {let first:Option<i64>=sqlx::query_scalar("SELECT p.seq FROM workspace_page_pending p LEFT JOIN workspace_page_receipts r ON r.pending_seq=p.seq WHERE p.page_id=? AND r.pending_seq IS NULL ORDER BY p.seq LIMIT 1").bind(id).fetch_optional(&mut *tx).await.map_err(|e|e.to_string())?;if first!=Some(seq){return Err("Page ACK skips pending frame".into());}sqlx::query("INSERT INTO workspace_page_receipts VALUES(?,?)").bind(seq).bind(response.to_string()).execute(&mut *tx).await.map_err(|e|e.to_string())?;}
        if let Some(head)=head{advance_head(&mut tx,id,head).await?;}
        if kind=="bootstrap"{super::private_changes::adopt(&mut tx,id).await?;}
        crash_barrier("workspace-page-ack-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;crash_barrier("workspace-page-ack-after-commit")
    }
    pub(super) async fn private_page_receive(&self,workspace:&str,id:&str,response:Value)->StoreResult<()> {
        validate_id(id)?;exact(&response,&["protocolVersion","workspaceId","pageId","documentName","editorSchemaVersion","metadata","headOrder","update","digest","stateVector"])?;scope(&response,workspace,id)?;let page=metadata(&response["metadata"],id)?;let head=order(&response,"headOrder")?;let bytes=decode(text(&response,"update")?)?;if response["digest"]!=hex(&digest(&bytes)){return Err("Page read digest mismatch".into());}decode(text(&response,"stateVector")?)?;
        let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;
        let existing:i64=sqlx::query_scalar("SELECT count(*) FROM workspace_page_documents WHERE page_id=?").bind(id).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;
        if existing==0 {let orphan:i64=sqlx::query_scalar("SELECT count(*) FROM pages WHERE id=?").bind(id).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;if orphan!=0{return Err("Orphan Page cannot be adopted".into());}set_metadata(&mut tx,&page).await?;sqlx::query("INSERT INTO workspace_page_documents(page_id) VALUES(?)").bind(id).execute(&mut *tx).await.map_err(|e|e.to_string())?;}
        let current=advance_head(&mut tx,id,head).await?;save(&mut tx,id,&bytes).await?;
        // Late diffs still add binary information, but cannot regress metadata.
        let pending:i64=sqlx::query_scalar("SELECT count(*) FROM workspace_page_pending p LEFT JOIN workspace_page_receipts r ON r.pending_seq=p.seq WHERE p.page_id=? AND r.pending_seq IS NULL").bind(id).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;
        let managed:i64=sqlx::query_scalar("SELECT (EXISTS(SELECT 1 FROM workspace_title_base WHERE page_id=?))+(EXISTS(SELECT 1 FROM workspace_title_operations WHERE page_id=?))").bind(id).bind(id).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;
        if current && pending==0 && managed==0 {set_metadata(&mut tx,&page).await?;}
        super::private_changes::adopt(&mut tx,id).await?;
        crash_barrier("workspace-page-receive-before-commit")?;tx.commit().await.map_err(|e|e.to_string())?;crash_barrier("workspace-page-receive-after-commit")
    }
}
