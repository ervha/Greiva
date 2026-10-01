use super::{PageStore, StoreResult};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use sqlx::{Sqlite, Transaction};

#[derive(Deserialize, Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LocalOperation {
    pub operation_id: String,
    pub entity_type: String,
    pub entity_id: String,
    pub kind: String,
    pub base_version: Option<i64>,
    pub payload: Value,
    pub client_id: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredSnapshot {
    pub tasks: Vec<Value>,
    pub relations: Vec<Value>,
    pub operations: Vec<Value>,
    pub state: Value,
    pub client_id: Option<String>,
}

// The frontend can request an entity mutation, never execute arbitrary SQL.
const TASK_JSON: &str = "json_object('id',id,'title',title,'status',status,'due',due,'version',version,'createdAt',created_at,'updatedAt',updated_at,'deletedAt',deleted_at)";
const RELATION_JSON: &str = "json_object('id',id,'fromType',from_type,'fromId',from_id,'toType',to_type,'toId',to_id,'version',version,'createdAt',created_at,'updatedAt',updated_at,'deletedAt',deleted_at)";

pub(super) async fn validate_schema(tx: &mut Transaction<'_, Sqlite>) -> StoreResult<()> {
    for statement in [
        "SELECT id,title,status,due,version,created_at,updated_at,deleted_at FROM tasks LIMIT 0",
        "SELECT id,from_type,from_id,to_type,to_id,version,created_at,updated_at,deleted_at FROM relations LIMIT 0",
        "SELECT seq,operation_id,entity_type,entity_id,kind,base_version,payload,client_id,created_at,status,base_entity,dependency_operation_id,prepared_wire FROM sync_operations LIMIT 0",
        "SELECT stream,cursor,last_successful_sync_at FROM sync_state LIMIT 0",
        "SELECT singleton,client_id FROM structured_client LIMIT 0",
    ] { sqlx::query(statement).execute(&mut **tx).await.map_err(|e| e.to_string())?; }
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM sync_state WHERE stream='structured'").fetch_one(&mut **tx).await.map_err(|e| e.to_string())?;
    if count != 1 { return Err("Structured sync state is missing".into()); }
    Ok(())
}
fn uuid_v7(value: &str) -> bool {
    let b = value.as_bytes();
    b.len() == 36 && b[14] == b'7' && matches!(b[19], b'8'|b'9'|b'a'|b'b'|b'A'|b'B') &&
        b.iter().enumerate().all(|(i,c)| if [8,13,18,23].contains(&i) { *c == b'-' } else { c.is_ascii_hexdigit() })
}
fn date_only(value: &str) -> bool {
    let b = value.as_bytes();
    if b.len() != 10 || b[4] != b'-' || b[7] != b'-' || !b.iter().enumerate().all(|(i,c)| [4,7].contains(&i) || c.is_ascii_digit()) { return false; }
    let year = value[0..4].parse::<u32>().unwrap();
    let month = value[5..7].parse::<usize>().unwrap();
    let day = value[8..10].parse::<u32>().unwrap();
    let days = [31, if year%4 == 0 && (year%100 != 0 || year%400 == 0) {29} else {28},31,30,31,30,31,31,30,31,30,31];
    (1..=12).contains(&month) && day > 0 && day <= days[month-1]
}
fn validate(operation: &LocalOperation) -> StoreResult<&Map<String, Value>> {
    if !uuid_v7(&operation.operation_id) || !uuid_v7(&operation.entity_id) || !uuid_v7(&operation.client_id) { return Err("Structured IDs must be UUIDv7".into()); }
    if !["task","relation"].contains(&operation.entity_type.as_str()) || !["create","update","delete"].contains(&operation.kind.as_str()) { return Err("Invalid operation kind or entity type".into()); }
    match (operation.kind.as_str(), operation.base_version) {
        ("create", None) => {},
        ("update"|"delete", Some(v)) if (0..=9_007_199_254_740_991).contains(&v) => {},
        _ => return Err("Invalid base version".into()),
    }
    let payload = operation.payload.as_object().ok_or("Payload must be an object")?;
    let allowed = if operation.kind == "delete" { vec![] } else if operation.entity_type == "task" { vec!["title","status","due"] } else { vec!["fromType","fromId","toType","toId"] };
    if payload.keys().any(|key| !allowed.contains(&key.as_str())) { return Err("Unknown or immutable payload field".into()); }
    if operation.kind == "create" && payload.len() != allowed.len() { return Err("Create payload is incomplete".into()); }
    if operation.kind == "update" && payload.is_empty() { return Err("Empty update".into()); }
    for (key,value) in payload {
        let valid = match key.as_str() {
            "title" => value.is_string(),
            "status" => value.as_str().is_some_and(|s| ["todo","in_progress","done"].contains(&s)),
            "due" => value.is_null() || value.as_str().is_some_and(date_only),
            "fromType"|"toType" => value.as_str().is_some_and(|s| ["page","task"].contains(&s)),
            "fromId"|"toId" => value.as_str().is_some_and(uuid_v7),
            _ => false,
        };
        if !valid { return Err(format!("Invalid payload field: {key}")); }
    }
    Ok(payload)
}
fn decoded(raw: String) -> StoreResult<Value> { serde_json::from_str(&raw).map_err(|e| e.to_string()) }

impl PageStore {
    pub async fn structured_client_id(&self, candidate: &str) -> StoreResult<String> {
        if !uuid_v7(candidate) { return Err("Client ID must be UUIDv7".into()); }
        let mut tx = self.pool.begin().await.map_err(|e| e.to_string())?;
        sqlx::query("INSERT OR IGNORE INTO structured_client(singleton,client_id) VALUES (1,?)").bind(candidate).execute(&mut *tx).await.map_err(|e| e.to_string())?;
        let id: String = sqlx::query_scalar("SELECT client_id FROM structured_client WHERE singleton=1").fetch_one(&mut *tx).await.map_err(|e| e.to_string())?;
        if !uuid_v7(&id) { return Err("Invalid stored Client ID".into()); }
        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(id)
    }
    pub async fn structured_snapshot(&self) -> StoreResult<StructuredSnapshot> {
        let mut tx = self.pool.begin().await.map_err(|e| e.to_string())?;
        let mut entities = Vec::new();
        for (table, projection) in [("tasks",TASK_JSON),("relations",RELATION_JSON)] {
            let raws: Vec<String> = sqlx::query_scalar(&format!("SELECT {projection} FROM {table} ORDER BY created_at,id"))
                .fetch_all(&mut *tx).await.map_err(|e| e.to_string())?;
            entities.push(raws.into_iter().map(decoded).collect::<StoreResult<Vec<_>>>()?);
        }
        let raws: Vec<String> = sqlx::query_scalar("SELECT json_object('operationId',operation_id,'entityType',entity_type,'entityId',entity_id,'kind',kind,'baseVersion',base_version,'payload',json(payload),'clientId',client_id,'createdAt',created_at,'status',status) FROM sync_operations ORDER BY seq")
            .fetch_all(&mut *tx).await.map_err(|e| e.to_string())?;
        let operations = raws.into_iter().map(decoded).collect::<StoreResult<Vec<_>>>()?;
        let state: String = sqlx::query_scalar("SELECT json_object('stream',stream,'cursor',cursor,'lastSuccessfulSyncAt',last_successful_sync_at) FROM sync_state WHERE stream='structured'")
            .fetch_one(&mut *tx).await.map_err(|e| e.to_string())?;
        let client_id = sqlx::query_scalar("SELECT client_id FROM structured_client WHERE singleton=1").fetch_optional(&mut *tx).await.map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(StructuredSnapshot { tasks: entities.remove(0), relations: entities.remove(0), operations, state: decoded(state)?, client_id })
    }

    pub async fn structured_mutate(&self, operation: LocalOperation) -> StoreResult<Value> {
        let payload = validate(&operation)?;
        let (table, projection) = if operation.entity_type == "task" { ("tasks",TASK_JSON) } else { ("relations",RELATION_JSON) };
        let mut tx = self.pool.begin().await.map_err(|e| e.to_string())?;
        let client_id: Option<String> = sqlx::query_scalar("SELECT client_id FROM structured_client WHERE singleton=1").fetch_optional(&mut *tx).await.map_err(|e| e.to_string())?;
        if client_id.as_deref() != Some(&operation.client_id) { return Err("Local client identity mismatch".into()); }
        let previous: Option<String> = sqlx::query_scalar("SELECT json_object('operationId',operation_id,'entityType',entity_type,'entityId',entity_id,'kind',kind,'baseVersion',base_version,'payload',json(payload),'clientId',client_id) FROM sync_operations WHERE operation_id=?")
            .bind(&operation.operation_id).fetch_optional(&mut *tx).await.map_err(|e| e.to_string())?;
        let current: Option<String> = sqlx::query_scalar(&format!("SELECT {projection} FROM {table} WHERE id=?"))
            .bind(&operation.entity_id).fetch_optional(&mut *tx).await.map_err(|e| e.to_string())?;
        if let Some(previous) = previous {
            if serde_json::from_str::<LocalOperation>(&previous).map_err(|e| e.to_string())? != operation { return Err("Operation ID reused with different content".into()); }
            return current.map(decoded).unwrap_or_else(|| Err("Queued entity is missing".into()));
        }
        let base = current.map(decoded).transpose()?;
        if operation.kind == "create" && base.is_some() { return Err("Entity already exists".into()); }
        if operation.kind != "create" {
            let entity = base.as_ref().ok_or("Entity not found")?;
            if !entity["deletedAt"].is_null() { return Err("Entity is deleted".into()); }
            if entity["version"].as_i64() != operation.base_version { return Err("Stale local base version".into()); }
        }
        let now: String = sqlx::query_scalar("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now')").fetch_one(&mut *tx).await.map_err(|e| e.to_string())?;
        let mut entity = base.clone().unwrap_or_else(|| json!({"id":operation.entity_id,"version":0,"createdAt":now,"deletedAt":null}));
        for (key,value) in payload { entity[key] = value.clone(); }
        entity["updatedAt"] = json!(now);
        if operation.kind == "delete" { entity["deletedAt"] = json!(now); }
        if operation.entity_type == "task" {
            sqlx::query("INSERT INTO tasks(id,title,status,due,version,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,status=excluded.status,due=excluded.due,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at")
                .bind(&operation.entity_id).bind(entity["title"].as_str()).bind(entity["status"].as_str()).bind(entity["due"].as_str()).bind(entity["version"].as_i64())
                .bind(entity["createdAt"].as_str()).bind(&now).bind(entity["deletedAt"].as_str()).execute(&mut *tx).await.map_err(|e| e.to_string())?;
        } else {
            sqlx::query("INSERT INTO relations(id,from_type,from_id,to_type,to_id,version,created_at,updated_at,deleted_at) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET from_type=excluded.from_type,from_id=excluded.from_id,to_type=excluded.to_type,to_id=excluded.to_id,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at")
                .bind(&operation.entity_id).bind(entity["fromType"].as_str()).bind(entity["fromId"].as_str()).bind(entity["toType"].as_str()).bind(entity["toId"].as_str()).bind(entity["version"].as_i64())
                .bind(entity["createdAt"].as_str()).bind(&now).bind(entity["deletedAt"].as_str()).execute(&mut *tx).await.map_err(|e| e.to_string())?;
        }
        // Retain the original local base and predecessor for causal offline edits.
        // Step 7 will prepare immutable wire operations before their first send.
        let dependency: Option<String> = sqlx::query_scalar("SELECT operation_id FROM sync_operations WHERE entity_type=? AND entity_id=? AND status='pending' ORDER BY seq DESC LIMIT 1")
            .bind(&operation.entity_type).bind(&operation.entity_id).fetch_optional(&mut *tx).await.map_err(|e| e.to_string())?;
        sqlx::query("INSERT INTO sync_operations(operation_id,entity_type,entity_id,kind,base_version,payload,client_id,created_at,status,base_entity,dependency_operation_id) VALUES (?,?,?,?,?,?,?,?,'pending',?,?)")
            .bind(&operation.operation_id).bind(&operation.entity_type).bind(&operation.entity_id).bind(&operation.kind).bind(operation.base_version).bind(operation.payload.to_string())
            .bind(&operation.client_id).bind(&now).bind(base.map(|v| v.to_string())).bind(dependency).execute(&mut *tx).await.map_err(|e| e.to_string())?;
        tx.commit().await.map_err(|e| e.to_string())?;
        Ok(entity)
    }
}
