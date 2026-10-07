# アカウント別の端末IDと再ログイン

v0.27.0。ログインごとに新しいclientIdを生成すると、WorkspaceContextにclientIdを含むnative保存先が変わり、保存済みPageや未送信更新を開き直せない。検証済みissuer＋subjectごとの端末IDをnative側へ保存し、同じアカウントの再ログインで再利用する。

## 保存とIPC

`workspace_device(owner, candidate)` はapp-owned `private-workspaces/devices.sqlite` を使用する。入力はstrictなissuer/subjectIdとUUIDv7候補だけ、応答はissuer/subjectId/clientIdだけ。メール・プロフィール・password・Auth token・本文をこのDBへ保存しない。frontendからpathやSQLを受け取らない。

独立SQLite schema1の `workspace_devices` はissuer/subject_idを主キー、client_idをuniqueにする。更新/削除は禁止。WAL/FULL synchronous、BEGIN IMMEDIATEで初回作成を直列化し、同時要求も同じIDを返す。COMMIT前のkillはrollback、COMMIT後の応答喪失は次回同じIDを返す。workspace SQLite schema6と既存active handleは変更しない。

記録がないfresh rootでは候補IDを保存する。既に別の `.sqlite` があるrootでdevice DBだけがない場合、未知schemaや破損、候補の衝突では停止する。旧workspaceを走査して所有者を推測したり、新IDで空のworkspaceを代わりに表示したりしない。v0.26以前のprivate rootの自動取り込みは未実装。復旧には同じdevice metadataとworkspace DBの整合したbackupが必要で、復元UIやbackup暗号化はまだ実装していない。

## 認証と画面

`PrivateLoginController` はserverによるAuth検証後、authorized世代内で端末IDを解決してからconnectionを作る。待機中は「端末の登録情報を確認中」と表示し、workspace登録を許可しない。取消・期限切れ・遅着・不正応答・保存失敗では接続を作らず、安全なエラーを返す。保存失敗時にrandom IDへfallbackしない。

`auth.html` のnative compositionは実Tauri invokeを選ぶ。browser診断は従来のmemory-only検証IDで、localStorage等へ書かない。ログアウトでAuthを閉じてもdevice metadataとworkspace/pendingを消去しない。これは保管の挙動であり、offline閲覧権限や失効後閲覧を許可する契約ではない。

このIDは登録識別子で、物理端末の証明やnative Auth grantではない。native側へ渡すownerはtrusted compositionの検証済み値が前提。署名Auth/OS credential custody、offline grant、実Supabase正常系、実Tauri invoke、通常root画面のlogin/catalog/editor composition、native CSPは後続工程。暗号化の配備設定も別工程。

[全16判断](../decisions/private-device-identity.md)、[検証](../../tests/evidence/private-device-20261008/SUMMARY.md)、[IPC](NATIVE_WORKSPACE_IPC.md)、[個人情報/暗号化](../plan/ACCOUNT_PRIVACY_ENCRYPTION_SPEC.md)。
