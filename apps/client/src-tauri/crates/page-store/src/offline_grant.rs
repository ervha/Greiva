//! Fixed, separate JWS type for local access only. Never a bearer API token.
use crate::{WorkspaceContext, structured::uuid_v7};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use ed25519_dalek::{Signature, VerifyingKey};
use serde::Deserialize;
use std::collections::BTreeMap;

pub const OFFLINE_SECONDS:u64=604800;
#[derive(Debug,Clone,Copy,PartialEq,Eq)]
pub struct OfflineGrantError;
impl std::fmt::Display for OfflineGrantError {fn fmt(&self,f:&mut std::fmt::Formatter<'_>)->std::fmt::Result{f.write_str("Offline access unavailable")}}
impl std::error::Error for OfflineGrantError{}
type Result<T>=std::result::Result<T,OfflineGrantError>;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Header {alg:String,typ:String,kid:String}
#[derive(Deserialize)]
#[serde(rename_all="camelCase",deny_unknown_fields)]
struct Claims {
    iss:String,aud:String,sub:String,auth_issuer:String,workspace_id:String,client_id:String,stream_epoch:String,
    iat:u64,exp:u64,nonce:String,
}
pub struct VerifiedOfflineGrant {context:WorkspaceContext,issued_at:u64,expires_at:u64,nonce:String}
impl VerifiedOfflineGrant {
    pub fn context(&self)->&WorkspaceContext{&self.context}
    pub fn expires_at(&self)->u64{self.expires_at}
    /// high_water must be native-owned durable state; a JS clock/claim is not
    /// acceptable. This check never extends the server-signed expiry.
    pub fn check_time(&self,now:u64,high_water:u64)->Result<()> {
        if now<high_water || now<self.issued_at || now>=self.expires_at {Err(OfflineGrantError)}else{Ok(())}
    }
    /// Fresh online response must match the native-created challenge. Offline
    /// cached use re-verifies its signature/scope and durable lock separately.
    pub fn check_challenge(&self,expected:&str)->Result<()> {if expected!=self.nonce{Err(OfflineGrantError)}else{Ok(())}}
}
pub struct OfflineGrantVerifier {issuer:String,audience:String,keys:BTreeMap<String,VerifyingKey>}
fn text(value:&str,max:usize)->bool{!value.trim().is_empty()&&value.len()<=max&&!value.chars().any(char::is_control)}
fn nonce(value:&str)->bool{value.len()==64&&value.bytes().all(|b|b.is_ascii_hexdigit()&&!b.is_ascii_uppercase())}
impl OfflineGrantVerifier {
    /// Compiled deployment pin. This is public material, never a request/IPC key.
    pub fn from_public_pin(issuer:&str,audience:&str,kid:&str,hex:&str)->Result<Self>{
        let url=url::Url::parse(issuer).map_err(|_|OfflineGrantError)?;
        if url.scheme()!="https"||url.host_str().is_none()||!url.username().is_empty()||url.password().is_some()||url.query().is_some()||url.fragment().is_some()||hex.len()!=64||!hex.bytes().all(|b|b.is_ascii_digit()||(b'a'..=b'f').contains(&b)){return Err(OfflineGrantError)}
        let mut bytes=[0u8;32];for (index,byte) in bytes.iter_mut().enumerate(){*byte=u8::from_str_radix(&hex[index*2..index*2+2],16).map_err(|_|OfflineGrantError)?;}Self::new(issuer.into(),audience.into(),vec![(kid.into(),bytes)])
    }
    /// Only trusted native configuration supplies issuer/audience/pinned keys.
    /// No token-provided JWK/URL/algorithm or network key discovery is accepted.
    pub fn new(issuer:String,audience:String,keys:Vec<(String,[u8;32])>)->Result<Self>{
        if !text(&issuer,2048)||!text(&audience,256)||keys.is_empty()||keys.len()>8{return Err(OfflineGrantError)}
        let mut pinned=BTreeMap::new();
        for (kid,bytes) in keys {if !text(&kid,64)||!kid.bytes().all(|b|b.is_ascii_alphanumeric()||b==b'_'||b==b'-'){return Err(OfflineGrantError)}let key=VerifyingKey::from_bytes(&bytes).map_err(|_|OfflineGrantError)?;if key.is_weak()||pinned.insert(kid,key).is_some(){return Err(OfflineGrantError)}}
        Ok(Self{issuer,audience,keys:pinned})
    }
    pub fn verify(&self,token:&str,expected:&WorkspaceContext)->Result<VerifiedOfflineGrant>{
        if token.len()>8192 || !token.is_ascii(){return Err(OfflineGrantError)}
        let parts:Vec<_>=token.split('.').collect();if parts.len()!=3||parts.iter().any(|part|part.is_empty()){return Err(OfflineGrantError)}
        let header:Header=serde_json::from_slice(&URL_SAFE_NO_PAD.decode(parts[0]).map_err(|_|OfflineGrantError)?).map_err(|_|OfflineGrantError)?;
        if header.alg!="EdDSA"||header.typ!="greiva-offline-v1+jwt"{return Err(OfflineGrantError)}
        let key=self.keys.get(&header.kid).ok_or(OfflineGrantError)?;
        let bytes=URL_SAFE_NO_PAD.decode(parts[2]).map_err(|_|OfflineGrantError)?;
        let signature=Signature::from_slice(&bytes).map_err(|_|OfflineGrantError)?;
        key.verify_strict(format!("{}.{}",parts[0],parts[1]).as_bytes(),&signature).map_err(|_|OfflineGrantError)?;
        let claims:Claims=serde_json::from_slice(&URL_SAFE_NO_PAD.decode(parts[1]).map_err(|_|OfflineGrantError)?).map_err(|_|OfflineGrantError)?;
        if claims.iss!=self.issuer||claims.aud!=self.audience||!text(&claims.auth_issuer,2048)||!text(&claims.sub,512)
            || ![&claims.workspace_id,&claims.client_id,&claims.stream_epoch].iter().all(|s|uuid_v7(s))
            ||claims.iat==0||claims.iat.checked_add(OFFLINE_SECONDS)!=Some(claims.exp)||claims.exp>9_007_199_254_740_991||!nonce(&claims.nonce){return Err(OfflineGrantError)}
        let context=WorkspaceContext{issuer:claims.auth_issuer,subject_id:claims.sub,workspace_id:claims.workspace_id,client_id:claims.client_id,stream_epoch:claims.stream_epoch};
        if &context!=expected{return Err(OfflineGrantError)}
        Ok(VerifiedOfflineGrant{context,issued_at:claims.iat,expires_at:claims.exp,nonce:claims.nonce})
    }
}

#[cfg(test)]
mod tests {
    use super::*;use ed25519_dalek::{Signer,SigningKey};use serde_json::{json,Value};
    fn context()->WorkspaceContext{WorkspaceContext{issuer:"https://auth.fixture.invalid/auth/v1".into(),subject_id:"synthetic-owner".into(),workspace_id:"01900000-0000-7000-8000-000000000001".into(),client_id:"01900000-0000-7000-8000-000000000002".into(),stream_epoch:"01900000-0000-7000-8000-000000000003".into()}}
    fn claims()->Value{let c=context();json!({"iss":"https://api.fixture.invalid","aud":"greiva-private","sub":c.subject_id,"authIssuer":c.issuer,"workspaceId":c.workspace_id,"clientId":c.client_id,"streamEpoch":c.stream_epoch,"iat":1000,"exp":605800,"nonce":"a".repeat(64)})}
    fn signed(payload:&str,header:Value,key:&SigningKey)->String{let input=format!("{}.{}",URL_SAFE_NO_PAD.encode(header.to_string()),URL_SAFE_NO_PAD.encode(payload));format!("{}.{}",input,URL_SAFE_NO_PAD.encode(key.sign(input.as_bytes()).to_bytes()))}
    fn fixture()->(SigningKey,OfflineGrantVerifier){let key=SigningKey::from_bytes(&[42;32]);let verifier=OfflineGrantVerifier::new("https://api.fixture.invalid".into(),"greiva-private".into(),vec![("fixture".into(),key.verifying_key().to_bytes())]).unwrap();(key,verifier)}
    #[test]
    fn compiled_public_pin_refuses_weak_keys_noncanonical_hex_and_untrusted_urls(){let (key,_)=fixture();let hex=key.verifying_key().to_bytes().iter().map(|b|format!("{b:02x}")).collect::<String>();assert!(OfflineGrantVerifier::from_public_pin("https://api.fixture.invalid","native","fixture",&hex).is_ok());for issuer in ["http://api.invalid","https://user@api.invalid","https://api.invalid?q=1","https://api.invalid/#key"]{assert!(OfflineGrantVerifier::from_public_pin(issuer,"native","fixture",&hex).is_err());}for bad in ["0".repeat(64),hex.to_uppercase(),"a".repeat(63)]{assert!(OfflineGrantVerifier::from_public_pin("https://api.invalid","native","fixture",&bad).is_err());}}
    fn header()->Value{json!({"alg":"EdDSA","typ":"greiva-offline-v1+jwt","kid":"fixture"})}
    #[test]
    fn exact_expiry_clock_rollback_and_challenge_are_checked(){let(k,v)=fixture();let grant=v.verify(&signed(&claims().to_string(),header(),&k),&context()).unwrap();assert!(grant.check_time(1000,1000).is_ok());assert!(grant.check_time(605799,1000).is_ok());assert!(grant.check_time(605800,1000).is_err());assert!(grant.check_time(999,0).is_err());assert!(grant.check_time(2000,2001).is_err());assert!(grant.check_challenge(&"a".repeat(64)).is_ok());assert!(grant.check_challenge(&"b".repeat(64)).is_err());}
    #[test]
    fn scope_every_field_and_signed_ttl_cannot_be_overridden(){let(k,v)=fixture();for(field,value)in [("iss",json!("foreign")),("aud",json!("foreign")),("sub",json!("other")),("authIssuer",json!("https://other.invalid")),("workspaceId",json!("01900000-0000-7000-8000-000000000004")),("clientId",json!("01900000-0000-7000-8000-000000000004")),("streamEpoch",json!("01900000-0000-7000-8000-000000000004")),("exp",json!(605801)),("iat",json!(0)),("nonce",json!("bad")),("extra",json!(true))]{let mut c=claims();c[field]=value;assert!(v.verify(&signed(&c.to_string(),header(),&k),&context()).is_err(),"{field}");}}
    #[test]
    fn signature_algorithm_headers_and_duplicate_claims_refuse(){let(k,v)=fixture();for h in [json!({"alg":"none","typ":"greiva-offline-v1+jwt","kid":"fixture"}),json!({"alg":"EdDSA","typ":"JWT","kid":"fixture"}),json!({"alg":"EdDSA","typ":"greiva-offline-v1+jwt","kid":"missing"}),json!({"alg":"EdDSA","typ":"greiva-offline-v1+jwt","kid":"fixture","jku":"https://untrusted.invalid"})]{assert!(v.verify(&signed(&claims().to_string(),h,&k),&context()).is_err());}let raw=claims().to_string();let duplicate=format!("{{\"exp\":605800,{}",&raw[1..]);assert!(v.verify(&signed(&duplicate,header(),&k),&context()).is_err());let wrong=SigningKey::from_bytes(&[43;32]);assert!(v.verify(&signed(&raw,header(),&wrong),&context()).is_err());let token=signed(&raw,header(),&k);for bad in [token.clone()+"=",token.clone()+".extra",token[..token.len()-3].into(),"x".repeat(8193)]{assert!(v.verify(&bad,&context()).is_err());}}
}
