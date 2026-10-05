import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { privateApiOrigin, supabaseConfiguration } from '@greiva/shared';
const sqlite = process.env.VITE_GREIVA_TEST_SQLITE === '1' ? (await import('../../tests/support/sqlite-bridge.ts')).sqliteBridge() : null;
const envDir = resolve(import.meta.dirname, '../..');
export default defineConfig(({ mode }) => {
  const publicEnv = { ...loadEnv(mode, envDir, 'VITE_GREIVA_'), ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('VITE_GREIVA_'))) };
  const project = publicEnv.VITE_GREIVA_SUPABASE_URL, algorithm = publicEnv.VITE_GREIVA_SUPABASE_ALGORITHM, key = publicEnv.VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY, api = publicEnv.VITE_GREIVA_PRIVATE_API_ORIGIN;
  // Reject credential-like misconfiguration before Vite embeds public settings.
  if (algorithm && !['ES256', 'RS256'].includes(algorithm)) throw new Error('Invalid public authentication configuration');
  if (project) supabaseConfiguration(project, algorithm === 'RS256' ? 'RS256' : 'ES256');
  if (api) privateApiOrigin(api);
  if (key && (key.length > 512 || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key))) throw new Error('Invalid public authentication configuration');
  const target = process.env.GREIVA_PRIVATE_PROXY_TARGET ?? loadEnv(mode, envDir, 'GREIVA_PRIVATE_PROXY_TARGET').GREIVA_PRIVATE_PROXY_TARGET;
  const privateTarget = target ? privateApiOrigin(target) : null;
  return {
  envDir,
  plugins: [react(), ...(sqlite ? [sqlite] : [])],
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] }, ...(privateTarget ? { proxy: { '/v1': { target: privateTarget, changeOrigin: true } } } : {}) },
  build: { rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), auth: resolve(import.meta.dirname, 'auth.html') } } },
  clearScreen: false,
  };
});
