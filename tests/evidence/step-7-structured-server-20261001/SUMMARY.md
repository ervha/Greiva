# Step 7 verification

2026-10-01T05:15:38.739Z / linux x64 / Git: unavailable in execution environment; source fingerprint recorded

Source SHA-256: ec2bd806e4a9ed7b6184da6ec17d9dc6f8ea313a040e033364e912ef8ab120b6

| Test | Result | Evidence |
| --- | --- | --- |
| STEP7-SERVER-STORE-DRIVER | Pass | [log](STEP7-SERVER-STORE-DRIVER.log) |
| STEP7-SERVER-BUILD | Pass | [log](STEP7-SERVER-BUILD.log) |
| STEP7-SERVER-TYPES | Pass | [log](STEP7-SERVER-TYPES.log) |
| STEP7-SERVER-UNIT-INTEGRATION | Pass | [log](STEP7-SERVER-UNIT-INTEGRATION.log) |
| STEP7-SERVER-E2E | Pass | [log](STEP7-SERVER-E2E.log) |
| STEP7-SERVER-SQLITE-INIT | Pass | [log](STEP7-SERVER-SQLITE-INIT.log) |
| STEP7-SERVER-POSTGRES | Pass | [log](STEP7-SERVER-POSTGRES.log) |
| STEP7-SERVER-DESKTOP-CHECK | Pass | [log](STEP7-SERVER-DESKTOP-CHECK.log) |

Scope: Section 18 Step 7 server checkpoint only: durable immutable operation ledger, transactional server ordering, cursor pagination, Task/Relation field merge, preserved conflicts and explicit resolution, tombstone priority, migration and database rollback. Local ACK/pull/cursor integration, conflict UI, transport interruption and native checks remain pending. No Gate verdict.

See [summary.json](summary.json) for environment, commands, timestamps, versions and result details.

## 結果と証拠の範囲

- build・strict型・実Rust store driver・SQLite初期化・Linux locked Cargo checkを含む8項目がPass。
- 通常unit/integrationは29件Pass、PostgreSQL対象12件は通常runでskipし、別の実DB runで全12件Pass（skip/failureなし）。
- Chromium回帰E2Eは全43件Pass、skip/flakyなし。端末structured syncの新規E2Eではない。
- [checkoutの113ファイル照合](checkout-source-match.json)は上記source hashと一致。PoC仕様のSHA-256も不変。runtime package/Tauri/Cargoは0.5.0。既存Windows実行物は0.4.0のまま。
- [初回の実DB assertion失敗](previous-attempt/SUMMARY.md)を保持し、修正後の最終結果と区別する。[実装判断](../../../docs/decisions/step-7-structured-server.md)、[修正記録](../../../docs/failures/step-7-structured-server.md)。

今回の追加試験はサーバーのimmutable ACK・field merge・Conflict解決・tombstone・連続offline intent・cursor順序・移行・transaction rollbackを対象とする。端末ACK/pullのSQLite適用とcursor前進、競合UI、transport中断/遅延/再接続と統合crash recoveryは未実装。Microsoft IME・新規native操作・最終Gateは未検証で、このDocker成功から推定しない。
