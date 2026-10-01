import { defineConfig, devices } from '@playwright/test';
process.env.VITE_GREIVA_TEST_HOOKS = '1';
process.env.VITE_GREIVA_TEST_SQLITE = '1';
const evidence = process.env.GREIVA_EVIDENCE_DIR ?? 'tests/evidence/runs/latest';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, retries: 0,
  workers: 2,
  reporter: [['list'], ['json', { outputFile: `${evidence}/playwright.json` }], ['junit', { outputFile: `${evidence}/playwright.xml` }]],
  outputDir: `${evidence}/artifacts`,
  use: {
    baseURL: 'http://127.0.0.1:1420', trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'npm run dev -w @greiva/client', url: 'http://127.0.0.1:1420', reuseExistingServer: false },
    { command: 'npm run start -w @greiva/api', url: 'http://127.0.0.1:3000/health', reuseExistingServer: false },
    { command: 'npm run start -w @greiva/collaboration', url: 'http://127.0.0.1:1234/health', reuseExistingServer: false },
  ],
});
