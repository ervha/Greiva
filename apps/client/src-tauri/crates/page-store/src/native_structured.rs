//! Admission-bound Task/Relation transport. WebView supplies only a handle.
use super::*;
use serde_json::{json,Value};

#[derive(Clone,Copy,Debug,PartialEq,Eq,serde::Serialize)]
#[serde(rename_all="snake_case")]
pub enum StructuredSendStatus {Idle,Acknowledged,Conflict,Rejected,SendUnknown,AckPending}
#[derive(Clone,Copy,Debug,PartialEq,Eq,serde::Serialize)]
#[serde(tag="status",rename_all="snake_case")]
pub enum StructuredPullStatus {Received{#[serde(rename="hasMore")]has_more:bool},ReadUnknown,StorePending}

impl<S:CredentialStore+'static,P:NativeProvider,C:NativeClock+'static> NativeWorkspaceGate<S,P,C> {
    async fn structured_local(&self,admission:&WorkspaceAdmission,handle:&str,request:Value)->Result<Value>{
        let registry=self.registry.clone();let h=handle.to_owned();
        self.session.local(Some(admission),|_|Box::pin(async move {registry.execute(&h,request).await.map_err(|_|CredentialError)})).await
    }
    pub async fn send_structured(&self,handle:&str)->Result<StructuredSendStatus>{
        let _io=self.structured_io.lock().await;
        let (generation,admission,cached,wire)={
            let active=self.active.lock().await;
            let (_,admission)=active.active.as_ref().filter(|(h,_)|h.handle==handle).ok_or(CredentialError)?;
            if active.structured_received.is_some(){return Err(CredentialError)}
            let cached=active.structured_ack.clone();
            let prepared=if let Some((wire,_))=&cached{Value::String(wire.clone())}else{self.structured_local(admission,handle,json!({"command":"prepare"})).await?};
            if prepared.is_null(){return Ok(StructuredSendStatus::Idle)}
            (active.generation,admission.clone(),cached,prepared.as_str().ok_or(CredentialError)?.to_owned())
        };
        // Cached replies also require current session admission below.
        let response=if let Some((_,response))=cached{response}else{match self.session.structured_send(&admission,&wire).await{Ok(value)=>value,Err(_)=>return Ok(StructuredSendStatus::SendUnknown)}};
        let mut active=self.active.lock().await;
        if active.generation!=generation||active.active.as_ref().is_none_or(|(h,_)|h.handle!=handle){return Err(CredentialError)}
        if self.structured_local(&admission,handle,json!({"command":"structured_validate_ack","wire":wire,"response":response})).await.is_err(){return Ok(StructuredSendStatus::SendUnknown)}
        let status=match response["results"][0]["status"].as_str(){Some("acknowledged")=>StructuredSendStatus::Acknowledged,Some("conflict")=>StructuredSendStatus::Conflict,Some("rejected")=>StructuredSendStatus::Rejected,_=>return Ok(StructuredSendStatus::SendUnknown)};
        active.structured_ack=Some((wire.clone(),response.clone()));
        #[cfg(test)]let failure=self.ack_failure.swap(0,std::sync::atomic::Ordering::SeqCst);
        #[cfg(not(test))]let failure=0;
        if failure==1{return Ok(StructuredSendStatus::AckPending)}
        if self.structured_local(&admission,handle,json!({"command":"ack","wire":wire,"response":response})).await.is_err()||failure==2{return Ok(StructuredSendStatus::AckPending)}
        active.structured_ack=None;Ok(status)
    }
    pub async fn pull_structured(&self,handle:&str)->Result<StructuredPullStatus>{
        let _io=self.structured_io.lock().await;
        let (generation,admission,cached,request)={
            let active=self.active.lock().await;
            let (_,admission)=active.active.as_ref().filter(|(h,_)|h.handle==handle).ok_or(CredentialError)?;
            if active.structured_ack.is_some(){return Err(CredentialError)}
            let cached=active.structured_received.clone();
            let request=if let Some((request,_))=&cached{request.clone()}else{self.structured_local(admission,handle,json!({"command":"structured_pull_request"})).await?};
            (active.generation,admission.clone(),cached,request)
        };
        let response=if let Some((_,response))=cached{response}else{match self.session.structured_pull(&admission,&request).await{Ok(value)=>value,Err(_)=>return Ok(StructuredPullStatus::ReadUnknown)}};
        let mut active=self.active.lock().await;
        if active.generation!=generation||active.active.as_ref().is_none_or(|(h,_)|h.handle!=handle){return Err(CredentialError)}
        if self.structured_local(&admission,handle,json!({"command":"structured_validate_pull","request":request,"response":response})).await.is_err(){return Ok(StructuredPullStatus::ReadUnknown)}
        let has_more=response["hasMore"].as_bool().ok_or(CredentialError)?;
        active.structured_received=Some((request.clone(),response.clone()));
        #[cfg(test)]let failure=self.read_failure.swap(0,std::sync::atomic::Ordering::SeqCst);
        #[cfg(not(test))]let failure=0;
        if failure==1{return Ok(StructuredPullStatus::StorePending)}
        if self.structured_local(&admission,handle,json!({"command":"pull","request":request,"response":response})).await.is_err()||failure==2{return Ok(StructuredPullStatus::StorePending)}
        active.structured_received=None;Ok(StructuredPullStatus::Received{has_more})
    }
}
