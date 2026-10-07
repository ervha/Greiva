use crate::{WorkspaceContext,WorkspaceStore,LocalOperation,StoreResult};
use serde::Serialize;
use serde_json::Value;
use sha2::{Digest,Sha256};
use std::{path::PathBuf,time::{SystemTime,UNIX_EPOCH}};
use tokio::sync::Mutex;

#[derive(Clone,Serialize)]
#[serde(rename_all="camelCase")]
pub struct WorkspaceHandle {pub handle:String,pub context:WorkspaceContext}
struct Active {handle:String,store:WorkspaceStore}
struct State {generation:u64,active:Option<Active>}
// A local repository handle is not an Auth grant. Only trusted application
// composition should open one after verified registration. Native token custody
// and offline grants remain separate contracts. Callers never supply DB paths.
pub struct WorkspaceRegistry {root:PathBuf,instance:String,state:Mutex<State>}
const REJECTED:&str="Private workspace command rejected or unavailable";
fn exact(request:&Value,fields:&[&str])->StoreResult<()> {let object=request.as_object().ok_or(REJECTED)?;if object.len()!=fields.len() || fields.iter().any(|field|!object.contains_key(*field)){return Err(REJECTED.into());}Ok(())}
fn text<'a>(request:&'a Value,key:&str)->StoreResult<&'a str> {request[key].as_str().ok_or_else(||REJECTED.into())}
impl WorkspaceRegistry {
    pub async fn device(&self,owner:crate::WorkspaceOwner,candidate:&str)->StoreResult<crate::WorkspaceDevice> {
        // Device lookup must not close or rebind an already active workspace.
        crate::workspace_device::resolve(&self.root,owner,candidate).await
    }
    pub fn new(root:PathBuf)->Self {
        // Uniqueness namespace only, not a secret capability or proof of owner.
        let time=SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_nanos();
        Self{root,instance:format!("{time:x}-{:x}",std::process::id()),state:Mutex::new(State{generation:0,active:None})}
    }
    pub async fn open(&self,context:WorkspaceContext)->StoreResult<WorkspaceHandle> {self.open_inner(context).await.map_err(|_|REJECTED.into())}
    async fn open_inner(&self,context:WorkspaceContext)->StoreResult<WorkspaceHandle> {
        let mut state=self.state.lock().await;
        // Account/workspace switch invalidates the previous handle even if the
        // next store cannot open. Existing operations finish on their old store.
        state.active=None;state.generation=state.generation.checked_add(1).ok_or(REJECTED)?;
        let name=Sha256::digest(serde_json::to_vec(&context).map_err(|_|REJECTED)?).iter().map(|byte|format!("{byte:02x}")).collect::<String>();
        std::fs::create_dir_all(&self.root).map_err(|_|REJECTED)?;
        let store=WorkspaceStore::open(&self.root.join(format!("{name}.sqlite")),context.clone()).await?;
        let handle=format!("{}-{:x}",self.instance,state.generation);state.active=Some(Active{handle:handle.clone(),store});Ok(WorkspaceHandle{handle,context})
    }
    pub async fn close(&self,handle:&str)->StoreResult<()> {
        let mut state=self.state.lock().await;if state.active.as_ref().is_none_or(|active|active.handle!=handle){return Err(REJECTED.into());}state.active=None;Ok(())
    }
    pub async fn execute(&self,handle:&str,request:Value)->StoreResult<Value> {self.execute_inner(handle,request).await.map_err(|_|REJECTED.into())}
    async fn execute_inner(&self,handle:&str,request:Value)->StoreResult<Value> {
        // Hold the registry gate through commit. close/open waits for already
        // admitted operations; a late old handle never resolves a current store.
        let state=self.state.lock().await;let active=state.active.as_ref().filter(|active|active.handle==handle).ok_or(REJECTED)?;let store=&active.store;
        match text(&request,"command")? {
            "snapshot"=>{exact(&request,&["command"])?;store.snapshot().await},
            "mutate"=>{exact(&request,&["command","operation"])?;store.mutate(serde_json::from_value::<LocalOperation>(request["operation"].clone()).map_err(|_|REJECTED)?).await},
            "prepare"=>{exact(&request,&["command"])?;Ok(store.prepare().await?.map(Value::String).unwrap_or(Value::Null))},
            "ack"=>{exact(&request,&["command","wire","response"])?;store.acknowledge(text(&request,"wire")?.into(),request["response"].clone()).await?;Ok(Value::Null)},
            "pull"=>{exact(&request,&["command","request","response"])?;store.apply_pull(request["request"].clone(),request["response"].clone()).await?;Ok(Value::Null)},
            "page_create"=>{exact(&request,&["command","pageId","title","update"])?;let update:Vec<u8>=serde_json::from_value(request["update"].clone()).map_err(|_|REJECTED)?;store.page_create(text(&request,"pageId")?,text(&request,"title")?,&update).await?;Ok(Value::Null)},
            "page_append"=>{exact(&request,&["command","pageId","update"])?;let update:Vec<u8>=serde_json::from_value(request["update"].clone()).map_err(|_|REJECTED)?;store.page_append(text(&request,"pageId")?,&update).await?;Ok(Value::Null)},
            "page_load"=>{exact(&request,&["command","pageId"])?;store.page_load(text(&request,"pageId")?).await},
            "page_exists"=>{exact(&request,&["command","pageId"])?;Ok(Value::Bool(store.page_exists(text(&request,"pageId")?).await?))},
            "page_list"=>{exact(&request,&["command","after","limit"])?;let after=if request["after"].is_null(){None}else{Some(text(&request,"after")?)};let limit=request["limit"].as_u64().filter(|limit|*limit<=100).ok_or(REJECTED)? as usize;store.page_list(after,limit).await},
            "page_prepare"=>{exact(&request,&["command","pageId"])?;store.page_prepare(text(&request,"pageId")?).await},
            "page_ack"=>{exact(&request,&["command","pageId","sequence","wire","response"])?;store.page_ack(text(&request,"pageId")?,text(&request,"sequence")?,text(&request,"wire")?,request["response"].clone()).await?;Ok(Value::Null)},
            "page_receive"=>{exact(&request,&["command","pageId","response"])?;store.page_receive(text(&request,"pageId")?,request["response"].clone()).await?;Ok(Value::Null)},
            _=>Err(REJECTED.into())
        }
    }
}
