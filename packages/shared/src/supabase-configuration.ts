// Trusted deployment configuration only. Never derive endpoints from token claims.
export function privateApiOrigin(candidate: string) {
  let url: URL; try { url = new URL(candidate); } catch { throw new Error('Invalid private API configuration'); }
  if (candidate !== url.origin || url.username || url.password
    || !(url.protocol === 'https:' || url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) throw new Error('Invalid private API configuration');
  return url.origin;
}
export function supabaseConfiguration(projectUrl: string, algorithm: 'ES256' | 'RS256') {
  let url: URL;
  try { url = new URL(projectUrl); } catch { throw new Error('Invalid Supabase configuration'); }
  if (projectUrl !== url.origin || url.protocol !== 'https:' || url.username || url.password
    || !['ES256', 'RS256'].includes(algorithm)) throw new Error('Invalid Supabase configuration');
  return Object.freeze({ projectUrl, issuer: `${projectUrl}/auth/v1`, audience: 'authenticated',
    jwksUrl: `${projectUrl}/auth/v1/.well-known/jwks.json`, algorithms: Object.freeze([algorithm]) });
}
