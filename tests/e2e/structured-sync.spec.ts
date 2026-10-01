import { test,expect,type Page } from '@playwright/test';
import { newId } from '@greiva/shared';
import { structuredSnapshotSchema } from '@greiva/protocol';
const panel = (page: Page)=>page.getByRole('region',{name:'TaskとRelation'});
const synced = (page: Page)=>expect(panel(page).getByLabel('TaskとRelationの同期状態')).toHaveText('サーバーと同期済み');
async function snapshot(page: Page) {
  const device = await page.evaluate(()=>localStorage.getItem('greiva-test-device'));
  return structuredSnapshotSchema.parse((await (await page.request.post('/__greiva_test_store',{data:{device,command:'structured-snapshot'}})).json()).value);
}
const row = (page: Page,id: string)=>panel(page).getByLabel('保存したTask').locator(`[data-entity-id="${id}"]`);
test('STEP7-E2E: offline creation/reload, peer field merge, keyboard conflict resolution and focus preservation use real HTTP and Rust SQLite',async ({page,browser},info)=> {
  test.setTimeout(60_000); const peerContext = await browser.newContext(); const peer = await peerContext.newPage();
  try {
    await page.goto(`/?page=${newId()}`); await synced(page);
    const name = `sync ${newId()}`;
    await panel(page).getByLabel('Taskの名前').fill(name); await panel(page).getByLabel('Taskの名前').press('Enter');
    await synced(page); const id = (await snapshot(page)).tasks.find(task=>task.title===name)!.id;
    await peer.goto(`/?page=${newId()}`); await synced(peer); await expect(row(peer,id)).toContainText(name);
    await page.getByRole('button',{name:'接続を一時停止'}).click();
    await row(page,id).getByRole('button',{name:`${name}を編集`}).click(); await panel(page).getByLabel('Taskの名前').fill('local title'); await panel(page).getByLabel('期限').fill('2026-10-10');
    await panel(page).getByLabel('Taskの名前').press('Enter'); await expect(panel(page).getByLabel('Taskの保存状態')).toContainText('送信待ち 1件');
    const before = await snapshot(page); const device = await page.evaluate(()=>localStorage.getItem('greiva-test-device'));
    await page.request.post('/__greiva_test_store_control',{data:{device,command:'kill'}}); await page.reload();
    await expect(page.getByRole('button',{name:'再接続',exact:true})).toBeVisible();
    await expect(panel(page).getByLabel('TaskとRelationの同期状態')).toHaveText('オフライン'); expect(await snapshot(page)).toEqual(before);
    await row(peer,id).getByRole('button',{name:`${name}を編集`}).click(); await panel(peer).getByLabel('Taskの名前').fill('remote title'); await panel(peer).getByLabel('Taskの状態',{exact:true}).selectOption('done');
    await panel(peer).getByRole('button',{name:'変更を保存',exact:true}).click(); await synced(peer);
    await page.getByRole('button',{name:'再接続',exact:true}).click(); await expect(panel(page).getByLabel('TaskとRelationの同期状態')).toHaveText('競合の解決待ち');
    const conflict = panel(page).getByRole('article',{name:'名前の競合'}); await expect(conflict).toContainText(name); await expect(conflict).toContainText('local title'); await expect(conflict).toContainText('remote title');
    await expect(row(page,id)).toContainText('完了'); await expect(row(page,id)).toContainText('2026-10-10');
    await panel(page).getByLabel('Taskの名前').fill('keep unsaved draft'); await panel(page).getByLabel('Taskの名前').focus(); await page.waitForTimeout(2200);
    await expect(panel(page).getByLabel('Taskの名前')).toHaveValue('keep unsaved draft'); await expect(panel(page).getByLabel('Taskの名前')).toBeFocused();
    await conflict.screenshot({path:`${process.env.GREIVA_EVIDENCE_DIR}/structured-conflict.png`});
    await conflict.getByRole('button',{name:'この端末の値を採用'}).focus(); await page.keyboard.press('Enter');
    await synced(page); await expect(panel(page).getByRole('region',{name:'競合一覧'})).toBeFocused();
    await expect(row(peer,id)).toContainText('local title'); await expect(panel(page).getByLabel('Taskの名前')).toHaveValue('keep unsaved draft');
    await synced(peer); const [left,right] = await Promise.all([snapshot(page),snapshot(peer)]);
    expect(left.tasks).toEqual(right.tasks); expect(left.conflicts).toEqual(right.conflicts); expect(left.conflicts.filter(conflict=>conflict.status==='open')).toEqual([]);
    await info.attach('structured-convergence',{body:JSON.stringify({left,right},null,2),contentType:'application/json'});
    await row(page,id).getByRole('button',{name:'local titleを削除'}).click(); await synced(page); await expect(row(peer,id)).toHaveCount(0);
  } finally { await peerContext.close(); }
});
test('STEP7-E2E-DRAFT: peer updates do not overwrite an active draft; stale save retains user input; remote conflict choice is explicit',async ({page,browser})=> {
  test.setTimeout(60_000); const context = await browser.newContext(); const peer = await context.newPage();
  try {
    await page.goto(`/?page=${newId()}`); await synced(page); const name = `draft ${newId()}`;
    await panel(page).getByLabel('Taskの名前').fill(name); await panel(page).getByRole('button',{name:'Taskを追加',exact:true}).click(); await synced(page);
    const id = (await snapshot(page)).tasks.find(task=>task.title===name)!.id; await peer.goto(`/?page=${newId()}`); await synced(peer);
    await row(page,id).getByRole('button',{name:`${name}を編集`}).click(); await panel(page).getByLabel('Taskの名前').fill('unsaved input'); await panel(page).getByLabel('Taskの名前').focus();
    await row(peer,id).getByRole('button',{name:`${name}を編集`}).click(); await panel(peer).getByLabel('期限').fill('2026-12-24'); await panel(peer).getByRole('button',{name:'変更を保存',exact:true}).click(); await synced(peer);
    await expect(row(page,id)).toContainText('2026-12-24'); await expect(panel(page).getByLabel('Taskの名前')).toHaveValue('unsaved input'); await expect(panel(page).getByLabel('Taskの名前')).toBeFocused();
    await panel(page).getByLabel('Taskの名前').press('Enter'); await expect(panel(page).getByRole('alert')).toContainText('Stale local base version'); await expect(panel(page).getByLabel('Taskの名前')).toHaveValue('unsaved input');
    await panel(page).getByRole('button',{name:'編集を取消',exact:true}).click();
    await page.getByRole('button',{name:'接続を一時停止'}).click(); await row(page,id).getByRole('button',{name:`${name}を編集`}).click();
    await panel(page).getByLabel('Taskの名前').fill('offline contender'); await panel(page).getByRole('button',{name:'変更を保存',exact:true}).click();
    await row(peer,id).getByRole('button',{name:`${name}を編集`}).click(); await panel(peer).getByLabel('Taskの名前').fill('remote chosen'); await panel(peer).getByRole('button',{name:'変更を保存',exact:true}).click(); await synced(peer);
    await page.getByRole('button',{name:'再接続',exact:true}).click(); const conflict = panel(page).getByRole('article',{name:'名前の競合'}); await expect(conflict).toBeVisible();
    await conflict.getByRole('button',{name:'他の端末の値を採用'}).click(); await synced(page); await synced(peer);
    await expect(row(page,id)).toContainText('remote chosen');
    await expect.poll(async ()=> {const [left,right] = await Promise.all([snapshot(page),snapshot(peer)]); return JSON.stringify(left.tasks)===JSON.stringify(right.tasks) && JSON.stringify(left.conflicts)===JSON.stringify(right.conflicts);},{timeout:10_000}).toBe(true);
  } finally { await context.close(); }
});
