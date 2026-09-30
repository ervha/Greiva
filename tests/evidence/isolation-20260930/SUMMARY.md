# 隔離環境への切替: 2026-09-30

担当: Codex。Git commitなし。ユーザー指定: Dockerで開発・自動試験、Windows VMでTauri/IME。

| 確認 | 期待 | 実結果 | 証拠 |
| --- | --- | --- | --- |
| Compose構成検査 | 定義が有効 | Pass: exit 0 | [構成検査ログ](compose-config.log) |
| Docker engine | desktop-linuxへ接続できる | Fail: pipeが存在せず接続不能 | [engineログ](docker-engine.log) |
| image build/起動 | 固定版toolchainで起動できる | Not run: engine未起動 | [日時・exit code](environment.json) |
| container自動試験 | build/typecheck/unit/E2E/PostgreSQL/Cargoが成功 | Not run | Docker起動後に実施 |
| Windows VM/IME | guest内でP0の実操作が成功 | Not run | VM未接続 |

構成ファイル: [Dockerfile](../../../infrastructure/development/Dockerfile)、[Compose](../../../infrastructure/development/compose.yaml)。実行と生成物の境界: [隔離手順](../../../docs/development/isolated-environment.md)。GateのPass/Failはこの環境確認から判定しない。

切替前の診断結果: [Vitest JSON](host-before-switch-vitest.json) / [JUnit](host-before-switch-vitest.xml)、[Playwright JSON](host-before-switch-playwright.json) / [JUnit](host-before-switch-playwright.xml)。unit/integrationは19件成功・1件skip。E2Eは4件成功・19件失敗（Viteサーバー停止）。これらはホスト実行の旧結果で、修正後ソースの合格証拠ではない。ソース全体のfingerprintとnative buildの保存ログが揃っていないため正式なGate証拠として使わない。
