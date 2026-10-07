import { it, expect, vi } from 'vitest';
import { newId } from '@greiva/shared';
import { PrivateLoginController, type PrivateLoginConfiguration } from '../../apps/client/src/auth/private-login.js';
const projectUrl = 'https://project.fixture.invalid', apiUrl = 'http://127.0.0.1:1421';
const configuration: PrivateLoginConfiguration = { projectUrl, apiUrl, algorithm: 'ES256', publishableKey: 'sb_publishable_fixture' };
function deferred<T>() { let resolve!: (value: T) => void; return { promise: new Promise<T>(done => { resolve = done; }), resolve: (value: T) => resolve(value) }; }
function fixture() {
  let subject = 'owner-fixture', expiresAt = Math.floor(Date.now()/1000)+300, bootstrapStatus = 200, logoutStatus = 200;
  const workspaceId = newId(), epoch = newId(), calls: { url: string; init: RequestInit | undefined }[] = [];
  let intercept: ((url: string) => Promise<Response> | undefined) | undefined;
  const fetchPort: typeof fetch = async (input, init) => {
    const url = String(input); calls.push({ url, init }); const replacement = intercept?.(url); if (replacement) return replacement;
    if (url.includes('/token?')) return Response.json({ access_token: 'fixture.header.signature', refresh_token: 'fixture-refresh', token_type: 'bearer', user: { id: subject } });
    if (url.endsWith('/v1/session')) return Response.json({ issuer: projectUrl + '/auth/v1', subjectId: subject, expiresAt });
    if (url.endsWith('/bootstrap')) return Response.json(bootstrapStatus === 200 ? { protocolVersion: 1, workspaceId, clientId: JSON.parse(String(init?.body)).clientId, epoch } : { error: 'fixture-private-provider-body' }, { status: bootstrapStatus });
    return new Response('', { status: logoutStatus });
  };
  return { calls, fetchPort, setSubject: (value: string) => { subject = value; }, setExpiry: (value: number) => { expiresAt = value; },
    setBootstrap: (value: number) => { bootstrapStatus = value; }, setLogout: (value: number) => { logoutStatus = value; }, setIntercept: (value: typeof intercept) => { intercept = value; } };
}
it('PRIVATE-LOGIN: durable device resolver is used only after verification and stable ID survives logout/login', async () => {
  const f = fixture(), clientId = newId(), resolveDevice = vi.fn(async (_identity: import('@greiva/sync').AuthIdentity, _signal: AbortSignal) => clientId), controller = new PrivateLoginController(configuration, f.fetchPort, resolveDevice);
  try {
    await controller.login('fixture@example.invalid', 'fixture-password'); await controller.register(); const first = controller.snapshot.context;
    expect(first?.clientId).toBe(clientId); expect(resolveDevice.mock.calls[0]?.[0]).toMatchObject({ subjectId: 'owner-fixture', issuer: projectUrl + '/auth/v1' });
    await controller.logout(); await controller.login('fixture@example.invalid', 'fixture-password'); await controller.register(); expect(controller.snapshot.context).toEqual(first);
  } finally { controller.dispose(); }
});
it('PRIVATE-LOGIN: close during device persistence never exposes identity or registers a late device; storage failure never falls back to random ID', async () => {
  const f = fixture(), wait = deferred<string>(), controller = new PrivateLoginController(configuration, f.fetchPort, async () => wait.promise);
  try {
    const login = controller.login('fixture@example.invalid', 'fixture-password'); await vi.waitFor(() => expect(controller.snapshot.phase).toBe('preparing_device'));
    expect(controller.snapshot).toMatchObject({ busy: true, identity: null, context: null }); controller.close(); wait.resolve(newId()); await login; await controller.register();
    expect(controller.snapshot.phase).toBe('signed_out'); expect(f.calls.some(call => call.url.endsWith('/bootstrap'))).toBe(false);
  } finally { controller.dispose(); }
  const failed = new PrivateLoginController(configuration, f.fetchPort, async () => { throw Error('private email token path'); });
  try { await failed.login('fixture@example.invalid', 'fixture-password'); await failed.register(); expect(failed.snapshot).toMatchObject({ phase: 'signed_out', identity: null, context: null }); expect(failed.snapshot.message).toContain('端末の登録情報'); expect(JSON.stringify(failed.snapshot)).not.toContain('private email token path'); }
  finally { failed.dispose(); }
});
it('PRIVATE-LOGIN: explicit login/registration/refresh/logout; immutable public snapshot omits tokens and ready is not synchronization', async () => {
  const f = fixture(), controller = new PrivateLoginController(configuration, f.fetchPort);
  try {
    expect(controller.snapshot.phase).toBe('signed_out'); await controller.login('fixture@example.invalid', 'fixture-password');
    expect(controller.snapshot).toMatchObject({ phase: 'verified', identity: { subjectId: 'owner-fixture' }, context: null }); expect(f.calls).toHaveLength(2);
    await controller.register(); const first = controller.snapshot.context; expect(first).not.toBeNull(); expect(controller.snapshot.phase).toBe('ready');
    expect(Object.isFrozen(controller.snapshot)).toBe(true); expect(JSON.stringify(controller.snapshot)).not.toMatch(/fixture-password|fixture-refresh|fixture.header.signature|publishable/);
    await controller.refresh(); expect(controller.snapshot).toMatchObject({ phase: 'verified', context: null }); await controller.register(); expect(controller.snapshot.context).toEqual(first);
    await controller.logout(); expect(controller.snapshot).toMatchObject({ phase: 'signed_out', identity: null, context: null }); expect(f.calls.at(-1)?.url).toBe(projectUrl + '/auth/v1/logout?scope=local');
  } finally { controller.dispose(); }
});
it('PRIVATE-LOGIN: close/dispose suppress ignored-abort late login; new login uses a fresh owner instance', async () => {
  const f = fixture(), wait = deferred<Response>(); f.setIntercept(url => url.includes('/token?') ? wait.promise : undefined);
  const controller = new PrivateLoginController(configuration, f.fetchPort), notify = vi.fn(), detach = controller.subscribe(notify);
  try {
    const old = controller.login('fixture@example.invalid', 'fixture-password'); await controller.login('ignored@example.invalid', 'ignored'); expect(f.calls).toHaveLength(1);
    controller.close(); f.setIntercept(undefined); f.setSubject('new-owner'); await controller.login('new@example.invalid', 'fixture-password');
    wait.resolve(Response.json({ access_token: 'fixture.header.signature', refresh_token: 'old-refresh', token_type: 'bearer', user: { id: 'old-owner' } })); await old;
    expect(controller.snapshot).toMatchObject({ phase: 'verified', identity: { subjectId: 'new-owner' } });
    controller.dispose(); const calls = notify.mock.calls.length; await controller.register(); await controller.refresh(); expect(notify).toHaveBeenCalledTimes(calls);
  } finally { detach(); controller.dispose(); }
});
it('PRIVATE-LOGIN: 503 registration can be explicitly retried with same ID; access denial clears local authentication', async () => {
  const f = fixture(), controller = new PrivateLoginController(configuration, f.fetchPort);
  try {
    await controller.login('fixture@example.invalid', 'fixture-password'); f.setBootstrap(503); await controller.register(); expect(controller.snapshot.phase).toBe('verified');
    expect(controller.snapshot.message).not.toContain('fixture-private-provider-body'); f.setBootstrap(200); await controller.register();
    const bodies = f.calls.filter(call => call.url.endsWith('/bootstrap')).map(call => call.init?.body); expect(bodies[0]).toBe(bodies[1]);
    controller.close(); await controller.login('fixture@example.invalid', 'fixture-password'); f.setBootstrap(403); await controller.register();
    expect(controller.snapshot).toMatchObject({ phase: 'signed_out', identity: null, context: null });
    expect(f.calls.filter(call => call.url.endsWith('/bootstrap')).at(-1)?.init?.body).not.toBe(bodies[0]);
  } finally { controller.dispose(); }
});
it('PRIVATE-LOGIN: refresh pending hides old identity/context, close defeats late rotated response', async () => {
  const f = fixture(), controller = new PrivateLoginController(configuration, f.fetchPort), wait = deferred<Response>();
  try {
    await controller.login('fixture@example.invalid', 'fixture-password'); await controller.register();
    f.setIntercept(url => url.includes('grant_type=refresh_token') ? wait.promise : undefined);
    const work = controller.refresh(); expect(controller.snapshot).toMatchObject({ phase: 'refreshing', busy: true, identity: null, context: null });
    controller.close(); wait.resolve(Response.json({ access_token: 'fixture.header.signature', refresh_token: 'rotated', token_type: 'bearer', user: { id: 'owner-fixture' } })); await work;
    expect(controller.snapshot).toMatchObject({ phase: 'signed_out', identity: null, context: null });
  } finally { controller.dispose(); }
});
it('PRIVATE-LOGIN: expiry updates status without implicit requests; explicit refresh requires another registration', async () => {
  vi.useFakeTimers(); const f = fixture(), controller = new PrivateLoginController(configuration, f.fetchPort);
  try {
    f.setExpiry(Math.floor(Date.now()/1000)+1); await controller.login('fixture@example.invalid', 'fixture-password'); await controller.register(); const calls = f.calls.length;
    await vi.advanceTimersByTimeAsync(1100); expect(controller.snapshot).toMatchObject({ phase: 'expired', identity: null, context: null }); expect(f.calls).toHaveLength(calls);
    f.setExpiry(Math.floor(Date.now()/1000)+300); await controller.refresh(); expect(controller.snapshot).toMatchObject({ phase: 'verified', context: null });
  } finally { controller.dispose(); vi.useRealTimers(); }
});
it('PRIVATE-LOGIN: logout local state closes immediately even when provider rejects, no raw error text is published', async () => {
  const f = fixture(), controller = new PrivateLoginController(configuration, f.fetchPort), wait = deferred<Response>();
  try {
    await controller.login('fixture@example.invalid', 'fixture-password'); await controller.register(); f.setIntercept(url => url.includes('/logout?') ? wait.promise : undefined);
    const work = controller.logout(); expect(controller.snapshot).toMatchObject({ phase: 'signing_out', identity: null, context: null });
    wait.resolve(new Response('fixture-private-provider-body', { status: 503 })); await work; expect(controller.snapshot.phase).toBe('signed_out');
    expect(controller.snapshot.message).toContain('サーバー側のログアウトは確認できませんでした'); expect(controller.snapshot.message).not.toContain('fixture-private-provider-body');
  } finally { controller.dispose(); }
});
it('PRIVATE-LOGIN: invalid deployment fails without network; mutable supplied settings do not alter captured endpoints/key', async () => {
  const f = fixture(), invalid = new PrivateLoginController({ ...configuration, publishableKey: '' }, f.fetchPort);
  expect(invalid.snapshot.phase).toBe('configuration'); await invalid.login('fixture@example.invalid', 'fixture-password'); expect(f.calls).toHaveLength(0); invalid.dispose();
  const config = { ...configuration }, controller = new PrivateLoginController(config, f.fetchPort); config.projectUrl = 'https://other.fixture.invalid'; config.publishableKey = 'sb_publishable_other';
  try { await controller.login('fixture@example.invalid', 'fixture-password'); expect(f.calls[0]?.url).toContain(projectUrl); expect(f.calls[0]?.init?.headers).toMatchObject({ apikey: 'sb_publishable_fixture' }); }
  finally { controller.dispose(); }
});
