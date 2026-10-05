import { it, expect, vi } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { newId } from '@greiva/shared';
import { supabaseAuthSession } from '@greiva/sync';
import { createSupabasePrivateApp } from '../../apps/api/src/supabase-private-app.js';

async function fixture(){
  const projectUrl='https://project.fixture.invalid',issuer=projectUrl+'/auth/v1',workspaceId=newId(),keys=await generateKeyPair('ES256');
  const jwk={...await exportJWK(keys.publicKey),alg:'ES256',kid:'fixture'};
  const read=vi.fn(async()=>({workspace:{id:workspaceId,ownerIssuer:issuer,ownerSubjectId:'owner-A'},resources:[]}));
  const jwks=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify({keys:[jwk]})));
  const app=await createSupabasePrivateApp({projectUrl,algorithm:'ES256'},{read},undefined,jwks);await app.listen(0,'127.0.0.1');const apiUrl=await app.getUrl();
  async function token(subject='owner-A',expired=false){return new SignJWT({sub:subject,iss:issuer,aud:'authenticated',exp:Math.floor(Date.now()/1000)+(expired?-60:300)}).setProtectedHeader({alg:'ES256',kid:'fixture'}).sign(keys.privateKey);}
  const providerCalls:{path:string;body:unknown}[]=[];
  let count=0,revoked=false,current=await token();
  const fetchPort:typeof fetch=async(input,init)=>{
    const url=new URL(String(input));if(url.origin!==projectUrl)return fetch(input,init);
    expect(new Headers(init?.headers).get('apikey')).toBe('sb_publishable_fixture');
    providerCalls.push({path:url.pathname+url.search,body:JSON.parse(String(init?.body))});
    if(url.pathname.endsWith('/logout')){revoked=true;return new Response(null,{status:204});}
    count++;return new Response(JSON.stringify({access_token:current,refresh_token:`fixture-refresh-${count}`,token_type:'bearer',user:{id:'owner-A'}}));
  };
  const session=supabaseAuthSession({projectUrl,algorithm:'ES256',publishableKey:'sb_publishable_fixture',apiUrl},fetchPort);
  return {app,apiUrl,issuer,workspaceId,read,jwks,token,session,providerCalls,setToken(value:string){current=value;},get revoked(){return revoked;}};
}
it('SUPABASE-AUTH-HTTP: provider fixture login/rotation passes actual signed-JWT HTTP verification and owner access',async()=>{
  const f=await fixture();try{
    expect((await fetch(f.apiUrl+'/v1/session')).status).toBe(401);
    const identity=await f.session.login('fixture@example.invalid','fixture-password');expect(identity).toMatchObject({issuer:f.issuer,subjectId:'owner-A'});expect(f.read).not.toHaveBeenCalled();expect(f.jwks).toHaveBeenCalledOnce();
    await f.session.authorized(async(header,signal)=>{const response=await fetch(`${f.apiUrl}/v1/workspaces/${f.workspaceId}/access`,{headers:{authorization:header},signal});expect(response.status).toBe(200);expect(await response.json()).toMatchObject({workspaceId:f.workspaceId,subjectId:'owner-A'});});
    await f.session.refresh();await f.session.refresh();expect(f.providerCalls.slice(1).map(call=>call.body)).toEqual([{refresh_token:'fixture-refresh-1'},{refresh_token:'fixture-refresh-2'}]);
    expect(await f.session.logout()).toEqual({localClosed:true,providerLogoutConfirmed:true});expect(f.revoked).toBe(true);expect(f.providerCalls.at(-1)?.path).toBe('/auth/v1/logout?scope=local');
    for(const path of ['/tasks','/relations','/sync/pull'])expect((await fetch(f.apiUrl+path)).status).toBe(404);
  }finally{f.session.close();await f.app.close();}
});
it('SUPABASE-AUTH-HTTP: expired JWT or provider user/token subject mismatch cannot establish a client identity',async()=>{
  const f=await fixture();try{
    f.setToken(await f.token('owner-A',true));await expect(f.session.login('fixture@example.invalid','fixture-password')).rejects.toMatchObject({stage:'verification'});expect(f.session.identity).toBeNull();
    f.setToken(await f.token('owner-B'));await expect(f.session.login('fixture@example.invalid','fixture-password')).rejects.toMatchObject({stage:'identity'});expect(f.read).not.toHaveBeenCalled();expect(f.session.identity).toBeNull();
  }finally{f.session.close();await f.app.close();}
});
