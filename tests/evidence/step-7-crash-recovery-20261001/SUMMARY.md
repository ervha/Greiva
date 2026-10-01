# Step 7 保存待ち改善・統合crash recovery（v0.6.2）

2026-10-01T08:19:46.582Z / linux x64 / Git: unavailable in execution environment; source fingerprint recorded

Source SHA-256: 7fce6015a4352284e8bf37c5e85898bc01f80f8de7109dec579273e7ab112930

| Test | Result | Evidence |
| --- | --- | --- |
| STEP7-RECOVERY-STORE-DRIVER | Pass | [log](STEP7-RECOVERY-STORE-DRIVER.log) |
| STEP7-RECOVERY-BUILD | Pass | [log](STEP7-RECOVERY-BUILD.log) |
| STEP7-RECOVERY-TYPES | Pass | [log](STEP7-RECOVERY-TYPES.log) |
| STEP7-RECOVERY-UNIT-INTEGRATION | Pass | [log](STEP7-RECOVERY-UNIT-INTEGRATION.log) |
| STEP7-RECOVERY-E2E | Pass | [log](STEP7-RECOVERY-E2E.log) |
| STEP7-RECOVERY-SQLITE-INIT | Pass | [log](STEP7-RECOVERY-SQLITE-INIT.log) |
| STEP7-RECOVERY-POSTGRES | Pass | [log](STEP7-RECOVERY-POSTGRES.log) |
| STEP7-RECOVERY-STRUCTURED-E2E | Pass | [log](STEP7-RECOVERY-STRUCTURED-E2E.log) |
| STEP7-RECOVERY-COMBINED-CRASH | Pass | [log](STEP7-RECOVERY-COMBINED-CRASH.log) |
| STEP7-RECOVERY-DESKTOP-CHECK | Pass | [log](STEP7-RECOVERY-DESKTOP-CHECK.log) |
| STEP7-RECOVERY-DEFAULT-FEATURES | Pass | [log](STEP7-RECOVERY-DEFAULT-FEATURES.log) |

Scope: Section 18 Step 7 recovery checkpoint: actual standalone API process SIGKILL before/after commit, plus combined Chromium and Rust SQLite Page/block/Task/Relation SIGKILL at immediate edit, local commit, committed push without ACK and staged pull before cursor. Approved 2026-10-01 A contract: all committed/saved input survives; optimistic input still saving may be absent. Tests compare every committed SQLite update, full Yjs state and saved structure/intent, and require complete pre-kill equality if saved was displayed. Page pending updates coalesce without debounce or metadata reordering. Fresh PostgreSQL schemas isolate each run. Windows native IPC/IME, performance and final Gates require separate evidence. No Gate verdict.

See [summary.json](summary.json) for environment, commands, timestamps, versions and result details.

## 最終結果と契約

全11項目がPass。通常unit/integrationは44件Pass・PostgreSQL専用20件skip、専用runは実PostgreSQLで20件Pass・skipなし。Editor43件、structured UI2件、統合crash4件はすべてPass、skip/flakyなし。Linux locked Cargo checkと通常Tauriのfeature graphを確認し、試験専用停止featureは通常ビルドに含まれない。[ソースと件数の監査](checkout-source-match.json)、[featureログ](STEP7-RECOVERY-DEFAULT-FEATURES.log)。

ユーザーは保存中だったことの説明後、「『保存完了』でなく保存中であったならAでいいと思います。」と回答した。保存済みの全変更を保証し、保存中の未commit入力を区別する契約へPoC／製品設計を揃えた。最初の保存を意図的に遅らせず、待機Yjs updateだけをmergeし、タイトル変更の順序・保存失敗時の停止・送信前のcommitを維持する。

## 実際の終了境界

実standalone APIをPostgreSQL確定前と確定後・ACK受信前にSIGKILLし、実Rust storeも再起動する2試験が専用PostgreSQL runに含まれる。再送後のoperation一件性・cursor・client／peer／server Task一致を確認する。[ログ](STEP7-RECOVERY-POSTGRES.log)、[JSON](postgres/vitest.json)。

統合4試験はChromiumとRust driverを実際にSIGKILLする。Page／block追加・削除・移動、Task作成／更新、Page→Task Relationとpendingをoffline復元し、再接続後にpeerへ収束させる。編集直後は試験専用ビルドでPage appendのSQLite確定直前を停止し、停止markerと終了driverのPID一致を確認する。表示は「端末へ保存中…」、直前の本文`keep immediate`に対し復元は最後に保存済みの`keep`。保存済み全文・block構造、3件のTask／Relation pendingを保持し、read-onlyで取得した全commit済みupdateのchecksumと再構築Yjs状態に完全一致する。他3境界は保存済みと表示し、終了前の全文・clockに完全一致する。pullはreceipt／entity／Conflictを書いた後・cursor確定前に停止し、確定済み状態の原子性と再取得を検証する。[復元監査](restoration-audit.json)、[全snapshotとSQLite updateを含むraw JSON](combined-crash/playwright.json)。

## 出所とプレビュー

検証ソース126ファイルのSHA-256は`7fce6015a4352284e8bf37c5e85898bc01f80f8de7109dec579273e7ab112930`。親コミットは`cf715d1281113ae9eee098bc578bd9d1ea9f97fe`。実行時は未commitの0.6.2候補で、containerに.gitがなく、checkoutでinventoryと全bytesの一致を別監査した。A承認後のPOC_SPEC.md SHA-256は`0d9cf458a8d7a48ba6376688bd56eb0fcc6aa2c8c3e1904bdb976c256a90e36d`。

Docker image `sha256:ea31de938cb6adddf75b730bbb180a4bbef9bb53f669e4fb2d93903229fd21c6`へ反映し、同じ126ファイルのhash・app所有manifest0.6.2・client/API/collaboration HTTP 200を確認した。[反映証拠](deployment.json)、[image buildログ](image-build.log)。nodeユーザー、init、nonprivileged、no-new-privileges、loopback公開、collaboration用named volumeのみでhostソースやDocker socketのbindなし。

## 履歴と未検証範囲

[初回の無条件復元Fail](../step-7-crash-boundary-20261001/SUMMARY.md)、[説明と判断](../../../docs/failures/step-7-integrated-crash.md)を履歴として維持する。保存待ち改善後の[初回full run](previous-attempt/first-full-run/SUMMARY.md)も11項目Passだったが、編集直後に保存が完了していた。最新runでは試験専用停止により保存中の境界を確実に検証した。初期の型／standalone Cargo lockの検証失敗ログもprevious-attemptに保持する。

Dockerのbrowser／Rust橋はWindows Tauri IPC／WebView／Microsoft IMEの代替ではない。既存Windows候補は0.6.0のままで、0.6.2 Windows実行物は未作成。Step 8の性能・P1/P2、P0 native残項目・Microsoft IME補強、Step 9の最終Gate A/B/Cと技術選定結論は未完了。
