// Docker-only transport for exercising the same repository used by Tauri.
// JSON-lines over inherited stdin/stdout; no network listener or raw SQL API.
use greiva_page_store::{PageStore, LocalOperation};
use serde_json::{json, Value};
use std::{io::{self, BufRead, Write}, path::Path};
#[tokio::main]
async fn main() {
    let path = std::env::args().nth(1).expect("SQLite path required");
    let store = PageStore::open(Path::new(&path)).await;
    for line in io::stdin().lock().lines() {
        let request: Value = serde_json::from_str(&line.expect("stdin")).expect("valid JSON");
        let id = request["pageId"].as_str().unwrap_or("");
        let result = match &store {
            Err(e) => Err(e.clone()),
            Ok(store) => match request["command"].as_str().unwrap_or("") {
                "list" => store.list().await.map(|value| serde_json::to_value(value).unwrap()),
                "structured-snapshot" => store.structured_snapshot().await.map(|value| serde_json::to_value(value).unwrap()),
                "structured-client-id" => store.structured_client_id(request["candidate"].as_str().unwrap_or("")).await.map(Value::String),
                "structured-mutate" => match serde_json::from_value::<LocalOperation>(request["operation"].clone()) {
                    Ok(operation) => store.structured_mutate(operation).await, Err(e) => Err(e.to_string()),
                },
                "load" => store.load(id).await.map(|value| serde_json::to_value(value).unwrap()),
                "append" => match serde_json::from_value::<Vec<u8>>(request["update"].clone()) {
                    Ok(bytes) => store.append(id, &bytes).await.map(|_| Value::Null), Err(e) => Err(e.to_string()),
                },
                "title" => store.set_title(id, request["title"].as_str().unwrap_or("")).await.map(|_| Value::Null),
                _ => Err("Unknown command".into()),
            },
        };
        let response = match result { Ok(value) => json!({"id":request["id"],"value":value}), Err(error) => json!({"id":request["id"],"error":error}) };
        println!("{response}");
        io::stdout().flush().unwrap();
    }
}
