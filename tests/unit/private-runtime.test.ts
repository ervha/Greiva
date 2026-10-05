import { it, expect, vi } from 'vitest';
import type pg from 'pg';
import { privateRuntimeConfiguration, startPrivateApi } from '../../apps/api/src/private-runtime.js';

const env = { DATABASE_URL: 'postgresql://fixture:fixture-secret@db.fixture.invalid/database', GREIVA_SUPABASE_URL: 'https://project.fixture.invalid',
  GREIVA_SUPABASE_ALGORITHM: 'ES256', GREIVA_PRIVATE_SCHEMA: 'greiva_private_fixture' };
it('PRIVATE-RUNTIME: explicit provider/schema/DSN, loopback default and finite ports; invalid settings never disclose input', () => {
  const config = privateRuntimeConfiguration(env); expect(Object.isFrozen(config)).toBe(true); expect(config).toMatchObject({ host: '127.0.0.1', port: 3001 });
  expect(privateRuntimeConfiguration({ ...env, GREIVA_PRIVATE_HOST: '0.0.0.0', GREIVA_PRIVATE_PORT: '65535' })).toMatchObject({ host: '0.0.0.0', port: 65535 });
  for (const bad of [{}, { ...env, GREIVA_SUPABASE_URL: undefined }, { ...env, GREIVA_SUPABASE_ALGORITHM: 'HS256' }, { ...env, GREIVA_PRIVATE_SCHEMA: 'public' },
    { ...env, DATABASE_URL: 'https://fixture-secret@db.invalid/database' }, { ...env, DATABASE_URL: 'postgres://db.invalid' },
    ...['0', '-1', '65536', '03001', '3001\n', 'NaN'].map(GREIVA_PRIVATE_PORT => ({ ...env, GREIVA_PRIVATE_PORT })),
    { ...env, GREIVA_PRIVATE_HOST: 'db.fixture.invalid' }]) {
    try { privateRuntimeConfiguration(bad); throw new Error('expected failure'); }
    catch (error) { expect(error).toMatchObject({ stage: 'configuration', message: 'Private API configuration failed' }); expect((error as Error).cause).toBeUndefined(); }
  }
});
it('PRIVATE-RUNTIME: failed readiness releases client/pool without DDL or listener and reconstructs safe errors', async () => {
  const queries: string[] = [], release = vi.fn(), end = vi.fn(async () => {});
  const pool = { on: vi.fn(), connect: async () => ({ release, query: async (sql: string) => {
    queries.push(sql); if (sql.includes('private_schema_version')) throw new Error('fixture-secret DSN'); return { rows: [], rowCount: 0 };
  } }), end } as unknown as pg.Pool;
  await expect(startPrivateApi(privateRuntimeConfiguration(env), { poolFactory: () => pool })).rejects.toMatchObject({ stage: 'schema', message: 'Private API schema failed' });
  expect(queries[0]).toContain('READ ONLY'); expect(queries.at(-1)).toBe('ROLLBACK'); expect(queries.some(query => /CREATE|INSERT|UPDATE|DELETE/.test(query))).toBe(false);
  expect(release).toHaveBeenCalledTimes(1); expect(end).toHaveBeenCalledTimes(1);
});
it('PRIVATE-RUNTIME: connection/config failures close owned pool and do not expose trusted port errors', async () => {
  const end = vi.fn(async () => {}), makePool = vi.fn(() => ({ on: vi.fn(), connect: async () => { throw new Error('fixture-secret'); }, end } as unknown as pg.Pool));
  await expect(startPrivateApi(privateRuntimeConfiguration(env), { poolFactory: makePool })).rejects.toMatchObject({ stage: 'schema', message: 'Private API schema failed' });
  expect(end).toHaveBeenCalledTimes(1);
  await expect(startPrivateApi({ ...privateRuntimeConfiguration(env), port: 0 }, { poolFactory: makePool })).rejects.toMatchObject({ stage: 'configuration' });
  expect(makePool).toHaveBeenCalledTimes(1);
});
