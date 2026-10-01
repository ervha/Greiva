import {test,expect,chromium,type Page,type BrowserContext,type APIRequestContext} from '@playwright/test';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import * as Y from 'yjs';
import {newId} from '@greiva/shared';
import {structuredSnapshotSchema,pushResponseSchema,type StructuredSnapshot,type PushOperation} from '@greiva/protocol';

type PageSnapshot={pageId:string;clocks:Array<[number,number]>;json:unknown;fragment:string;stateVector:number[];pending:number;selection:{from:number;to:number;parent:string;offset:number;size:number}};
type Inspection={marker:{pid:number;stage:string}|null;state:unknown;receipts:unknown[];entities:unknown[];conflicts:unknown[];integrity:unknown;pageUpdates:Array<{seq:number;page_id:string;update_bytes:number[];digest:number[]}>};
const body=(page:Page)=>page.getByRole('textbox',{name:'Page本文'});
const panel=(page:Page)=>page.getByRole('region',{name:'TaskとRelation'});
async function pageState(page:Page) {
  return page.evaluate(()=> (window as unknown as {greivaTest:{snapshot:()=>PageSnapshot}}).greivaTest.snapshot());
}
async function control(request:APIRequestContext,device:string,command:string):Promise<unknown> {
  const response=await request.post('http://127.0.0.1:1420/__greiva_test_store_control',{data:{device,command}});
  expect(response.ok()).toBe(true); return (await response.json()).value as unknown;
}
async function structured(request:APIRequestContext,device:string) {
  const response=await request.post('http://127.0.0.1:1420/__greiva_test_store',{data:{device,command:'structured-snapshot'}});
  expect(response.ok()).toBe(true); return structuredSnapshotSchema.parse((await response.json()).value);
}
async function profile(directory:string,device:string) {
  const context=await chromium.launchPersistentContext(directory,{baseURL:'http://127.0.0.1:1420'});
  await context.addInitScript(id=> {localStorage.setItem('greiva-test-device',id);sessionStorage.setItem('greiva-connection-paused','1');},device);
  let connected=false;
  await context.routeWebSocket(/127\.0\.0\.1:1234/,socket=> {if(connected) socket.connectToServer();else socket.close();});
  return {context,connect(){connected=true;}};
}
async function terminate(context:BrowserContext,request:APIRequestContext,device:string) {
  const browser=context.browser()!; const cdp=await browser.newBrowserCDPSession();
  const processes=await cdp.send('SystemInfo.getProcessInfo');
  const pid=processes.processInfo.find(value=>value.type==='browser')!.id;
  const exited=new Promise<void>(done=>browser.once('disconnected',()=>done()));
  const startedAt=new Date().toISOString();
  const storeKill=control(request,device,'kill'); process.kill(pid,'SIGKILL');
  await exited; const store=await storeKill as {pid:number;signal:string|null;at:string;path:string};
  expect(store.pid).toBeGreaterThan(0);expect(store.signal).toBe('SIGKILL');
  return {browser:{pid,signal:'SIGKILL',startedAt,disconnectedAt:new Date().toISOString()},store};
}
async function equalPeers(a:Page,b:Page,request:APIRequestContext,device:string,peerDevice:string) {
  await expect.poll(async()=> {
    const [left,right,local,remote]=await Promise.all([pageState(a),pageState(b),structured(request,device),structured(request,peerDevice)]);
    return JSON.stringify(left.clocks)===JSON.stringify(right.clocks) && JSON.stringify(left.json)===JSON.stringify(right.json) && left.fragment===right.fragment &&
      JSON.stringify(local.tasks)===JSON.stringify(remote.tasks) && JSON.stringify(local.relations)===JSON.stringify(remote.relations) && JSON.stringify(local.conflicts)===JSON.stringify(remote.conflicts);
  },{timeout:30_000}).toBe(true);
}

for(const boundary of ['edit-immediate','local-committed','push-after-server-commit','pull-before-cursor'] as const) {
  test(`STEP7-COMBINED-CRASH-${boundary}: Page blocks, Task intent and Relation survive browser/store SIGKILL and offline restart`,async({browser,request},info)=> {
    test.setTimeout(90_000);
    const directory=mkdtempSync(join(tmpdir(),'greiva-combined-crash-')); const device=newId();
    const peerContext=await browser.newContext(); const peer=await peerContext.newPage();
    let current:BrowserContext|undefined; let releasePush=()=>{};
    try {
      let desktop=await profile(directory,device); current=desktop.context; let page=current.pages()[0]!;
      await page.goto('/'); await expect(body(page)).toBeVisible();
      await page.getByRole('button',{name:'新しいPage',exact:true}).click(); await expect(body(page)).toBeVisible();
      const pageId=new URL(page.url()).searchParams.get('page')!;
      const title=`combined ${boundary}`; await page.getByLabel('Pageタイトル',{exact:true}).fill(title);
      await body(page).click(); await page.keyboard.type('keep');
      await page.keyboard.press('Enter'); await page.keyboard.type('remove');
      await page.keyboard.press('Enter'); await page.keyboard.type('move');
      await body(page).locator(':scope > p').nth(1).click();
      await expect.poll(async()=> (await pageState(page)).selection.parent).toBe('remove');
      await page.keyboard.press('Home');
      await expect.poll(async()=> (await pageState(page)).selection.offset).toBe(0);
      await page.keyboard.press('Shift+End');
      await expect.poll(async()=> {const {selection}=await pageState(page);return selection.to-selection.from;}).toBe('remove'.length);
      await page.keyboard.press('Backspace'); await page.keyboard.press('Delete');
      await body(page).locator(':scope > p:last-child').click();
      await expect.poll(async()=> (await pageState(page)).selection.parent).toBe('move');
      await page.getByRole('button',{name:'上へ移動',exact:true}).click();
      await expect(body(page)).not.toContainText('remove');
      const taskName=`task ${boundary} ${newId()}`;
      await panel(page).getByLabel('Taskの名前').fill(taskName); await panel(page).getByLabel('Taskの名前').press('Enter');
      await expect(panel(page).getByLabel('Taskの保存状態')).toContainText('送信待ち 1件');
      const taskId=(await structured(request,device)).tasks.find(task=>task.title===taskName)!.id;
      await panel(page).getByRole('button',{name:`${taskName}を編集`,exact:true}).click();
      await panel(page).getByLabel('Taskの名前').fill(`edited ${taskName}`);
      await panel(page).getByLabel('Taskの状態',{exact:true}).selectOption('in_progress');
      await panel(page).getByLabel('期限').fill('2028-02-29');
      await panel(page).getByRole('button',{name:'変更を保存',exact:true}).click();
      await expect(panel(page).getByLabel('Taskの保存状態')).toContainText('送信待ち 2件');
      await panel(page).getByLabel('関連元').selectOption(`page:${pageId}`);
      await panel(page).getByLabel('関連先').selectOption(`task:${taskId}`);
      await panel(page).getByRole('button',{name:'Relationを追加',exact:true}).click();
      await expect(panel(page).getByLabel('Taskの保存状態')).toContainText('送信待ち 3件');
      await expect(page.getByLabel('端末の保存状態')).toHaveText('端末に保存済み');
      const offlineQueue=await structured(request,device);
      const savedPage=await pageState(page);
      expect(offlineQueue.operations.map(operation=>operation.status)).toEqual(['pending','pending','pending']);
      expect(offlineQueue.tasks.find(task=>task.id===taskId)).toMatchObject({title:`edited ${taskName}`,status:'in_progress',due:'2028-02-29'});
      expect(offlineQueue.relations[0]).toMatchObject({fromType:'page',fromId:pageId,toType:'task',toId:taskId});
      let pushed:PushOperation|null=null; let serverResult:unknown=null;
      let beforePull:Inspection|undefined; let stagedPull:Inspection|undefined;
      let immediateEditedAt:string|undefined;
      if(boundary==='edit-immediate') {
        await control(request,device,'arm-page-barrier');
        await body(page).locator(':scope > p:last-child').click(); await page.keyboard.press('End');
        await page.keyboard.type(' immediate'); // Do not await the saved indicator after this edit.
        immediateEditedAt=new Date().toISOString();
        await expect.poll(async()=> {
          stagedPull=await control(request,device,'barrier-status') as Inspection;
          return stagedPull.marker?.stage;
        },{timeout:10_000}).toBe('page-append-before-commit');
        await expect(page.getByLabel('端末の保存状態')).toHaveText('端末へ保存中…');
      } else if(boundary==='push-after-server-commit') {
        let entered=()=>{}; const pushedOnce=new Promise<void>(done=> {entered=done;});
        const parked=new Promise<void>(done=> {releasePush=done;});
        await page.route('http://127.0.0.1:3000/sync/push',async route=> {
          try {
            pushed=(route.request().postDataJSON() as {operations:PushOperation[]}).operations[0]!;
            const response=await route.fetch(); serverResult=await response.json(); entered(); await parked;
            await route.abort();
          } catch { /* The killed browser cannot receive the already committed ACK. */ }
        });
        desktop.connect(); await page.getByRole('button',{name:'再接続',exact:true}).click();
        await pushedOnce;
        expect(pushResponseSchema.parse(serverResult).results[0]?.status).toBe('acknowledged');
        expect((await structured(request,device)).operations[0]?.status).toBe('pending');
        await expect(panel(page).getByLabel('TaskとRelationの同期状態')).not.toHaveText('サーバーと同期済み');
      } else if(boundary==='pull-before-cursor') {
        const remoteClient=newId(); const witnessId=newId();
        const push=async(kind:PushOperation['kind'],payload:object,baseVersion:number|null)=> {
          const response=await request.post('http://127.0.0.1:3000/sync/push',{data:{operations:[{operationId:newId(),clientId:remoteClient,entityId:witnessId,entityType:'task',kind,payload,baseVersion}]}});
          expect(response.ok()).toBe(true); return pushResponseSchema.parse(await response.json()).results[0]!;
        };
        await push('create',{title:'witness base',status:'todo',due:null},null);
        await push('update',{title:'peer witness'},1);
        expect((await push('update',{title:'witness contender'},1)).status).toBe('conflict');
        beforePull=await control(request,device,'inspect') as Inspection;
        await control(request,device,'arm-pull-barrier');
        desktop.connect(); await page.getByRole('button',{name:'再接続',exact:true}).click();
        await expect.poll(async()=> {
          stagedPull=await control(request,device,'barrier-status') as Inspection;
          return stagedPull.marker?.stage;
        },{timeout:10_000}).toBe('structured-pull-before-cursor');
        expect(stagedPull?.marker?.pid).toBeGreaterThan(0);
        for(const key of ['state','receipts','entities','conflicts'] as const) expect(stagedPull?.[key]).toEqual(beforePull[key]);
      }
      const pageBefore=await pageState(page);
      const saveIndicator=await page.getByLabel('端末の保存状態').textContent();
      const queueBefore=boundary==='pull-before-cursor' || boundary==='edit-immediate' ? offlineQueue:await structured(request,device);
      const killed=await terminate(current,request,device); current=undefined; releasePush();
      if(stagedPull?.marker) expect(stagedPull.marker.pid).toBe(killed.store.pid);
      if(boundary==='pull-before-cursor' || boundary==='edit-immediate') await control(request,device,'clear-barrier');
      desktop=await profile(directory,device);current=desktop.context;page=current.pages()[0]!;
      await page.goto('/');await expect(body(page)).toBeVisible({timeout:15_000});
      await expect(page.getByLabel('Pageタイトル',{exact:true})).toHaveValue(title);
      await expect(page.getByRole('button',{name:'再接続',exact:true})).toBeVisible();
      await expect(panel(page).getByLabel('TaskとRelationの同期状態')).toHaveText('オフライン');
      const restoredPage=await pageState(page); const restoredQueue=await structured(request,device);
      const afterRecovery=await control(request,device,'inspect') as Inspection;
      await info.attach(`offline-restoration-${boundary}`,{body:JSON.stringify({boundary,device,pageId,immediateEditedAt,killed,saveIndicator,savedPage,pageBefore,restoredPage,offlineQueue,queueBefore,restoredQueue,beforePull,stagedPull,afterRecovery},null,2),contentType:'application/json'});
      // Rebuild from every actually committed SQLite update; restoration must
      // match all of that state, including delete sets, not merely a text prefix.
      const committed=new Y.Doc();committed.getXmlFragment('body');
      try {
        for(const row of afterRecovery.pageUpdates.filter(row=>row.page_id===pageId)) {
          const bytes=Uint8Array.from(row.update_bytes);
          expect(Array.from(createHash('sha256').update(bytes).digest())).toEqual(row.digest);
          Y.applyUpdate(committed,bytes);
        }
        expect(restoredPage.clocks).toEqual(Array.from(Y.decodeStateVector(Y.encodeStateVector(committed))).sort(([a],[b])=>a-b));
        expect(restoredPage.fragment).toEqual(committed.getXmlFragment('body').toJSON());
      } finally {committed.destroy();}
      if(boundary==='edit-immediate') {
        // The approved A contract keeps all last-saved state. Only the final
        // uncommitted appended input may be absent, with no structural loss.
        const expected=JSON.parse(JSON.stringify(savedPage.json)) as {content:Array<{type:string;content:Array<{type:string;text:string}>}>};
        const actual=restoredPage.json as typeof expected;
        const last=expected.content.at(-1)!;const text=actual.content.at(-1)!.content[0]!.text;
        expect(`${last.content[0]!.text} immediate`.startsWith(text)).toBe(true);
        expect(text.startsWith(last.content[0]!.text)).toBe(true);
        last.content[0]!.text=text;expect(actual).toEqual(expected);
        for(const [client,clock] of savedPage.clocks) expect(restoredPage.clocks.find(([id])=>id===client)?.[1]).toBeGreaterThanOrEqual(clock);
        if(saveIndicator==='端末に保存済み') {
          expect(restoredPage.clocks).toEqual(pageBefore.clocks);expect(restoredPage.json).toEqual(pageBefore.json);expect(restoredPage.fragment).toEqual(pageBefore.fragment);
        } else expect(saveIndicator).toBe('端末へ保存中…');
      } else {
        expect(restoredPage.clocks).toEqual(pageBefore.clocks);expect(restoredPage.json).toEqual(pageBefore.json);expect(restoredPage.fragment).toEqual(pageBefore.fragment);
      }
      expect(restoredQueue).toEqual(queueBefore);expect(restoredQueue.clientId).toBe(offlineQueue.clientId);
      if(beforePull) for(const key of ['state','receipts','entities','conflicts'] as const) expect(afterRecovery[key]).toEqual(beforePull[key]);
      await peer.goto(`/?page=${pageId}`);await expect(body(peer)).toBeVisible();
      const peerDevice=await peer.evaluate(()=>localStorage.getItem('greiva-test-device'));
      expect(peerDevice).toBeTruthy();
      desktop.connect();await page.getByRole('button',{name:'再接続',exact:true}).click();
      if(boundary==='pull-before-cursor') {
        const conflict=panel(page).getByRole('article',{name:'名前の競合'});
        await expect(conflict).toContainText('witness contender');
        await conflict.getByRole('button',{name:'他の端末の値を採用',exact:true}).click();
      }
      await expect(panel(page).getByLabel('TaskとRelationの同期状態')).toHaveText('サーバーと同期済み',{timeout:15_000});
      await equalPeers(page,peer,request,device,peerDevice!);
      const local=await structured(request,device); const remote=await structured(request,peerDevice!);
      expect(local.operations.filter(operation=>operation.status==='pending')).toEqual([]);
      for(const operation of offlineQueue.operations) expect(local.operations.find(value=>value.operationId===operation.operationId)?.status).toBe('acknowledged');
      const entityList=await (await request.get('http://127.0.0.1:3000/tasks')).json() as StructuredSnapshot['tasks'];
      expect(entityList.find(task=>task.id===taskId)).toEqual(local.tasks.find(task=>task.id===taskId));
      await info.attach(`combined-${boundary}`,{body:JSON.stringify({boundary,device,pageId,killed,saveIndicator,pageBefore,restoredPage,offlineQueue,queueBefore,restoredQueue,beforePull,stagedPull,afterRecovery,pushed,serverResult,local,remote},null,2),contentType:'application/json'});
    } finally {
      releasePush();await control(request,device,'clear-barrier');
      await current?.close();await peerContext.close();rmSync(directory,{recursive:true,force:true});
    }
  });
}
