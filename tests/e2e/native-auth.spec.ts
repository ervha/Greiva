import {test,expect,type Page} from '@playwright/test';
import * as Y from 'yjs';
import {emptyPageUpdate} from '@greiva/sync';
import {nativePreviewProfile} from '../../scripts/native-preview-profile.js';
import {privatePreviewProfile} from '../../scripts/private-preview-profile.js';
const context={issuer:'https://project.fixture.invalid/auth/v1',subjectId:'owner-fixture',workspaceId:'01900000-0000-7000-8000-000000000001',clientId:'01900000-0000-7000-8000-000000000002',streamEpoch:'01900000-0000-7000-8000-000000000003'};
const id='01900000-0000-7000-8000-000000000004';
const pageEntry={metadata:{id,title:'端末の検証Page',yDocId:`page:${id}`,createdAt:'2026-10-13T00:00:00.000Z',updatedAt:'2026-10-13T00:00:00.000Z'},pending:2};
async function fixture(page:Page,restore=false){
 const calls:{command:string;args?:Record<string,unknown>}[]=[];let persistent=true,foreign=false,verified=false,unknown=false;
 const journal=new Map<string,{metadata:typeof pageEntry.metadata;updates:number[][]}>();journal.set(id,{metadata:{...pageEntry.metadata},updates:[Array.from(emptyPageUpdate()),[0,0]]});
 await page.route('**/native-fixture/invoke',async route=>{
  const call=route.request().postDataJSON();calls.push(call);const command=call.command;
  if(command==='native_auth_restore' && !restore){await route.fulfill({status:503,json:{private:'not visible'}});return;}
  if(command==='native_auth_login'||command==='native_auth_restore')verified=true;if(command==='native_auth_logout')verified=false;
  if(command==='native_workspace_execute'){
   if(!verified){await route.fulfill({status:503,json:{error:'closed'}});return;}
   const request=call.args.request;
   if(request.command==='page_create'){journal.set(request.pageId,{metadata:{...pageEntry.metadata,id:request.pageId,yDocId:`page:${request.pageId}`,title:request.title},updates:[request.update]});await route.fulfill({json:null});return;}
   if(request.command==='page_append'){journal.get(request.pageId)!.updates.push(request.update);if(unknown){unknown=false;await route.fulfill({status:503,json:{private:'unknown'}});return;}await route.fulfill({json:null});return;}
   if(request.command==='page_load'){const entry=journal.get(request.pageId)!;await route.fulfill({json:{page:entry,pending:entry.updates.length,serverHead:null}});return;}
  }
  const result=command==='native_auth_status'?{available:true,phase:verified?'verified':'locked',expiresAt:verified?Math.floor(Date.now()/1000)+300:null}:command==='native_auth_login'||command==='native_auth_restore'?{available:true,phase:'verified',expiresAt:Math.floor(Date.now()/1000)+300}:command==='native_workspace_open'?{handle:'native-handle',context}:command==='native_workspace_execute'?{context:foreign?{...context,subjectId:'other-owner'}:context,pages:[...journal.values()].sort((a,b)=>a.metadata.id.localeCompare(b.metadata.id)).map(entry=>({metadata:entry.metadata,pending:entry.metadata.id===id?Math.max(2,entry.updates.length):entry.updates.length})),nextAfter:null}:command==='native_auth_logout'?{localLocked:true,persistentLocked:persistent,cleanupPending:persistent?false:null,providerConfirmed:false}:null;
  await route.fulfill({json:result});
 });return{calls,unknownLogout(){persistent=false;},foreign(){foreign=true;},unknownAppend(){unknown=true;},revoke(){verified=false;},body(pageId:string){const doc=new Y.Doc({gc:false});for(const update of journal.get(pageId)!.updates)Y.applyUpdate(doc,Uint8Array.from(update));const body=doc.getXmlFragment('body').toString();doc.destroy();return body;}};
}
const state=(page:Page)=>page.getByLabel('端末接続の状態',{exact:true});
async function login(page:Page){await page.getByLabel('メールアドレス',{exact:true}).fill('fixture@example.invalid');await page.getByLabel('パスワード',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'ログイン',exact:true}).click();}
test('NATIVE-AUTH-UI: restore once, retained local Page list, logout without claiming provider confirmation',async({page})=>{
 const f=await fixture(page,true);await page.goto('/native-auth.fixture.html');await expect(state(page)).toHaveText('認証を確認しました');expect(f.calls.filter(c=>c.command==='native_auth_restore')).toHaveLength(1);
 await page.getByRole('button',{name:'workspaceを開く',exact:true}).click();await expect(page.getByRole('region',{name:'端末Page一覧'})).toContainText('端末の検証Page');await expect(page.getByText('未送信 2件',{exact:true})).toBeVisible();
 expect(f.calls.find(c=>c.command==='native_workspace_open')?.args).toEqual({candidate:expect.any(String)});expect(f.calls.find(c=>c.command==='native_workspace_execute')?.args).toEqual({handle:'native-handle',request:{command:'page_list',after:null,limit:50}});
 await page.getByRole('button',{name:'ログアウト',exact:true}).click();await expect(state(page)).toHaveText('ログインしていません');await expect(page.getByRole('alert')).toContainText('サーバーへのログアウト結果は確認できていません');await expect(page.getByRole('region',{name:'端末Page一覧'})).toHaveCount(0);
});
test('NATIVE-AUTH-UI: failed restore does not loop; composition and keyboard login clear password',async({page})=>{
 const f=await fixture(page);await page.goto('/native-auth.fixture.html');await expect(state(page)).toHaveText('ログインしていません');await page.getByLabel('メールアドレス',{exact:true}).fill('fixture@example.invalid');const password=page.getByLabel('パスワード',{exact:true});await password.fill('fixture-password');
 await password.dispatchEvent('compositionstart',{data:'検証'});await password.press('Enter');await page.getByRole('button',{name:'アカウントを新規登録',exact:true}).click();expect(f.calls.filter(c=>c.command==='native_auth_login')).toHaveLength(0);await expect(page.getByRole('button',{name:'ログイン',exact:true})).toBeVisible();
 await password.dispatchEvent('compositionend',{data:'検証'});await password.press('Enter');await expect(state(page)).toHaveText('認証を確認しました');await expect(password).toHaveCount(0);expect(f.calls.filter(c=>c.command==='native_auth_login')).toHaveLength(1);expect(f.calls.filter(c=>c.command==='native_auth_restore')).toHaveLength(1);
});
test('NATIVE-AUTH-UI: unknown durable logout offers retry; foreign list never renders',async({page})=>{
 const f=await fixture(page);await page.goto('/native-auth.fixture.html');await expect(state(page)).toHaveText('ログインしていません');await login(page);await expect(state(page)).toHaveText('認証を確認しました');f.foreign();await page.getByRole('button',{name:'workspaceを開く',exact:true}).click();await expect(page.getByRole('alert')).toContainText('保存先を確認できません');await expect(page.getByText('端末の検証Page',{exact:true})).toHaveCount(0);
 f.unknownLogout();await page.getByRole('button',{name:'ログアウト',exact:true}).click();await expect(page.getByRole('button',{name:'ログアウトを再確認',exact:true})).toBeVisible();await expect(page.getByRole('alert')).toContainText('端末へのログアウト記録を確認できません');
});
test('NATIVE-AUTH-UI: browser production entry has no fake native login; mobile layout stays inside viewport',async({page},testInfo)=>{
 await page.goto('/native.html');await expect(page.getByRole('status')).toContainText('Windowsアプリから');await expect(page.getByRole('textbox',{name:'メールアドレス'})).toHaveCount(0);
 await fixture(page);await page.goto('/native-auth.fixture.html');await expect(state(page)).toHaveText('ログインしていません');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('native-auth.png'),fullPage:true});
});
test('NATIVE-AUTH-UI: signup request stays unverified and clears password before confirmation',async({page})=>{
 const f=await fixture(page);let signup=0;await page.route('https://project.fixture.invalid/auth/v1/signup',async route=>{signup++;await route.fulfill({json:{user:{email:'ignored@example.invalid'},access_token:'ignored'}});});
 await page.goto('/native-auth.fixture.html');await expect(state(page)).toHaveText('ログインしていません');await page.getByRole('button',{name:'アカウントを新規登録',exact:true}).click();await page.getByLabel('メールアドレス',{exact:true}).fill('fixture@example.invalid');await page.getByLabel('パスワード',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'確認メールを送って登録',exact:true}).click();
 await expect(state(page)).toHaveText('登録依頼を受け付けました');await expect(page.getByLabel('パスワード',{exact:true})).toHaveValue('');await expect(page.getByRole('button',{name:'workspaceを開く',exact:true})).toHaveCount(0);expect(signup).toBe(1);expect(f.calls.filter(c=>c.command==='native_auth_login')).toHaveLength(0);
});
async function openLocal(page:Page){await page.getByRole('button',{name:'workspaceを開く',exact:true}).click();await expect(state(page)).toHaveText('端末のworkspaceを開きました');}
test('NATIVE-PAGE-UI: native local create/keyboard autosave keeps focus and replays after screen reconnect',async({page},testInfo)=>{
 const f=await fixture(page,true);await page.goto('/native-auth.fixture.html');await expect(state(page)).toHaveText('認証を確認しました');await openLocal(page);await page.getByLabel('新しいPageのタイトル',{exact:true}).fill('新しい端末Page');await page.getByRole('button',{name:'Pageを作成',exact:true}).click();
 const editor=page.getByRole('textbox',{name:'Page本文',exact:true});await expect(editor).toBeVisible();await editor.click();await page.keyboard.type('native local saved text');await expect(page.getByLabel('本文の保存状態')).toContainText('端末に保存しました');await expect(editor).toBeFocused();
 const created=f.calls.find(c=>(c.args?.request as {command?:string}|undefined)?.command==='page_create')!.args!.request as {pageId:string};expect(f.body(created.pageId)).toContain('native local saved text');
 await page.getByRole('button',{name:'workspaceを閉じる',exact:true}).click();await expect(editor).toHaveCount(0);await openLocal(page);await page.getByRole('button',{name:'新しい端末Page',exact:true}).click();await expect(editor).toContainText('native local saved text');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:testInfo.outputPath('native-editor.png'),fullPage:true});
});
test('NATIVE-PAGE-UI: unknown save retains input and explicit same-scope recovery never duplicates committed text',async({page})=>{
 const f=await fixture(page,true);await page.goto('/native-auth.fixture.html');await expect(state(page)).toHaveText('認証を確認しました');await openLocal(page);await page.getByRole('button',{name:'端末の検証Page',exact:true}).click();const editor=page.getByRole('textbox',{name:'Page本文',exact:true});await expect(editor).toBeVisible();f.unknownAppend();await editor.fill('retained unknown text');await expect(page.getByLabel('本文の保存状態')).toContainText('保存未確認');await expect(editor).toContainText('retained unknown text');
 await page.getByRole('button',{name:'workspaceを閉じる',exact:true}).click();await openLocal(page);await page.getByRole('button',{name:'端末の検証Page',exact:true}).click();const count=f.calls.filter(c=>(c.args?.request as {command?:string}|undefined)?.command==='page_append').length;await page.getByRole('button',{name:'保持した入力を戻す',exact:true}).click();await expect(page.getByRole('button',{name:'保持した入力を戻す',exact:true})).toHaveCount(0);await expect(editor).toContainText('retained unknown text');expect(f.calls.filter(c=>(c.args?.request as {command?:string}|undefined)?.command==='page_append')).toHaveLength(count);expect(f.body(id).split('retained unknown text')).toHaveLength(2);
});
test('NATIVE-PAGE-UI: composition blocks navigation and auth controls while save status leaves editor focused',async({page})=>{
 await fixture(page,true);await page.goto('/native-auth.fixture.html');await expect(state(page)).toHaveText('認証を確認しました');await openLocal(page);await page.getByRole('button',{name:'端末の検証Page',exact:true}).click();const editor=page.getByRole('textbox',{name:'Page本文',exact:true});await editor.focus();await editor.dispatchEvent('compositionstart',{data:'検証'});
 await expect(page.getByRole('button',{name:'ログアウト',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'workspaceを閉じる',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'認証を更新',exact:true})).toBeDisabled();await expect(editor).toBeFocused();
 await editor.dispatchEvent('compositionend',{data:'検証'});await expect(page.getByRole('button',{name:'ログアウト',exact:true})).toBeEnabled();await editor.fill('composition ended normally');await expect(page.getByLabel('本文の保存状態')).toContainText('端末に保存しました');await expect(editor).toBeFocused();
});
test('NATIVE-PAGE-UI: revoked connection masks an active composition, retains its draft after commit and restores only on reconnect',async({page})=>{
 const f=await fixture(page,true);await page.goto('/native-auth.fixture.html');await expect(state(page)).toHaveText('認証を確認しました');await openLocal(page);await page.getByRole('button',{name:'端末の検証Page',exact:true}).click();const editor=page.getByRole('textbox',{name:'Page本文',exact:true});await editor.focus();await editor.dispatchEvent('compositionstart',{data:'保持'});f.revoke();
 await editor.evaluate(el=>{const p=el.querySelector('p')!;p.textContent='composition held after revoke';el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:'composition held after revoke'}));});
 await expect(page.locator('.native-editor-lock')).toBeVisible();await expect(editor).toBeFocused();await expect(page.getByLabel('メールアドレス',{exact:true})).toBeDisabled();await editor.dispatchEvent('compositionend',{data:'保持'});await expect(editor).toHaveCount(0);
 await login(page);await expect(state(page)).toHaveText('認証を確認しました');await openLocal(page);await page.getByRole('button',{name:'端末の検証Page',exact:true}).click();await page.getByRole('button',{name:'保持した入力を戻す',exact:true}).click();await expect(editor).toContainText('composition held after revoke');expect(f.body(id)).toContain('composition held after revoke');
});
test('NATIVE-AUTH-CSP: native profile allows signup but blocks browser token and refresh endpoints',async({page})=>{
 const profile=nativePreviewProfile(privatePreviewProfile({VITE_GREIVA_SUPABASE_URL:'https://project.fixture.invalid',VITE_GREIVA_SUPABASE_ALGORITHM:'ES256',VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',VITE_GREIVA_PRIVATE_API_ORIGIN:'http://127.0.0.1:1439'}));
 let signup=0,token=0;await page.route('**/native-csp-check.html',route=>route.fulfill({contentType:'text/html',headers:{'content-security-policy':profile.override.app.security.csp},body:'<!doctype html><html><body>CSP fixture</body></html>'}));
 await page.route('https://project.fixture.invalid/auth/v1/**',async route=>{if(new URL(route.request().url()).pathname.endsWith('/signup'))signup++;else token++;await route.fulfill({headers:{'access-control-allow-origin':'*'},json:{accepted:true}});});
 await page.goto('/native-csp-check.html');const result=await page.evaluate(async()=>{const call=async(path:string)=>{try{await fetch('https://project.fixture.invalid/auth/v1/'+path,{method:'POST',body:'{}'});return true;}catch{return false;}};return{signup:await call('signup'),password:await call('token?grant_type=password'),refresh:await call('token?grant_type=refresh_token')};});
 expect(result).toEqual({signup:true,password:false,refresh:false});expect(signup).toBe(1);expect(token).toBe(0);
});
