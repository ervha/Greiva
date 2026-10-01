# Greiva 開発計画・状況・セットアップ

[プロジェクト紹介へ戻る](../../README.md)。以下のコマンドは、特記がなければリポジトリのルートで実行します。

2026-10-01時点の開発計画と検証記録。開発チェックポイント **v0.5.0**。[変更履歴](../../CHANGELOG.md)・[コミット/バージョン運用](../development/versioning.md)。更新規模に応じたGitタグを付けてGitHubへ反映します。

[POC_SPEC.md](POC_SPEC.md) のSection 18に沿って進めています。Step 1の基盤とStep 2の最小Editorを実装し、Slash・Toggleの操作改善を含むDocker内の全30件のE2Eが成功しました。Step 3はWindows実機へ切り替え、既存native shellの起動とWebView2保存先を確認しました。初回local IMEの4群は利用者がすべて問題なしと明示回答し、手動結果と初回証拠を記録しました。[Step 3初回IME記録](../../tests/evidence/windows-host-ime-20261001/SUMMARY.md)。[版の記録](../decisions/specification-version.md)、[Step 2の範囲・検証状況](../decisions/step-2-scope.md)、[Editor操作の改善](../decisions/editor-ux.md)を参照してください。

Step 4ではPage本文のYjs/Hocuspocus接続とサーバーbinary journalを追加しました。6つのA/B収束ケース、local Undo分離、新規client復元、別Page分離とサーバーSIGKILL復元を検証し、Dockerの全37 E2E、unit/integration 22件、build・型・Linux locked Cargo checkと専用PostgreSQL試験が成功しました。[Step 4の実装判断](../decisions/step-4-collaboration.md)・[証拠](../../tests/evidence/step-4-collaboration-20261001/SUMMARY.md)。[接続中の実機IME追加試験](../../tests/evidence/windows-remote-ime-20261001/SUMMARY.md)も、12回の更新を受ける間に試した操作すべて正常・双方の本文保持と利用者が回答し、候補画面を独立観察しました。同一段落のcomposition重複と残るnative全ブロック証拠は最終Gateに向け補強します。端末SQLiteのPage/update保存とoffline強制終了復旧はStep 5、Task/Relation同期はStep 6以降。Gate A/B/Cは未判定です。

製品設計には[Calendar・定期予定・時間割の追加設計](CALENDAR_TIMETABLE_SPEC.md)を記録しました。曜日＋時限/自由な時刻、週次の繰り返し、一回の取消・振替・追加を汎用モデルで扱う案です。Calendarは未実装で、PoCの対象と検証順序は変更していません。

[ヘルプ・利用案内の追加設計](HELP_SUPPORT_SPEC.md)も記録しました。ヘルプ内検索、FAQ、操作の文脈案内、ショートカット、offlineで読める基本ガイド、問題解決と診断情報の確認を扱う案です。ヘルプ画面・記事は未実装です。

[将来のAI・文章/音声操作の設計](AI_ACTION_SPEC.md)では、Page作成・Task/予定登録と、通常UIと共通の操作経路へ段階的に接続する案を記録しています。新規作成は直接実行、既存変更・削除は確認後に実行する方針です。現在のPage・予定と関連するノート/Taskを参照し、外部送信は初回設定で許可した送信先・データ種別の範囲内で毎回の確認を省略できる設計です。Provider等は未決定で、AI・音声機能は未実装です。

音声の将来設計には、短い操作指示と、長い会議・講義の録音からのPage作成・Task/予定候補の抽出を含めます。Pageは整理したノート＋折りたたんだ全文文字起こしとし、抽出候補は一覧から選んで一括登録します。元録音は初期30日保存で期間を変更でき、基本は端末内、選んだ録音だけアプリのクラウドへ保存する設計です。期限後もPage・文字起こしを残します。保存・削除契約、候補保持・処理上限は未決定です。

AI初期提供の方針は作成・登録・録音整理から開始し、既存編集・削除・検索は後続追加とします。入口は共通パネルと各画面を併用し、音声はアプリ内録音と既存ファイル取込みに対応します。AI会話履歴は初期30日保存、期間変更・手動削除が可能です。履歴やアプリ管理下の録音が期限切れでも、作成したPage・文字起こし・登録済みTask/予定や取込み元のファイルは消しません。これらは将来設計であり、今回のPoCでは実装していません。

追加の製品設計として[アプリ内更新](APP_UPDATE_SPEC.md)を記録しました。起動時・定期確認、利用者が開始するダウンロード、「今すぐ更新／後で」と再起動前の確認、未送信データの保全を合意済みです。未実装で、提供時期は未決定です。

Step 5ではnative Page metadataとYjs binary updateをSQLiteへ保存し、commit後に同期送信する境界を実装しました。[実装判断](../decisions/step-5-page-store.md)。[Dockerの8項目・Chromium全41 E2E](../../tests/evidence/step-5-page-store-20261001/SUMMARY.md)が成功し、強制終了・復元の選択状態を確認する試験も追加で3回成功しました。DockerでWindows 0.3.0候補をcross buildし、利用者の入力なしでnativeの新規offline Page・title・本文・block移動、強制終了後のoffline復元、再接続後のnative/peer state vectorと本文一致を確認しました。[実機証拠](../../tests/evidence/step-5-native-recovery-20261001/SUMMARY.md)。初期の制限付き起動によるWebView生成失敗は通常権限での起動で解消しました。Google日本語入力の実キー変換・候補選択は記録済みですが、Microsoft IME・native全項目・最終Gateは未検証で、結果を流用しません。Step 6の進捗は次の段落に記録しています。

## 通常の開発・試験はDocker内で実行

Step 6ではTask/Relationの端末CRUD・tombstone、entityとqueueの同一SQLite transaction、schema移行、stable client ID、PostgreSQL最小モデル・Nest読み取りAPIを追加しました。[実装判断](../decisions/step-6-structured-models.md)、[全43 E2E・unit/integration 29件・実PostgreSQL別run 2件の証拠](../../tests/evidence/step-6-structured-models-20261001/SUMMARY.md)。Windows候補0.4.0はDockerでcross buildしましたが、[実機操作APIのアクセス拒否](../../tests/evidence/step-6-native-local-20261001/SUMMARY.md)により新規Task操作は未検証です。push/pull・ACK・cursor前進・base/local/remoteの競合処理はStep 7、Microsoft IMEと最終Gate A/B/Cも未完了です。

Step 7のサーバー側push/pull、操作台帳、順序付きcursor、field merge・Conflictと明示解決、連続offline編集の意図保持を追加しました。[実装判断](../decisions/step-7-structured-server.md)と[検証証拠](../../tests/evidence/step-7-structured-server-20261001/SUMMARY.md)。Dockerの通常29件、実PostgreSQL別run12件、全43 E2Eとbuild/型・保存層・locked Cargo checkが成功しました。端末ACK・pull適用とcursor保存・Conflict UI・network chaos・統合crash recoveryは続けて実装します。既存Windows実行物は0.4.0のままで、Microsoft IMEと最終Gateも未完了です。

現在のユーザー指定により、**Dockerで開発・自動テスト、Windows実機でTauri・Microsoft IMEを検証**します。[実機起動手順](../development/windows-host-ime.md)は既存実行物を使い、ホストへ開発ツールを追加しません。[隔離環境の詳細](../development/isolated-environment.md)。

```powershell
docker compose -f infrastructure/development/compose.yaml up --build -d dev
docker compose -f infrastructure/development/compose.yaml --profile test run --build --rm tests
```

UIはhttp://127.0.0.1:1420。ソースはimageへコピーし、依存・ビルド出力・SQLite・ブラウザをcontainer内に置きます。DBは専用volumeに保存し、host portを公開しません。試験証拠だけが`tests/evidence/runs/container/`へ出力されます。ソース変更後は`up --build -d dev`で再反映します。

Docker imageの構築とcontainer内のbuild/typecheck、unit/integration 20件、E2E全30件、SQLite初期化、実PostgreSQL接続が成功しました。[最新の証拠索引](../../tests/evidence/README.md)。2026-10-01の実機準備ではDockerのclient/shared 36ファイルとcheckoutのhash一致を確認しました。実機の起動記録と実際のIME試験は別に扱います。不要なGreiva VM・ISO・準備ディレクトリは削除済み。VirtualBox本体もWindowsの管理者確認後に削除完了を確認しました。

## 過去のVM内セットアップ計画

以下のVM専用手順と依存一覧は、実機方式へ変更する前の記録です。現在の実機でこれらのセットアップコマンドを実行する指示ではありません。追加のnativeビルドが必要になった場合は、Docker内クロスビルド等の成立性を別途検証します。

## Windows VM内の前提環境

- Node.js **24.19.0**、npm **11.9.0**（`.node-version` / `.nvmrc` / `engines` / `packageManager` に固定）
- Rust **1.98.1**（`rust-toolchain.toml`）、Tauri 2 の各OS用ネイティブ開発要件
- Docker/Composeはホストで実行（現在確認した CLI: Docker 29.6.2、Compose 5.3.1）。VMへのDocker導入は初回IME試験には不要。
- E2E 用 Chromium（通常は Playwright が管理する版をインストール）

Windows 11 の desktop 開発には Visual Studio C++ Build Tools（Desktop development with C++）、Windows SDK、WebView2 を用意してください。macOS には Xcode Command Line Tools、Linux Debian/Ubuntu には C/C++ ビルド環境、pkg-config、GTK3、WebKitGTK 4.1、OpenSSL、librsvg、libayatana-appindicator の開発パッケージが必要です。OS要件は [Tauri の公式手順](https://v2.tauri.app/start/prerequisites/)も参照してください。Windows P0 起動や IME の合否を Linux ブラウザ試験から判断しません。

## Windows VM内のセットアップ

以下のNode/RustコマンドはWindows VMのguest内で実行します。ホストでは実行しません。[VM手順と初回IME試験](../development/windows-vm.md)を参照してください。共有パッケージは利用前にコンパイルします。

```sh
npm ci
cp .env.example .env
npm run build:packages
npm exec -- playwright install chromium
npm run db:sqlite
```

PowerShell では `cp` を `Copy-Item .env.example .env` と置き換えられます。`.env` はローカル設定であり Git 対象外です。例の PostgreSQL パスワードは開発専用です。

`db:sqlite` は `.data/greiva-dev.sqlite` を初期化し、WAL / foreign_keys / synchronous=FULL を設定して整合性を検査します。任意のパスには `npm run db:sqlite -- <path>` を使用します。この Node SQLite ツールは開発基盤の検証用であり、Tauri desktop の保存・クラッシュ復旧試験を代替しません。業務テーブルは Step 5/6 で追加します。

`db:up` は PostgreSQL **18.4-bookworm** を起動し、healthcheck が成功するまで待ちます。初回は Docker Hub への接続が必要です。ポートは `127.0.0.1:5432`、DB 名は `greiva_poc`、接続文字列は `.env.example` を参照してください。データは名前付き volume に保持されます。`npm run db:down` で停止します（volume は保持）。Step 1 では structured sync のテーブルは作成しません。

## Windows VM内の起動

```sh
npm run dev
```

- Client: http://127.0.0.1:1420
- API: http://127.0.0.1:3000/health
- Collaboration: http://127.0.0.1:1234/health

各 workspace は `npm run dev -w @greiva/client` / `@greiva/api` / `@greiva/collaboration` でも起動できます。これらのnpmコマンドはDocker内で実行します。APIとcollaborationのhost/portは`.env`を読みます。Clientは1420に固定。Step 4から`page:{pageId}`へ接続し、サーバーupdate journalをdev専用volumeへ保存します。

Tauri desktop の最小 shell は、OS の開発要件を満たした端末で次を実行します。

```sh
npm run desktop
```

Rust の静的コンパイル確認:

```sh
cargo check --locked --manifest-path apps/client/src-tauri/Cargo.toml
```

配布用インストーラは Step 1 の対象外です。SQLite plugin は登録していますが、UI からDBを開く処理やエンティティ保存は実装していません。

## Windows VM内のビルドと試験

```sh
npm run build
npm run typecheck
npm test
npm run test:e2e
npm run test:postgres
```

`build` は共有パッケージ、API、collaboration、React の production build までです。Tauri のネイティブビルドは上記の別コマンドで検証します。

`npm test` は共有モデル、UUID v7/UTC、block移動transaction、実際のNestJS/Fastify・Hocuspocusの起動、SQLiteの初期化・再オープンを検証します。PostgreSQL integrationは通常 **skip** し、起動済み実DBに対して`test:postgres`を明示実行します。Dockerの試験serviceはこの実DB試験も実行します。

`test:e2e`は共有・serverをbuildし、クライアントとコンパイル済みAPI/collaborationを起動します。health試験1件とEditor操作29件をChromiumで検証します。1420/3000/1234が空いている必要があります。Microsoft IME/Tauri/同期の試験は含みません。compositionの合成イベント検査を実IMEの合格根拠にはしません。

管理環境に既存の Chromium だけがある場合は、その利用を明示できます。

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e
```

PowerShell: `$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE = 'C:\path\to\chrome.exe'`。通常は変数を設定せず、Playwright 管理版を使用してください。環境変数名は接続先や検証条件の設定に限ります。

## 証拠

```sh
npm run versions
npm run evidence
npm run evidence -- --postgres --desktop
```

`evidence`はStep 2のビルド・型検査・unit/integration・E2E・SQLiteのログ、JSON/JUnit、環境と版、Git状態、ソース/lockfile/仕様SHA-256を保存します。`--desktop`はlocked Cargo check、VM内で利用できるDockerがある場合の`--postgres`はDB起動・接続試験を追加します。Docker試験serviceはDocker socketを共有せず、Composeが起動した実DBへ接続し、証拠をhostの`tests/evidence/runs/container/`へ出力します。失敗はexit 1、未実施はNot runです。

実行ログは `runs/` として Git 対象外です。レビュー対象の証拠は選んだ実行ディレクトリを `tests/evidence/step-1/` などにコピーし、[証拠索引](../../tests/evidence/README.md)からリンクします。失敗時は仕様 Section 1.3 / 16 に従い [docs/failures/](../failures/) に最小再現手順、期待/実結果、原因候補、影響するGate、次の選択肢を残します。

## 依存バージョン

2026-09-30 の実装開始時点に registry の stable/latest を確認して固定しました。npm の直接依存は exact version、推移依存は `package-lock.json`、Rust は exact version と `apps/client/src-tauri/Cargo.lock` で固定しています。`npm ci` と `cargo ... --locked` を使用し、主要バージョン更新には再検証を伴います。PoC の技術は置換していません。

| 領域 | 固定バージョン |
| --- | --- |
| React / React DOM | 19.3.0 |
| TypeScript | 7.0.2 |
| Vite / React plugin | 8.3.1 / 6.1.1 |
| Tauri API / CLI / Rust | 2.12.0 |
| tauri-build / SQLite plugin JS・Rust | 2.7.0 / 2.5.0 |
| Tiptap core / React / PM / StarterKit / List / Details / Mention / Suggestion | 3.31.3 |
| ProseMirror | Tiptap PM の推移依存として lockfile に個別固定 |
| Yjs | 13.6.33 |
| Hocuspocus server / provider | 4.7.0 |
| NestJS common / core / platform-fastify | 12.1.1 |
| Fastify | 5.12.5 |
| PostgreSQL / pg | 18.4-bookworm / 8.23.0 |
| SQLite 開発ツール | Node 24.19.0 同梱 3.53.3 |
| SQLite desktop | Rust plugin の libsqlite3-sys を Cargo.lock に固定（ネイティブ実行未検証） |
| Zod / UUID | 4.6.5 / 14.0.2 |
| Vitest / Playwright | 5.0.2 / 1.63.0 |
| tsx / concurrently | 4.23.15 / 10.0.5 |
| reflect-metadata / RxJS | 0.2.2 / 7.8.2 |
| @types node / React / React DOM / pg | 26.6.3 / 19.3.0 / 19.3.0 / 8.23.1 |

全直接依存と lockfile hash は `npm run versions` および実行証拠の `summary.json` を参照してください。Tiptap/Yjs/provider の依存固定は後工程の技術準備であり、統合済みを意味しません。PostgreSQLの実際のimage IDは[Docker実行証拠](../../tests/evidence/step-2-docker-20260930/docker-runtime.json)へ記録しました。

## 検証範囲と現在の制約

過去のStep 1ではLinuxで16件のunit/integrationとWeb E2E 1件が成功しました。今回の隔離切替前のWindows確認ではbuild、typecheck、unit/integration **19件**、locked Cargo check、debug native buildが成功しています。実PostgreSQL試験1件はskip、native UIとIMEは未実施です。

Step 2の基準検証ではDocker内でbuild/typecheck、unit/integration **20件**、Editorを含むE2E **全23件**、SQLite初期化、実PostgreSQL試験、Linux locked Cargo checkが成功しました。[証拠](../../tests/evidence/step-2-docker-20260930/SUMMARY.md)。その後のEditor UX改善ではE2E全30件が成功しました。[最新のEditor証拠](../../tests/evidence/editor-ux-20260930/SUMMARY.md)。現在のP0対象はWindows実機です。初回local IMEは利用者確認でPass。Yjs接続中のIMEとGate A最終判定、Gate B/Cは後続工程です。Step 4のYjs接続以降にはまだ進んでいません。
