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
