import { supabaseConfiguration } from '@greiva/shared';

export class SignupError extends Error {
  constructor(readonly stage: 'credentials' | 'provider' | 'rate_limited' | 'unavailable') { super(`Registration ${stage}`); }
}

// Registration never grants a session. Ignore provider user/profile/token fields;
// a subsequent password login still needs the existing Greiva signature check.
export async function supabaseSignup(configuration: Readonly<{projectUrl:string;algorithm:'ES256'|'RS256';publishableKey:string}>,
  email:string,password:string,signal:AbortSignal,fetchPort:typeof fetch=globalThis.fetch):Promise<void> {
  const provider=supabaseConfiguration(configuration.projectUrl,configuration.algorithm),key=configuration.publishableKey;
  if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))throw new SignupError('provider');
  if(typeof email!=='string'||!email.trim()||email.length>320||/[\r\n]/.test(email)||typeof password!=='string'||password.length<8||password.length>4096)throw new SignupError('credentials');
  try {
    const response=await fetchPort(provider.issuer+'/signup',{method:'POST',headers:{apikey:key,'content-type':'application/json'},
      body:JSON.stringify({email:email.trim(),password}),credentials:'omit',redirect:'error',cache:'no-store',
      signal:AbortSignal.any([signal,AbortSignal.timeout(15_000)])});
    // Do not parse or retain account details, even when auto-confirm returns tokens.
    await response.body?.cancel();
    if(signal.aborted)throw new SignupError('unavailable');
    if(response.status===429)throw new SignupError('rate_limited');
    if(!response.ok)throw new SignupError('provider');
  } catch(error) { throw error instanceof SignupError?error:new SignupError('unavailable'); }
}
