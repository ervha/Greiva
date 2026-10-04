import { test, expect } from '@playwright/test';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';

test('STEP8-DRAG-1000: real gutter drag retains every block and reports browser frame timing', async ({ page }, info) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1280, height: 1000 });
  const pageId = crypto.randomUUID(), document = new Y.Doc();
  const peer = new HocuspocusProvider({ url: `ws://127.0.0.1:1234?clientId=${crypto.randomUUID()}`, name: `page:${pageId}`, document });
  const texts = Array.from({ length: 1000 }, (_, index) => `Block ${String(index).padStart(4, '0')}`);
  try {
    await expect.poll(() => peer.isSynced).toBe(true);
    document.transact(() => {
      const body = document.getXmlFragment('body');
      body.delete(0, body.length); // Replace the server's shared empty-page seed.
      for (const text of texts) { const paragraph = new Y.XmlElement('paragraph'), content = new Y.XmlText(); content.insert(0, text); paragraph.insert(0, [content]); body.push([paragraph]); }
    });
    await expect.poll(() => peer.unsyncedChanges).toBe(0);
    await page.goto(`/?page=${pageId}`);
    const editor = page.getByRole('textbox', { name: 'Page本文' }), paragraphs = editor.locator(':scope > p');
    await expect(paragraphs).toHaveCount(1000, { timeout: 15000 });
    await expect(paragraphs.first()).toHaveText(texts[0]!);
    await page.evaluate(() => {
      const samples: { type: string; start: number; twoFrames?: number }[] = [];
      const longTasks: { start: number; duration: number }[] = [];
      const probe = { samples, longTasks, gestureStart: 0, gestureEnd: 0 };
      (window as unknown as { dragProbe: typeof probe }).dragProbe = probe;
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) longTasks.push({ start: entry.startTime, duration: entry.duration });
      }).observe({ type: 'longtask' });
      for (const type of ['dragstart', 'dragover']) window.addEventListener(type, event => {
        if (type === 'dragstart' && !(event.target as Element).closest('.block-handle')) return;
        if (type === 'dragover' && !(event as DragEvent).dataTransfer?.types.includes('application/x-greiva-block')) return;
        const sample = { type, start: performance.now() } as typeof samples[number];
        samples.push(sample);
        if (type === 'dragstart') probe.gestureStart = sample.start;
        requestAnimationFrame(() => requestAnimationFrame(() => { sample.twoFrames = performance.now() - sample.start; }));
      }, true);
      window.addEventListener('dragend', () => { probe.gestureEnd = performance.now(); }, true);
    });
    const handle = await editor.getByRole('button', { name: 'ブロック1をドラッグして移動', exact: true }).boundingBox();
    const target = await paragraphs.nth(4).boundingBox();
    if (!handle || !target) throw new Error('Missing large-page geometry');
    const x = handle.x + handle.width / 2;
    await page.mouse.move(x, handle.y + handle.height / 2); await page.mouse.down();
    await page.mouse.move(x, handle.y + handle.height + 8, { steps: 4 });
    await page.mouse.move(x, target.y + 2, { steps: 20 }); await page.mouse.move(x, target.y + 3);
    await expect(page.locator('.block-drag-preview')).toBeVisible();
    await page.mouse.up();
    const moved = [...texts.slice(1, 4), texts[0]!, ...texts.slice(4)];
    await expect(paragraphs).toHaveText(moved);
    await page.keyboard.press('ControlOrMeta+z'); await expect(paragraphs).toHaveText(texts);
    await expect(page.locator('.block-drag-preview')).toHaveCount(0);
    await expect.poll(() => peer.unsyncedChanges).toBe(0);
    await expect.poll(() => document.getXmlFragment('body').toArray().map(block => (block as Y.XmlElement).get(0).toString())).toEqual(texts);
    await expect.poll(async () => {
      const local = await page.evaluate(() => (window as unknown as { greivaTest: { snapshot: () => { clocks: number[][]; pending: number } } }).greivaTest.snapshot());
      return local.pending === 0 && JSON.stringify(local.clocks) === JSON.stringify(Array.from(Y.decodeStateVector(Y.encodeStateVector(document))).sort(([a], [b]) => a - b));
    }).toBe(true);
    const report = await page.evaluate(() => (window as unknown as { dragProbe: unknown }).dragProbe);
    await info.attach('drag-1000-browser-timing', { body: JSON.stringify({ report, blocks: 1000, scope: 'Docker Chromium dev frontend and test SQLite bridge. Event-to-two-rAF timing is diagnostic, not native FPS, actual paint or release SLO.' }, null, 2), contentType: 'application/json' });
  } finally { peer.destroy(); document.destroy(); }
});
