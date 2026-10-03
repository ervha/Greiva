import {test,expect,type Page,type TestInfo} from '@playwright/test';

const body=(page:Page)=>page.getByRole('textbox',{name:'Page本文',exact:true});
const sync=(page:Page)=>page.getByLabel('同期状態',{exact:true});
type Snapshot={pageId:string;clientId:string;clocks:number[][];json:unknown;fragment:string;pending:number;selection:{from:number;to:number;offset:number}};
const snapshot=(page:Page)=>page.evaluate(()=> (window as unknown as {greivaTest:{snapshot:()=>Snapshot}}).greivaTest.snapshot());
async function home(page:Page){
  await page.keyboard.press('Home');
  await expect.poll(async()=> (await snapshot(page)).selection.offset).toBe(0);
}
async function selection(page:Page,selector:string){
  return page.evaluate(selector=>{
    const root=document.querySelector('[aria-label="Page本文"]')!.querySelector(selector)!,s=document.getSelection();
    if(!s?.anchorNode||!s.focusNode||!root.contains(s.anchorNode)||!root.contains(s.focusNode))return null;
    const offset=(node:Node,at:number)=>{const r=document.createRange();r.setStart(root,0);r.setEnd(node,at);return r.toString().length;};
    return {text:s.toString(),anchor:offset(s.anchorNode,s.anchorOffset),focus:offset(s.focusNode,s.focusOffset)};
  },selector);
}
async function converge(a:Page,b:Page,info:TestInfo,label:string){
  await expect.poll(async()=>{
    const [left,right]=await Promise.all([snapshot(a),snapshot(b)]);
    return left.pending===0&&right.pending===0&&JSON.stringify(left.clocks)===JSON.stringify(right.clocks)&&
      JSON.stringify(left.json)===JSON.stringify(right.json)&&left.fragment===right.fragment;
  },{timeout:15_000}).toBe(true);
  const clients=await Promise.all([snapshot(a),snapshot(b)]);
  expect(clients[0].clientId).not.toBe(clients[1].clientId);
  await info.attach(label,{body:JSON.stringify({at:new Date().toISOString(),clients},null,2),contentType:'application/json'});
}
const layouts=[
  {id:'paragraph',query:null,label:null,selector:':scope > p'},
  {id:'heading',query:'h2',label:'見出し2',selector:':scope > h2'},
  {id:'todo',query:'todo',label:'Todo',selector:'li[data-checked] p'},
  {id:'toggle',query:'toggle',label:'Toggle',selector:'summary'},
] as const;
for(const layout of layouts)for(const direction of ['forward','backward'] as const){
  test(`STEP8-FOCUS-${layout.id}-${direction}: peer updates during blur retain selection and local Undo excludes remote edits`,async({page:a,browser},info)=>{
    test.setTimeout(45_000);
    const peerContext=await browser.newContext(),b=await peerContext.newPage();
    try{
      const pageId=crypto.randomUUID();await Promise.all([a.goto(`/?page=${pageId}`),b.goto(`/?page=${pageId}`)]);
      for(const page of [a,b])await expect(sync(page)).toHaveText('サーバーと同期済み',{timeout:15_000});
      await body(a).click();
      if(layout.query){await a.keyboard.type(`/${layout.query}`);await a.getByRole('option',{name:layout.label!,exact:true}).click();}
      // A literal fixture tests selection mechanics, never native Japanese IME.
      await a.keyboard.insertText('MS65 local 日本語');await converge(a,b,info,'seed');
      await a.waitForTimeout(550); // Separate setup from the Yjs history capture group.
      await body(a).locator(layout.selector).click();await home(a);
      for(let i=0;i<(direction==='forward'?11:14);i++)await a.keyboard.press('ArrowRight');
      for(let i=0;i<3;i++)await a.keyboard.press(direction==='forward'?'Shift+ArrowRight':'Shift+ArrowLeft');
      await expect.poll(async()=> (await selection(a,layout.selector))?.text).toBe('日本語');
      const before=await selection(a,layout.selector);expect(before).not.toBeNull();
      await info.attach('before-blur',{body:JSON.stringify({dom:before,pm:await snapshot(a)},null,2),contentType:'application/json'});
      expect(before!.anchor<before!.focus).toBe(direction==='forward');
      await a.getByRole('textbox',{name:'Pageタイトル',exact:true}).focus();
      await expect(a.getByRole('textbox',{name:'Pageタイトル',exact:true})).toBeFocused();
      await b.bringToFront();await body(b).locator(layout.selector).click();await home(b);
      for(let i=1;i<=3;i++){await b.keyboard.type(`R${i} `);await home(b);await expect(body(a).locator(layout.selector)).toHaveText(`${Array.from({length:i},(_,j)=>`R${i-j} `).join('')}MS65 local 日本語`);}
      // Delete only the peer's newest prefix; the original selection must also
      // follow remote deletion without capturing that deletion in local history.
      for(let i=0;i<3;i++)await b.keyboard.press('Shift+ArrowRight');
      await expect.poll(async()=>{const s=(await snapshot(b)).selection;return {size:s.to-s.from,offset:s.offset};}).toEqual({size:3,offset:0});
      await b.keyboard.press('Backspace');
      await expect(body(a).locator(layout.selector)).toHaveText('R2 R1 MS65 local 日本語');
      await converge(a,b,info,'remote-insert-and-delete');
      await info.attach('after-remote-before-focus',{body:JSON.stringify({dom:await selection(a,layout.selector),pm:await snapshot(a)},null,2),contentType:'application/json'});
      await a.bringToFront();await body(a).focus();await expect(body(a)).toBeFocused();
      await info.attach('after-focus',{body:JSON.stringify({dom:await selection(a,layout.selector),pm:await snapshot(a)},null,2),contentType:'application/json'});
      await expect.poll(async()=> await selection(a,layout.selector)).toEqual({text:'日本語',anchor:before!.anchor+6,focus:before!.focus+6});
      const restored=await selection(a,layout.selector);
      expect(restored!.anchor-before!.anchor).toBe(6);expect(restored!.focus-before!.focus).toBe(6);
      expect(restored!.anchor<restored!.focus).toBe(direction==='forward');
      const pm=(await snapshot(a)).selection;expect(pm.to-pm.from).toBe(3);
      await info.attach('selection-after-focus-and-remote',{body:JSON.stringify({before,restored,pm},null,2),contentType:'application/json'});
      await a.keyboard.insertText('EDIT');await converge(a,b,info,'replacement');
      await expect(body(a).locator(layout.selector)).toHaveText('R2 R1 MS65 local EDIT');
      await a.keyboard.press('ControlOrMeta+z');await converge(a,b,info,'local-undo');
      await expect(body(a).locator(layout.selector)).toHaveText('R2 R1 MS65 local 日本語');
      await a.keyboard.press('ControlOrMeta+Shift+z');await converge(a,b,info,'local-redo');
      await expect(body(b).locator(layout.selector)).toHaveText('R2 R1 MS65 local EDIT');
    }finally{await peerContext.close();}
  });
}

test('STEP8-RECONNECT-CYCLES: repeated offline edits converge once and restore to an independent client',async({page:a,browser},info)=>{
  test.setTimeout(60_000);const peerContext=await browser.newContext(),b=await peerContext.newPage();
  try{
    const pageId=crypto.randomUUID();await Promise.all([a.goto(`/?page=${pageId}`),b.goto(`/?page=${pageId}`)]);
    for(const page of [a,b])await expect(sync(page)).toHaveText('サーバーと同期済み',{timeout:15_000});
    await body(a).click();await a.keyboard.type('seed');await converge(a,b,info,'seed');
    for(let cycle=1;cycle<=4;cycle++){
      for(const page of [a,b]){await page.getByRole('button',{name:'接続を一時停止',exact:true}).click();await expect(sync(page)).toHaveText('オフライン');}
      for(const [page,marker] of [[a,`A${cycle}`],[b,`B${cycle}`]] as const){
        await page.bringToFront();await body(page).locator(':scope > p').click();await page.keyboard.press('End');await page.keyboard.type(` ${marker}`);
        await expect(sync(page)).toHaveText('オフライン');await expect(page.getByLabel('端末の保存状態',{exact:true})).toHaveText('端末に保存済み');
      }
      for(const page of cycle%2?[b,a]:[a,b])await page.getByRole('button',{name:'再接続',exact:true}).click();
      await converge(a,b,info,`reconnect-${cycle}`);
      for(const page of [a,b]){
        await expect(sync(page)).toHaveText('サーバーと同期済み');
        const text=await body(page).locator(':scope > p').innerText();
        for(let n=1;n<=cycle;n++)for(const prefix of ['A','B'])expect(text.split(`${prefix}${n}`).length-1).toBe(1);
      }
    }
    const freshContext=await browser.newContext();try{
      const fresh=await freshContext.newPage();await fresh.goto(`/?page=${pageId}`);await expect(sync(fresh)).toHaveText('サーバーと同期済み');
      await converge(a,fresh,info,'independent-restore');
    }finally{await freshContext.close();}
  }finally{await peerContext.close();}
});
