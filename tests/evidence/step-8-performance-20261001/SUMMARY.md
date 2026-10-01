# Step 8 verification

2026-10-01T09:17:13.349Z / linux x64 / Git: unavailable in execution environment; source fingerprint recorded

Source SHA-256: 2c3a843cc412d5ca0b4e203bb33d525aaf6410f4beb610c3010c703fd6a90723

| Test | Result | Evidence |
| --- | --- | --- |
| STEP8-STORE-DRIVER | Pass | [log](STEP8-STORE-DRIVER.log) |
| STEP8-BUILD | Pass | [log](STEP8-BUILD.log) |
| STEP8-TYPES | Pass | [log](STEP8-TYPES.log) |
| STEP8-UNIT-INTEGRATION | Pass | [log](STEP8-UNIT-INTEGRATION.log) |
| STEP8-E2E | Pass | [log](STEP8-E2E.log) |
| STEP8-SQLITE-INIT | Pass | [log](STEP8-SQLITE-INIT.log) |
| STEP8-POSTGRES | Pass | [log](STEP8-POSTGRES.log) |
| STEP8-STRUCTURED-E2E | Pass | [log](STEP8-STRUCTURED-E2E.log) |
| STEP8-COMBINED-CRASH | Pass | [log](STEP8-COMBINED-CRASH.log) |
| STEP8-DESKTOP-CHECK | Pass | [log](STEP8-DESKTOP-CHECK.log) |
| STEP8-DEFAULT-FEATURES | Pass | [log](STEP8-DEFAULT-FEATURES.log) |
| STEP8-PERFORMANCE | Pass | [log](STEP8-PERFORMANCE.log) |

Scope: Section 18 Step 8: Step 7 regression plus production frontend/release Rust performance workloads: empty SQLite navigation, 1000-block journal restore and actual keyboard/frame/commit observations, 100 offline Yjs key edits and reconnect convergence, 1000 durable Task operations through the actual React sync engine. Browser uses read-only diagnostics and a test-only bridge. Timing observations are not a native Windows release startup or Microsoft IME Pass. P1/P2 actual OS checks and final Gates require separate evidence. No Gate verdict.

See [summary.json](summary.json) for environment, commands, timestamps, versions and result details.

## 検証結果と範囲

最終run `2026-10-01T09-17-13.288Z` は12項目Pass、exit=0。通常unit/integrationは45件Pass、PostgreSQL専用20件はskipし、別runで実PostgreSQL20件を全実行してPass。Editor43、structured UI2、統合crash4、性能4ケースはすべてPass、skip/flakyなし。通常Tauriのdefault featureでは試験専用crash停止を無効とする検査も成功した。

[ソース照合](checkout-source-match.json): 130ファイル、上記SHA-256とcheckoutの全byte／inventoryが一致。parentは`256b71be0600b915a1e6113151af317de3a214ef`、branchは`codex/poc-editor`、app-owned manifest／lockは0.6.3。両Cargo lockの外部packageとnpm lockの外部entryはparentと同じ。POC_SPEC.md SHA-256は`0d9cf458a8d7a48ba6376688bd56eb0fcc6aa2c8c3e1904bdb976c256a90e36d`。

[Docker条件](docker-runtime.json): nodeユーザー、initあり、2 CPU／4GiB、非privileged、no-new-privileges、証拠先だけbind mount。既存imageに照合済みsourceをcopyして実行したため、source fingerprintが今回の検証対象を示す。性能試験はproduction frontendとlocked release Rustを使用し、試験専用HTTP bridgeと読み取りdiagnosticsを含む。[性能環境／stageログ](performance/environment.json)、[raw測定report](performance/playwright.json)、[要約数値](performance-metrics.json)、[再現方法](../../../docs/decisions/step-8-performance.md)。ホスト負荷は固定していない。

## 時間の観測と未達

| 対象 | 最終runの観測 | 評価 |
| --- | --- | --- |
| 空SQLiteのWeb navigation→編集可能、3 sample | min 1,029.56／median 1,061.55／max 1,114.32ms | Web補助値。Windows exe起動の判定ではない |
| 1,000 block／1,001 journal updateの復元、3 sample | min 899.28／median 1,165.44／max 2,472.85ms | 一回が2秒目安超過。全本文／構造／clock一致 |
| 104文字のkeydown→DOM input | median 66.0／p95 153.7／max 365.0ms | 入力処理の待ちを観測。native IMEは未測定 |
| keydown→次のframe機会 | median 74.9／p95 162.9／max 373.4ms | rAFによる機会で、paint完了の証明ではない |
| keydown→実Rust commit ACK | median 499.0／p95 961.7／max 1,319.4ms | 全104文字を実Yjs差分へ対応。HTTP bridge往復も含む |
| 入力中のframe間隔 | median 33.4／p95 133.4／max 433.4ms | 操作感の改善課題を保持 |
| Yjs A/B各50回編集・offline保存→再接続収束 | 1,286.08ms | 30秒内。100文字、全本文／構造／clockとpending=0を確認 |
| Task 250件×4操作のqueue作成／offline復元 | 14,917.48／385.49ms | 全1,000操作を実SQLite保存、SIGKILL後に保持 |
| 実React engineのTask 1,000操作同期 | 106,527.07ms | 全ACK、errors/conflicts=0、全Task一致、台帳unique/head=1,000、再接続で増殖なし |

104文字の入力全体は10,862.94ms、最後のキーから保存済み確認まで138.88msだった。最後の待ちだけで各文字の保存待ちを代表させない。20回のappend ACK往復はmedian 193.0ms、p95 317.8ms、max 377.0ms。240秒のTask試験timeoutは観察上限で製品SLOではない。

全12項目Passは正確性・回帰と観測処理の成功であり、性能目安全達成の判定ではない。入力処理・toolbar可否・decoration・保存通知render・commit待ち・structured snapshotは次のprofile候補で、原因を特定した扱いにしない。未commit入力を保存済みとすることや、予測文字の先行確定で保存契約を変更しない。

## 初回Failと再現証拠

[最初の全回帰](previous-attempt/full-regression-fail/SUMMARY.md)ではEditor26件Pass／17件Fail。driver SIGKILLとstdin writeの競合でEPIPEがunhandled errorとなり、試験Viteが停止した。Cargo lockの外部2crateを誤って0.6.3へ置換したためlocked検査もFail。両方を修正し、上記最終runで再検証した。[失敗artifact archive](previous-attempt/full-regression-fail/artifacts.tar.gz)にcontext／traceを保持する。

[修正前probe](previous-attempt/step8-bridge-before-fix/vitest.json)はerror listenerのみをDocker内で一時除去し、同じbackpressure試験でEPIPE・exit=1を再現。assertion成功でもunhandled errorがあるrunはFailとした。finallyで元のsource bytesを戻して照合した。[修正後の専用試験](previous-attempt/step8-bridge-targeted/vitest.json)と最終回帰の4回SIGKILL／復帰はPass。[判断と修正](../../../docs/failures/step-8-test-harness.md)。

初回性能の[raw JSON archive](previous-attempt/step8-performance-first/playwright.json.gz)と[hash照合](previous-attempt/step8-performance-first/raw-report-hash.json)、補強後の[raw JSON archive](previous-attempt/step8-performance-measured/playwright.json.gz)と[hash照合](previous-attempt/step8-performance-measured/raw-report-hash.json)は保持した。初回rAFの負値は観測処理の初回sampleを修正し、旧数値を最終値へ書き換えない。rawログ・JSON・JUnitの失敗はそのまま残す。

## 実機・Gateの残り

[Windows 0.6.0の限定smoke](../step-8-native-smoke-20261001/SUMMARY.md)は別証拠で、新規Page・literal入力・保存／同期とTask一件の確定を確認した。接続するpreviewは0.6.2で、今回のcontainerと別。最新native候補／Microsoft IME／全native操作／Windows release起動・性能は未検証。P1のmacOS、P2の実iOS／AndroidもNot run。Gate A/B/Cと技術選定結論は未判定。
