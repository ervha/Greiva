import { test, expect } from '@playwright/test';
import { newId } from '@greiva/shared';
import * as Y from 'yjs';
import { emptyPageUpdate } from '@greiva/sync';

test('RENDER-ISOLATION: Page saves avoid unrelated redraws while titles and Task drafts remain reactive', async ({ page, request }, info) => {
  test.setTimeout(60000);
  const device = newId(), pageId = newId(), clientId = newId();
  const rpc = async (command: string, fields: object = {}) => {
    const response = await request.post('/__greiva_test_store', { data: { device, command, ...fields } });
    expect(response.ok()).toBe(true); const value = await response.json(); expect(value.error).toBeUndefined(); return value.value;
  };
  const doc = new Y.Doc(); Y.applyUpdate(doc, emptyPageUpdate());
  const fragment = doc.getXmlFragment('body'); fragment.delete(0, fragment.length);
  const rows = Array.from({ length: 1000 }, (_, index) => `Row ${index}`);
  for (const row of rows) { const paragraph = new Y.XmlElement('paragraph'), text = new Y.XmlText(); text.insert(0, row); paragraph.insert(0, [text]); fragment.push([paragraph]); }
  await rpc('load', { pageId }); await rpc('append', { pageId, update: Array.from(Y.encodeStateAsUpdate(doc)) }); doc.destroy();
  await rpc('structured-client-id', { candidate: clientId });
  for (let index = 0; index < 250; index++) await rpc('structured-mutate', { operation: { operationId: newId(), clientId, entityId: newId(), entityType: 'task', kind: 'create', payload: { title: `Task ${index}`, status: 'todo', due: null }, baseVersion: null } });
  await page.addInitScript(({ device }) => { localStorage.setItem('greiva-test-device', device); sessionStorage.setItem('greiva-connection-paused', '1'); }, { device });
  await page.goto(`/?page=${pageId}`);
  const editor = page.getByRole('textbox', { name: 'Page本文' }), panel = page.getByRole('region', { name: 'TaskとRelation' });
  await expect(editor.locator(':scope > p')).toHaveCount(1000);
  await expect(panel.getByRole('list', { name: '保存したTask' }).locator(':scope > li')).toHaveCount(250);
  await expect(panel.getByLabel('Taskの保存状態')).toContainText('送信待ち 250件');
  await panel.getByLabel('Taskの名前', { exact: true }).fill('Draft retained');
  await editor.locator(':scope > p').nth(500).click(); await page.keyboard.press('End');
  await page.keyboard.type('w'); await expect(page.getByLabel('端末の保存状態')).toHaveText('端末に保存済み');
  const counts = () => page.evaluate(() => ({ ...(window as unknown as { greivaRenderProbe: Record<string, number> }).greivaRenderProbe }));
  const before = await counts();
  const text = 'abcdefghijklmnopqrst'; await page.keyboard.type(text, { delay: 10 });
  await expect(page.getByLabel('端末の保存状態')).toHaveText('端末に保存済み');
  const after = await counts();
  const isolated = process.env.GREIVA_EXPECT_RENDER_ISOLATION === '1';
  if (isolated) { expect(after.TaskPanel).toBe(before.TaskPanel); expect(after.PageEditor).toBe(before.PageEditor); }
  else { expect(after.TaskPanel).toBeGreaterThan(before.TaskPanel!); expect(after.PageEditor).toBeGreaterThan(before.PageEditor!); }
  const expected = [...rows]; expected[500] += 'w' + text;
  await expect(editor.locator(':scope > p')).toHaveText(expected);
  await expect(panel.getByLabel('Taskの名前', { exact: true })).toHaveValue('Draft retained');
  const original = await rpc('structured-snapshot');
  expect(original.tasks).toHaveLength(250); expect(original.operations).toHaveLength(250);
  await page.getByLabel('Pageタイトル', { exact: true }).fill('Renamed Page');
  await expect(panel.getByLabel('関連元')).toContainText('Page: Renamed Page');
  const metadataChanged = await counts(); expect(metadataChanged.TaskPanel).toBeGreaterThan(after.TaskPanel!); expect(metadataChanged.PageEditor).toBeGreaterThan(after.PageEditor!);
  await panel.getByLabel('Taskの名前', { exact: true }).fill('Edited draft');
  await expect(panel.getByLabel('Taskの名前', { exact: true })).toHaveValue('Edited draft');
  const draftChanged = await counts(); expect(draftChanged.TaskPanel).toBeGreaterThan(metadataChanged.TaskPanel!);
  expect(await rpc('structured-snapshot')).toEqual(original);
  await info.attach('render-isolation', { body: JSON.stringify({ isolated, blocks: 1000, tasks: 250, inputCharacters: 21, before, after, metadataChanged, draftChanged, scope: 'Temporary render counters inserted into Docker diagnostic sources; not normal production code, native IME or frame timing.' }, null, 2), contentType: 'application/json' });
});
