import { test, expect, type Page } from '@playwright/test';
const workspaceId = '01a10240-0000-7000-8000-000000000101', epoch = '01a10240-0000-7000-8000-000000000102';
async function fixture(page: Page) {
  const requests: { path: string; body: unknown }[] = []; let loginStatus = 200, refreshStatus = 200, bootstrapStatus = 200;
  let hold: Promise<void> | undefined;
  await page.route('https://project.fixture.invalid/auth/v1/**', async route => {
    const url = new URL(route.request().url()); requests.push({ path: url.pathname + url.search, body: route.request().postDataJSON() });
    if (hold) await hold;
    const status = url.searchParams.get('grant_type') === 'refresh_token' ? refreshStatus : loginStatus;
    await route.fulfill({ status: url.pathname.endsWith('/logout') ? 200 : status, contentType: 'application/json', body: JSON.stringify(status === 200
      ? { access_token: 'fixture.header.signature', refresh_token: 'fixture-refresh', token_type: 'bearer', user: { id: 'owner-fixture' } }
      : { error: 'fixture-private-error-body' }) }).catch(() => { /* close may abort the held fixture request */ });
  });
  await page.route('**/v1/session', route => route.fulfill({ json: { issuer: 'https://project.fixture.invalid/auth/v1', subjectId: 'owner-fixture', expiresAt: Math.floor(Date.now()/1000)+300 } }));
  await page.route('**/v1/workspaces/bootstrap', async route => {
    const body = route.request().postDataJSON() as { clientId: string }; requests.push({ path: '/v1/workspaces/bootstrap', body });
    await route.fulfill({ status: bootstrapStatus, json: bootstrapStatus === 200 ? { protocolVersion: 1, workspaceId, epoch, clientId: body.clientId } : { error: 'fixture-private-error-body' } });
  });
  return { requests, loginStatus: (value: number) => { loginStatus = value; }, refreshStatus: (value: number) => { refreshStatus = value; }, bootstrapStatus: (value: number) => { bootstrapStatus = value; }, hold: (value: Promise<void> | undefined) => { hold = value; } };
}
async function login(page: Page) {
  await page.getByRole('textbox', { name: 'メールアドレス' }).fill('fixture@example.invalid');
  await page.getByLabel('パスワード', { exact: true }).fill('fixture-password'); await page.getByRole('button', { name: 'ログインを確認', exact: true }).click();
}
const status = (page: Page) => page.getByLabel('接続確認の状態', { exact: true });
test('PRIVATE-LOGIN-UI: keyboard login, explicit bootstrap, refresh/re-register/local logout; no implicit sync or token storage', async ({ page }, info) => {
  const f = await fixture(page); await page.goto('/auth.html'); await expect(status(page)).toHaveText('ログインしていません'); expect(f.requests).toHaveLength(0);
  await info.attach('login-layout', { body: await page.screenshot(), contentType: 'image/png' });
  const email = page.getByRole('textbox', { name: 'メールアドレス' }); await email.focus(); await page.keyboard.type('fixture@example.invalid'); await page.keyboard.press('Tab');
  await expect(page.getByLabel('パスワード', { exact: true })).toBeFocused(); await page.keyboard.type('fixture-password'); await page.keyboard.press('Enter');
  await expect(status(page)).toHaveText('認証を確認しました'); expect(f.requests.filter(item => item.path === '/v1/workspaces/bootstrap')).toHaveLength(0);
  await page.getByRole('button', { name: 'workspace登録を確認', exact: true }).click(); await expect(status(page)).toHaveText('workspace登録を確認しました');
  await expect(page.getByText('データ同期はまだ開始していません。', { exact: false })).toBeVisible(); await expect(page.locator('.tiptap')).toHaveCount(0);
  const first = f.requests.find(item => item.path === '/v1/workspaces/bootstrap')?.body;
  await page.getByRole('button', { name: '認証を更新', exact: true }).click(); await expect(status(page)).toHaveText('認証を確認しました'); await expect(page.locator('.auth-success')).toHaveCount(0);
  await page.getByRole('button', { name: 'workspace登録を確認', exact: true }).click(); await expect(status(page)).toHaveText('workspace登録を確認しました');
  expect(f.requests.filter(item => item.path === '/v1/workspaces/bootstrap').at(-1)?.body).toEqual(first);
  expect(await page.evaluate(async () => ({ local: localStorage.length, session: sessionStorage.length, databases: (await indexedDB.databases()).length }))).toEqual({ local: 0, session: 0, databases: 0 });
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click(); await expect(status(page)).toHaveText('ログインしていません');
  expect(f.requests.at(-1)?.path).toBe('/auth/v1/logout?scope=local'); await expect(page.getByLabel('パスワード', { exact: true })).toHaveValue('');
});
test('PRIVATE-LOGIN-UI: failed provider/refresh/registration show fixed messages and clear revoked authentication', async ({ page }) => {
  const f = await fixture(page); f.loginStatus(400); await page.goto('/auth.html'); await login(page); await expect(page.getByRole('alert')).toContainText('ログインを確認できませんでした');
  await expect(page.getByLabel('パスワード', { exact: true })).toHaveValue(''); await expect(page.locator('body')).not.toContainText('fixture-private-error-body');
  f.loginStatus(200); await login(page); await expect(status(page)).toHaveText('認証を確認しました'); f.bootstrapStatus(503);
  await page.getByRole('button', { name: 'workspace登録を確認', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('もう一度お試しください');
  f.bootstrapStatus(403); await page.getByRole('button', { name: 'workspace登録を確認', exact: true }).click(); await expect(status(page)).toHaveText('ログインしていません');
  await login(page); await expect(status(page)).toHaveText('認証を確認しました'); f.refreshStatus(400); await page.getByRole('button', { name: '認証を更新', exact: true }).click();
  await expect(status(page)).toHaveText('ログインしていません'); await expect(page.getByRole('alert')).toContainText('認証を更新できませんでした');
});
test('PRIVATE-LOGIN-UI: pending password is cleared at submission, cancellation and reload never revive late login', async ({ page }) => {
  const f = await fixture(page); let release!: () => void; f.hold(new Promise<void>(resolve => { release = resolve; }));
  await page.goto('/auth.html'); await login(page); await expect(status(page)).toHaveText('ログインを確認中…');
  await expect(page.getByLabel('パスワード', { exact: true })).toHaveValue(''); await expect(page.getByRole('button', { name: 'ログインを確認', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: '接続を閉じる', exact: true }).click(); release(); f.hold(undefined); await expect(status(page)).toHaveText('ログインしていません');
  await login(page); await expect(status(page)).toHaveText('認証を確認しました'); await page.reload(); await expect(status(page)).toHaveText('ログインしていません');
  await expect(page.getByLabel('パスワード', { exact: true })).toHaveValue('');
});
test('PRIVATE-LOGIN-UI: composition does not submit, responsive keyboard controls and reduced motion preserve form', async ({ page }, info) => {
  const f = await fixture(page); await page.goto('/auth.html'); await page.getByRole('textbox', { name: 'メールアドレス' }).fill('fixture@example.invalid');
  const password = page.getByLabel('パスワード', { exact: true }); await password.fill('fixture-password');
  await password.dispatchEvent('compositionstart'); await page.getByRole('form', { name: 'ログイン', exact: true }).dispatchEvent('submit');
  expect(f.requests).toHaveLength(0); await expect(password).toHaveValue('fixture-password');
  await password.dispatchEvent('compositionend'); await page.getByRole('button', { name: 'ログインを確認', exact: true }).click(); await expect(status(page)).toHaveText('認証を確認しました');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name.includes('reduced-motion')) expect(await page.getByRole('button', { name: '認証を更新', exact: true }).evaluate(element => getComputedStyle(element).transitionProperty)).toBe('none');
  await info.attach('verified-layout', { body: await page.screenshot(), contentType: 'image/png' });
});
