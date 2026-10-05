import pg from 'pg';
import { installPrivateWorkspaceSchema, privateSchemaName } from './private-workspace-schema.js';
import { installPrivateStructuredSchema } from './private-structured-schema.js';

// Explicit operator command only; never called by normal/private API startup.
let pool: pg.Pool | undefined;
try {
  const schema = privateSchemaName(process.env.GREIVA_PRIVATE_SCHEMA ?? ''), dsn = process.env.DATABASE_URL;
  if (!dsn) throw new Error();
  const url = new URL(dsn);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2 || url.hash) throw new Error();
  pool = new pg.Pool({ connectionString: dsn, max: 1, connectionTimeoutMillis: 5_000, statement_timeout: 10_000 });
  pool.on('error', () => { /* no credential-bearing exception log */ });
  const mode=process.argv[2];
  if(mode==='--structured')await installPrivateStructuredSchema(pool,schema);
  else if(mode===undefined)await installPrivateWorkspaceSchema(pool,schema);
  else throw new Error();
  console.log(JSON.stringify({ service: 'private-api', event: mode==='--structured'?'structured_schema_installed':'schema_created' }));
} catch {
  console.error(JSON.stringify({ service: 'private-api', event: 'schema_install_failed' })); process.exitCode = 1;
} finally { try { await pool?.end(); } catch { process.exitCode = 1; } }
