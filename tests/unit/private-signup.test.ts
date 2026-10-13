import {it,expect,vi} from 'vitest';
import {supabaseSignup} from '@greiva/sync';
import {PrivateLoginController} from '../../apps/client/src/auth/private-login.js';
const config={projectUrl:'https://project.fixture.invalid',publishableKey:'sb_publishable_fixture',algorithm:'ES256' as const,apiUrl:'https://api.fixture.invalid'};
it('SIGNUP: exact provider destination/body; returned auto-confirm tokens and profile never create identity or device',async()=>{
  const requests:Array<{url:string;init:RequestInit}>=[],device=vi.fn(async()=>{throw Error('must not register');});
  const fetchPort:typeof fetch=async(url,init)=>{requests.push({url:String(url),init:init!});return new Response(JSON.stringify({access_token:'not-accepted',user:{email:'private@example.invalid'}}));};
  const controller=new PrivateLoginController(config,fetchPort,device);
  try {await controller.signup('fixture@example.invalid','fixture-password');expect(requests).toHaveLength(1);expect(requests[0]!.url).toBe(config.projectUrl+'/auth/v1/signup');
    expect(JSON.parse(String(requests[0]!.init.body))).toEqual({email:'fixture@example.invalid',password:'fixture-password'});
    expect(requests[0]!.init).toMatchObject({credentials:'omit',redirect:'error',cache:'no-store'});
    expect(controller.snapshot).toMatchObject({phase:'signup_requested',identity:null,context:null,busy:false});expect(controller.activeConnection).toBeNull();expect(device).not.toHaveBeenCalled();
    expect(JSON.stringify(controller.snapshot)).not.toMatch(/fixture-password|fixture@example|private@example|not-accepted/);
  }finally{controller.dispose();}
});
it('SIGNUP: invalid input/config never transmits credentials',async()=>{
  const fetchPort=vi.fn<typeof fetch>();
  for(const [email,password] of [['','fixture-password'],['fixture@example.invalid','short'],['x'.repeat(321),'fixture-password']])await expect(supabaseSignup(config,email!,password!,new AbortController().signal,fetchPort)).rejects.toThrow('Registration credentials');
  const controller=new PrivateLoginController({...config,publishableKey:''},fetchPort);await controller.signup('fixture@example.invalid','fixture-password');expect(controller.snapshot.phase).toBe('configuration');expect(fetchPort).not.toHaveBeenCalled();controller.dispose();
});
it.each([400,429,500])('SIGNUP: HTTP %s never echoes provider error/profile/credentials or grants workspace',async status=>{
  const controller=new PrivateLoginController(config,async()=>new Response(JSON.stringify({error:'provider-private-details',email:'private@example.invalid'}),{status}));
  try{await controller.signup('fixture@example.invalid','fixture-password');expect(controller.snapshot.phase).toBe('signed_out');expect(controller.snapshot.identity).toBeNull();expect(JSON.stringify(controller.snapshot)).not.toMatch(/provider-private|private@example|fixture-password/);expect(controller.snapshot.message).toContain(status===429?'一時的に制限':'結果を確認できません');}finally{controller.dispose();}
});
it('SIGNUP: close aborts held request, duplicate action is refused, late success cannot resurrect state',async()=>{
  let complete!:(r:Response)=>void,signal:AbortSignal|undefined;let calls=0;
  const controller=new PrivateLoginController(config,async(_url,init)=>{++calls;signal=init?.signal as AbortSignal;return new Promise<Response>(resolve=>{complete=resolve;});});
  const work=controller.signup('fixture@example.invalid','fixture-password');await controller.signup('fixture@example.invalid','fixture-password');expect(calls).toBe(1);expect(controller.snapshot.phase).toBe('signing_up');controller.close();expect(signal?.aborted).toBe(true);complete(new Response('{}'));await work;expect(controller.snapshot.phase).toBe('signed_out');expect(controller.snapshot.message).toContain('接続を閉じました');controller.dispose();
});
it('SIGNUP: network exception with private content is sanitized; no automatic retry',async()=>{
  const fetchPort=vi.fn<typeof fetch>(async()=>{throw Error('private@example.invalid fixture-password');});
  const controller=new PrivateLoginController(config,fetchPort);try{await controller.signup('fixture@example.invalid','fixture-password');expect(fetchPort).toHaveBeenCalledTimes(1);expect(controller.snapshot.message).toContain('結果を確認できません');expect(JSON.stringify(controller.snapshot)).not.toMatch(/private@example|fixture-password/);}finally{controller.dispose();}
});
