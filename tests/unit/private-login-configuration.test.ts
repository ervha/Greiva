import { it, expect } from 'vitest';
import type { ConfigEnv, UserConfigFnObject } from 'vite';
// The Vite config is also typechecked by the client project; load it as Vite
// does, without pulling its allowed .ts bridge imports into Node test emit.
const configurationFile = '../../apps/client/vite.config.ts';
const { default: config } = await import(configurationFile);
const configure = config as UserConfigFnObject, mode: ConfigEnv = { command: 'serve', mode: 'test' };
it('PRIVATE-LOGIN-CONFIG: rejects credential-like public settings before bundling without disclosing supplied values', () => {
  const keys = ['VITE_GREIVA_SUPABASE_URL', 'VITE_GREIVA_SUPABASE_ALGORITHM', 'VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY', 'VITE_GREIVA_PRIVATE_API_ORIGIN'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    for (const key of keys) delete process.env[key]; expect(configure(mode)).toMatchObject({ server: { port: 1420 }, build: { rollupOptions: { input: { auth: expect.stringContaining('auth.html') } } } });
    for (const [key, value] of [
      ['VITE_GREIVA_SUPABASE_URL', 'https://fixture-private-value@project.invalid'], ['VITE_GREIVA_SUPABASE_ALGORITHM', 'fixture-private-value'],
      ['VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY', 'sb_secret_fixture-private-value'], ['VITE_GREIVA_PRIVATE_API_ORIGIN', 'https://fixture-private-value@api.invalid'],
    ]) {
      process.env[key!] = value;
      let failure: unknown; try { configure(mode); } catch (error) { failure = error; }
      expect(failure).toBeInstanceOf(Error); expect(String(failure)).not.toContain('fixture-private-value'); delete process.env[key!];
    }
  } finally { for (const [key, value] of Object.entries(saved)) if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
it('PRIVATE-LOGIN-CONFIG: optional proxy is fixed at configuration time and rejects insecure non-loopback destinations', () => {
  const saved = process.env.GREIVA_PRIVATE_PROXY_TARGET;
  try {
    process.env.GREIVA_PRIVATE_PROXY_TARGET = 'http://127.0.0.1:3001'; const result = configure(mode);
    expect(result.server?.proxy).toEqual({ '/v1': { target: 'http://127.0.0.1:3001', changeOrigin: true } });
    process.env.GREIVA_PRIVATE_PROXY_TARGET = 'http://other.fixture.invalid'; expect(() => configure(mode)).toThrow();
    expect(result.server?.proxy).toEqual({ '/v1': { target: 'http://127.0.0.1:3001', changeOrigin: true } });
  } finally { if (saved === undefined) delete process.env.GREIVA_PRIVATE_PROXY_TARGET; else process.env.GREIVA_PRIVATE_PROXY_TARGET = saved; }
});
