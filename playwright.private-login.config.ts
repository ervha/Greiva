import { defineConfig, devices } from '@playwright/test';
const evidence = process.env.GREIVA_EVIDENCE_DIR ?? 'tests/evidence/runs/private-login';
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'private-login.spec.ts', fullyParallel: false, workers: 2, retries: 0,
  reporter: [['list'], ['json', { outputFile: `${evidence}/playwright.json` }]], outputDir: `${evidence}/artifacts`,
  use: { baseURL: 'http://127.0.0.1:1421', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile-dark-reduced-motion', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 }, colorScheme: 'dark', reducedMotion: 'reduce' } },
  ],
  webServer: { command: 'npm run dev -w @greiva/client -- --port 1421', url: 'http://127.0.0.1:1421/auth.html', reuseExistingServer: false,
    env: { ...process.env, VITE_GREIVA_TEST_HOOKS: '0', VITE_GREIVA_TEST_SQLITE: '0', VITE_GREIVA_SUPABASE_URL: 'https://project.fixture.invalid',
      VITE_GREIVA_SUPABASE_ALGORITHM: 'ES256', VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture', VITE_GREIVA_PRIVATE_API_ORIGIN: 'http://127.0.0.1:1421' } },
});
