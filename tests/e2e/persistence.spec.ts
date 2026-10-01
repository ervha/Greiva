import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { newId } from '@greiva/shared';

const body = (page: Page) => page.getByRole('textbox', { name: 'Page本文' });
const saved = (page: Page) => expect(page.getByLabel('端末の保存状態')).toHaveText('端末に保存済み');
async function snapshot(page: Page) {
  return page.evaluate(() => (window as unknown as { greivaTest: { snapshot: () => { clocks: number[][]; json: unknown; fragment: string; pending: number; selection: { from: number; to: number; parent: string; offset: number; size: number } } } }).greivaTest.snapshot());
}
async function device(page: Page) { return page.evaluate(() => localStorage.getItem('greiva-test-device')); }
async function control(page: Page, command: string) {
  const response = await page.request.post('/__greiva_test_store_control', { data: { device: await device(page), command } });
  expect(response.ok()).toBe(true); return response.json();
}
async function profile(path: string, offline: boolean, stableDevice: string) {
  const context = await chromium.launchPersistentContext(path, { baseURL: 'http://127.0.0.1:1420' });
  // Native Tauri selects a fixed app-config path, independent of WebView cache.
  // Chromium localStorage itself is not a durable device identity after SIGKILL.
  await context.addInitScript(device => localStorage.setItem('greiva-test-device', device), stableDevice);
  if (offline) await context.routeWebSocket(/127\.0\.0\.1:1234/, socket => socket.close());
  return context;
}
async function killBrowser(context: BrowserContext) {
  const browser = context.browser()!;
  const cdp = await browser.newBrowserCDPSession();
  const result = await cdp.send('SystemInfo.getProcessInfo');
  const processInfo = result.processInfo.find(value => value.type === 'browser')!;
  const disconnected = new Promise<void>(done => browser.once('disconnected', () => done()));
  process.kill(processInfo.id, 'SIGKILL'); await disconnected;
  return { browserPid: processInfo.id, signal: 'SIGKILL', at: new Date().toISOString() };
}

test('STEP5-CRASH: new offline Page metadata and block edits survive renderer/store SIGKILL, reopen offline and converge', async ({ browser }, info) => {
  test.setTimeout(60000);
  const directory = mkdtempSync(join(tmpdir(), 'greiva-page-crash-'));
  const stableDevice = newId();
  let context: BrowserContext | undefined;
  const peerContext = await browser.newContext();
  try {
    context = await profile(directory, true, stableDevice);
    let a = context.pages()[0]!;
    await a.goto('/'); await expect(body(a)).toBeVisible();
    await a.getByRole('button', { name: '新しいPage', exact: true }).click();
    await expect(body(a)).toBeVisible();
    const url = a.url();
    expect(new URL(url).searchParams.get('page')).toMatch(/^[0-9a-f-]{14}7/);
    await a.getByLabel('Pageタイトル', { exact: true }).fill('オフラインのPage');
    await body(a).click(); await a.keyboard.type('keep');
    await a.keyboard.press('Enter'); await a.keyboard.type('remove');
    await a.keyboard.press('Enter'); await a.keyboard.type('move');
    await body(a).locator(':scope > p').nth(1).click();
    await expect.poll(async () => (await snapshot(a)).selection.parent).toBe('remove');
    await a.keyboard.press('Home');
    await expect.poll(async () => (await snapshot(a)).selection.offset).toBe(0);
    await a.keyboard.press('Shift+End');
    await expect.poll(async () => { const { selection } = await snapshot(a); return selection.to - selection.from; }).toBe('remove'.length);
    await info.attach('before-delete-selection', { body: JSON.stringify(await snapshot(a)), contentType: 'application/json' });
    await a.keyboard.press('Backspace'); await a.keyboard.press('Delete');
    await body(a).locator(':scope > p:last-child').click();
    await expect.poll(async () => (await snapshot(a)).selection.parent).toBe('move');
    await a.getByRole('button', { name: '上へ移動', exact: true }).click();
    await expect(body(a)).not.toContainText('remove');
    await saved(a);
    const before = await snapshot(a);
    const storedResponse = await a.request.post('/__greiva_test_store', { data: { device: stableDevice, command: 'load', pageId: new URL(url).searchParams.get('page') } });
    const storedBefore = (await storedResponse.json()).value;
    expect(storedBefore.metadata.title).toBe('オフラインのPage');
    const storeKill = await control(a, 'kill');
    const browserKill = await killBrowser(context); context = undefined;
    context = await profile(directory, true, stableDevice); a = context.pages()[0]!;
    await a.goto('/'); await expect(body(a)).toBeVisible(); await saved(a);
    await expect(a.getByLabel('Pageタイトル', { exact: true })).toHaveValue('オフラインのPage');
    await expect(a.getByRole('link', { name: '同じPageを別画面で開く' })).toHaveAttribute('href', `/?page=${new URL(url).searchParams.get('page')}`);
    const restored = await snapshot(a);
    expect(restored.clocks).toEqual(before.clocks); expect(restored.json).toEqual(before.json); expect(restored.fragment).toEqual(before.fragment);
    await info.attach('offline-crash', { body: JSON.stringify({ stableDevice, storedBefore, before, restored, storeKill, browserKill }, null, 2), contentType: 'application/json' });
    await context.close(); context = await profile(directory, false, stableDevice); a = context.pages()[0]!;
    const b = await peerContext.newPage();
    await Promise.all([a.goto('/'), b.goto(url)]);
    for (const page of [a, b]) { await expect(body(page)).toBeVisible(); await saved(page); await expect(page.getByLabel('同期状態', { exact: true })).toHaveText('サーバーと同期済み'); }
    await expect.poll(async () => { const [x, y] = await Promise.all([snapshot(a), snapshot(b)]); return JSON.stringify(x.clocks) === JSON.stringify(y.clocks) && JSON.stringify(x.json) === JSON.stringify(y.json) && x.fragment === y.fragment; }).toBe(true);
    await expect(body(b)).toContainText('keep'); await expect(body(b)).toContainText('move');
    await expect(b.getByLabel('Pageタイトル', { exact: true })).toHaveValue(''); // Metadata stays device-local in Step 5.
    await info.attach('restart-convergence', { body: JSON.stringify(await Promise.all([snapshot(a), snapshot(b)]), null, 2), contentType: 'application/json' });
  } finally { await context?.close(); await peerContext.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('STEP5-WRITE-ERROR: failed SQLite commit never sends the unsafe update or reports saved/synced', async ({ page, browser }, info) => {
  const peer = await browser.newContext();
  try {
    const url = `/?page=${newId()}`; const b = await peer.newPage();
    await Promise.all([page.goto(url), b.goto(url)]);
    for (const view of [page, b]) { await expect(body(view)).toBeVisible(); await saved(view); await expect(view.getByLabel('同期状態', { exact: true })).toHaveText('サーバーと同期済み'); }
    await control(page, 'write-failure'); await body(page).click(); await page.keyboard.type('unsafe');
    await expect(page.getByLabel('同期状態', { exact: true })).toHaveText('端末への保存エラー');
    await expect(page.getByLabel('端末の保存状態')).toContainText('保存できません');
    await expect(page.getByRole('alert')).toContainText('Injected SQLite write failure');
    await expect(body(b)).not.toContainText('unsafe');
    await page.waitForTimeout(500); await expect(body(b)).not.toContainText('unsafe');
    await info.attach('write-failure', { body: JSON.stringify({ local: await snapshot(page), remote: await snapshot(b) }, null, 2), contentType: 'application/json' });
  } finally { await peer.close(); }
});

for (const fault of ['corrupt', 'schema'] as const) {
  test(`STEP5-RESTORE-${fault}: incompatible or corrupted SQLite fails closed`, async ({ page }) => {
    await page.goto(`/?page=${newId()}`); await expect(body(page)).toBeVisible(); await saved(page);
    await control(page, 'kill'); await control(page, fault);
    await page.reload();
    await expect(page.getByLabel('同期状態', { exact: true })).toHaveText('端末への保存エラー');
    await expect(page.getByRole('alert')).toContainText(fault === 'schema' ? 'Unsupported local schema version' : 'checksum mismatch');
    await expect(body(page)).not.toBeVisible();
  });
}
