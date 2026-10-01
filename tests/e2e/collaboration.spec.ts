import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
const test = base.extend<{ peer: Page }>({
  peer: async ({ browser }, use) => {
    const context = await browser.newContext();
    try { await use(await context.newPage()); } finally { await context.close(); }
  },
});

type Snapshot = { pageId: string; clientId: string; stateVector: number[]; clocks: number[][]; json: unknown; fragment: string; pending: number;
  selection: { from: number; to: number; parent: string; offset: number; size: number } };
const body = (page: Page) => page.getByRole('textbox', { name: 'Page本文' });
async function snapshot(page: Page): Promise<Snapshot> {
  return page.evaluate(() => (window as unknown as { greivaTest: { snapshot: () => Snapshot } }).greivaTest.snapshot());
}
async function converged(a: Page, b: Page, info: TestInfo, label = 'final') {
  await expect.poll(async () => {
    const [left, right] = await Promise.all([snapshot(a), snapshot(b)]);
    return left.pending === 0 && right.pending === 0 &&
      JSON.stringify(left.clocks) === JSON.stringify(right.clocks) &&
      JSON.stringify(left.json) === JSON.stringify(right.json) && left.fragment === right.fragment;
  }, { timeout: 15000 }).toBe(true);
  const values = await Promise.all([snapshot(a), snapshot(b)]);
  expect(values[0].clientId).not.toBe(values[1].clientId);
  await info.attach(`convergence-${label}`, { body: JSON.stringify({ capturedAt: new Date().toISOString(), clients: values }, null, 2), contentType: 'application/json' });
  return values;
}
async function pair(a: Page, b: Page) {
  const pageId = crypto.randomUUID();
  await Promise.all([a.goto(`/?page=${pageId}`), b.goto(`/?page=${pageId}`)]);
  for (const page of [a, b]) {
    await expect(body(page)).toBeVisible();
    await expect(page.getByLabel('同期状態', { exact: true })).toHaveText('サーバーと同期済み', { timeout: 15000 });
  }
}
async function pause(page: Page) {
  await page.getByRole('button', { name: '接続を一時停止', exact: true }).click();
  await expect(page.getByLabel('同期状態', { exact: true })).toHaveText('オフライン');
}
async function resume(page: Page) {
  await page.getByRole('button', { name: '再接続', exact: true }).click();
  // Reconnect plus the following 15s convergence check stays within the 30s
  // PoC convergence window; the default 5s assertion could stop before retry.
  await expect(page.getByLabel('同期状態', { exact: true })).toHaveText('サーバーと同期済み', { timeout: 15000 });
}
async function typeBlocks(page: Page, lines: string[]) {
  await page.bringToFront();
  await body(page).click();
  for (let i = 0; i < lines.length; i++) {
    if (i) await page.keyboard.press('Enter');
    await page.keyboard.type(lines[i]!);
  }
}
async function atEnd(page: Page, selector: string) {
  await page.bringToFront();
  const expected = await body(page).locator(selector).textContent();
  await body(page).locator(selector).click();
  await expect.poll(async () => (await snapshot(page)).selection.parent).toBe(expected);
  await page.keyboard.press('End');
  await expect.poll(async () => { const { selection } = await snapshot(page); return selection.offset === selection.size; }).toBe(true);
}
async function slash(page: Page, query: string, label: string) {
  await page.keyboard.type(`/${query}`);
  await page.getByRole('option', { name: label, exact: true }).click();
}

test('STEP4-PARAGRAPH: simultaneous edits retain both changes and remote update keeps the caret', async ({ page: a, context, peer: b }, info) => {
  await pair(a, b);
  await typeBlocks(a, ['middle']);
  await converged(a, b, info, 'seed');
  await atEnd(a, ':scope > p');
  await body(b).locator(':scope > p').click();
  await b.keyboard.press('Home');
  await Promise.all([a.keyboard.type(' A'), b.keyboard.type('B ')]);
  await converged(a, b, info);
  await expect(body(a)).toContainText('B middle A');
  await expect(body(a)).toBeFocused();
  await a.keyboard.type('!');
  await expect(body(b)).toContainText('B middle A!');
  await converged(a, b, info, 'caret');
});

test('STEP4-BLOCKS: different blocks, local undo does not undo the other client', async ({ page: a, context, peer: b }, info) => {
  await pair(a, b);
  await typeBlocks(a, ['one', 'two']);
  await converged(a, b, info, 'seed');
  // Ensure the earlier setup isn't grouped into the next local undo.
  await a.waitForTimeout(550);
  await atEnd(a, ':scope > p:nth-of-type(1)');
  await atEnd(b, ':scope > p:last-child');
  await Promise.all([a.keyboard.type(' A'), b.keyboard.type(' B')]);
  await converged(a, b, info, 'edited');
  await a.getByRole('button', { name: '元に戻す', exact: true }).click();
  await converged(a, b, info, 'undo');
  await expect(body(b)).toContainText('two B');
  await expect(body(a)).not.toContainText('one A');
  await a.getByRole('button', { name: 'やり直す', exact: true }).click();
  await converged(a, b, info);
});

test('STEP4-OFFLINE: each client adds and deletes blocks, reconnect and fresh client restore the result', async ({ page: a, context, peer: b }, info) => {
  await pair(a, b);
  await typeBlocks(a, ['removeA', 'removeB', 'keep']);
  await converged(a, b, info, 'seed');
  await Promise.all([pause(a), pause(b)]);
  for (const [page, selector, text] of [[a, ':scope > p:nth-of-type(1)', 'offlineA'], [b, ':scope > p:nth-of-type(2)', 'offlineB']] as const) {
    await page.bringToFront();
    await body(page).locator(selector).click();
    const expected = text === 'offlineA' ? 'removeA' : 'removeB';
    await expect.poll(async () => (await snapshot(page)).selection.parent).toBe(expected);
    await info.attach(`delete-${text}-click`, { body: JSON.stringify(await snapshot(page)), contentType: 'application/json' });
    await page.keyboard.press('Home');
    await expect.poll(async () => (await snapshot(page)).selection.offset).toBe(0);
    await page.keyboard.press('Shift+End');
    await expect.poll(async () => { const { selection } = await snapshot(page); return selection.to - selection.from; }).toBe(expected.length);
    await info.attach(`delete-${text}-selected`, { body: JSON.stringify(await snapshot(page)), contentType: 'application/json' });
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Delete');
    await info.attach(`delete-${text}-deleted`, { body: JSON.stringify(await snapshot(page)), contentType: 'application/json' });
    await atEnd(page, ':scope > p:last-child');
    await page.keyboard.press('Enter');
    await page.keyboard.type(text);
    await expect(page.getByLabel('同期状態', { exact: true })).toHaveText('オフライン');
  }
  await info.attach('offline-clients', { body: JSON.stringify(await Promise.all([snapshot(a), snapshot(b)])), contentType: 'application/json' });
  await Promise.all([resume(a), resume(b)]);
  await converged(a, b, info);
  for (const page of [a, b]) {
    await expect(body(page)).toContainText('offlineA');
    await expect(body(page)).toContainText('offlineB');
    await expect(body(page)).not.toContainText('removeA');
    await expect(body(page)).not.toContainText('removeB');
  }
  const c = await context.newPage();
  await c.goto(a.url());
  await expect(body(c)).toBeVisible();
  await converged(a, c, info, 'fresh-client');
});

test('STEP4-MOVE: both clients move blocks while offline', async ({ page: a, context, peer: b }, info) => {
  await pair(a, b);
  await typeBlocks(a, ['first', 'second', 'third']);
  await converged(a, b, info, 'seed');
  await Promise.all([pause(a), pause(b)]);
  await atEnd(a, ':scope > p:last-child');
  await a.getByRole('button', { name: '上へ移動', exact: true }).click();
  await atEnd(b, ':scope > p:nth-of-type(1)');
  await b.getByRole('button', { name: '下へ移動', exact: true }).click();
  await Promise.all([resume(a), resume(b)]);
  await converged(a, b, info);
  for (const page of [a, b]) for (const text of ['first', 'second', 'third']) await expect(body(page)).toContainText(text);
});

test('STEP4-NESTED: edit and move within a nested Toggle, then reconnect', async ({ page: a, context, peer: b }, info) => {
  await pair(a, b);
  await body(a).click();
  await slash(a, 'toggle', 'Toggle');
  await a.keyboard.type('Outer');
  await a.keyboard.press('Enter');
  await slash(a, 'toggle', 'Toggle');
  await a.keyboard.type('Inner');
  await a.keyboard.press('Enter');
  await a.keyboard.type('nested first');
  await a.keyboard.press('Enter');
  await a.keyboard.type('nested second');
  await converged(a, b, info, 'seed');
  await Promise.all([pause(a), pause(b)]);
  await atEnd(a, '[data-type="detailsContent"] [data-type="detailsContent"] > p:last-child');
  await a.getByRole('button', { name: '上へ移動', exact: true }).click();
  await atEnd(b, '[data-type="details"] [data-type="details"] summary');
  await b.keyboard.type(' B');
  await Promise.all([resume(a), resume(b)]);
  await converged(a, b, info);
  await expect(body(b).locator('[data-type="details"] [data-type="details"]')).toHaveCount(1);
  await expect(body(b)).toContainText('Inner B');
  await expect(body(b)).toContainText('nested second');
});

test('STEP4-TODO: concurrent checked change and nested list edits retain valid nodes', async ({ page: a, context, peer: b }, info) => {
  await pair(a, b);
  await body(a).click();
  await slash(a, 'todo', 'Todo');
  await a.keyboard.type('task');
  await a.keyboard.press('Enter');
  await a.keyboard.type('child');
  await converged(a, b, info, 'seed');
  await Promise.all([pause(a), pause(b)]);
  await body(a).getByRole('checkbox', { name: 'Todo: task', exact: true }).check();
  await b.bringToFront();
  await body(b).locator('li[data-checked]').last().locator('p').click();
  await b.getByRole('button', { name: 'インデント', exact: true }).click();
  await Promise.all([resume(a), resume(b)]);
  await converged(a, b, info, 'nested');
  await expect(body(b).getByRole('checkbox', { name: 'Todo: task child', exact: true })).toBeChecked();
  await expect(body(b).locator('ul[data-type="taskList"] ul[data-type="taskList"]')).toHaveCount(1);
  await body(b).locator('li[data-checked] li[data-checked] p').click();
  await b.getByRole('button', { name: 'インデント解除', exact: true }).click();
  await converged(a, b, info);
  await expect(body(a).locator('ul[data-type="taskList"] ul[data-type="taskList"]')).toHaveCount(0);
});

test('STEP4-ISOLATION: another Page never receives this Page body', async ({ page: a, peer: b }) => {
  await Promise.all([a.goto(`/?page=${crypto.randomUUID()}`), b.goto(`/?page=${crypto.randomUUID()}`)]);
  await expect(body(a)).toBeVisible();
  await expect(body(b)).toBeVisible();
  await typeBlocks(a, ['private to this page']);
  await expect(a.getByLabel('同期状態', { exact: true })).toHaveText('サーバーと同期済み');
  await expect(body(b)).not.toContainText('private to this page');
  expect((await snapshot(a)).pageId).not.toBe((await snapshot(b)).pageId);
});
