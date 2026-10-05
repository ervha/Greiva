import { supabaseConfiguration, privateApiOrigin } from '@greiva/shared';
import { AuthSession, AuthSessionError, type AuthSessionPorts } from './auth-session.js';

// Provider and Greiva origins are explicit trusted deployment configuration.
// fetchPort is infrastructure/test injection, never a field of a login request.
export function supabaseAuthSession(configuration: Readonly<{ projectUrl: string; publishableKey: string; algorithm: 'ES256' | 'RS256'; apiUrl: string }>, fetchPort: typeof fetch = globalThis.fetch) {
  const provider = supabaseConfiguration(configuration.projectUrl, configuration.algorithm);
  const key = configuration.publishableKey;
  let apiUrl: string; try { apiUrl = privateApiOrigin(configuration.apiUrl); } catch { throw new AuthSessionError('identity'); }
  if (typeof key !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new AuthSessionError('identity');
  async function call(url: string, signal: AbortSignal, headers: Record<string, string>, body?: unknown) {
    const response = await fetchPort(url, { method: body === undefined ? 'GET' : 'POST',
      headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), credentials: 'omit', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) });
    if (!response.ok) throw new AuthSessionError('provider');
    return response;
  }
  const ports: AuthSessionPorts = {
    async login(email, password, signal) { return (await call(`${provider.issuer}/token?grant_type=password`, signal, { apikey: key }, { email, password })).json(); },
    async refresh(refreshToken, signal) { return (await call(`${provider.issuer}/token?grant_type=refresh_token`, signal, { apikey: key }, { refresh_token: refreshToken })).json(); },
    async verify(accessToken, signal) { return (await call(`${apiUrl}/v1/session`, signal, { authorization: `Bearer ${accessToken}` })).json(); },
    async revoke(accessToken, signal) { await call(`${provider.issuer}/logout?scope=local`, signal, { apikey: key, authorization: `Bearer ${accessToken}` }, {}); },
  };
  return new AuthSession(provider.issuer, ports);
}
