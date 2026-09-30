import { test, expect, type Page } from '@playwright/test';

async function editorAt(page: Page) {
  await page.goto('/');
  const editor = page.getByRole('textbox', { name: 'Page本文' });
  await editor.click();
  return editor;
}
async function toggleAt(page: Page) {
  const editor = await editorAt(page);
  await page.keyboard.type('/toggle');
  await page.getByRole('option', { name: 'Toggle', exact: true }).click();
  await page.keyboard.type('Heading');
  return editor;
}

test('STEP2-UX-SLASH: pointer and keyboard share one selection and retain editor focus', async ({ page }) => {
  const editor = await editorAt(page);
  await page.keyboard.type('/');
  const menu = page.getByRole('listbox', { name: 'ブロックを挿入' });
  const heading = menu.getByRole('option', { name: '見出し2', exact: true });
  await heading.hover();
  await expect(heading).toHaveAttribute('aria-selected', 'true');
  await expect(menu.locator('[aria-selected="true"]')).toHaveCount(1);
  await expect(editor).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('option', { name: '見出し3', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Enter');
  await expect(menu).toHaveCount(0);
  await expect(editor).toBeFocused();
  await page.keyboard.type('Selected heading');
  await expect(editor.locator('h3')).toHaveText('Selected heading');
});

test('STEP2-UX-SLASH: wrap, Home/End, Tab, search aliases and empty dismissal', async ({ page }) => {
  const editor = await editorAt(page);
  await page.keyboard.type('/');
  const menu = page.getByRole('listbox', { name: 'ブロックを挿入' });
  await page.keyboard.press('ArrowUp');
  await expect(menu.getByRole('option', { name: 'Toggle', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(menu.getByRole('option', { name: '本文', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('End');
  await expect(menu.getByRole('option', { name: 'Toggle', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Home');
  await expect(menu.getByRole('option', { name: '本文', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.type('h2');
  await expect(menu.getByRole('option')).toHaveCount(1);
  await page.keyboard.press('Tab');
  await expect(editor.locator('h2')).toHaveCount(1);
  await expect(editor).toBeFocused();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await page.keyboard.type('/unmatched');
  await expect(menu.getByRole('option')).toHaveCount(0);
  await expect(menu).toContainText('候補が見つかりません');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(editor.locator('p')).toHaveText('/unmatched');
  await expect(editor).not.toHaveAttribute('aria-activedescendant');
});

test('STEP2-UX-SLASH: outside dismissal preserves query, narrow popup stays on screen', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const editor = await editorAt(page);
  await page.keyboard.type('/');
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.keyboard.press('End');
  const rect = await page.locator('.suggestion-menu').boundingBox();
  expect(rect).not.toBeNull();
  expect(rect!.x).toBeGreaterThanOrEqual(8);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(352);
  expect(rect!.y).toBeGreaterThanOrEqual(8);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(632);
  await page.getByRole('heading', { name: 'Greiva PoC', exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(editor.locator('p')).toHaveText('/');
});

test('STEP2-UX-TOGGLE: Enter reuses existing body and collapse moves caret to visible heading', async ({ page }) => {
  const editor = await toggleAt(page);
  const content = editor.locator('[data-type="detailsContent"]');
  await expect(content).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Body text');
  await expect(content.locator('p')).toHaveCount(1);
  await expect(content).toHaveText('Body text');
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(content).toBeHidden();
  await expect(editor).toBeFocused();
  await page.keyboard.type('!');
  await expect(editor.locator('summary')).toHaveText('Heading!');
  await page.keyboard.press('Enter');
  await expect(content).toBeVisible();
  await expect(content.locator('p')).toHaveCount(1);
  await page.keyboard.type('Prefix ');
  await expect(content).toHaveText('Prefix Body text');
});

test('STEP2-UX-TOGGLE: pointer retains caret, keyboard button activation retains focus', async ({ page }) => {
  const editor = await toggleAt(page);
  const content = editor.locator('[data-type="detailsContent"]');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Retained');
  await editor.getByRole('button', { name: 'Toggleを閉じる', exact: true }).click();
  await expect(editor).toBeFocused();
  await page.keyboard.type('!');
  await expect(editor.locator('summary')).toHaveText('Heading!');
  const button = editor.locator('[data-type="details"] > button');
  await button.focus();
  await button.press('Enter');
  await expect(content).toBeVisible();
  await expect(button).toBeFocused();
  await button.press('Space');
  await expect(content).toBeHidden();
  await expect(button).toBeFocused();
  await expect(content).toHaveText('Retained');
});

test('STEP2-UX-TOGGLE: folding is excluded from content undo and nested shortcut uses nearest toggle', async ({ page }) => {
  const editor = await toggleAt(page);
  await page.keyboard.press('Enter');
  await page.keyboard.type('Outer body');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/toggle');
  await page.getByRole('option', { name: 'Toggle', exact: true }).click();
  await page.keyboard.type('Inner');
  const toggles = editor.locator('[data-type="details"]');
  await expect(toggles).toHaveCount(2);
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(toggles.first()).toHaveClass(/is-open/);
  await expect(toggles.last()).not.toHaveClass(/is-open/);
  await page.keyboard.press('ControlOrMeta+Enter');
  await expect(toggles.last()).toHaveClass(/is-open/);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(editor).not.toContainText('Inner');
  await expect(editor).toContainText('Outer body');
});

test('STEP2-UX-VISUAL: capture polished slash menu and toggle at a desktop viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  const editor = await toggleAt(page);
  await page.getByRole('textbox', { name: 'Pageタイトル' }).fill('Greiva — 書く、整理する');
  await editor.locator('summary').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('A place for ideas and the next action.');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/');
  const menu = page.getByRole('listbox', { name: 'ブロックを挿入' });
  await expect(menu).toBeVisible();
  await menu.getByRole('option', { name: 'Todo', exact: true }).hover();
  const screenshot = testInfo.outputPath('editor-ux.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('editor-ux', { path: screenshot, contentType: 'image/png' });
});
