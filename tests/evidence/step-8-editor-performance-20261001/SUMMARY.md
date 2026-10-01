# Step 8 verification

2026-10-01T09:55:17.442Z / linux x64 / Git: unavailable in execution environment; source fingerprint recorded

Source SHA-256: 668dbab5744083b681f91a83cf4fe954bcfeaa0c280ebf47deddcc85639d0be3

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

## 検証した更新

v0.6.4、2026-10-01、担当Codex。[実装判断](../../../docs/decisions/step-8-editor-performance.md)。各入力で作り直していたドラッグハンドルをwidget keyで保持し、dragstart時には現在のposition／本文を読む。保存層・同期順序・IME composition・Undoの契約は変更していない。

12項目Pass、exit=0。通常unit/integration45件Pass、PostgreSQL専用20件はskipし別runで実PostgreSQL20件Pass。Editor44・structured UI2・統合crash4・性能4ケースはすべてPass、skip/flakyなし。通常Tauriの停止feature無効検査も成功。新しい実操作E2EはDOM保持、前の本文編集によるoffset変更後のdrag payload、実pointer移動とUndo/Redoを確認した。

[全source照合](checkout-source-match.json): 130ファイル、SHA-256 `668dbab5744083b681f91a83cf4fe954bcfeaa0c280ebf47deddcc85639d0be3`。checkoutとinventory／全byteが一致。parent `ce5d37273bdd04ca1def8b5a8e849650906ebccb`、branch `codex/poc-editor`。外部npm／Cargo依存はparentから変更なし、所有manifest／lockのみ0.6.4。POC_SPEC.mdの承認A契約も変更なし（SHA-256 `0d9cf458a8d7a48ba6376688bd56eb0fcc6aa2c8c3e1904bdb976c256a90e36d`）。

## 1,000 blockの実入力

[raw測定report](performance/playwright.json)、[測定値要約](performance-metrics.json)、[環境とstageログ](performance/environment.json)。前の[0.6.3測定](../step-8-performance-20261001/SUMMARY.md)と同じ2 CPU／4GiBのDocker helperでproduction frontend／locked release Rustを使う。HTTP試験bridgeとdiagnosticsを含むため、native IPCの値へ読み替えない。

| 指標 | 0.6.3最終run | 0.6.4最終run |
| --- | --- | --- |
| 1,000 block復元、3 sampleのmedian／max | 1,165.44／2,472.85ms | 387.74／417.46ms |
| 104文字、keydown→DOM input p95／max | 153.7／365.0ms | 29.1／70.8ms |
| keydown→次のframe機会 p95／max | 162.9／373.4ms | 48.0／106.3ms |
| keydown→commit ACK p95／max | 961.7／1,319.4ms | 106.7／176.2ms |
| frame間隔 p95／max | 133.4／433.4ms | 50.0／133.4ms |

1,000個のhandle DOMは入力後も全数保持され、全104文字・構造・Yjs clocksと全commit journalの復元が一致。入力全体2,686.01ms、最後のキーから保存済み確認まで42.83ms。75 appendのACK往復median20.0ms・p95 70.8ms。入力ごとの保存ACKはYjs差分をdecodeして104文字へ対応させ、最後の待ち時間だけで代表させない。

空SQLiteのWeb補助起動は3 sampleのmedian827.76ms・max847.00ms。Yjs 100実キー編集は921.23msで全内容・clockとpending=0へ収束。250 Task×4操作のqueue作成8,728.38ms、offline復元133.71ms、実React engine同期55,241.98ms、台帳unique/head=1,000、全Task一致・再接続で増殖なし。Taskの所要時間変化をEditor修正の効果と断定しない。

## 原因候補・比較・退行検出

[変更前CPU profile](diagnostics/before-cpu/input.cpuprofile)、[元sourceへの対応](diagnostics/before-cpu/cpu-summary.json)、[scope](diagnostics/before-cpu/profile-scope.json)、[raw測定archive](diagnostics/before-cpu/playwright.json.gz)、[archive hash](diagnostics/before-cpu/raw-report-hash.json)。v0.6.3のsampling期間は約9.9秒。widget作成にinclusive約621ms、placeWidget約1,106ms、singleRect約2,034msが見えた。inclusiveは重複し、native program・layout・待ち全体の分解ではない。source map付きbuildの生成コードが測定bundleと一致することを検査した。

[追加比較](handle-comparison.json)では同じ0.6.4の試験・release Rust・production設定でハンドルsourceだけを切り替え、各一回を測定した。保持0→1,000、keydown→commit ACK p95 294.4→126.3ms、keydown→frame p95 67.3→38.5ms、104文字の入力全体5,365.45→2,844.67ms。baselineでも全本文／構造／clockと保存差分の一致を要求し、DOM保持のassertionだけは両runで観測へ変更した。raw reportは[変更前](diagnostics/paired-before/playwright.json.gz)・[修正版](diagnostics/paired-fixed/playwright.json.gz)へbyte照合して保存。診断集計のleaf suiteエラーは試験完了後の出力処理の問題で、既存baselineのPassとschema削除を検証して読み直し、修正版の測定を続けた。

host負荷、実行順序とOS／browser cacheは未固定で、追加比較中には別containerのcache snapshot作成も実施した。短縮率や性能目安全達成を保証しない。正規sourceを一時切替した診断はfinallyで復元し、[全130ファイルのbyte復元](diagnostic-source-restore.json)とcheckoutの一致を再確認した。

[元の実装probe](previous-attempt/before/probe.json)はDOM保持でFail、[stale position probe](previous-attempt/stale-position/probe.json)は期待「third edited」に対しpayload「second」でFail。[元のartifact](previous-attempt/before/artifacts.tar.gz)・[stale position artifact](previous-attempt/stale-position/artifacts.tar.gz)を保持。退行を検出できる期待Failとして扱い、アプリ／Gateのnative IME Failへ流用しない。

## Windows候補と残る範囲

[通常frontend／Windows cross-build](windows-build/build.json)、[Windows側のartifact照合](windows-build/host-artifact.json)、[build log](windows-build/NATIVE-CROSS-BUILD.log)。0.6.4 debug native shell＋embedded production frontendをDockerのSDK/cacheでlocked/offlineビルド。試験frontend flags=0、storeのcrash-test-hooksなし。exe SHA-256 `8e4d965d85bbbd75493713bc6de290c44d207d04ee9c1bd2701b32b929d07363`、18,557,952 bytes、実ProductVersion=0.6.4をWindowsで照合。MSVC PDB不足のlinker warningをログへ保持する。旧builderは停止してcacheをlocal imageへ保持し、initあり／node／非privileged／no-new-privilegesの新builderを使った。ホストtoolchain追加なし。

最新候補のnative全操作・Microsoft IME、Windows release起動／性能、P1 macOS・P2実iOS／Androidと最終Gate A/B/Cは未完了。旧0.6.0の[限定smoke](../step-8-native-smoke-20261001/SUMMARY.md)を0.6.4の成功へ流用しない。

[プレビュー反映](deployment.json)、[実行条件](deployment-runtime.json)、[通常image build](image-build.log)。0.6.4の実行中source130ファイルが最終検証のfingerprintと一致し、1420／3000／1234の3サービスhealth=200を確認。image `sha256:c06bb08669a73088e5c058910a0ce7288954bd7d9efb27248b5e78c4ebbcc5b3`、node／init／非privileged／no-new-privileges、collaboration専用volume、公開portはloopbackのみ。native buildはcompiler family detectionとMSVC PDBのwarningを保持し、成功したbuildをwarning無しと扱わない。
