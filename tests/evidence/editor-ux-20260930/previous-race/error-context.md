# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor-ux.spec.ts >> STEP2-UX-TOGGLE: folding is excluded from content undo and nested shortcut uses nearest toggle
- Location: tests/e2e/editor-ux.spec.ts:120:1

# Error details

```
Error: expect(locator).not.toHaveClass(expected) failed

Locator: getByRole('textbox', { name: 'Page本文' }).locator('[data-type="details"]').last()
Expected pattern: not /is-open/
Received string: "is-open"
Timeout: 5000ms

Call log:
  - Expect "not toHaveClass" getByRole('textbox', { name: 'Page本文' }).locator('[data-type="details"]').last() with timeout 5000ms
  - waiting for getByRole('textbox', { name: 'Page本文' }).locator('[data-type="details"]').last()
    14 × locator resolved to <div open="" class="is-open" data-type="details">…</div>
       - unexpected value "is-open"

```

```yaml
- button "Toggleを閉じる" [expanded]
- text: Inner
- paragraph: ここに内容を入力
```

# Test source

```ts
  32  |   await expect(editor.locator('h3')).toHaveText('Selected heading');
  33  | });
  34  | 
  35  | test('STEP2-UX-SLASH: wrap, Home/End, Tab, search aliases and empty dismissal', async ({ page }) => {
  36  |   const editor = await editorAt(page);
  37  |   await page.keyboard.type('/');
  38  |   const menu = page.getByRole('listbox', { name: 'ブロックを挿入' });
  39  |   await page.keyboard.press('ArrowUp');
  40  |   await expect(menu.getByRole('option', { name: 'Toggle', exact: true })).toHaveAttribute('aria-selected', 'true');
  41  |   await page.keyboard.press('ArrowDown');
  42  |   await expect(menu.getByRole('option', { name: '本文', exact: true })).toHaveAttribute('aria-selected', 'true');
  43  |   await page.keyboard.press('End');
  44  |   await expect(menu.getByRole('option', { name: 'Toggle', exact: true })).toHaveAttribute('aria-selected', 'true');
  45  |   await page.keyboard.press('Home');
  46  |   await expect(menu.getByRole('option', { name: '本文', exact: true })).toHaveAttribute('aria-selected', 'true');
  47  |   await page.keyboard.type('h2');
  48  |   await expect(menu.getByRole('option')).toHaveCount(1);
  49  |   await page.keyboard.press('Tab');
  50  |   await expect(editor.locator('h2')).toHaveCount(1);
  51  |   await expect(editor).toBeFocused();
  52  |   await page.keyboard.press('ControlOrMeta+a');
  53  |   await page.keyboard.press('Backspace');
  54  |   await page.keyboard.type('/unmatched');
  55  |   await expect(menu.getByRole('option')).toHaveCount(0);
  56  |   await expect(menu).toContainText('候補が見つかりません');
  57  |   await page.keyboard.press('Escape');
  58  |   await expect(menu).toHaveCount(0);
  59  |   await expect(editor.locator('p')).toHaveText('/unmatched');
  60  |   await expect(editor).not.toHaveAttribute('aria-activedescendant');
  61  | });
  62  | 
  63  | test('STEP2-UX-SLASH: outside dismissal preserves query, narrow popup stays on screen', async ({ page }) => {
  64  |   await page.setViewportSize({ width: 360, height: 640 });
  65  |   const editor = await editorAt(page);
  66  |   await page.keyboard.type('/');
  67  |   await expect(page.getByRole('listbox')).toBeVisible();
  68  |   await page.keyboard.press('End');
  69  |   const rect = await page.locator('.suggestion-menu').boundingBox();
  70  |   expect(rect).not.toBeNull();
  71  |   expect(rect!.x).toBeGreaterThanOrEqual(8);
  72  |   expect(rect!.x + rect!.width).toBeLessThanOrEqual(352);
  73  |   expect(rect!.y).toBeGreaterThanOrEqual(8);
  74  |   expect(rect!.y + rect!.height).toBeLessThanOrEqual(632);
  75  |   await page.getByRole('heading', { name: 'Greiva PoC', exact: true }).click();
  76  |   await expect(page.getByRole('listbox')).toHaveCount(0);
  77  |   await expect(editor.locator('p')).toHaveText('/');
  78  | });
  79  | 
  80  | test('STEP2-UX-TOGGLE: Enter reuses existing body and collapse moves caret to visible heading', async ({ page }) => {
  81  |   const editor = await toggleAt(page);
  82  |   const content = editor.locator('[data-type="detailsContent"]');
  83  |   await expect(content).toBeVisible();
  84  |   await page.keyboard.press('Enter');
  85  |   await page.keyboard.type('Body text');
  86  |   await expect(content.locator('p')).toHaveCount(1);
  87  |   await expect(content).toHaveText('Body text');
  88  |   await page.keyboard.press('ControlOrMeta+Enter');
  89  |   await expect(content).toBeHidden();
  90  |   await expect(editor).toBeFocused();
  91  |   await page.keyboard.type('!');
  92  |   await expect(editor.locator('summary')).toHaveText('Heading!');
  93  |   await page.keyboard.press('Enter');
  94  |   await expect(content).toBeVisible();
  95  |   await expect(content.locator('p')).toHaveCount(1);
  96  |   await page.keyboard.type('Prefix ');
  97  |   await expect(content).toHaveText('Prefix Body text');
  98  | });
  99  | 
  100 | test('STEP2-UX-TOGGLE: pointer retains caret, keyboard button activation retains focus', async ({ page }) => {
  101 |   const editor = await toggleAt(page);
  102 |   const content = editor.locator('[data-type="detailsContent"]');
  103 |   await page.keyboard.press('Enter');
  104 |   await page.keyboard.type('Retained');
  105 |   await editor.getByRole('button', { name: 'Toggleを閉じる', exact: true }).click();
  106 |   await expect(editor).toBeFocused();
  107 |   await page.keyboard.type('!');
  108 |   await expect(editor.locator('summary')).toHaveText('Heading!');
  109 |   const button = editor.locator('[data-type="details"] > button');
  110 |   await button.focus();
  111 |   await button.press('Enter');
  112 |   await expect(content).toBeVisible();
  113 |   await expect(button).toBeFocused();
  114 |   await button.press('Space');
  115 |   await expect(content).toBeHidden();
  116 |   await expect(button).toBeFocused();
  117 |   await expect(content).toHaveText('Retained');
  118 | });
  119 | 
  120 | test('STEP2-UX-TOGGLE: folding is excluded from content undo and nested shortcut uses nearest toggle', async ({ page }) => {
  121 |   const editor = await toggleAt(page);
  122 |   await page.keyboard.press('Enter');
  123 |   await page.keyboard.type('Outer body');
  124 |   await page.keyboard.press('Enter');
  125 |   await page.keyboard.type('/toggle');
  126 |   await page.getByRole('option', { name: 'Toggle', exact: true }).click();
  127 |   await page.keyboard.type('Inner');
  128 |   const toggles = editor.locator('[data-type="details"]');
  129 |   await expect(toggles).toHaveCount(2);
  130 |   await page.keyboard.press('ControlOrMeta+Enter');
  131 |   await expect(toggles.first()).toHaveClass(/is-open/);
> 132 |   await expect(toggles.last()).not.toHaveClass(/is-open/);
      |                                    ^ Error: expect(locator).not.toHaveClass(expected) failed
  133 |   await page.keyboard.press('ControlOrMeta+Enter');
  134 |   await expect(toggles.last()).toHaveClass(/is-open/);
  135 |   await page.keyboard.press('ControlOrMeta+z');
  136 |   await expect(editor).not.toContainText('Inner');
  137 |   await expect(editor).toContainText('Outer body');
  138 | });
  139 | 
  140 | test('STEP2-UX-VISUAL: capture polished slash menu and toggle at a desktop viewport', async ({ page }, testInfo) => {
  141 |   await page.setViewportSize({ width: 1100, height: 900 });
  142 |   const editor = await toggleAt(page);
  143 |   await page.getByRole('textbox', { name: 'Pageタイトル' }).fill('Greiva — 書く、整理する');
  144 |   await editor.locator('summary').click();
  145 |   await page.keyboard.press('End');
  146 |   await page.keyboard.press('Enter');
  147 |   await page.keyboard.type('A place for ideas and the next action.');
  148 |   await page.keyboard.press('Enter');
  149 |   await page.keyboard.type('/');
  150 |   const menu = page.getByRole('listbox', { name: 'ブロックを挿入' });
  151 |   await expect(menu).toBeVisible();
  152 |   await menu.getByRole('option', { name: 'Todo', exact: true }).hover();
  153 |   const screenshot = testInfo.outputPath('editor-ux.png');
  154 |   await page.screenshot({ path: screenshot, fullPage: true });
  155 |   await testInfo.attach('editor-ux', { path: screenshot, contentType: 'image/png' });
  156 | });
  157 | 
```