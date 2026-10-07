import {defineConfig,devices} from '@playwright/test';
const evidence=process.env.GREIVA_EVIDENCE_DIR??'tests/evidence/runs/private-workspace';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:'private-workspace.spec.ts',fullyParallel:false,workers:1,retries:0,
 reporter:[['list'],['json',{outputFile:evidence+'/playwright.json'}]],outputDir:evidence+'/artifacts',
 use:{baseURL:'http://127.0.0.1:1422',trace:'retain-on-failure'},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1280,height:900}}},{name:'mobile-dark-reduced-motion',use:{...devices['Desktop Chrome'],viewport:{width:360,height:780},colorScheme:'dark',reducedMotion:'reduce'}}],
 webServer:{command:'npm run dev -w @greiva/client -- --port 1422',url:'http://127.0.0.1:1422',reuseExistingServer:false,
 env:{...process.env,VITE_GREIVA_TEST_HOOKS:'1',VITE_GREIVA_TEST_SQLITE:'0',VITE_GREIVA_SUPABASE_URL:'https://project.fixture.invalid',VITE_GREIVA_SUPABASE_ALGORITHM:'ES256',VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',VITE_GREIVA_PRIVATE_API_ORIGIN:'http://127.0.0.1:1422'}},
});
