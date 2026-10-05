# Workspaceのnative耐久保存とSupabase接続準備

2026-10-05、v0.14.0。新規workspace専用Rust/sqlx storeとDocker JSON-lines portを実装。通常Tauri UI/IPCへは未接続。

追加12条件は実Rust/SQLiteを使用し、account/workspace/device/epoch不一致、旧/未知DB拒否、causal offline intent、prepared byte列の再起動保持、ACK不正/再送、pull不正/SQL失敗のrollback、閉じたsessionの遅着応答を確認した。prepared/ACK/pullそれぞれcommit前後の6境界で実プロセスをSIGKILLし、再open後が未commitまたは全commitの状態で、再試行が重複しないことを検証した。cursor-write失敗時もentity/receipt/cursorは一部commitされない。

通常132件Pass/実PG用26件skip、専用PG26件Pass、画面59件/実structured同期2件Pass、型/通常Windows buildがPass。PG/画面/実同期は旧経路の回帰試験で、新workspaceのHTTP/UI同期証拠ではない。通常Windows buildのsource88と外部npm315/Cargo不変を確認。crash hooksは通常buildで無効。

提供済みSupabase公開設定でDockerから実HTTPSのJWKSとAuth settingsを取得し、両方HTTP 200、ES256公開鍵とEmail有効を確認した。公開設定確認だけで実ユーザーのログイン/refresh/失効/端末間同期は未検証。key/password/tokenは証拠へ含めず、project固有Publishable keyはignoredローカル設定に保持する。

[集約](verification.json)、[通常](vitest.json.gz)、[実PG](postgres-vitest.json.gz)、[画面](playwright.json.gz)、[実同期](structured-playwright.json.gz)、[Supabase公開設定](supabase-public-check.json)、[source88](source-inventory.json)、[Windows build](windows-build.json)、[外部依存監査](version-audit.json)。生成exeはignored領域のみ。初回のdriver lock/type import/build権限/browser path失敗は修正後に最終検証を完了し、集約へ区別して記録する。

未完成：通常UI/IPC、新workspace structured HTTP/Page CRDT、実Authと安全なcredential保管、旧DB移行、Windows実IME/Android nativeの新確認。改善データ収集は未実装/未開始。[全14判断](../../../docs/decisions/workspace-durable-store.md)、[Supabase設定手順](../../../docs/development/SUPABASE_SETUP.md)。
