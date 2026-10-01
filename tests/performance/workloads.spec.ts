import {test,expect,type Page,type APIRequestContext,type TestInfo} from '@playwright/test';
import {newId} from '@greiva/shared';
import {emptyPageUpdate} from '@greiva/sync';
import {structuredSnapshotSchema,type PushOperation} from '@greiva/protocol';
import pg from 'pg';
import * as Y from 'yjs';
type Snapshot={clientId:string;pageId:string;clocks:number[][];json:{type:string;content:Array<{type:string;content?:Array<{type:string;text?:string}>}>};fragment:string;pending:number};
const body=(page:Page)=>page.getByRole('textbox',{name:'Page本文'});
async function snapshot(page:Page):Promise<Snapshot>{return page.evaluate(()=> (window as unknown as {greivaTest:{snapshot:()=>Snapshot}}).greivaTest.snapshot());}
async function rpc(request:APIRequestContext,device:string,command:string,fields:object={}) {
  const response=await request.post('http://127.0.0.1:1420/__greiva_test_store',{data:{device,command,...fields}});
  expect(response.ok()).toBe(true);const value=await response.json() as {value:unknown;error?:string};expect(value.error).toBeUndefined();return value.value;
}
async function kill(request:APIRequestContext,device:string){
  const response=await request.post('http://127.0.0.1:1420/__greiva_test_store_control',{data:{device,command:'kill'}});
  expect(response.ok()).toBe(true);const result=(await response.json()).value as {signal:string;pid:number};expect(result.signal).toBe('SIGKILL');return result;
}
async function offline(page:Page,device:string){
  await page.addInitScript(id=> {localStorage.setItem('greiva-test-device',id);sessionStorage.setItem('greiva-connection-paused','1');},device);
}
async function ready(page:Page){await page.waitForFunction(()=>{
  const editor=document.querySelector('[aria-label="Page本文"]');return editor?.getAttribute('contenteditable')==='true' && Boolean((window as unknown as {greivaTest?:unknown}).greivaTest);
});}
async function attach(info:TestInfo,name:string,value:unknown){await info.attach(name,{body:JSON.stringify({capturedAt:new Date().toISOString(),...value as object},null,2),contentType:'application/json'});}
function percentiles(values:number[]){const sorted=[...values].sort((a,b)=>a-b);const at=(p:number)=>sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]??null;return {count:values.length,min:sorted[0]??null,p50:at(.5),p95:at(.95),p99:at(.99),max:sorted.at(-1)??null};}

test('STEP8-STARTUP-WEB: empty SQLite navigation to an editable production-bundle UI',async({browser},info)=>{
  const samples=[];
  for(let index=0;index<3;index++){
    const context=await browser.newContext();const page=await context.newPage();const device=newId();await offline(page,device);
    try{
      const started=performance.now();await page.goto(`/?page=${newId()}`,{waitUntil:'commit'});await ready(page);
      const editableMs=performance.now()-started;await expect(page.getByLabel('端末の保存状態')).toHaveText('端末に保存済み');
      samples.push({device,editableMs,browserNavigation:await page.evaluate(()=>performance.getEntriesByType('navigation')[0]?.toJSON()),snapshot:await snapshot(page)});
    }finally{await context.close();}
  }
  await attach(info,'startup-production-web',{samples,editableMs:percentiles(samples.map(v=>v.editableMs)),referenceMs:3000,
    scope:'Empty real SQLite; fresh browser contexts, already-running browser/preview/services. Not Windows executable launch time or a native release startup Pass.'});
});

test('STEP8-PAGE-1000: restore every journal update and measure actual key input and durable-save wait',async({browser,request},info)=>{
  const device=newId();const pageId=newId();const doc=new Y.Doc();Y.applyUpdate(doc,emptyPageUpdate());
  const fragment=doc.getXmlFragment('body');fragment.delete(0,fragment.length);
  await rpc(request,device,'load',{pageId});
  await rpc(request,device,'append',{pageId,update:Array.from(Y.encodeStateAsUpdate(doc))});
  const updates:Uint8Array[]=[];doc.on('update',update=>updates.push(update));
  const rows=Array.from({length:1000},(_,index)=>`Block ${String(index).padStart(4,'0')} — saved content ${index}`);
  const seedStarted=performance.now();
  for(const text of rows){const paragraph=new Y.XmlElement('paragraph');const leaf=new Y.XmlText();leaf.insert(0,text);paragraph.insert(0,[leaf]);fragment.push([paragraph]);await rpc(request,device,'append',{pageId,update:Array.from(updates.at(-1)!)});}
  const seedMs=performance.now()-seedStarted;const expectedFragment=fragment.toJSON();const expectedClocks=Array.from(Y.decodeStateVector(Y.encodeStateVector(doc))).sort(([a],[b])=>a-b);
  const restoreSamples=[];let context=await browser.newContext();let page=await context.newPage();
  try{
    for(let index=0;index<3;index++){
      if(index>0){await context.close();context=await browser.newContext();page=await context.newPage();}
      await offline(page,device);const killed=await kill(request,device);const started=performance.now();
      await page.goto(`/?page=${pageId}`,{waitUntil:'commit'});await ready(page);const editableMs=performance.now()-started;
      const restored=await snapshot(page);expect(restored.fragment).toBe(expectedFragment);expect(restored.clocks).toEqual(expectedClocks);
      expect(restored.json.content).toHaveLength(1000);expect(restored.json.content.map(row=>row.content?.map(leaf=>leaf.text??'').join(''))).toEqual(rows);
      restoreSamples.push({editableMs,killed,snapshot:restored});
    }
    // Harness-only observation: no synthetic editor transaction or composition.
    await page.evaluate(()=>{
      type Input={at:number;keydownAt:number;data:string|null;nextFrameMs?:number;keydownToFrameMs?:number};type Write={startedAt:number;finishedAt:number;bytes:number;update:number[]};
      const inputs:Input[]=[];const frames:number[]=[];const longTasks:number[]=[];const writes:Write[]=[];let stopped=false;let last:number|null=null;let keydownAt=performance.now();
      const initialHandles=Array.from(document.querySelectorAll('.block-handle-anchor'));
      const target=window as unknown as {greivaPerf:unknown};const nativeFetch=window.fetch.bind(window);
      window.fetch=async(...args:Parameters<typeof fetch>)=>{
        const fields=typeof args[1]?.body==='string' ? JSON.parse(args[1].body) as {command?:string;update?:number[]}:null;
        const start=performance.now();const response=await nativeFetch(...args);
        if(fields?.command==='append')writes.push({startedAt:start,finishedAt:performance.now(),bytes:fields.update?.length??0,update:fields.update??[]});return response;
      };
      const keydown=()=>{keydownAt=performance.now();};document.addEventListener('keydown',keydown,true);
      const input=(event:Event)=>{const entry:Input={at:performance.now(),keydownAt,data:(event as InputEvent).data};inputs.push(entry);requestAnimationFrame(()=>{entry.nextFrameMs=performance.now()-entry.at;entry.keydownToFrameMs=performance.now()-entry.keydownAt;});};
      document.querySelector('[aria-label="Page本文"]')!.addEventListener('input',input);
      const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())longTasks.push(entry.duration);});observer.observe({type:'longtask'});
      const tick=(now:number)=>{if(stopped)return;if(last!==null)frames.push(now-last);last=now;requestAnimationFrame(tick);};requestAnimationFrame(tick);
      target.greivaPerf={stop(){stopped=true;observer.disconnect();window.fetch=nativeFetch;document.removeEventListener('keydown',keydown,true);document.querySelector('[aria-label="Page本文"]')!.removeEventListener('input',input);const currentHandles=Array.from(document.querySelectorAll('.block-handle-anchor'));return {inputs,frames,longTasks,writes,handleCount:currentHandles.length,retainedHandles:currentHandles.filter((node,index)=>node===initialHandles[index]).length,capturedAt:performance.now()};}};
    });
    await body(page).locator(':scope > p').nth(499).click();await page.keyboard.press('End');
    const text='abcdefghijklmnopqrstuvwxyz'.repeat(4);const typingStarted=performance.now();await page.keyboard.type(text,{delay:5});const typedMs=performance.now()-typingStarted;
    const finishedTyping=performance.now();await expect(page.getByLabel('端末の保存状態')).toHaveText('端末に保存済み');const savedAfterTypingMs=performance.now()-finishedTyping;
    await page.evaluate(()=>new Promise<void>(done=>requestAnimationFrame(()=>done())));
    const metrics=await page.evaluate(()=> (window as unknown as {greivaPerf:{stop:()=>{inputs:Array<{at:number;keydownAt:number;data:string|null;nextFrameMs?:number;keydownToFrameMs?:number}>;frames:number[];longTasks:number[];writes:Array<{startedAt:number;finishedAt:number;bytes:number;update:number[]}>;handleCount:number;retainedHandles:number;capturedAt:number}}}).greivaPerf.stop());
    const edited=await snapshot(page);const editedRows=[...rows];editedRows[499]+=text;
    expect(edited.json.content.map(row=>row.content?.map(leaf=>leaf.text??'').join(''))).toEqual(editedRows);expect(metrics.inputs).toHaveLength(text.length);
    expect(metrics.handleCount).toBe(1000);expect(metrics.retainedHandles).toBe(1000);
    const stored=await rpc(request,device,'load',{pageId}) as {updates:number[][]};const disk=new Y.Doc();for(const bytes of stored.updates)Y.applyUpdate(disk,Uint8Array.from(bytes));
    expect(disk.getXmlFragment('body').toJSON()).toBe(edited.fragment);expect(Array.from(Y.decodeStateVector(Y.encodeStateVector(disk))).sort(([a],[b])=>a-b)).toEqual(edited.clocks);disk.destroy();
    const seedClients=new Set(expectedClocks.map(([client])=>client));const inputCommitMs:number[]=[];let committedInputs=0;
    for(const write of metrics.writes){
      const characters=Y.decodeUpdate(Uint8Array.from(write.update)).structs.filter(struct=>!seedClients.has(struct.id.client)).reduce((sum,struct)=>sum+struct.length,0);
      for(let index=0;index<characters;index++){const entry=metrics.inputs[committedInputs++];expect(entry).toBeDefined();inputCommitMs.push(write.finishedAt-entry!.keydownAt);}
    }
    expect(committedInputs).toBe(text.length);expect(inputCommitMs.every(value=>value>=0)).toBe(true);
    await attach(info,'page-1000-production',{dataset:{blocks:1000,initialJournalUpdates:1001,seedMs,typedCharacters:text.length,keyDelayMs:5},restoreSamples,
      restoreMs:percentiles(restoreSamples.map(v=>v.editableMs)),restoreReferenceMs:2000,typedMs,savedAfterTypingMs,
      nextFrameOpportunityMs:percentiles(metrics.inputs.flatMap(v=>v.nextFrameMs===undefined ? []:[v.nextFrameMs])),keydownToFrameMs:percentiles(metrics.inputs.flatMap(v=>v.keydownToFrameMs===undefined ? []:[v.keydownToFrameMs])),
      keydownToInputMs:percentiles(metrics.inputs.map(v=>v.at-v.keydownAt)),inputToCommitAckMs:percentiles(inputCommitMs),frameIntervalsMs:percentiles(metrics.frames),
      appendRoundTripMs:percentiles(metrics.writes.map(v=>v.finishedAt-v.startedAt)),metrics,edited,
      scope:'Actual Chromium keyboard events on 1000 blocks; release Rust SQLite commit ACK via test bridge. rAF measures the next frame opportunity, not a native IME result.'});
  }finally{doc.destroy();await context.close();}
});

test('STEP8-YJS-100: fifty actual key edits per offline client converge completely after reconnect',async({browser},info)=>{
  const ca=await browser.newContext();const cb=await browser.newContext();const a=await ca.newPage();const b=await cb.newPage();const pageId=newId();
  try{
    await Promise.all([a.goto(`/?page=${pageId}`),b.goto(`/?page=${pageId}`)]);
    for(const page of [a,b]){await ready(page);await expect(page.getByLabel('同期状態',{exact:true})).toHaveText('サーバーと同期済み');await page.getByRole('button',{name:'接続を一時停止',exact:true}).click();}
    for(const [page,text] of [[a,'A'.repeat(50)],[b,'B'.repeat(50)]] as const){await body(page).click();await page.keyboard.type(text);await expect(page.getByLabel('端末の保存状態')).toHaveText('端末に保存済み');}
    const before=await Promise.all([snapshot(a),snapshot(b)]);const started=performance.now();
    await Promise.all([a.getByRole('button',{name:'再接続',exact:true}).click(),b.getByRole('button',{name:'再接続',exact:true}).click()]);
    await expect.poll(async()=>{const [left,right]=await Promise.all([snapshot(a),snapshot(b)]);return left.pending===0 && right.pending===0 && JSON.stringify(left.clocks)===JSON.stringify(right.clocks) && JSON.stringify(left.json)===JSON.stringify(right.json) && left.fragment===right.fragment;},{timeout:30_000,intervals:[50,100,200]}).toBe(true);
    const convergenceMs=performance.now()-started;const after=await Promise.all([snapshot(a),snapshot(b)]);expect(convergenceMs).toBeLessThanOrEqual(30_000);
    const text=after[0]!.json.content.flatMap(row=>row.content??[]).map(leaf=>leaf.text??'').join('');expect([...text].filter(c=>c==='A')).toHaveLength(50);expect([...text].filter(c=>c==='B')).toHaveLength(50);
    await attach(info,'yjs-100-reconnect',{dataset:{clients:2,keyEditsPerClient:50},before,after,convergenceMs,limitMs:30_000});
  }finally{await ca.close();await cb.close();}
});

test('STEP8-STRUCTURED-1000: durable Task chains restore offline and the actual UI engine converges without duplicates',async({browser,request},info)=>{
  const context=await browser.newContext();const page=await context.newPage();const device=newId();await offline(page,device);
  const peerContext=await browser.newContext();const peer=await peerContext.newPage();
  const database=new pg.Client({connectionString:process.env.DATABASE_URL});await database.connect();
  try{
    await page.goto(`/?page=${newId()}`);await ready(page);
    const clientId=(await rpc(request,device,'structured-snapshot') as {clientId:string}).clientId;
    const operations:PushOperation[]=[];const tasks=[];const created=performance.now();
    for(let index=0;index<250;index++){
      const id=newId();tasks.push({id,title:`edited task ${index}`,status:'done',due:'2028-02-29',version:4});
      for(const [kind,payload,baseVersion] of [['create',{title:`task ${index}`,status:'todo',due:null},null],['update',{status:'in_progress'},0],['update',{title:`edited task ${index}`,due:'2028-02-29'},0],['update',{status:'done'},0]] as const){
        const operation:PushOperation={operationId:newId(),clientId,entityId:id,entityType:'task',kind,payload,baseVersion};operations.push(operation);await rpc(request,device,'structured-mutate',{operation});
      }
    }
    const queueCreationMs=performance.now()-created;const before=structuredSnapshotSchema.parse(await rpc(request,device,'structured-snapshot'));
    expect(before.operations).toHaveLength(1000);expect(before.operations.every(op=>op.status==='pending')).toBe(true);expect(before.tasks).toHaveLength(250);
    const killed=await kill(request,device);const restoring=performance.now();await page.reload();await ready(page);
    const restored=structuredSnapshotSchema.parse(await rpc(request,device,'structured-snapshot'));expect(restored).toEqual(before);const offlineRestoreMs=performance.now()-restoring;
    const started=performance.now();await page.getByRole('button',{name:'再接続',exact:true}).click();
    await expect(page.getByLabel('TaskとRelationの同期状態')).toHaveText('サーバーと同期済み',{timeout:240_000});const convergenceMs=performance.now()-started;
    const local=structuredSnapshotSchema.parse(await rpc(request,device,'structured-snapshot'));expect(local.operations).toHaveLength(1000);expect(local.operations.every(op=>op.status==='acknowledged')).toBe(true);
    expect(local.errors).toEqual([]);expect(local.conflicts).toEqual([]);expect(local.tasks.map(({id,title,status,due,version})=>({id,title,status,due,version})).sort((a,b)=>a.id.localeCompare(b.id))).toEqual(tasks.sort((a,b)=>a.id.localeCompare(b.id)));
    await peer.goto(`/?page=${newId()}`);await ready(peer);await expect(peer.getByLabel('TaskとRelationの同期状態')).toHaveText('サーバーと同期済み',{timeout:60_000});
    const peerDevice=await peer.evaluate(()=>localStorage.getItem('greiva-test-device'));const remote=structuredSnapshotSchema.parse(await rpc(request,peerDevice!,'structured-snapshot'));expect(remote.tasks).toEqual(local.tasks);
    const response=await request.get('http://127.0.0.1:3000/tasks?includeDeleted=true');expect(response.ok()).toBe(true);expect(await response.json()).toEqual(local.tasks);
    const schema=process.env.GREIVA_DB_SCHEMA!;expect(schema).toMatch(/^greiva_test_[a-z0-9]+$/);
    const ledger=await database.query(`SELECT count(*)::int AS operations,count(DISTINCT operation_id)::int AS distinct_operations,max(server_order)::int AS head FROM "${schema}".server_operations`);
    expect(ledger.rows[0]).toEqual({operations:1000,distinct_operations:1000,head:1000});expect(local.state.cursor).toBe(local.state.headCursor);expect(remote.state.cursor).toBe(local.state.cursor);
    // Repeated reconnect must not add operations or change the final entities.
    await page.getByRole('button',{name:'接続を一時停止',exact:true}).click();await page.getByRole('button',{name:'再接続',exact:true}).click();await expect(page.getByLabel('TaskとRelationの同期状態')).toHaveText('サーバーと同期済み');
    const after=structuredSnapshotSchema.parse(await rpc(request,device,'structured-snapshot'));expect(after.tasks).toEqual(local.tasks);expect((await database.query(`SELECT count(*)::int AS operations FROM "${schema}".server_operations`)).rows[0]?.operations).toBe(1000);
    await attach(info,'structured-1000-ui-engine',{dataset:{tasks:250,operationsPerTask:4,operations:1000},queueCreationMs,offlineRestoreMs,convergenceMs,killed,ledger:ledger.rows[0],before,restored,local,remote,
      scope:'Actual React TaskPanel sync engine, real HTTP/PostgreSQL and release Rust SQLite; no batch push shortcut. 240s harness bound is not a product SLO.'});
  }finally{await database.end();await context.close();await peerContext.close();}
});
