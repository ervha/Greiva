# 試験証拠の索引

現在は`docs/plan/POC_SPEC.md` Section 18 Step 3の準備中です。Steps 1–2のDocker自動試験は成功。ユーザー指定によりnative/IME対象をWindows実機へ切り替えました。Microsoft IME、Gate A/B/Cは未検証です。

## 最新: Windows実機の初回IME試験準備（2026-10-01）

[準備記録](windows-host-ime-20261001/SUMMARY.md)。既存のWindows debug native shellを起動し、window handle・応答、WebView2データのプロジェクト内保存先、Docker側client/shared 36ファイルのhash一致を確認しました。描画・実際のIME入力は利用者の結果確認待ちで、Step 3は未完了です。Greiva専用VM・ISOとVirtualBox本体は削除済み。[本体の削除確認](windows-host-ime-20261001/virtualbox-uninstall.json)。

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
