import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const sqlite = process.env.VITE_GREIVA_TEST_SQLITE === '1' ? (await import('../../tests/support/sqlite-bridge.ts')).sqliteBridge() : null;
export default defineConfig({
  plugins: [react(), ...(sqlite ? [sqlite] : [])],
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } },
  clearScreen: false,
});
