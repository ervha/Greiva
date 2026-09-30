import { defineConfig } from 'vitest/config';
const evidence = process.env.GREIVA_EVIDENCE_DIR ?? 'tests/evidence/runs/latest';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    reporters: ['default', 'json', 'junit'],
    outputFile: { json: `${evidence}/vitest.json`, junit: `${evidence}/vitest.xml` },
    testTimeout: 15000,
  },
});
