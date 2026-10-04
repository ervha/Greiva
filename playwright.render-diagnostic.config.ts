import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';
export default defineConfig({ ...base, testDir: './tests/diagnostics', testMatch: 'render-isolation.spec.ts', workers: 1 });
