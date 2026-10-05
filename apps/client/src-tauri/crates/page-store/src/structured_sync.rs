use super::{PageStore, StoreResult};
use super::structured::{LocalOperation, validate, uuid_v7, date_only};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{Row, Sqlite, Transaction};

#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
pub struct PullBatch {
    pub operations: Vec<Value>,
    pub cursor: String,
    pub head_cursor: String,
    pub has_more: bool,
    pub server_time: String,
}
pub(super) async fn validate_schema(tx: &mut Transaction<'_,Sqlite>) -> StoreResult<()> {
    for statement in [
        "SELECT local_result,local_error,resolution FROM sync_operations LIMIT 0",
        "SELECT head_cursor,last_server_order FROM sync_state LIMIT 0",
        "SELECT entity_type,entity_id,server_order,entity FROM structured_server_entities LIMIT 0",
        "SELECT operation_id,server_order,result FROM structured_received LIMIT 0",
        "SELECT id,server_order,record FROM structured_conflicts LIMIT 0",
    ] { sqlx::query(statement).execute(&mut **tx).await.map_err(|e|e.to_string())?; }
    Ok(())
}
fn text<'a>(value: &'a Value,key: &str) -> StoreResult<&'a str> {
    value[key].as_str().ok_or_else(||format!("Missing string field: {key}"))
}
fn timestamp(value: &str) -> bool {
    if value.len()!=24 || !value.is_ascii() || !date_only(&value[..10]) { return false; }
    let b=value.as_bytes();
    b[10]==b'T' && b[13]==b':' && b[16]==b':' && b[19]==b'.' && b[23]==b'Z' &&
        [11,12,14,15,17,18,20,21,22].iter().all(|i|b[*i].is_ascii_digit()) &&
        value[11..13].parse::<u8>().unwrap()<24 && value[14..16].parse::<u8>().unwrap()<60 && value[17..19].parse::<u8>().unwrap()<60
}
fn exact_fields(value:&Value,fields:&[&str]) -> StoreResult<()> {
    let object=value.as_object().ok_or("Expected an object")?;
    if object.len()!=fields.len() || fields.iter().any(|key|!object.contains_key(*key)) { return Err("Unexpected response fields".into()); }
    Ok(())
}
fn validate_entity(entity:&Value,kind:&str,client:&str) -> StoreResult<()> {
    let fields=if kind=="task" {vec!["title","status","due"]} else {vec!["fromType","fromId","toType","toId"]};
    let mut keys=vec!["id","version","createdAt","updatedAt","deletedAt"]; keys.extend(&fields);
    exact_fields(entity,&keys)?;
    let id=text(entity,"id")?;
    if !uuid_v7(id) || !entity["version"].as_i64().is_some_and(|v|(1..=9_007_199_254_740_991).contains(&v)) ||
        !timestamp(text(entity,"createdAt")?) || !timestamp(text(entity,"updatedAt")?) ||
        !(entity["deletedAt"].is_null() || entity["deletedAt"].as_str().is_some_and(timestamp)) { return Err("Invalid server entity metadata".into()); }
    let payload=fields.into_iter().map(|field|(field.to_string(),entity[field].clone())).collect::<serde_json::Map<_,_>>();
    let operation=LocalOperation {operation_id:id.into(),entity_id:id.into(),entity_type:kind.into(),kind:"create".into(),base_version:None,payload:Value::Object(payload),client_id:client.into(),resolution:None};
    validate(&operation)?;
    Ok(())
}
pub(super) fn validate_result(value:&Value) -> StoreResult<i64> {
    let status=text(value,"status")?;
    let mut keys=vec!["operationId","clientId","entityType","entityId","serverOrder","conflicts","status","entity"];
    if status=="rejected" {keys.push("error");}
    exact_fields(value,&keys)?;
    let kind=text(value,"entityType")?;
    if !["task","relation"].contains(&kind) || !["acknowledged","conflict","rejected"].contains(&status) ||
        ["operationId","clientId","entityId"].iter().any(|key|!value[*key].as_str().is_some_and(uuid_v7)) {return Err("Invalid structured result identity".into());}
    let raw_order=text(value,"serverOrder")?;
    let order=raw_order.parse::<i64>().map_err(|_|"Invalid server order")?;
    if order<=0 || order.to_string()!=raw_order {return Err("Invalid server order".into());}
    if !value["entity"].is_null() {
        validate_entity(&value["entity"],kind,text(value,"clientId")?)?;
        if value["entity"]["id"]!=value["entityId"] {return Err("Server entity identity mismatch".into());}
    } else if status!="rejected" {return Err("Acknowledged entity is missing".into());}
    if status=="rejected" {
        exact_fields(&value["error"],&["code","message","retryable"])?;
        if text(&value["error"],"code")?.is_empty() || text(&value["error"],"message")?.is_empty() || value["error"]["retryable"]!=false {return Err("Invalid permanent error".into());}
    }
    let conflicts=value["conflicts"].as_array().ok_or("Conflict list is missing")?;
    let mut open=false;
    for record in conflicts {
        exact_fields(record,&["id","operationId","entityType","entityId","field","base","local","remote","createdAt","status","resolvedBy"])?;
        let field=text(record,"field")?;
        if !uuid_v7(text(record,"id")?) || !uuid_v7(text(record,"operationId")?) || record["entityType"]!=value["entityType"] || record["entityId"]!=value["entityId"] ||
            !timestamp(text(record,"createdAt")?) {return Err("Invalid Conflict identity".into());}
        for key in ["base","local","remote"] {
            let mut payload=serde_json::Map::new(); payload.insert(field.into(),record[key].clone());
            let operation=LocalOperation {operation_id:text(record,"id")?.into(),entity_id:text(value,"entityId")?.into(),entity_type:kind.into(),kind:"update".into(),base_version:Some(1),payload:Value::Object(payload),client_id:text(value,"clientId")?.into(),resolution:None};
            validate(&operation)?;
        }
        match text(record,"status")? {
            "open" if record["resolvedBy"].is_null() => {open=true;},
            "resolved" if record["resolvedBy"].as_str().is_some_and(uuid_v7) => {},
            _ => return Err("Invalid Conflict resolution state".into()),
        }
    }
    if (status=="conflict")!=open {return Err("Conflict result state mismatch".into());}
    Ok(order)
}
fn decode(raw:String) -> StoreResult<Value> {serde_json::from_str(&raw).map_err(|e|e.to_string())}
async fn project(tx:&mut Transaction<'_,Sqlite>,kind:&str,id:&str) -> StoreResult<()> {
    let table=if kind=="task" {"tasks"} else {"relations"};
    let projection=if kind=="task" {"json_object('id',id,'title',title,'status',status,'due',due,'version',version,'createdAt',created_at,'updatedAt',updated_at,'deletedAt',deleted_at)"} else {"json_object('id',id,'fromType',from_type,'fromId',from_id,'toType',to_type,'toId',to_id,'version',version,'createdAt',created_at,'updatedAt',updated_at,'deletedAt',deleted_at)"};
    let remote:Option<String>=sqlx::query_scalar("SELECT entity FROM structured_server_entities WHERE entity_type=? AND entity_id=?").bind(kind).bind(id).fetch_optional(&mut **tx).await.map_err(|e|e.to_string())?;
    let local:Option<String>=sqlx::query_scalar(&format!("SELECT {projection} FROM {table} WHERE id=?")).bind(id).fetch_optional(&mut **tx).await.map_err(|e|e.to_string())?;
    let mut entity=remote.or(local).map(decode).transpose()?;
    let rows=sqlx::query("SELECT kind,payload,base_entity,created_at FROM sync_operations WHERE entity_type=? AND entity_id=? AND status='pending' ORDER BY seq").bind(kind).bind(id).fetch_all(&mut **tx).await.map_err(|e|e.to_string())?;
    for row in rows {
        if entity.as_ref().is_some_and(|value|!value["deletedAt"].is_null()) {break;}
        let operation_kind:String=row.get("kind"); let payload=decode(row.get("payload"))?;
        let base=row.get::<Option<String>,_>("base_entity").map(decode).transpose()?;
        let created:String=row.get("created_at");
        if entity.is_none() && operation_kind=="create" {entity=Some(json!({"id":id,"version":0,"createdAt":created,"updatedAt":created,"deletedAt":null}));}
        if let Some(value)=entity.as_mut() {
            if operation_kind=="delete" {value["deletedAt"]=json!(created);}
            for (field,local_value) in payload.as_object().ok_or("Invalid queued payload")? {
                if operation_kind=="create" || base.as_ref().is_none_or(|base|base[field]!=*local_value) {value[field]=local_value.clone();}
            }
            value["updatedAt"]=json!(created);
        }
    }
    let Some(entity)=entity else {return Ok(());};
    if kind=="task" {
        sqlx::query("INSERT INTO tasks(id,title,status,due,version,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,status=excluded.status,due=excluded.due,version=excluded.version,created_at=excluded.created_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at")
            .bind(id).bind(entity["title"].as_str()).bind(entity["status"].as_str()).bind(entity["due"].as_str()).bind(entity["version"].as_i64()).bind(entity["createdAt"].as_str()).bind(entity["updatedAt"].as_str()).bind(entity["deletedAt"].as_str()).execute(&mut **tx).await.map_err(|e|e.to_string())?;
    } else {
        sqlx::query("INSERT INTO relations(id,from_type,from_id,to_type,to_id,version,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET from_type=excluded.from_type,from_id=excluded.from_id,to_type=excluded.to_type,to_id=excluded.to_id,version=excluded.version,created_at=excluded.created_at,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at")
            .bind(id).bind(entity["fromType"].as_str()).bind(entity["fromId"].as_str()).bind(entity["toType"].as_str()).bind(entity["toId"].as_str()).bind(entity["version"].as_i64()).bind(entity["createdAt"].as_str()).bind(entity["updatedAt"].as_str()).bind(entity["deletedAt"].as_str()).execute(&mut **tx).await.map_err(|e|e.to_string())?;
    }
    Ok(())
}
pub(super) async fn receive(tx:&mut Transaction<'_,Sqlite>,result:&Value) -> StoreResult<()> {
    let order=validate_result(result)?; let id=text(result,"operationId")?;
    let existing:Option<String>=sqlx::query_scalar("SELECT result FROM structured_received WHERE operation_id=?").bind(id).fetch_optional(&mut **tx).await.map_err(|e|e.to_string())?;
    if let Some(raw)=existing {
        if decode(raw)?!=*result {return Err("Immutable server result changed".into());}
        return Ok(());
    }
    let queued=sqlx::query("SELECT entity_type,entity_id,client_id,prepared_wire FROM sync_operations WHERE operation_id=?").bind(id).fetch_optional(&mut **tx).await.map_err(|e|e.to_string())?;
    if let Some(row)=queued {
        if row.get::<String,_>("entity_type")!=text(result,"entityType")? || row.get::<String,_>("entity_id")!=text(result,"entityId")? ||
            row.get::<String,_>("client_id")!=text(result,"clientId")? || row.get::<Option<String>,_>("prepared_wire").is_none() {return Err("Local ACK identity or prepared request is missing".into());}
        let rejected=result["status"]=="rejected";
        sqlx::query("UPDATE sync_operations SET status=?,local_result=?,local_error=? WHERE operation_id=?")
            .bind(if rejected {"rejected"} else {"acknowledged"}).bind(result.to_string()).bind(if rejected {Some(text(&result["error"],"code")?)} else {None}).bind(id).execute(&mut **tx).await.map_err(|e|e.to_string())?;
    }
    sqlx::query("INSERT INTO structured_received(operation_id,server_order,result) VALUES (?,?,?)").bind(id).bind(order).bind(result.to_string()).execute(&mut **tx).await.map_err(|e|e.to_string())?;
    if !result["entity"].is_null() {
        sqlx::query("INSERT INTO structured_server_entities(entity_type,entity_id,server_order,entity) VALUES (?,?,?,?) ON CONFLICT(entity_type,entity_id) DO UPDATE SET server_order=excluded.server_order,entity=excluded.entity WHERE excluded.server_order>structured_server_entities.server_order")
            .bind(text(result,"entityType")?).bind(text(result,"entityId")?).bind(order).bind(result["entity"].to_string()).execute(&mut **tx).await.map_err(|e|e.to_string())?;
    }
    for record in result["conflicts"].as_array().unwrap() {
        sqlx::query("INSERT INTO structured_conflicts(id,server_order,record) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET server_order=excluded.server_order,record=excluded.record WHERE excluded.server_order>structured_conflicts.server_order")
            .bind(text(record,"id")?).bind(order).bind(record.to_string()).execute(&mut **tx).await.map_err(|e|e.to_string())?;
    }
    project(tx,text(result,"entityType")?,text(result,"entityId")?).await
}
pub(super) async fn prepare_in_transaction(tx:&mut Transaction<'_,Sqlite>) -> StoreResult<Option<Value>> {

        loop {
            let Some(row)=sqlx::query("SELECT * FROM sync_operations WHERE status='pending' ORDER BY seq LIMIT 1").fetch_optional(&mut **tx).await.map_err(|e|e.to_string())? else { return Ok(None);};
            if let Some(raw)=row.get::<Option<String>,_>("prepared_wire") {let value=decode(raw)?;  return Ok(Some(value));}
            let id:String=row.get("operation_id");
            let mut wire=json!({"operationId":id,"entityType":row.get::<String,_>("entity_type"),"entityId":row.get::<String,_>("entity_id"),"kind":row.get::<String,_>("kind"),"baseVersion":row.get::<Option<i64>,_>("base_version"),"payload":decode(row.get("payload"))?,"clientId":row.get::<String,_>("client_id")});
            if let Some(raw)=row.get::<Option<String>,_>("resolution") {wire["resolution"]=decode(raw)?;}
            if let Some(dependency)=row.get::<Option<String>,_>("dependency_operation_id") {
                let previous=sqlx::query("SELECT status,local_result FROM sync_operations WHERE operation_id=?").bind(&dependency).fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;
                let status:String=previous.get("status");
                if status=="pending" {return Err("Predecessor is still pending".into());}
                if status=="rejected" {
                    sqlx::query("UPDATE sync_operations SET status='rejected',local_error='predecessor_rejected' WHERE operation_id=?").bind(&id).execute(&mut **tx).await.map_err(|e|e.to_string())?;
                    // Remove this rejected overlay in the same transaction, while
                    // keeping its original payload and base for explicit repair.
                    project(tx,&row.get::<String,_>("entity_type"),&row.get::<String,_>("entity_id")).await?;
                    continue;
                }
                let result=decode(previous.get::<Option<String>,_>("local_result").ok_or("Predecessor result is missing")?)?;
                wire["baseVersion"]=result["entity"]["version"].clone(); wire["predecessorOperationId"]=json!(dependency);
            }
            // Persist the exact wire BEFORE any network send; ACK loss must not rebase a retry.
            sqlx::query("UPDATE sync_operations SET prepared_wire=? WHERE operation_id=?").bind(wire.to_string()).bind(&id).execute(&mut **tx).await.map_err(|e|e.to_string())?;
            return Ok(Some(wire));
        }
    }
pub(super) async fn pull_in_transaction(tx:&mut Transaction<'_,Sqlite>,base_cursor:Option<String>,batch:PullBatch) -> StoreResult<()> {
        if batch.cursor.is_empty() || batch.head_cursor.is_empty() || !timestamp(&batch.server_time) || batch.operations.len()>500 ||
            (batch.has_more && batch.operations.is_empty()) || (!batch.has_more && batch.cursor!=batch.head_cursor) {return Err("Invalid pull page".into());}
        for result in &batch.operations {validate_result(result)?;}

        let state=sqlx::query("SELECT cursor,last_server_order FROM sync_state WHERE stream='structured'").fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;
        let cursor:Option<String>=state.get("cursor");
        if cursor!=base_cursor {
            if cursor.as_deref()==Some(&batch.cursor) {return Ok(());} // A repeated committed page.
            return Err("Pull cursor changed before application".into());
        }
        let mut order:i64=state.get("last_server_order");
        for result in &batch.operations {
            let next=validate_result(result)?;
            if next!=order.checked_add(1).ok_or("Server order exhausted")? {return Err("Pull page skipped or reordered an operation".into());}
            receive(tx,result).await?; order=next;
        }
        #[cfg(feature="crash-test-hooks")]
        if !batch.operations.is_empty() { crash_barrier("structured-pull-before-cursor")?; }
        let pending:i64=sqlx::query_scalar("SELECT count(*) FROM sync_operations WHERE status IN ('pending','rejected')").fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;
        let open:i64=sqlx::query_scalar("SELECT count(*) FROM structured_conflicts WHERE json_extract(record,'$.status')='open'").fetch_one(&mut **tx).await.map_err(|e|e.to_string())?;
        sqlx::query("UPDATE sync_state SET cursor=?,head_cursor=?,last_server_order=?,last_successful_sync_at=CASE WHEN ? THEN ? ELSE last_successful_sync_at END WHERE stream='structured'")
            .bind(&batch.cursor).bind(&batch.head_cursor).bind(order).bind(!batch.has_more && pending==0 && open==0).bind(&batch.server_time).execute(&mut **tx).await.map_err(|e|e.to_string())?;
        Ok(())
    }
impl PageStore {
    pub async fn structured_prepare(&self) -> StoreResult<Option<Value>> {
        let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;
        let value=prepare_in_transaction(&mut tx).await?;
        tx.commit().await.map_err(|e|e.to_string())?; Ok(value)
    }
    pub async fn structured_ack(&self,result:Value) -> StoreResult<()> {
        validate_result(&result)?;
        let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;
        let own:i64=sqlx::query_scalar("SELECT count(*) FROM sync_operations WHERE operation_id=?").bind(text(&result,"operationId")?).fetch_one(&mut *tx).await.map_err(|e|e.to_string())?;
        if own!=1 {return Err("ACK is not a local queued operation".into());}
        receive(&mut tx,&result).await?;
        tx.commit().await.map_err(|e|e.to_string())
    }
    pub async fn structured_pull(&self,base_cursor:Option<String>,batch:PullBatch) -> StoreResult<()> {
        let mut tx=self.pool.begin().await.map_err(|e|e.to_string())?;
        pull_in_transaction(&mut tx,base_cursor,batch).await?;
        tx.commit().await.map_err(|e|e.to_string())
    }
}

// Test-only pause at a named pre-commit boundary.
// The OS kills the driver while the actual repository transaction is open.
#[cfg(feature="crash-test-hooks")]
pub(crate) fn crash_barrier(stage:&str) -> StoreResult<()> {
    use std::{fs,io::Write,path::Path,time::{Duration,Instant}};
    let Ok(root)=std::env::var("GREIVA_CRASH_BARRIER_ROOT") else {return Ok(());};
    let armed=format!("{root}.armed");
    if fs::read_to_string(&armed).ok().as_deref()!=Some(stage) {return Ok(());}
    let mut marker=fs::File::create(format!("{root}.reached")).map_err(|e|e.to_string())?;
    marker.write_all(json!({"pid":std::process::id(),"stage":stage}).to_string().as_bytes()).map_err(|e|e.to_string())?;
    marker.sync_all().map_err(|e|e.to_string())?;
    let start=Instant::now();
    while Path::new(&armed).exists() {
        if start.elapsed()>Duration::from_secs(60) {return Err("Crash test barrier timed out".into());}
        std::thread::sleep(Duration::from_millis(5));
    }
    Ok(())
}
