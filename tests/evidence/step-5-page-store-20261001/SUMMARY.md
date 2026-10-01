# Step 5 verification

2026-10-01T03:33:06.676Z / linux x64 / Git: unavailable in execution environment; source fingerprint recorded

Source SHA-256: 4e19ab72b56cf11f2d2cb861aba081791fbdc7d0091289a8e2035fcaddb961d4

| Test | Result | Evidence |
| --- | --- | --- |
| STEP5-STORE-DRIVER | Pass | [log](STEP5-STORE-DRIVER.log) |
| STEP5-BUILD | Pass | [log](STEP5-BUILD.log) |
| STEP5-TYPES | Pass | [log](STEP5-TYPES.log) |
| STEP5-UNIT-INTEGRATION | Pass | [log](STEP5-UNIT-INTEGRATION.log) |
| STEP5-E2E | Pass | [log](STEP5-E2E.log) |
| STEP5-SQLITE-INIT | Pass | [log](STEP5-SQLITE-INIT.log) |
| STEP5-POSTGRES | Pass | [log](STEP5-POSTGRES.log) |
| STEP5-DESKTOP-CHECK | Pass | [log](STEP5-DESKTOP-CHECK.log) |

Scope: Section 18 Step 5: actual Rust SQLite repository used by Tauri; Page metadata and Yjs durability, offline creation, renderer/store SIGKILL and offline restoration, reconnect convergence and fail-closed errors. Browser uses a test-only transport to Rust; Windows native IPC and actual IME require separate evidence. No Gate verdict.

See [summary.json](summary.json) for environment, commands, timestamps, versions and result details.

## Checkpointとの照合・実機

[checkout-source-match.json](checkout-source-match.json)で103ファイルのbyte単位のsource fingerprint一致を確認した。現在のcheckpointは0.3.0。containerは`.git`を持たないため、Git commitは実行環境から取得していない。Windows実行物はDocker内のcargo-xwinでbuildし、[cross build log](windows-cross-build.log)と[実際のnative SQLite保存・復元・peer一致](../step-5-native-recovery-20261001/SUMMARY.md)を分けて記録する。実行物のhashはnative証拠を参照する。

最終E2Eは41件Pass、retry/skipなし。通常unit/integrationは25件Pass、PostgreSQL 1件skipで、[専用PostgreSQL試験](postgres/vitest.json)が1件Pass。追加の[crash repeat](crash-repeat.log)も3件Pass。これは全部のGateやAndroid/Microsoft IMEのPassではない。

[前回run](previous-attempt/summary.json)と[失敗したcrash復元](previous-attempt/playwright.json)は失敗のまま保持する。Chromium強制終了でtest transport用のlocalStorage device identityが失われたため、再起動後に別DBを読んだ。実際のTauriは固定app-config pathであり、このbrowser fixtureを同一のtest device IDに固定した。PostgreSQLの前回失敗はcontainerへ接続先environmentを渡していなかったためで、最終runではCompose network上の接続先を明示した。
