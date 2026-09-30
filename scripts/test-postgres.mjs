import { spawnSync } from 'node:child_process';
const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['exec', '--', 'vitest', 'run', 'tests/integration/postgres.test.ts'], { stdio: 'inherit', env: { ...process.env, GREIVA_TEST_POSTGRES: '1' }, shell: process.platform === 'win32' });
process.exit(result.status ?? 1);
