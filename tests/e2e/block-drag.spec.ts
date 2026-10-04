import { test, expect, type Page, type Locator } from '@playwright/test';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';

async function seed(page: Page) {
  const pageId = crypto.randomUUID();
  await page.goto(`/?page=${pageId}`);
  const editor = page.getByRole('textbox', { name: 'Page本文' });
  await expect(editor).toBeVisible({ timeout: 15000 });
  await editor.click(); await page.keyboard.type('first'); await page.keyboard.press('Enter');
  await page.keyboard.type('second'); await page.keyboard.press('Enter'); await page.keyboard.type('third');
  await expect(editor.locator(':scope > p')).toHaveText(['first', 'second', 'third']);
  return { pageId, editor };
}
async function hold(page: Page, handle: Locator, destination: Locator) {
  const from = await handle.boundingBox(), to = await destination.boundingBox();
  if (!from || !to) throw new Error('Missing drag geometry');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 4 });
  await page.mouse.move(to.x + 8, to.y + 2, { steps: 8 });
  await page.mouse.move(to.x + 8, to.y + 3);
}
async function clean(page: Page, editor: Locator) {
  await expect(page.locator('.block-drag-preview')).toHaveCount(0);
  await expect(editor).not.toHaveClass(/is-block-dragging/);
  await expect(page.locator('body')).not.toHaveClass(/greiva-block-dragging/);
}
test('STEP8-DRAG-PREVIEW: held block floats, siblings make space, drop and cancellation retain the document', async ({ page }, info) => {
  const { editor } = await seed(page);
  const paragraphs = editor.locator(':scope > p');
  await page.keyboard.press('Shift+ArrowLeft');
  await expect.poll(() => page.evaluate(() => {
    const selection = (window as unknown as { greivaTest: { snapshot: () => { selection: { from: number; to: number } } } }).greivaTest.snapshot().selection;
    return selection.to - selection.from;
  })).toBe(1);
  const selection = await page.evaluate(() => (window as unknown as { greivaTest: { snapshot: () => { selection: unknown } } }).greivaTest.snapshot().selection);
  await hold(page, editor.getByRole('button', { name: 'ブロック3をドラッグして移動', exact: true }), paragraphs.first());
  const card = page.locator('.block-drag-preview');
  await expect(card).toBeVisible(); await expect(card).toHaveText('⠿third');
  const cardBox = await card.boundingBox();
  if (!cardBox) throw new Error('Missing row preview');
  await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + 12);
  const movedBox = await card.boundingBox();
  expect(movedBox!.x).toBeCloseTo(cardBox.x, 1);
  expect(movedBox!.width).toBeCloseTo(cardBox.width, 1);
  await expect(card).toHaveAttribute('inert', ''); await expect(card).toHaveAttribute('aria-hidden', 'true');
  await expect(paragraphs).toHaveText(['first', 'second', 'third']);
  expect(await page.evaluate(() => (window as unknown as { greivaTest: { snapshot: () => { selection: unknown } } }).greivaTest.snapshot().selection)).toEqual(selection);
  await expect.poll(async () => paragraphs.first().evaluate(element => Number(getComputedStyle(element).transform.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,[^,]+,\s*([^\)]+)/)?.[1] ?? '0'))).toBeGreaterThan(0);
  expect(await paragraphs.first().evaluate(element => getComputedStyle(element).transitionProperty)).toContain('transform');
  expect(await paragraphs.last().evaluate(element => getComputedStyle(element).opacity)).toBe('0');
  await info.attach('held-block-preview', { body: await page.screenshot(), contentType: 'image/png' });
  await page.mouse.up();
  await expect(paragraphs).toHaveText(['third', 'first', 'second']); await clean(page, editor);
  await expect(editor).toBeFocused();
  await page.keyboard.press('ControlOrMeta+z'); await expect(paragraphs).toHaveText(['first', 'second', 'third']);
  await page.keyboard.press('ControlOrMeta+y'); await expect(paragraphs).toHaveText(['third', 'first', 'second']);
  await page.keyboard.press('ControlOrMeta+z'); await expect(paragraphs).toHaveText(['first', 'second', 'third']);
  await hold(page, editor.getByRole('button', { name: 'ブロック1をドラッグして移動', exact: true }), paragraphs.last());
  await expect(card).toBeVisible(); await page.keyboard.press('Escape'); await page.mouse.up();
  await clean(page, editor); await expect(paragraphs).toHaveText(['first', 'second', 'third']);
  await expect(editor).toBeFocused();
});

test('STEP8-DRAG-REMOTE: a real peer edit cancels the stale drag without inserting its text', async ({ page }) => {
  const { pageId, editor } = await seed(page);
  const document = new Y.Doc(), peer = new HocuspocusProvider({ url: `ws://127.0.0.1:1234?clientId=${crypto.randomUUID()}`, name: `page:${pageId}`, document });
  try {
    await expect.poll(() => peer.isSynced && document.getXmlFragment('body').toString().includes('third')).toBe(true);
    await hold(page, editor.getByRole('button', { name: 'ブロック3をドラッグして移動', exact: true }), editor.locator(':scope > p').first());
    await expect(page.locator('.block-drag-preview')).toBeVisible();
    const paragraph = document.getXmlFragment('body').get(0) as Y.XmlElement;
    (paragraph.get(0) as Y.XmlText).insert(0, 'R ');
    await expect(editor.locator(':scope > p')).toHaveText(['R first', 'second', 'third']);
    await clean(page, editor);
    await page.mouse.up();
    await expect(editor.locator(':scope > p')).toHaveText(['R first', 'second', 'third']);
    await expect.poll(() => peer.unsyncedChanges).toBe(0);
  } finally { peer.destroy(); document.destroy(); }
});

test('STEP8-DRAG-DOWN: a multiline block opens a full-height gap, reduced motion and outside drop preserve content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { editor } = await seed(page);
  const paragraphs = editor.locator(':scope > p');
  await paragraphs.first().click(); await page.keyboard.press('End');
  await page.keyboard.press('Shift+Enter'); await page.keyboard.type('second line');
  await page.keyboard.press('Shift+Enter'); await page.keyboard.type('third line');
  const before = await paragraphs.allTextContents();
  const source = await paragraphs.first().boundingBox(), last = await paragraphs.last().boundingBox();
  if (!source || !last) throw new Error('Missing multiline geometry');
  await hold(page, editor.getByRole('button', { name: 'ブロック1をドラッグして移動', exact: true }), paragraphs.last());
  await page.mouse.move(last.x + 8, last.y + last.height - 2);
  await expect(paragraphs.nth(1)).toHaveCSS('transition-duration', '0s');
  const shift = await paragraphs.nth(1).evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42);
  expect(shift).toBeLessThanOrEqual(-source.height);
  await page.mouse.up(); await clean(page, editor);
  await expect(paragraphs).toHaveText([before[1]!, before[2]!, before[0]!]);
  await page.keyboard.press('ControlOrMeta+z'); await expect(paragraphs).toHaveText(before);
  await hold(page, editor.getByRole('button', { name: 'ブロック1をドラッグして移動', exact: true }), paragraphs.last());
  await page.mouse.move(5, 5); await page.mouse.up();
  await clean(page, editor); await expect(paragraphs).toHaveText(before);
  await expect(editor).toBeFocused();
});

test('STEP8-DRAG-GUTTER: vertical movement in the handle column drops without entering the text', async ({ page }) => {
  const { editor } = await seed(page), paragraphs = editor.locator(':scope > p');
  const handle = await editor.getByRole('button', { name: 'ブロック3をドラッグして移動', exact: true }).boundingBox();
  const first = await paragraphs.first().boundingBox();
  if (!handle || !first) throw new Error('Missing gutter geometry');
  const x = handle.x + handle.width / 2;
  expect(x).toBeLessThan(first.x);
  await page.mouse.move(x, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(x + 2, handle.y - 16, { steps: 4 });
  await page.mouse.move(x, first.y + 2, { steps: 10 }); await page.mouse.move(x, first.y + 3);
  await expect(page.locator('.block-drag-preview')).toBeVisible();
  await page.mouse.up();
  await expect(paragraphs).toHaveText(['third', 'first', 'second']); await clean(page, editor);
  await page.keyboard.press('ControlOrMeta+z'); await expect(paragraphs).toHaveText(['first', 'second', 'third']);
  const title = page.getByRole('textbox', { name: 'Pageタイトル', exact: true }), titleBox = await title.boundingBox();
  if (!titleBox) throw new Error('Missing title geometry');
  await hold(page, editor.getByRole('button', { name: 'ブロック3をドラッグして移動', exact: true }), paragraphs.first());
  await page.mouse.move(titleBox.x + titleBox.width / 2, titleBox.y + titleBox.height / 2); await page.mouse.up();
  await clean(page, editor); await expect(title).toHaveValue('');
  await expect(paragraphs).toHaveText(['first', 'second', 'third']);
});
