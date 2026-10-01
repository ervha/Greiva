import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { newId } from '@greiva/shared';
// A fresh owned namespace per run; never clear the development application DB.
if (!process.env.DATABASE_URL) throw new Error('Structured E2E requires the Docker PostgreSQL DATABASE_URL');
const schema = `greiva_test_${newId().replaceAll('-','')}`;
const admin = new pg.Client({connectionString:process.env.DATABASE_URL}); await admin.connect();
try {
  console.log(JSON.stringify({event:'structured-e2e-isolation',schema}));
  const result = spawnSync(process.platform==='win32' ? 'npm.cmd' : 'npm',['run','test:e2e'],{stdio:'inherit',
    env:{...process.env,GREIVA_TEST_STRUCTURED_SYNC:'1',GREIVA_DB_SCHEMA:schema,GREIVA_TEST_STORE_DIR:`../../.data/${schema}-stores`},shell:process.platform==='win32'});
  process.exitCode = result.status ?? 1;
} finally {
  await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  const remaining = await admin.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[schema]);
  if (remaining.rowCount!==0) throw new Error('Test namespace cleanup failed');
  console.log(JSON.stringify({event:'structured-e2e-cleanup',schema,remaining:remaining.rowCount}));
  await admin.end();
}
