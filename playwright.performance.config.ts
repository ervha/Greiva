import {defineConfig,devices} from '@playwright/test';
const evidence=process.env.GREIVA_EVIDENCE_DIR ?? 'tests/evidence/runs/performance';
process.env.VITE_GREIVA_TEST_HOOKS='1';
process.env.VITE_GREIVA_TEST_SQLITE='1';
export default defineConfig({
  testDir:'./tests/performance',testMatch:'*.spec.ts',fullyParallel:false,workers:1,retries:0,
  timeout:300_000,expect:{timeout:15_000},
  reporter:[['list'],['json',{outputFile:`${evidence}/playwright.json`}],['junit',{outputFile:`${evidence}/playwright.xml`}]],
  outputDir:`${evidence}/artifacts`,
  use:{baseURL:'http://127.0.0.1:1420',trace:'retain-on-failure',
    launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}},
  projects:[{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer:[
    {command:'npm exec -w @greiva/client -- vite preview --host 127.0.0.1 --port 1420 --strictPort --outDir dist-performance',url:'http://127.0.0.1:1420',reuseExistingServer:false},
    {command:'npm run start -w @greiva/api',url:'http://127.0.0.1:3000/health',reuseExistingServer:false},
    {command:'npm run start -w @greiva/collaboration',url:'http://127.0.0.1:1234/health',reuseExistingServer:false},
  ],
});
