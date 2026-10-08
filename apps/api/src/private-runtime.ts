import pg from 'pg';
import { supabaseConfiguration } from '@greiva/shared';
import { PostgresPrivateAccessStore } from './private-access-store.js';
import { PostgresPrivateBootstrapStore } from './private-bootstrap-store.js';
import { privateSchemaName, verifyPrivateWorkspaceSchema } from './private-workspace-schema.js';
import { createSupabasePrivateApp } from './supabase-private-app.js';
import { PostgresPrivateTransactions } from './private-transactions.js';
import { PostgresPrivateStructuredStore } from './private-structured-store.js';
import {PostgresPrivatePageMetadataStore} from './private-page-metadata-store.js';
import { PostgresPrivatePageStore } from './private-page-store.js';
import {PostgresPrivatePageChangesStore} from './private-page-changes-store.js';
import {PostgresPrivateDatabaseSourceStore} from './private-database-source-store.js';

export class PrivateRuntimeError extends Error {
  constructor(readonly stage: 'configuration' | 'schema' | 'listen' | 'shutdown') {
    super(`Private API ${stage} failed`); this.name = 'PrivateRuntimeError';
  }
}
export type PrivateRuntimeConfiguration = Readonly<{
  projectUrl: string; algorithm: 'ES256' | 'RS256'; databaseUrl: string; schema: string; host: '127.0.0.1' | '0.0.0.0'; port: number;
}>;
// No provider, schema, DB or externally reachable listener is guessed. DSN is
// private configuration and must never be logged with this object.
export function privateRuntimeConfiguration(env: Readonly<Record<string, string | undefined>>): PrivateRuntimeConfiguration {
  try {
    const projectUrl = env.GREIVA_SUPABASE_URL, algorithm = env.GREIVA_SUPABASE_ALGORITHM;
    if (!projectUrl || (algorithm !== 'ES256' && algorithm !== 'RS256')) throw new Error();
    supabaseConfiguration(projectUrl, algorithm);
    const databaseUrl = env.DATABASE_URL, schema = privateSchemaName(env.GREIVA_PRIVATE_SCHEMA ?? '');
    if (!databaseUrl) throw new Error();
    const database = new URL(databaseUrl);
    if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname || database.pathname.length < 2 || database.hash) throw new Error();
    const host = env.GREIVA_PRIVATE_HOST ?? '127.0.0.1', portText = env.GREIVA_PRIVATE_PORT ?? '3001';
    if (!['127.0.0.1', '0.0.0.0'].includes(host) || !/^[1-9]\d{0,4}$/.test(portText) || Number(portText) > 65535) throw new Error();
    return Object.freeze({ projectUrl, algorithm, databaseUrl, schema, host: host as PrivateRuntimeConfiguration['host'], port: Number(portText) });
  } catch { throw new PrivateRuntimeError('configuration'); }
}
// Owns its pool and app; injected ports are trusted infrastructure for tests.
// Startup checks existing metadata read-only and never invokes the installer.
export async function startPrivateApi(configuration: PrivateRuntimeConfiguration, options: Readonly<{
  poolFactory?: (dsn: string) => pg.Pool; fetchJwks?: typeof fetch;
}> = {}) {
  const config = privateRuntimeConfiguration({ GREIVA_SUPABASE_URL: configuration.projectUrl, GREIVA_SUPABASE_ALGORITHM: configuration.algorithm,
    DATABASE_URL: configuration.databaseUrl, GREIVA_PRIVATE_SCHEMA: configuration.schema, GREIVA_PRIVATE_HOST: configuration.host, GREIVA_PRIVATE_PORT: String(configuration.port) });
  const makePool = options.poolFactory ?? (dsn => new pg.Pool({ connectionString: dsn, max: 5, connectionTimeoutMillis: 5_000, statement_timeout: 10_000 }));
  const fetchJwks = options.fetchJwks;
  let pool: pg.Pool | undefined, app: Awaited<ReturnType<typeof createSupabasePrivateApp>> | undefined, stage: PrivateRuntimeError['stage'] = 'schema';
  try {
    pool = makePool(config.databaseUrl);
    // Idle pool errors must not become an uncaught exception or print a DSN.
    pool.on('error', () => { /* active operations still fail closed */ });
    const schemaVersion = await verifyPrivateWorkspaceSchema(pool, config.schema);
    stage = 'listen';
    app = await createSupabasePrivateApp({ projectUrl: config.projectUrl, algorithm: config.algorithm },
      new PostgresPrivateAccessStore(pool, config.schema), new PostgresPrivateBootstrapStore(pool, config.schema), fetchJwks, new PostgresPrivateTransactions(pool, config.schema),
      schemaVersion>=2?new PostgresPrivateStructuredStore(pool,config.schema):undefined,
      schemaVersion>=3?new PostgresPrivatePageStore(pool,config.schema):undefined,
      schemaVersion>=4?new PostgresPrivatePageMetadataStore(pool,config.schema):undefined,
      schemaVersion>=5?new PostgresPrivatePageChangesStore(pool,config.schema):undefined,
      schemaVersion>=6?new PostgresPrivateDatabaseSourceStore(pool,config.schema):undefined);
    await app.listen(config.port, config.host);
    const address = await app.getUrl(), capturedApp = app, capturedPool = pool;
    let closing: Promise<void> | undefined;
    return Object.freeze({ address, close: () => closing ??= (async () => {
      let failed = false;
      try { await capturedApp.close(); } catch { failed = true; }
      try { await capturedPool.end(); } catch { failed = true; }
      if (failed) throw new PrivateRuntimeError('shutdown');
    })() });
  } catch {
    try { await app?.close(); } catch { /* preserve sanitized stage */ }
    try { await pool?.end(); } catch { /* preserve sanitized stage */ }
    throw new PrivateRuntimeError(stage);
  }
}
