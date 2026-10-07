// Test-only JSON-lines driver of the same registry used by Tauri commands.
use greiva_page_store::{WorkspaceRegistry,WorkspaceContext,WorkspaceOwner};
use serde_json::{json,Value};use std::{io::{self,BufRead,Write},path::PathBuf,sync::Arc};
#[tokio::main]
async fn main(){
  let registry=Arc::new(WorkspaceRegistry::new(PathBuf::from(std::env::args().nth(1).expect("Test root required"))));
  for line in io::stdin().lock().lines(){
    let request:Value=serde_json::from_str(&line.unwrap()).unwrap();
    let registry=registry.clone();tokio::spawn(async move {
    let result=match request["command"].as_str().unwrap_or("") {
      "device"=>match serde_json::from_value::<WorkspaceOwner>(request["owner"].clone()){Ok(owner)=>registry.device(owner,request["candidate"].as_str().unwrap_or("")).await.map(|value|serde_json::to_value(value).unwrap()),Err(_)=>Err("Private workspace device unavailable".into())},
      "open"=>match serde_json::from_value::<WorkspaceContext>(request["context"].clone()){Ok(context)=>registry.open(context).await.map(|value|serde_json::to_value(value).unwrap()),Err(_)=>Err("Private workspace command rejected or unavailable".into())},
      "close"=>registry.close(request["handle"].as_str().unwrap_or("")).await.map(|_|Value::Null),
      "execute"=>registry.execute(request["handle"].as_str().unwrap_or(""),request["request"].clone()).await,
      _=>Err("Private workspace command rejected or unavailable".into())
    };
    println!("{}",match result {Ok(value)=>json!({"id":request["id"],"value":value}),Err(error)=>json!({"id":request["id"],"error":error})});io::stdout().flush().unwrap();
    });
  }
}
