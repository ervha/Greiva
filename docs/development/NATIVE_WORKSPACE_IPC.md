# Native workspace保存先のIPC境界

v0.28.0：workspace_execute whitelistへ strict `page_list(after, limit)` を追加。[端末Page一覧](LOCAL_PAGE_CATALOG.md)はmetadata/pendingだけを返し、queue/本文を変更しない。

v0.27.0：`workspace_device(owner, candidate)` を追加し、アカウント別のstable clientIdを解決する。[契約/制限](PRIVATE_DEVICE_IDENTITY.md)、[証拠](../../tests/evidence/private-device-20261008/SUMMARY.md)。既存active handleを失効させず、署名native Authの代わりにはしない。

v0.24.0。Tauri command登録とRust registry/client adapterを追加。通常PoC UI/旧DBは保持し、新login/workspace画面へまだmountしない。実Auth/native token custody/実Windows invokeの完了証拠ではない。

| Command | 入力 | 内容 |
| --- | --- | --- |
| workspace_device | strict issuer/subjectId、UUIDv7 candidate | fixed devices.sqliteへ保存済みIDを照合/初回登録。owner/clientIdだけ返す |
| workspace_open | WorkspaceContext | app-owned root内のbound DBを開き、handle/contextのみ返す |
| workspace_close | handle | 旧処理commit完了を待ってhandleを閉じる。DB/queueは保持 |
| workspace_execute | handle、strict command request | 固定されたstructured/Page whitelistだけを同storeへ適用 |

rootはnative app config/private-workspaces、ファイル名はcanonical context JSONのSHA-256。frontendにroot/path/SQLを渡す入口はない。WorkspaceStoreのimmutable issuer/subject/workspace/client/epoch binding、private SQLite schema6を維持する。registryは一度に一workspaceをactiveにし、openは既存handleを失効させる。世代handleは秘密token/権限証明ではない。

NativeWorkspaceStore.open(connection)は検証済み登録とAuth generationを固定し、遅着open/commit・refresh/closeで新storeへredirectしない。Page create/append/load/prepareとPageSessionStore、WorkspaceSessionStoreを同handleへ接続する。invoke responseはunknownとして検査し、requestはawait前に分離する。Webのdefault native invokeはconfigurationで拒否し、test-only port doubleを製品Web保存へ転用しない。

local registry/handleはrepository bindingで、native側の署名session認証/credential custody/offline grantを代替しない。通常UIを接続する前にtrusted composition、Native Auth、logout/失効時のデータ保持/閲覧方針を確定する。tokenはcontext/DB/logへ入れず、caller contextだけで認証済みと表示しない。

開始済み旧commitはclose/openより先に完了し得る。registry gateをcommitまで保持して保存先を固定し、clientはclose後の成功を拒否する。cleanup失敗はstorage categoryでportを閉じたままにし、pendingを破棄しない。

実Docker native library/JSON-lines driverとsigned fixture HTTP、Browser2、型/Windows command compileを検証する。実Tauri invoke/起動/IME、実ユーザーAuth/Android、Hocuspocus provider/metadata Conflict/Web durable storeは別gate。専用API/previewはv0.21/schema3を継続。

[全16判断](../decisions/native-workspace-ipc.md)、[証拠](../../tests/evidence/workspace-ipc-20261005/SUMMARY.md)、[Page session](PRIVATE_PAGE_SESSION.md)、[必要事項](../plan/PENDING_PRODUCTION_CONFIGURATION.md)。
