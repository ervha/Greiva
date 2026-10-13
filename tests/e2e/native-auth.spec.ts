import {test,expect,type Page} from '@playwright/test';
const context={issuer:'https://project.fixture.invalid/auth/v1',subjectId:'owner-fixture',workspaceId:'01900000-0000-7000-8000-000000000001',clientId:'01900000-0000-7000-8000-000000000002',streamEpoch:'01900000-0000-7000-8000-000000000003'};
const id='01900000-0000-7000-8000-000000000004';
const pageEntry={metadata:{id,title:'端末の検証Page',yDocId:`page:${id}`,createdAt:'2026-10-13T00:00:00.000Z',updatedAt:'2026-10-13T00:00:00.000Z'},pending:2};
async function fixture(page:Page,restore=false){
 const calls:{command:string;args?:Record<string,unknown>}[]=[];let persistent=true,foreign=false;
 await page.route('**/native-fixture/invoke',async route=>{
  const call=route.request().postDataJSON();calls.push(call);const command=call.command;
  if(command==='native_auth_restore' && !restore){await route.fulfill({status:503,json:{private:'not visible'}});return;}
  const result=command==='native_auth_status'?{available:true,phase:'locked',expiresAt:null}:command==='native_auth_login'||command==='native_auth_restore'?{available:true,phase:'verified',expiresAt:Math.floor(Date.now()/1000)+300}:command==='native_workspace_open'?{handle:'native-handle',context}:command==='native_workspace_execute'?{context:foreign?{...context,subjectId:'other-owner'}:context,pages:[pageEntry],nextAfter:null}:command==='native_auth_logout'?{localLocked:true,persistentLocked:persistent,cleanupPending:persistent?false:null,providerConfirmed:false}:null;
  await route.fulfill({json:result});
 });return{calls,unknownLogout(){persistent=false;},foreign(){foreign=true;}};
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
