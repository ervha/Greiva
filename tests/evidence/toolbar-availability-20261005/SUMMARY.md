# 移動ボタンの可否判定の負荷削減

2026-10-05 JST、baseline `697b3c30b59e838cfa65e9ca73ae809cbaa23ff9`（製品0.6.20）、新製品v0.6.24。[変更・判断全件](../../../docs/decisions/step-8-toolbar-availability.md)。UTC raw timestampが2026-10-04T15時台なのはJST翌日。担当Codex、利用者操作なし。

## 自動検証

[source hashと検証結果](verification.json)、[型](TYPECHECK.log)、[unit](vitest.json)／[XML](vitest.xml)、[全E2E JSON gzip](playwright.json.gz)／[XML](playwright.xml)。50 unit/integration Pass、実DB20 skip。59 E2E全Pass、skip／Fail／flaky 0。通常の移動／Undo・Toggle・focus・remote・dragを含む。追加2 unitは境界の可否一致と、1,000 blockでtransaction／全文走査を生成しないことを検証。

最初の型検査は追加unitのNodeNext importに.jsがなくFail。[原ログ](first-typecheck-failure.log)を保持、修正後の全検証はPass。転送初回も存在しないtsconfig名／Windows区切り／container所有権で失敗し、host inventoryの `/` 正規化とroot展開・node所有権に修正。最終全file hash一致をcontrollerで検査した。

[microbenchmark](benchmark.json): 同一1,000 blockの中間selection、可否2方向を1組として各1,000組、順序を交互に6回、50回warmup。旧901–1,982ms、新0.066–1.003ms。Nodeのみの限定処理、全E2E／cross buildと同時期でhost負荷を固定していない。browser/nativeの総入力時間やFPSへ換算しない。[再現script](benchmark.ts)はrepo rootのDocker内で `npx tsx tests/evidence/toolbar-availability-20261005/benchmark.ts`。出力先 `/tmp/toolbar0624` を作ってから実行。import pathだけ公開ファイル配置に合わせた。

## production-bundle入力・復元

[環境](performance/environment.json)はDocker／WSL2 Linux 6.18.40.1、i7-12700H、Node24.19.0、npm11.9、Playwright Chromium。[Page原metrics gzip](performance-metrics.json.gz)と[原report gzip](performance/playwright.json.gz)／[XML](performance/playwright.xml)。`npm run test:performance -- --grep STEP8-PAGE-1000` が1 Pass、skip／Fail 0、所有PostgreSQL schema削除後0件。release実Rust storeを現在manifestでbuildし、外部依存は変えずignored nested lockの自crate版だけ合わせた。

1,000 block、1,001初期journal、復元3 sample 372.2／379.1／381.1ms、実キー104文字（delay5ms）、入力全体2,033.5ms、入力終了後保存待ち22.8ms。全内容／構造／clock／journal再構成と1,000 handle保持が一致。keydown→frame機会p95 17.0ms／max62.4ms、input event→commit ACK p95 291.5ms／max357.5ms。値は試験bridge経由で、Windows Tauri IPC／MS IME／実paint／native復元SLOとは別。対照のpaired browser runはなく、過去の別runに対する入力全体の改善を主張しない。v0.6.25で原測定`inputToCommitAckMs`に合わせACKの起点表記だけを訂正した。

## buildとWindows基本操作

[通常buildとfeature graph metadata](build.json)、[frontend](BUILD.log)、[cross log](RELEASE-CROSS.log)、[版・依存照合](version-audit.json)。frontend test flags0、Rust crash hooksなし、main window native drag-drop false。Windows exe13,094,912 bytes、SHA256 `6553e3c19220fd2d77a9d6bc1c838c507c3128de9bc9d2f15ec3d1a24923090a`。hostコピーとも一致。identifier `dev.greiva.poc.validation624`、Page `01a10500-0000-7000-8000-000000000001`、WIN624-IME1000。exe／SQLiteは.dataに保持しGitへ含めない。

[Windows環境](native-environment.json)で新fixtureの1,000段落復元、先頭の上移動無効／下移動有効、2行目の上移動有効を確認。「接続を一時停止」後、上移動でremote→local、Ctrl+Zでlocal→remote、End→実キーxで2行目末尾へ一度だけ追加。[移動画面](native-moved.jpg)／[Undo](native-restored.jpg)／[保存済み](native-typed-saved.jpg)。Alt+F4直後のwindow一覧はまだ1件だったため終了扱いにせず、次のprocess読取りで実不在を確認した。

[native監査](native-audit.json)／[script](audit-native.mjs)。稼働copyはpackaged Roaming。停止後もWALが残り、本体単体copyは旧1更新だったため採用せず、Node SQLite read-only online backupで全4更新へ照合し直した。seq2移動、seq3のXML hashはseedと完全一致、seq4は2行目末尾xのみ。他998段落／metadataとstructured entity／queue／receipt／cursor保持、全digest・integrity_check=ok。baseline未作成だったstructured client ID1件の初期生成は別記録。元の全structured table不変という最初の監査assertionはこの正常初期化でFailし、限定した許容条件に訂正した。日本語IME、物理drag、native latency、peer収束の追加証拠にはしない。試験appは終了、Computer Use解除済み。

## 残条件

Gate A／B／Cの既存結論と、未検証macOS／iOS・Windows性能の残条件を維持。device_listでもiOSはmacOS/Xcode不足で不可。Android emulatorは未起動一覧で、以前のboot失敗後に環境変更がなく今回は起動再試行しない。利用者の追加操作を要求しない。
