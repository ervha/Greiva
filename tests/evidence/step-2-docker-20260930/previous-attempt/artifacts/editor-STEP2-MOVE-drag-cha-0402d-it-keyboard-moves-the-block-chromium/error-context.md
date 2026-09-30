# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor.spec.ts >> STEP2-MOVE: drag changes order, undo restores it, keyboard moves the block
- Location: tests/e2e/editor.spec.ts:106:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 3
+ Received  + 1

  Array [
-   "first",
-   "second",
-   "third",
+   "",
  ]

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - heading "Greiva PoC" [level=1] [ref=e5]
    - status "同期状態" [ref=e6]: 未検証（structured）
  - paragraph [ref=e7]: Editor検証：編集内容はこの画面を閉じると失われます。永続化・同期は未実装です。
  - region "Page Editor" [ref=e8]:
    - textbox "Pageタイトル" [ref=e9]:
      - /placeholder: 無題のPage
    - toolbar "編集操作" [ref=e10]:
      - button "元に戻す" [disabled] [ref=e11]
      - button "やり直す" [ref=e12] [cursor=pointer]
      - group [ref=e13]:
        - generic "ブロックを挿入" [ref=e14] [cursor=pointer]
      - button "上へ移動" [disabled] [ref=e15]
      - button "下へ移動" [disabled] [ref=e16]
      - button "インデント" [disabled] [ref=e17]
      - button "インデント解除" [disabled] [ref=e18]
    - paragraph [ref=e19]: 行頭の / でブロック追加、@ でMention。Ctrl+Z / Ctrl+Shift+Zで元に戻す・やり直す。
    - textbox "Page本文" [active] [ref=e21]:
      - button "ブロック1をドラッグして移動" [ref=e22]: ⠿
      - paragraph [ref=e23]
```

# Test source

```ts
  18  | const blocks = [
  19  |   ['本文', 'p'], ['見出し1', 'h1'], ['見出し2', 'h2'], ['見出し3', 'h3'],
  20  |   ['箇条書き', 'ul:not([data-type])'], ['番号付きリスト', 'ol'],
  21  |   ['Todo', 'ul[data-type="taskList"]'], ['引用', 'blockquote'], ['コード', 'pre'],
  22  |   ['区切り線', 'hr'], ['Toggle', '[data-type="details"]'],
  23  | ] as const;
  24  | for (const [label, selector] of blocks) {
  25  |   test(`STEP2-BLOCK: slash inserts ${label}, edit and delete`, async ({ page }) => {
  26  |     const editor = await body(page);
  27  |     await slash(page, label);
  28  |     await expect(editor.locator(selector).first()).toBeVisible();
  29  |     if (label !== '区切り線') {
  30  |       await page.keyboard.type('block content');
  31  |       await expect(editor).toContainText('block content');
  32  |     }
  33  |     await editor.press('ControlOrMeta+a');
  34  |     await editor.press('Backspace');
  35  |     await expect(editor).not.toContainText('block content');
  36  |     if (selector !== 'p') await expect(editor.locator(selector)).toHaveCount(0);
  37  |   });
  38  | }
  39  | 
  40  | test('STEP2-TODO: checkbox and nested list survive undo/redo', async ({ page }) => {
  41  |   const editor = await body(page);
  42  |   await slash(page, 'Todo');
  43  |   await page.keyboard.type('first');
  44  |   await page.keyboard.press('Enter');
  45  |   await page.keyboard.type('second');
  46  |   await page.getByRole('button', { name: 'インデント', exact: true }).click();
  47  |   await expect(editor.locator('ul[data-type="taskList"] ul[data-type="taskList"]')).toHaveCount(1);
  48  |   await page.getByRole('button', { name: 'インデント解除', exact: true }).click();
  49  |   await expect(editor.locator('ul[data-type="taskList"] ul[data-type="taskList"]')).toHaveCount(0);
  50  |   const checkbox = editor.getByRole('checkbox', { name: 'Todo: first', exact: true });
  51  |   await checkbox.check();
  52  |   await expect(checkbox).toBeChecked();
  53  |   await page.getByRole('button', { name: '元に戻す', exact: true }).click();
  54  |   await expect(checkbox).not.toBeChecked();
  55  |   await page.getByRole('button', { name: 'やり直す', exact: true }).click();
  56  |   await expect(checkbox).toBeChecked();
  57  | });
  58  | 
  59  | test('STEP2-TOGGLE: nested content folds without losing text and unwraps', async ({ page }) => {
  60  |   const editor = await body(page);
  61  |   await slash(page, 'Toggle');
  62  |   await page.keyboard.type('summary');
  63  |   await page.getByRole('button', { name: 'Toggleを開く', exact: true }).click();
  64  |   const content = editor.locator('[data-type="detailsContent"]').first();
  65  |   await content.locator('p').click();
  66  |   await page.keyboard.type('nested text');
  67  |   await page.keyboard.press('Enter');
  68  |   await slash(page, 'Toggle');
  69  |   await page.keyboard.type('nested summary');
  70  |   await expect(editor.locator('[data-type="details"] [data-type="details"]')).toHaveCount(1);
  71  |   await editor.getByRole('button', { name: 'Toggleを閉じる', exact: true }).first().click();
  72  |   await expect(content).toBeHidden();
  73  |   await editor.getByRole('button', { name: 'Toggleを開く', exact: true }).first().click();
  74  |   await expect(content).toBeVisible();
  75  |   await expect(content).toContainText('nested text');
  76  |   await editor.locator('summary').first().click();
  77  |   await page.getByRole('button', { name: 'Toggleを解除', exact: true }).click();
  78  |   await expect(editor.locator(':scope > [data-type="details"]')).toHaveCount(1);
  79  |   await expect(editor).toContainText('nested text');
  80  | });
  81  | 
  82  | test('STEP2-MENTION: keyboard selects a fixed entity and Escape leaves ordinary text', async ({ page }) => {
  83  |   const editor = await body(page);
  84  |   await page.keyboard.type('@');
  85  |   await expect(page.getByRole('listbox', { name: 'Mention候補' })).toBeVisible();
  86  |   await page.keyboard.press('ArrowDown');
  87  |   await page.keyboard.press('Enter');
  88  |   await expect(editor.locator('[data-type="mention"]')).toHaveAttribute('data-id', 'demo-task');
  89  |   await expect(editor).toContainText('サンプルTask');
  90  |   await page.keyboard.type('@');
  91  |   await page.keyboard.press('Escape');
  92  |   await expect(page.getByRole('listbox')).toHaveCount(0);
  93  |   await expect(editor).toContainText('@');
  94  | });
  95  | 
  96  | for (const [text, selector] of [['# ', 'h1'], ['## ', 'h2'], ['### ', 'h3'], ['- ', 'ul:not([data-type])'], ['1. ', 'ol'], ['[] ', 'ul[data-type="taskList"]']] as const) {
  97  |   test(`STEP2-MARKDOWN: ${text} shortcut`, async ({ page }) => {
  98  |     const editor = await body(page);
  99  |     await page.keyboard.type(text);
  100 |     await expect(editor.locator(selector)).toHaveCount(1);
  101 |     await page.keyboard.type('shortcut content');
  102 |     await expect(editor.locator(selector)).toContainText('shortcut content');
  103 |   });
  104 | }
  105 | 
  106 | test('STEP2-MOVE: drag changes order, undo restores it, keyboard moves the block', async ({ page }) => {
  107 |   const editor = await body(page);
  108 |   await page.keyboard.type('first');
  109 |   await page.keyboard.press('Enter');
  110 |   await page.keyboard.type('second');
  111 |   await page.keyboard.press('Enter');
  112 |   await page.keyboard.type('third');
  113 |   const texts = () => editor.locator(':scope > p').allTextContents();
  114 |   await expect.poll(texts).toEqual(['first', 'second', 'third']);
  115 |   await editor.getByRole('button', { name: 'ブロック3をドラッグして移動', exact: true }).dragTo(editor.locator(':scope > p').first(), { targetPosition: { x: 5, y: 2 } });
  116 |   await expect.poll(texts).toEqual(['third', 'first', 'second']);
  117 |   await page.getByRole('button', { name: '元に戻す', exact: true }).click();
> 118 |   await expect.poll(texts).toEqual(['first', 'second', 'third']);
      |                            ^ Error: expect(received).toEqual(expected) // deep equality
  119 |   await editor.locator(':scope > p').last().click();
  120 |   await page.keyboard.press('ControlOrMeta+Shift+ArrowUp');
  121 |   await expect.poll(texts).toEqual(['first', 'third', 'second']);
  122 |   await page.getByRole('button', { name: '下へ移動', exact: true }).click();
  123 |   await expect.poll(texts).toEqual(['first', 'second', 'third']);
  124 | });
  125 | 
  126 | test('STEP2-COMPOSITION: slash menu does not consume composition Enter', async ({ page }) => {
  127 |   const editor = await body(page);
  128 |   await page.keyboard.type('/');
  129 |   const menu = page.getByRole('listbox', { name: 'ブロックを挿入' });
  130 |   await expect(menu).toBeVisible();
  131 |   const consumed = await editor.evaluate(element => !element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })));
  132 |   expect(consumed).toBe(false);
  133 |   await expect(menu).toBeVisible();
  134 |   await page.keyboard.press('Escape');
  135 |   await expect(menu).toHaveCount(0);
  136 |   // Synthetic composition safety check only; this is not Microsoft IME evidence.
  137 | });
  138 | 
```