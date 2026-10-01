# 試験証拠の索引

`docs/plan/POC_SPEC.md` Section 18 Step 7のサーバー側同期まで記録しました。端末側の同期適用・競合UI・network chaosは未完了です。Windows実機の初回IMEと遠隔更新中に試した操作は利用者確認による結果を保持します。今回のCodex実キー入力はGoogle日本語入力で、Microsoft IMEの結果に流用しません。native全件の証拠とGate A/B/Cの最終判定は未完了です。

## Step 7: structured syncサーバー（2026-10-01）

[Docker検証](step-7-structured-server-20261001/SUMMARY.md)、[113ファイルのソース照合](step-7-structured-server-20261001/checkout-source-match.json)、[初回assertionの失敗](step-7-structured-server-20261001/previous-attempt/SUMMARY.md)。通常29件・実PostgreSQL別run12件・全43 E2E・build/型・保存層・locked Cargo checkがPass。push/pull、immutable確定結果、transactional順序、cursor、field merge・Conflict解決・tombstone・連続offline intentと移行をサーバー側で確認。端末ACK・pull/cursor適用と競合UI・transport chaos・統合crash recoveryは後続。Windows実行物は0.4.0のままで、Microsoft IMEと最終GateのPassを意味しない。

## Step 6: Task／Relation最小モデル（2026-10-01）

[Docker検証](step-6-structured-models-20261001/SUMMARY.md)、[ソース照合](step-6-structured-models-20261001/checkout-source-match.json)、[Windows候補の起動と操作未検証](step-6-native-local-20261001/SUMMARY.md)。Task/Relationと操作queueの同一transaction、schema移行、pending復元、tombstone、実PostgreSQLモデル・version保護・Nest読み取りを確認。全43 E2E、unit/integration 29件、別runの実PostgreSQL 2件、build/型・SQLite初期化・Linux locked Cargo checkがPass。push/pull・cursor前進・競合解決は次のStep 7。実機入力はアクセス拒否で新規操作未検証、Microsoft IMEと最終GateのPassを意味しない。

## Step 5: Page SQLite永続化（2026-10-01）

[Docker検証](step-5-page-store-20261001/SUMMARY.md)、[Windows実機の自動操作・復元・peer一致](step-5-native-recovery-20261001/SUMMARY.md)、[初期の起動失敗](step-5-native-startup-20261001/SUMMARY.md)。Dockerの41 E2Eと実機のPage保存・強制終了・offline復元・再接続を区別する。Google日本語入力の実キー結果はMicrosoft IMEの結果に含めず、native全件とGate A/B/Cの最終判定は未完了。

## 最新: 遠隔更新中のWindows実機IME（2026-10-01）

[結果・実機画面](windows-remote-ime-20261001/SUMMARY.md)、[利用者の回答](windows-remote-ime-20261001/manual-results.json)。Docker peerから12回送信し、全ACKを確認。利用者は試した変換・再変換・選択・Undo/Redoに問題なし、双方の文字保持と回答しました。Codexは日本語候補と遠隔文字の同時表示を実機で独立観察しました。同一段落composition重複は確立していません。証拠チェックポイント0.2.1、frontend0.2.0、既存native shell0.0.0を区別します。

## 最新: Step 4共同編集（2026-10-01）

[結果・収束スナップショット](step-4-collaboration-20261001/SUMMARY.md)、[metadata](step-4-collaboration-20261001/summary.json)、[ソース照合・Docker条件](step-4-collaboration-20261001/verification-context.json)。build/型、unit/integration 22件、Chromium全37件、SQLite基盤、実PostgreSQL 1件、Linux locked Cargo checkがPass。6つのA/Bケースをraw state vector・clock map・本文JSONで比較し、サーバーSIGKILL後のbinary復元も検証した。今回のfrontend/app sourceは0.2.0、既存Windows shellは0.0.0。この自動runだけで実機IMEの成功は判断しない。上記の追加手動試験を別記録とし、端末耐久化・Gate最終Passは未完了。

## 最新: Windows実機の初回IME試験（2026-10-01）

[結果](windows-host-ime-20261001/SUMMARY.md)・[利用者の明示回答](windows-host-ime-20261001/manual-results.json)・[完了監査](windows-host-ime-20261001/completion-audit.md)。変換・確定・再変換、変換中/確定後の選択・削除・Undo/Redo、Slash/Mention候補中の入力、Todo/Toggle/移動後編集の4群は、すべて問題なしと利用者が回答しました。Step 3の初回手動証拠として記録し、自動試験やCodexの独立観察とは区別します。具体的な入力ログ・画像は未提供で、追加のnativeブロック全件やYjs接続中IMEの成功は推定しません。

既存Windows debug shellの起動、WebView2保存先、Docker/client/shared 36ファイルのhash一致も記録済み。Greiva専用VM・ISOとVirtualBox本体は削除済み。[本体の削除確認](windows-host-ime-20261001/virtualbox-uninstall.json)。

## 最新: Editor UI/UX改善（2026-09-30）

[最終run](editor-ux-20260930/SUMMARY.md)、[ソース・実行環境](editor-ux-20260930/summary.json)、[ソース照合・Docker条件](editor-ux-20260930/verification-context.json)、[画面](editor-ux-20260930/editor-ux.png)。build・strict型チェック、unit/integration 20件、Chromium E2E全30件、SQLite初期化、実PostgreSQL 1件がPass。入れ子トグルの競合修正は[10/10回の再現試験](editor-ux-20260930/toggle-repeat/playwright.json)でも成功した。

[競合修正前の29/30件run](editor-ux-20260930/previous-race/SUMMARY.md)と[初回の型・試験エラー](editor-ux-20260930/previous-attempt/SUMMARY.md)はそのまま保持した。[UX改善](../../docs/decisions/editor-ux.md)、[修正記録](../../docs/failures/step-2-editor.md)。`.git`はimageへ含めないためcontainerのGit commitはnullであり、現在のcheckoutと照合したsource SHA-256を根拠にする。Rust未変更につき今回のCargo checkはNot run、以下の基盤runはPass。Windows VM/IMEとGate A/B/Cは未検証。

## 基盤: Step 2 Docker検証（2026-09-30）

[結果とログ](step-2-docker-20260930/SUMMARY.md)、[環境・固定版・仕様/lockfile/ソースhash](step-2-docker-20260930/summary.json)、[Docker実行条件](step-2-docker-20260930/docker-runtime.json)、[ホストのソースとのhash一致](step-2-docker-20260930/checkout-source-match.json)。ソース81ファイルのSHA-256は`32c7a1bb74c924f81a00bef90a64254b497ee44e2920611999f5a6878544b490`。Gitは未commit、containerはnodeユーザー、非privileged、no-new-privileges、証拠ディレクトリだけのbind mount。

| 検証 | 結果 |
| --- | --- |
| Web/Node build、strict型チェック | Pass |
| unit/integration | 20件Pass、通常runのPostgreSQL 1件skip |
| Chromium E2E | 全23件Pass、skip/flakyなし |
| SQLite初期化/WAL/整合性 | Pass |
| 実PostgreSQL 18.4への接続 | 別runで1件Pass（通常runのskipを代替） |
| Linux locked Cargo check | Pass |

[Vitest JSON](step-2-docker-20260930/vitest.json)、[Playwright JSON](step-2-docker-20260930/playwright.json)、[PostgreSQL専用JSON](step-2-docker-20260930/postgres/vitest.json)。失敗した前回runも[そのまま保持](step-2-docker-20260930/previous-attempt/SUMMARY.md)し、[Editorの修正記録](../../docs/failures/step-2-editor.md)へ経緯を記録した。最終runの終了コードは0。

2026-09-30時点ではWindows VM作成済み・OS ISO取得中だった。[当時のVM準備記録](windows-vm-preparation-20260930/summary.json)。その後実機方式へ切り替え、VM・ISOは削除した。Windows VM内Tauri・Microsoft IMEは未実施のまま。Linux checkや合成compositionのPassをGate AのPassとしない。

## 過去: 隔離環境へ切替時

2026-09-30の指定ではDockerで開発・自動試験、Windows VMでTauri/IMEを検証する予定だった。[当時の環境確認](isolation-20260930/SUMMARY.md)、[現在の実行手順](../../docs/development/isolated-environment.md)、[Step 2の実装・未検証範囲](../../docs/decisions/step-2-scope.md)。

切替時点ではCompose構文のみPassで、Docker engine到達不可のためimage buildとcontainer自動試験はNot runでした。旧ホスト実行のbuild/typecheck/19件のunit・integration、Windows native compile成功を、隔離環境やIMEの成功として扱いません。以下は過去のStep 1証拠です。

## 環境設定後の確認: 2026-09-30 17:32 JST

ユーザーが設定完了を伝えた後、稼働中のセッションで前提条件を確認しました。[今回の結果](step-1-environment-recheck-2026-09-30T08-32-32.197Z/SUMMARY.md)と[metadata](step-1-environment-recheck-2026-09-30T08-32-32.197Z/summary.json)を保存しました。

Docker daemon は応答しましたが、PostgreSQL pull は依然 Forbidden。GLib/GTK/WebKitGTK 開発ライブラリは未導入で、Tauri locked check は同じ GLib 不足で停止しました。稼働セッションの network policy / environment_status には Docker registry の許可追加が確認できませんでした。ユーザーが変更した設定画面・環境と本セッションとの対応、セットアップの実行状況は未確認です。アプリ実装の変更はなく、前回通過した試験は繰り返していません。Step 2 には進んでいません。

## 再検証: 2026-09-30 17:20 JST

ユーザーの指定により、同じ作業環境で Step 1 を再検証しました。実装ソース、仕様書、npm/Cargo lockfile の hash は初回検証と一致しています。

- [再検証の結果と各ログ](step-1-recheck-20260930-1720/SUMMARY.md)
- [環境・日時・コマンド・依存版・ソースhash](step-1-recheck-20260930-1720/summary.json)
- [Vitest JSON](step-1-recheck-20260930-1720/vitest.json) / [Playwright JSON](step-1-recheck-20260930-1720/playwright.json)

ビルド、型チェック、unit/integration 16件、Web E2E 1件、SQLite初期化、Compose構成検査は Pass。PostgreSQL起動は registry の Forbidden、Tauriのlocked checkは GLib開発環境不足で引き続き Fail。実DB試験は未実行（通常Vitestの1件skip）。検証全体の終了コードは1。Step 2、Gate A/B/Cには進んでいません。

## 初回の検証証拠

- [Step 1 の実行結果](step-1/SUMMARY.md)
- [環境・依存版・Git状態・ソース/lockfile/仕様hash・コマンド・日時](step-1/summary.json)
- [検証したソースのファイル一覧](step-1/source-files.json)
- [unit / integration JSON](step-1/vitest.json) / [JUnit](step-1/vitest.xml)
- [Playwright JSON](step-1/playwright.json) / [JUnit](step-1/playwright.xml)
- [PostgreSQL の失敗記録](../../docs/failures/step-1-postgres-registry.md)
- [Tauri CLI 起動ログ](step-1/tauri-dev.log) / [補足metadata](step-1/tauri-dev-metadata.json)
- [Tauri の失敗記録](../../docs/failures/step-1-tauri-prerequisites.md)

2026-09-30 17:11 JST（08:11 UTC）に Linux x86_64 で実行しました。担当: Codex。まだ commit が存在しないリポジトリのため Git commit は null、dirty 状態とソース SHA-256 を記録しています。

| 試験ID | 前提と操作 | 期待結果 | 実結果 |
| --- | --- | --- | --- |
| STEP1-BUILD | npm ci 後、npm run build | 共有パッケージと3アプリのWeb/Nodeビルド成功 | Pass |
| STEP1-TYPES | npm run typecheck | テストを含む strict 型チェック成功 | Pass |
| STEP1-PROTOCOL / STEP1-ID | UUID/date/version/cursor/DTO の境界入力を検証 | 仕様準拠データのみ受理、IDが一意・ソート可能 | Pass: unit 13件 |
| STEP1-API | NestJS/Fastify の実アプリへ inject | health 200、sync push は未実装で404 | Pass: integration 1件 |
| STEP1-COLLAB | Hocuspocus を実ポートで起動しHTTP送信 | health 200 | Pass: integration 1件 |
| STEP1-SQLITE | 一時ファイルDB初期化、試験データ保存、再オープン | WAL/FULL/FK、データ保持、integrity_check=ok | Pass: integration 1件 |
| STEP1-E2E | Playwright が3サービスを起動、ChromiumでReact画面を開く | UI表示と両health成功、同期状態は未検証 | Pass: 1件 |
| STEP1-SQLITE-INIT | npm run db:sqlite | 開発DB初期化と整合性検査成功 | Pass |
| STEP1-POSTGRES-CONFIG | docker compose config --quiet | 開発構成が有効 | Pass |
| STEP1-POSTGRES-START | npm run db:up | PostgreSQL起動とhealthcheck成功 | Fail: registryアクセスForbidden |
| STEP1-POSTGRES | 起動済み実DBへ接続 | DB名/18.4版を確認 | Not run: 起動失敗。通常Vitestでは1件skip |
| STEP1-DESKTOP-CHECK | cargo check --locked | Tauri 2のネイティブコンパイル成功 | Fail: GLib開発環境なし |

条件: API/Hocuspocus/E2E は localhost 接続、network chaos なし、強制終了なし。Chromium の実行パスとバージョンは summary.json を参照してください。clientId 別ログ、cursor、operation ID、Yjs state vector/文書JSON は後工程の機能が未実装のため該当なしです。Tauri build は未成功、Windows/macOS/iOS/Android は未検証です。Gate の Pass は主張しません。

`npm ci` は lockfile からクリーン再インストールして終了コード0でした。Rust の cargo generate-lockfile も成功しました。`npm run evidence -- --postgres --desktop` は、PostgreSQL起動とTauriコンパイル失敗を含むため終了コード1です。失敗を証拠から除外していません。

以後の実行は `npm run evidence` で `runs/<UTC時刻>/` に保存し、レビュー対象を選んで索引に追加してください。
