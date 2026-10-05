import { it, expect } from 'vitest';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { newId } from '@greiva/shared';
import { privateRuntimeConfiguration, startPrivateApi } from '../../apps/api/src/private-runtime.js';
import { installPrivateWorkspaceSchema } from '../../apps/api/src/private-workspace-schema.js';

async function freePort() {
  const server = createServer(); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No fixture port');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); return address.port;
}
function command(file: string, env: NodeJS.ProcessEnv) {
  return new Promise<{ code: number | null; output: string }>((resolve, reject) => {
    const child = spawn(process.execPath, [file], { env, stdio: ['ignore', 'pipe', 'pipe'] }); let output = '';
    child.stdout.on('data', data => { output += String(data); }); child.stderr.on('data', data => { output += String(data); });
    child.on('error', reject); child.on('exit', code => resolve({ code, output }));
  });
}
const test = it.skipIf(process.env.GREIVA_TEST_POSTGRES !== '1');
test('PRIVATE-RUNTIME-PG: signed session/bootstrap uses actual startup/read-only schema; old aliases absent and close coalesced', async () => {
  const schema = 'greiva_private_runtime_' + newId().replaceAll('-', ''), pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const projectUrl = 'https://project.fixture.invalid', keys = await generateKeyPair('ES256'), jwk = { ...await exportJWK(keys.publicKey), kid: 'fixture', alg: 'ES256' };
  let runtime: Awaited<ReturnType<typeof startPrivateApi>> | undefined;
  try {
    await installPrivateWorkspaceSchema(pool, schema);
    const configuration = privateRuntimeConfiguration({ DATABASE_URL: process.env.DATABASE_URL, GREIVA_PRIVATE_SCHEMA: schema,
      GREIVA_SUPABASE_URL: projectUrl, GREIVA_SUPABASE_ALGORITHM: 'ES256', GREIVA_PRIVATE_PORT: String(await freePort()) });
    runtime = await startPrivateApi(configuration, { fetchJwks: async () => new Response(JSON.stringify({ keys: [jwk] })) });
    const token = await new SignJWT({ sub: 'owner-runtime', iss: projectUrl + '/auth/v1', aud: 'authenticated', exp: Math.floor(Date.now()/1000)+300 })
      .setProtectedHeader({ alg: 'ES256', kid: 'fixture' }).sign(keys.privateKey);
    expect((await fetch(runtime.address + '/v1/session')).status).toBe(401);
    const session = await fetch(runtime.address + '/v1/session', { headers: { authorization: 'Bearer ' + token } }); expect(session.status).toBe(200);
    const clientId = newId(), bootstrap = () => fetch(runtime!.address + '/v1/workspaces/bootstrap', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ clientId }) });
    const first = await bootstrap(); expect(first.status).toBe(200); const context = await first.json(); expect(await (await bootstrap()).json()).toEqual(context);
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_workspaces`)).rows[0].n).toBe(1);
    for (const path of ['/tasks', '/sync/pull', '/pages', '/health']) expect((await fetch(runtime.address + path)).status).toBe(404);
    const a = runtime.close(), b = runtime.close(); expect(a).toBe(b); await a; await expect(fetch(runtime.address + '/v1/session')).rejects.toThrow();
  } finally { await runtime?.close(); await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end(); }
});
test('PRIVATE-RUNTIME-PG: CLI initializer is explicit/non-destructive; missing or unknown schema prevents listening without credentials in output', async () => {
  const schema = 'greiva_private_cli_' + newId().replaceAll('-', ''), pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const env = { ...process.env, GREIVA_PRIVATE_SCHEMA: schema, GREIVA_SUPABASE_URL: 'https://project.fixture.invalid', GREIVA_SUPABASE_ALGORITHM: 'ES256', GREIVA_PRIVATE_PORT: String(await freePort()) };
  try {
    const absent = await command('apps/api/dist/private-main.js', env); expect(absent).toEqual({ code: 1, output: '{"service":"private-api","event":"failed","stage":"schema"}\n' });
    expect((await pool.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [schema])).rowCount).toBe(0);
    const created = await command('apps/api/dist/init-private.js', env); expect(created).toEqual({ code: 0, output: '{"service":"private-api","event":"schema_created"}\n' });
    const repeated = await command('apps/api/dist/init-private.js', env); expect(repeated).toEqual({ code: 1, output: '{"service":"private-api","event":"schema_install_failed"}\n' });
    expect((await pool.query(`SELECT version FROM "${schema}".private_schema_version`)).rows[0].version).toBe(1);
    await pool.query(`UPDATE "${schema}".private_schema_version SET version=2`);
    expect(await command('apps/api/dist/private-main.js', env)).toEqual(absent);
    expect((await pool.query(`SELECT version FROM "${schema}".private_schema_version`)).rows[0].version).toBe(2);
    await pool.query(`UPDATE "${schema}".private_schema_version SET version=1`);
    await pool.query(`DROP VIEW "${schema}".resource_access`);
    expect(await command('apps/api/dist/private-main.js', env)).toEqual(absent);
    const bad = await command('apps/api/dist/private-main.js', { ...env, GREIVA_SUPABASE_URL: 'https://fixture-secret@project.invalid' });
    expect(bad).toEqual({ code: 1, output: '{"service":"private-api","event":"failed","stage":"configuration"}\n' });
  } finally { await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end(); }
});
test('PRIVATE-RUNTIME-PG: actual process listens without legacy routes and SIGTERM closes listener/pool without schema mutation', async () => {
  const schema = 'greiva_private_signal_' + newId().replaceAll('-', ''), pool = new pg.Pool({ connectionString: process.env.DATABASE_URL }), port = await freePort();
  let child: ReturnType<typeof spawn> | undefined;
  try {
    await installPrivateWorkspaceSchema(pool, schema);
    child = spawn(process.execPath, ['apps/api/dist/private-main.js'], { env: { ...process.env, GREIVA_PRIVATE_SCHEMA: schema,
      GREIVA_SUPABASE_URL: 'https://project.fixture.invalid', GREIVA_SUPABASE_ALGORITHM: 'ES256', GREIVA_PRIVATE_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      child!.once('error', reject); child!.once('exit', (code, signal) => resolve({ code, signal }));
    });
    const line = await Promise.race([new Promise<string>(resolve => child!.stdout!.once('data', data => resolve(String(data)))), exited.then(() => { throw new Error('Startup exited'); })]);
    expect(JSON.parse(line)).toEqual({ service: 'private-api', event: 'listening', address: `http://127.0.0.1:${port}` });
    expect((await fetch(`http://127.0.0.1:${port}/v1/session`)).status).toBe(401);
    child.kill('SIGTERM'); expect(await exited).toEqual({ code: 0, signal: null });
    await expect(fetch(`http://127.0.0.1:${port}/v1/session`)).rejects.toThrow();
    expect((await pool.query(`SELECT count(*)::int AS n FROM "${schema}".private_workspaces`)).rows[0].n).toBe(0);
  } finally { if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await pool.end(); }
});
