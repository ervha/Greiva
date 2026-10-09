// Docker JSON-lines bridge to the actual native library; no network/raw SQL.
use greiva_page_store::{WorkspaceContext,WorkspaceStore,LocalOperation};
use serde_json::{json,Value};
use std::{io::{self,BufRead,Write},path::Path};
#[tokio::main]
async fn main() {
    let args:Vec<String>=std::env::args().collect();
    let context:WorkspaceContext=serde_json::from_str(&args[2]).expect("Workspace context required");
    let store=WorkspaceStore::open(Path::new(&args[1]),context).await;
    for line in io::stdin().lock().lines() {
        let request:Value=serde_json::from_str(&line.unwrap()).unwrap();
        let result=match &store {
            Err(error)=>Err(error.clone()),
            Ok(store)=>match request["command"].as_str().unwrap_or("") {

                "page_create"|"page_append"=>match serde_json::from_value::<Vec<u8>>(request["update"].clone()) {Ok(bytes)=>if request["command"]=="page_create" {store.page_create(request["pageId"].as_str().unwrap_or(""),request["title"].as_str().unwrap_or(""),&bytes).await.map(|_|Value::Null)}else{store.page_append(request["pageId"].as_str().unwrap_or(""),&bytes).await.map(|_|Value::Null)},Err(_)=>Err("Invalid Page update".into())},
                "title_enqueue"=>store.title_enqueue(request["pageId"].as_str().unwrap_or(""),request["intent"].clone()).await.map(|_|Value::Null),
                "title_prepare"=>store.title_prepare(request["pageId"].as_str().unwrap_or("")).await,
                "title_ack"=>store.title_ack(request["pageId"].as_str().unwrap_or(""),request["sequence"].as_str().unwrap_or(""),request["wire"].as_str().unwrap_or(""),request["response"].clone()).await.map(|_|Value::Null),
                "title_receive"=>store.title_receive(request["pageId"].as_str().unwrap_or(""),request["request"].clone(),request["response"].clone()).await.map(|_|Value::Null),
                "title_load"=>store.title_load(request["pageId"].as_str().unwrap_or(""),request["afterOperation"].as_str(),request["afterConflict"].as_str(),request["limit"].as_u64().unwrap_or(50) as usize).await,
                "page_load"=>store.page_load(request["pageId"].as_str().unwrap_or("")).await,
                "page_prepare"=>store.page_prepare(request["pageId"].as_str().unwrap_or("")).await,
                "page_ack"=>store.page_ack(request["pageId"].as_str().unwrap_or(""),request["sequence"].as_str().unwrap_or(""),request["wire"].as_str().unwrap_or(""),request["response"].clone()).await.map(|_|Value::Null),
                "page_receive"=>store.page_receive(request["pageId"].as_str().unwrap_or(""),request["response"].clone()).await.map(|_|Value::Null),
                "database_source_enqueue" => store.database_source_enqueue(request["intent"].clone()).await.map(|_|Value::Null),
                "database_source_prepare" => store.database_source_prepare().await,
                "database_source_ack" => store.database_source_ack(request["sequence"].as_str().unwrap_or(""),request["wire"].as_str().unwrap_or(""),request["response"].clone()).await.map(|_|Value::Null),
                "database_source_queue" => store.database_source_queue(request["after"].as_str(),request["limit"].as_u64().unwrap_or(50) as usize,request["pendingOnly"].as_bool().unwrap_or(false)).await,
                "database_changes_receive"=>store.database_changes_receive(request["sourceId"].as_str().unwrap_or(""),request["request"].clone(),request["response"].clone()).await.map(|_|Value::Null),
                "database_changes_load"=>store.database_changes_load(request["sourceId"].as_str().unwrap_or("")).await,
                "database_view_receive"=>store.database_view_receive(request["sourceId"].as_str().unwrap_or(""),request["viewId"].as_str().unwrap_or(""),request["request"].clone(),request["response"].clone()).await.map(|_|Value::Null),
                "database_view_load"=>store.database_view_load(request["sourceId"].as_str().unwrap_or(""),request["viewId"].as_str().unwrap_or(""),request["afterConflict"].as_str(),request["limit"].as_u64().unwrap_or(20) as usize).await,
                "database_view_list"=>store.database_view_list(request["sourceId"].as_str().unwrap_or(""),request["after"].as_str(),request["limit"].as_u64().unwrap_or(50) as usize).await,
                "database_record_receive"=>store.database_record_receive(request["sourceId"].as_str().unwrap_or(""),request["recordId"].as_str().unwrap_or(""),request["request"].clone(),request["response"].clone()).await.map(|_|Value::Null),
                "database_record_load"=>store.database_record_load(request["sourceId"].as_str().unwrap_or(""),request["recordId"].as_str().unwrap_or(""),request["afterConflict"].as_str(),request["limit"].as_u64().unwrap_or(20) as usize).await,
                "database_record_list"=>store.database_record_list(request["sourceId"].as_str().unwrap_or(""),request["after"].as_str(),request["limit"].as_u64().unwrap_or(50) as usize).await,
                "database_source_receive"=>store.database_source_receive(request["sourceId"].as_str().unwrap_or(""),request["request"].clone(),request["response"].clone()).await.map(|_|Value::Null),
                "database_source_load"=>store.database_source_load(request["sourceId"].as_str().unwrap_or("")).await,
                "database_source_list"=>store.database_source_list(request["after"].as_str(),request["limit"].as_u64().unwrap_or(50) as usize).await,
                "snapshot"=>store.snapshot().await,
                "mutate"=>match serde_json::from_value::<LocalOperation>(request["operation"].clone()) {Ok(value)=>store.mutate(value).await,Err(_)=>Err("Invalid workspace request".into())},
                "prepare"=>store.prepare().await.map(|value|value.map(Value::String).unwrap_or(Value::Null)),
                "ack"=>store.acknowledge(request["wire"].as_str().unwrap_or("").into(),request["response"].clone()).await.map(|_|Value::Null),
                "pull"=>store.apply_pull(request["request"].clone(),request["response"].clone()).await.map(|_|Value::Null),
                _=>Err("Unknown workspace command".into()),
            }
        };
        println!("{}",match result {Ok(value)=>json!({"id":request["id"],"value":value}),Err(error)=>json!({"id":request["id"],"error":error})});
        io::stdout().flush().unwrap();
    }
}
