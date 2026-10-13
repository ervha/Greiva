use greiva_page_store::{offline_grant::OfflineGrantVerifier,WorkspaceContext};
use serde::Deserialize;use std::io::{self,Read};
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct Input{token:String,context:WorkspaceContext,key:[u8;32],now:u64,high_water:u64,nonce:String,issuer:String,audience:String,kid:String}
fn main(){
    let result=(||{let mut input=String::new();io::stdin().take(16385).read_to_string(&mut input).map_err(|_|())?;if input.len()>16384{return Err(())}let value:Input=serde_json::from_str(&input).map_err(|_|())?;
        let verifier=OfflineGrantVerifier::new(value.issuer,value.audience,vec![(value.kid,value.key)]).map_err(|_|())?;
        let grant=verifier.verify(&value.token,&value.context).map_err(|_|())?;grant.check_time(value.now,value.high_water).map_err(|_|())?;grant.check_challenge(&value.nonce).map_err(|_|())?;Ok::<_,()>(())})();
    println!("{{\"accepted\":{}}}",result.is_ok());
}
