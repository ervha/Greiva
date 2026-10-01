import { test, expect, type Page } from '@playwright/test';

async function body(page: Page) {
  await page.goto(`/?page=${crypto.randomUUID()}`);
  const editor = page.getByRole('textbox', { name: 'Page本文' });
  // This is interaction setup, not the release startup performance gate.
  await expect(editor).toBeVisible({ timeout: 15000 });
  await editor.click();
  return editor;
}
async function slash(page: Page, label: string) {
  await page.keyboard.type('/');
  const menu = page.getByRole('listbox', { name: 'ブロックを挿入' });
  await expect(menu).toBeVisible();
  await menu.getByRole('option', { name: label, exact: label !== 'Toggle' }).click();
  await expect(menu).toHaveCount(0);
}

const blocks = [
  ['本文', 'p'], ['見出し1', 'h1'], ['見出し2', 'h2'], ['見出し3', 'h3'],
  ['箇条書き', 'ul:not([data-type])'], ['番号付きリスト', 'ol'],
  ['Todo', 'ul[data-type="taskList"]'], ['引用', 'blockquote'], ['コード', 'pre'],
  ['区切り線', 'hr'], ['Toggle', '[data-type="details"]'],
] as const;
for (const [label, selector] of blocks) {
  test(`STEP2-BLOCK: slash inserts ${label}, edit and delete`, async ({ page }) => {
    const editor = await body(page);
    await slash(page, label);
    await expect(editor.locator(selector).first()).toBeVisible();
    if (label !== '区切り線') {
      await page.keyboard.type('block content');
      await expect(editor).toContainText('block content');
    }
    await editor.press('ControlOrMeta+a');
    await editor.press('Backspace');
    await expect(editor).not.toContainText('block content');
    if (selector !== 'p') await expect(editor.locator(selector)).toHaveCount(0);
  });
}

test('STEP2-TODO: checkbox and nested list survive undo/redo', async ({ page }) => {
  const editor = await body(page);
  await slash(page, 'Todo');
  await page.keyboard.type('first');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second');
  await page.getByRole('button', { name: 'インデント', exact: true }).click();
  await expect(editor.locator('ul[data-type="taskList"] ul[data-type="taskList"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'インデント解除', exact: true }).click();
  await expect(editor.locator('ul[data-type="taskList"] ul[data-type="taskList"]')).toHaveCount(0);
  const checkbox = editor.getByRole('checkbox', { name: 'Todo: first', exact: true });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await expect(checkbox).not.toBeChecked();
  await page.getByRole('button', { name: 'やり直す', exact: true }).click();
  await expect(checkbox).toBeChecked();
});

test('STEP8-TODO: each checkbox aligns with its editable text and pointer editing keeps the item', async ({ page }) => {
  const editor = await body(page);
  await slash(page, 'Todo');
  await page.keyboard.type('first');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second');
  const items = editor.locator('ul[data-type="taskList"] > li');
  await expect(items).toHaveCount(2);
  for (const item of await items.all()) {
    const checkbox = await item.getByRole('checkbox').boundingBox();
    const text = await item.locator(':scope > div > p').boundingBox();
    expect(checkbox).not.toBeNull();
    expect(text).not.toBeNull();
    expect(text!.x, 'Todo text must sit to the right of its checkbox').toBeGreaterThan(checkbox!.x + checkbox!.width);
    expect(Math.abs(checkbox!.y + checkbox!.height / 2 - text!.y - text!.height / 2),
      'Todo checkbox and its text must share the same line').toBeLessThan(text!.height / 2);
  }
  const first = items.first().locator(':scope > div > p');
  await first.click();
  await page.keyboard.press('End');
  await page.keyboard.type(' edited');
  await expect(first).toHaveText('first edited');
  await expect(items.nth(1).locator(':scope > div > p')).toHaveText('second');
  const checkbox = items.first().getByRole('checkbox', { name: 'Todo: first edited', exact: true });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await expect(first).toHaveCSS('text-decoration-line', 'line-through');
});

test('STEP2-TOGGLE: nested content folds without losing text and unwraps', async ({ page }) => {
  const editor = await body(page);
  await slash(page, 'Toggle');
  await page.keyboard.type('summary');
  const content = editor.locator('[data-type="detailsContent"]').first();
  await expect(content).toBeVisible();
  await content.locator('p').click();
  await page.keyboard.type('nested text');
  await page.keyboard.press('Enter');
  await slash(page, 'Toggle');
  await page.keyboard.type('nested summary');
  await expect(editor.locator('[data-type="details"] [data-type="details"]')).toHaveCount(1);
  await editor.getByRole('button', { name: 'Toggleを閉じる', exact: true }).first().click();
  await expect(content).toBeHidden();
  await editor.getByRole('button', { name: 'Toggleを開く', exact: true }).first().click();
  await expect(content).toBeVisible();
  await expect(content).toContainText('nested text');
  await editor.locator('summary').first().click();
  await page.getByRole('button', { name: 'Toggleを解除', exact: true }).click();
  await expect(editor.locator(':scope > [data-type="details"]')).toHaveCount(1);
  await expect(editor).toContainText('nested text');
});

test('STEP2-MENTION: keyboard selects a fixed entity and Escape leaves ordinary text', async ({ page }) => {
  const editor = await body(page);
  await page.keyboard.type('@');
  await expect(page.getByRole('listbox', { name: 'Mention候補' })).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(editor.locator('[data-type="mention"]')).toHaveAttribute('data-id', 'demo-task');
  await expect(editor).toContainText('サンプルTask');
  await page.keyboard.type('@');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(editor).toContainText('@');
});

for (const [text, selector] of [['# ', 'h1'], ['## ', 'h2'], ['### ', 'h3'], ['- ', 'ul:not([data-type])'], ['1. ', 'ol'], ['[] ', 'ul[data-type="taskList"]']] as const) {
  test(`STEP2-MARKDOWN: ${text} shortcut`, async ({ page }) => {
    const editor = await body(page);
    await page.keyboard.type(text);
    await expect(editor.locator(selector)).toHaveCount(1);
    await page.keyboard.type('shortcut content');
    await expect(editor.locator(selector)).toContainText('shortcut content');
  });
}

test('STEP2-MOVE: drag changes order, undo restores it, keyboard moves the block', async ({ page }) => {
  const editor = await body(page);
  await page.keyboard.type('first');
  await page.keyboard.press('Enter');
  await page.keyboard.type('second');
  await page.keyboard.press('Enter');
  await page.keyboard.type('third');
  const texts = () => editor.locator(':scope > p').allTextContents();
  await expect.poll(texts).toEqual(['first', 'second', 'third']);
  await editor.getByRole('button', { name: 'ブロック3をドラッグして移動', exact: true }).dragTo(editor.locator(':scope > p').first(), { targetPosition: { x: 5, y: 2 } });
  await expect.poll(texts).toEqual(['third', 'first', 'second']);
  await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  await expect.poll(texts).toEqual(['first', 'second', 'third']);
  await editor.locator(':scope > p').last().click();
  await page.keyboard.press('ControlOrMeta+Shift+ArrowUp');
  await expect.poll(texts).toEqual(['first', 'third', 'second']);
  await page.getByRole('button', { name: '下へ移動', exact: true }).click();
  await expect.poll(texts).toEqual(['first', 'second', 'third']);
});

test('STEP8-HANDLES: typing retains handle DOM and dragging uses current offsets and text', async ({ page }) => {
  const editor = await body(page);
  await page.keyboard.type('first');await page.keyboard.press('Enter');
  await page.keyboard.type('second');await page.keyboard.press('Enter');await page.keyboard.type('third');
  await expect(editor.locator('.block-handle-anchor')).toHaveCount(3);
  await editor.evaluate(element => {
    (window as unknown as {greivaHandles:Element[]}).greivaHandles=Array.from(element.querySelectorAll('.block-handle-anchor'));
  });
  await editor.locator(':scope > p').first().click();await page.keyboard.press('End');await page.keyboard.type(' shifted');
  await editor.locator(':scope > p').last().click();await page.keyboard.press('End');await page.keyboard.type(' edited');
  await expect(editor).toBeFocused();
  expect(await editor.evaluate(element => {
    const before=(window as unknown as {greivaHandles:Element[]}).greivaHandles;
    return Array.from(element.querySelectorAll('.block-handle-anchor')).every((node,index)=>node===before[index]);
  })).toBe(true);
  const texts=()=>editor.locator(':scope > p').allTextContents();
  await expect.poll(texts).toEqual(['first shifted','second','third edited']);
  const transfer=await page.evaluateHandle(()=>new DataTransfer());
  const handle=editor.getByRole('button',{name:'ブロック3をドラッグして移動',exact:true});
  await handle.dispatchEvent('dragstart',{dataTransfer:transfer});
  expect(await transfer.evaluate(value=>value.getData('text/plain'))).toBe('third edited');
  await handle.dispatchEvent('dragend');await transfer.dispose();
  // Real pointer drag verifies the reused getPos after both offset and payload changed.
  await handle.dragTo(editor.locator(':scope > p').first(),{targetPosition:{x:5,y:2}});
  await expect.poll(texts).toEqual(['third edited','first shifted','second']);
  await page.getByRole('button',{name:'元に戻す',exact:true}).click();
  await expect.poll(texts).toEqual(['first shifted','second','third edited']);
  await page.getByRole('button',{name:'やり直す',exact:true}).click();
  await expect.poll(texts).toEqual(['third edited','first shifted','second']);
  await expect(editor.getByRole('button',{name:'ブロック3をドラッグして移動',exact:true})).toHaveCount(1);
});

test('STEP2-COMPOSITION: slash menu does not consume composition Enter', async ({ page }) => {
  const editor = await body(page);
  await page.keyboard.type('/');
  const menu = page.getByRole('listbox', { name: 'ブロックを挿入' });
  await expect(menu).toBeVisible();
  const consumed = await editor.evaluate(element => !element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })));
  expect(consumed).toBe(false);
  await expect(menu).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  // Synthetic composition safety check only; this is not Microsoft IME evidence.
});
