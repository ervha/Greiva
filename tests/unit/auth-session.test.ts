import { it, expect, vi } from 'vitest';
import { AuthSession, AuthSessionError, supabaseAuthSession, type AuthSessionPorts } from '@greiva/sync';
import { supabaseConfiguration } from '@greiva/shared';
const issuer='https://auth.fixture.invalid/auth/v1';
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>{resolve=yes;});return {promise,resolve};}
function fixture(){
  const token={access_token:'fixture.access.signature',refresh_token:'fixture-refresh-A',token_type:'bearer',user:{id:'owner-A'}},identity={issuer,subjectId:'owner-A',expiresAt:200};
  const ports={login:vi.fn(async()=>token),refresh:vi.fn(async(_token:string,_signal:AbortSignal)=>({...token,access_token:'new.access.signature',refresh_token:'fixture-refresh-B'})),verify:vi.fn(async()=>identity),revoke:vi.fn(async()=>{})};
  const clock={now:100};return {token,identity,ports,clock,session:new AuthSession(issuer,ports,()=>clock.now)};
}
it('AUTH-SESSION: tokens are memory-only and identity is exposed only after server verification',async()=>{
  const f=fixture(),wait=deferred<unknown>();f.ports.verify.mockImplementationOnce(()=>wait.promise as Promise<typeof f.identity>);
  const login=f.session.login('fixture@example.invalid','fixture-password');await Promise.resolve();expect(f.session.identity).toBeNull();wait.resolve(f.identity);
  expect(await login).toEqual(f.identity);expect(Object.isFrozen(f.session.identity)).toBe(true);expect(JSON.stringify(f.session)).toBe('{}');
  await f.session.authorized(async(authorization,_signal,identity)=>{expect(authorization).toBe('Bearer fixture.access.signature');expect(identity).toEqual(f.identity);});
  expect(f.ports.verify).toHaveBeenCalledWith(f.token.access_token,expect.any(AbortSignal));
});
it('AUTH-SESSION: refresh rotates tokens atomically after verification and never uses old access during refresh',async()=>{
  const f=fixture();await f.session.login('fixture@example.invalid','fixture-password');const wait=deferred<typeof f.token>();f.ports.refresh.mockImplementationOnce(()=>wait.promise);
  const refresh=f.session.refresh();expect(f.session.identity).toBeNull();await expect(f.session.authorized(async()=>{})).rejects.toMatchObject({stage:'busy'});await expect(f.session.refresh()).rejects.toMatchObject({stage:'busy'});
  wait.resolve({...f.token,access_token:'new.access.signature',refresh_token:'fixture-refresh-B'});await refresh;
  await f.session.authorized(async header=>expect(header).toBe('Bearer new.access.signature'));await f.session.refresh();expect(f.ports.refresh.mock.calls.map(call=>call[0])).toEqual(['fixture-refresh-A','fixture-refresh-B']);
});
it('AUTH-SESSION: close ignores late provider login and late verification even when transport ignores abort',async()=>{
  for(const stage of ['login','verify'] as const){const f=fixture(),wait=deferred<any>();f.ports[stage].mockImplementationOnce(()=>wait.promise);const login=f.session.login('fixture@example.invalid','fixture-password');await Promise.resolve();f.session.close();wait.resolve(stage==='login'?f.token:f.identity);
    await expect(login).rejects.toMatchObject({stage:'closed'});expect(f.session.identity).toBeNull();await expect(f.session.refresh()).rejects.toMatchObject({stage:'closed'});}
});
it('AUTH-SESSION: refresh and account switch abort old authorized requests and reject their late results',async()=>{
  for(const action of ['refresh','close'] as const){const f=fixture();await f.session.login('fixture@example.invalid','fixture-password');const wait=deferred<string>();let signal!:AbortSignal;
    const work=f.session.authorized(async(_header,current)=>{signal=current;return wait.promise;});if(action==='refresh')await f.session.refresh();else f.session.close();expect(signal.aborted).toBe(true);wait.resolve('private old result');await expect(work).rejects.toMatchObject({stage:'closed'});}
});
it('AUTH-SESSION: wrong issuer/subject, expired or malformed verified identities never authorize',async()=>{
  for(const identity of [{issuer:'https://other.invalid',subjectId:'owner-A',expiresAt:200},{issuer,subjectId:'owner-B',expiresAt:200},{issuer,subjectId:'owner-A',expiresAt:100},{issuer,subjectId:'owner-A',expiresAt:1.5}]){
    const f=fixture();f.ports.verify.mockResolvedValue(identity);await expect(f.session.login('fixture@example.invalid','fixture-password')).rejects.toMatchObject({stage:'identity'});expect(f.session.identity).toBeNull();await expect(f.session.authorized(async()=>{})).rejects.toMatchObject({stage:'unavailable'});}
});
it('AUTH-SESSION: refresh cannot switch the owner; failed refresh requires reauthentication and a different account needs a new instance',async()=>{
  const f=fixture();await f.session.login('fixture@example.invalid','fixture-password');f.ports.refresh.mockResolvedValue({...f.token,user:{id:'owner-B'}});f.ports.verify.mockResolvedValue({...f.identity,subjectId:'owner-B'});
  await expect(f.session.refresh()).rejects.toMatchObject({stage:'identity'});expect(f.session.identity).toBeNull();await expect(f.session.refresh()).rejects.toMatchObject({stage:'unavailable'});
  f.ports.login.mockResolvedValue({...f.token,user:{id:'owner-B'}});await expect(f.session.login('other@example.invalid','fixture-password')).rejects.toMatchObject({stage:'identity'});
});
it('AUTH-SESSION: expiry before or during authorized work blocks access without silent refresh',async()=>{
  const f=fixture();await f.session.login('fixture@example.invalid','fixture-password');f.clock.now=200;expect(f.session.identity).toBeNull();await expect(f.session.authorized(async()=>{})).rejects.toMatchObject({stage:'expired'});expect(f.ports.refresh).not.toHaveBeenCalled();
  f.clock.now=150;await expect(f.session.authorized(async()=>{f.clock.now=200;return 'late result';})).rejects.toMatchObject({stage:'expired'});
});
it('AUTH-SESSION: failed refresh and forged error objects disclose no token, body or cause',async()=>{
  const f=fixture();await f.session.login('fixture@example.invalid','fixture-password');const error=new AuthSessionError('provider');error.message='private token body';Object.assign(error,{cause:'private refresh token'});f.ports.refresh.mockRejectedValue(error);
  const failed=await f.session.refresh().catch(error=>error);expect(failed.message).toBe('Authentication provider');expect(failed.cause).toBeUndefined();expect(f.session.identity).toBeNull();expect(JSON.stringify(f.session)).toBe('{}');
});
it('AUTH-SESSION: logout closes locally before remote revoke and reports failed revoke without claiming global session invalidation',async()=>{
  const f=fixture();await f.session.login('fixture@example.invalid','fixture-password');const wait=deferred<void>();f.ports.revoke.mockImplementationOnce(()=>wait.promise);const logout=f.session.logout();expect(f.session.identity).toBeNull();await expect(f.session.authorized(async()=>{})).rejects.toMatchObject({stage:'closed'});wait.resolve();expect(await logout).toEqual({localClosed:true,providerLogoutConfirmed:true});
  const other=fixture();await other.session.login('fixture@example.invalid','fixture-password');other.ports.revoke.mockRejectedValue(Error('private headers'));expect(await other.session.logout()).toEqual({localClosed:true,providerLogoutConfirmed:false});
});
it('AUTH-SESSION: invalid credentials and malformed provider success never reach verification',async()=>{
  const f=fixture();await expect(f.session.login('','')).rejects.toMatchObject({stage:'credentials'});expect(f.ports.login).not.toHaveBeenCalled();
  for(const token of [{...f.token,access_token:'not a token'},{...f.token,refresh_token:''},{...f.token,token_type:'other'},{...f.token,user:{id:''}}]){f.ports.login.mockResolvedValue(token);await expect(f.session.login('fixture@example.invalid','fixture-password')).rejects.toMatchObject({stage:'provider'});}expect(f.ports.verify).not.toHaveBeenCalled();
});
it('AUTH-SESSION: caller port replacement cannot rebind a waiting authentication instance',async()=>{
  const f=fixture(),wait=deferred<typeof f.token>();f.ports.login.mockImplementationOnce(()=>wait.promise);const old=f.ports.verify,login=f.session.login('fixture@example.invalid','fixture-password');f.ports.verify=vi.fn(async()=>({...f.identity,subjectId:'owner-B'}));wait.resolve(f.token);await login;expect(old).toHaveBeenCalledOnce();expect(f.ports.verify).not.toHaveBeenCalled();
});
it('SUPABASE-CONFIG: HTTPS origin and asymmetric algorithms are explicit; credentials/path/query/foreign HTTP API are rejected',()=>{
  expect(supabaseConfiguration('https://project.fixture.invalid','ES256')).toMatchObject({issuer:'https://project.fixture.invalid/auth/v1',audience:'authenticated',algorithms:['ES256']});
  for(const url of ['http://project.fixture.invalid','https://project.fixture.invalid/','https://project.fixture.invalid/path','https://user:password@project.fixture.invalid','https://project.fixture.invalid?key=value'])expect(()=>supabaseConfiguration(url,'ES256')).toThrow();
  expect(()=>supabaseConfiguration('https://project.fixture.invalid','HS256' as 'ES256')).toThrow();
  const config={projectUrl:'https://project.fixture.invalid',algorithm:'ES256' as const,publishableKey:'sb_publishable_fixture',apiUrl:'http://127.0.0.1:3000'};
  for(const change of [{publishableKey:'sb_secret_fixture'},{publishableKey:'legacy.jwt.key'},{apiUrl:'http://remote.invalid'},{apiUrl:'https://api.invalid/path'},{apiUrl:'invalid'}])expect(()=>supabaseAuthSession({...config,...change})).toThrow();
});
it('SUPABASE-TRANSPORT: password/refresh/verify/local logout use captured origins and credentials stay out of URL/cookies',async()=>{
  const config={projectUrl:'https://project.fixture.invalid',algorithm:'ES256' as const,publishableKey:'sb_publishable_fixture',apiUrl:'http://127.0.0.1:3000'};
  const token={access_token:'fixture.access.signature',refresh_token:'fixture-refresh',token_type:'bearer',user:{id:'owner-A'}};
  const fetchPort=vi.fn<typeof fetch>(async(input,init)=>new Response(String(input).includes('/v1/session')?JSON.stringify({issuer:config.projectUrl+'/auth/v1',subjectId:'owner-A',expiresAt:Math.floor(Date.now()/1000)+60}):String(input).includes('/logout')?null:JSON.stringify(token),{status:String(input).includes('/logout')?204:200}));
  const session=supabaseAuthSession(config,fetchPort);config.apiUrl='https://changed.invalid';config.publishableKey='sb_publishable_changed';await session.login('fixture@example.invalid','fixture-password');await session.refresh();await session.logout();
  expect(fetchPort.mock.calls.map(([url])=>String(url))).toEqual(['https://project.fixture.invalid/auth/v1/token?grant_type=password','http://127.0.0.1:3000/v1/session','https://project.fixture.invalid/auth/v1/token?grant_type=refresh_token','http://127.0.0.1:3000/v1/session','https://project.fixture.invalid/auth/v1/logout?scope=local']);
  for(const [url,init] of fetchPort.mock.calls){expect(String(url)).not.toMatch(/fixture-password|fixture-refresh|fixture\.access/);expect(init?.credentials).toBe('omit');expect(init?.redirect).toBe('error');expect(init?.signal).toBeInstanceOf(AbortSignal);}
  expect(new Headers(fetchPort.mock.calls[0]?.[1]?.headers).get('apikey')).toBe('sb_publishable_fixture');expect(new Headers(fetchPort.mock.calls[1]?.[1]?.headers).get('apikey')).toBeNull();
  expect(JSON.parse(String(fetchPort.mock.calls[2]?.[1]?.body))).toEqual({refresh_token:'fixture-refresh'});
});
it('SUPABASE-TRANSPORT: HTTP failure/non-JSON success remains unauthenticated with fixed errors',async()=>{
  const config={projectUrl:'https://project.fixture.invalid',algorithm:'ES256' as const,publishableKey:'sb_publishable_fixture',apiUrl:'http://127.0.0.1:3000'};
  for(const response of [new Response('private provider error',{status:400}),new Response('<private html>',{status:200})]){const session=supabaseAuthSession(config,async()=>response);const error=await session.login('fixture@example.invalid','fixture-password').catch(error=>error);expect(error.message).toBe('Authentication provider');expect(error.cause).toBeUndefined();expect(session.identity).toBeNull();}
});
