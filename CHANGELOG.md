# 変更履歴

番号は確認済みのリポジトリ開発チェックポイントを示す。[運用方針](docs/development/versioning.md)。将来機能の設計と実装は区別して記載する。

## 0.6.6 — 2026-10-01

- Step 8の実機結果・失敗記録を整理する文書更新（PATCH）。実際に検証したアプリ・manifest／lockfile・プレビューは0.6.5のまま。製品コードや依存は変更しない。
- Google日本語入力で同一段落への遠隔3更新、変換・候補選択・確定・local Undo/Redoと最終peer本文一致を確認。Microsoft IMEでは同一段落への遠隔6更新と通常変換の本文保持を確認したが、候補一覧が一度隠れ、再変換の確定後に直前の `al ` が欠落した。peerと保存済みSQLiteにも欠落を確認し、未修正・原因未確定として残す。
- Windows releaseの設定だけを変えた隔離用0.6.5候補をDockerでbuild。新規DB／WebView保存先の一回で起動から主要UIの画像確認まで1,962msを観測。正確なfirst paintや大量データ性能の保証ではない。観測間隔が空いた初回試行も保持する。
- [結果と証拠](tests/evidence/step-8-platform-validation-20261001/SUMMARY.md)、[再変換の失敗](docs/failures/step-8-ms-ime-reconversion.md)、[停止境界と残課題](docs/decisions/step-8-validation-boundary.md)。native全項目・P1/P2実OSは未完了。利用者の指定に従いStep 8の記録チェックポイントで停止し、Step 9の最終Gate判定・技術選定には進まない。

## 0.6.5 — 2026-10-01

- Todo配置の修正（PATCH）: 固定版Tiptapの実DOMに一致するCSSへ変更し、チェック欄と本文を同じ行に配置する。完了状態の取り消し線、保存・同期・IME処理は維持。
- 修正前の位置検査Fail、修正後のpointer編集・本文保持・チェックと全E2E45件Pass。build・型・通常試験・locked Tauri checkもPass。[証拠](tests/evidence/step-8-todo-layout-20261001/SUMMARY.md)。外部依存を維持し、アプリ所有manifest／lockの版を整合。
- Windows 0.6.4の新規Page・Slash／選択・Undo/Redo／Toggle／Todoと実キー日本語変換を限定的に記録。修正後0.6.5でTodo配置・pointer編集・完了表示を実機確認し、Docker previewもsource一致を確認して反映。0.6.4 release artifactはDocker build・host照合のみ。最新native全操作、Microsoft IME、同一段落composition重複・再変換、release起動時間と最終Gateは未検証。

## 0.6.4 — 2026-10-01

- Editor性能改善（PATCH）: 入力のたびに作り直していたブロックのドラッグハンドルDOMを再利用する。ドラッグ開始時には現在の位置と本文を読み、前のブロックの編集で位置が変わっても正しいブロックを移動する。保存・同期・IMEの契約は維持。
- 実操作E2EでDOM保持、更新後のdrag payload／実pointer移動、Undo/Redoを検証。元の再生成と古い位置を使う誤修正が試験で失敗することもDocker内のprobeで確認。1,000 block／104文字の性能試験に全ハンドルの保持検査を追加。
- 通常production frontendを埋め込んだWindows 0.6.4候補をDockerでlocked/offline cross-buildし、Windowsへコピーしたexeのバージョン・容量・SHA-256を照合。ホストtoolchain追加なし。候補の生成と実機操作・IMEの合否を区別する。
- [最終検証・変更前後の観測](tests/evidence/step-8-editor-performance-20261001/SUMMARY.md)、[判断と残課題](docs/decisions/step-8-editor-performance.md)。Dockerの12項目・Editor44 E2EはPass。Windows最新候補／Microsoft IME、Windows release性能、P1/P2実OS、最終Gateは別の証拠が必要。

## 0.6.3 — 2026-10-01

- 検証・開発環境の更新（PATCH）: Step 8のproduction frontend／release Rust性能試験を追加。空SQLite起動のWeb補助値、1,000 blockの全journal復元・104文字の実キー入力／frame／保存ACK、100回のYjs offline編集・再接続、1,000件のTask操作を実UI engineで測定し、全内容・queue・cursorと一件性を検証する。
- 試験用Rust transportのSIGKILLとrequestが競合した際のstdin EPIPEを受け止め、Viteが停止しないよう修正。大きな並行requestのbackpressureで修正前の失敗を再現し、修正後の復帰を検証。生成した性能bundleをGit／Docker入力から除外。
- Windowsの既存0.6.0候補で新規Page・title／本文のliteral入力、保存・同期表示、Task作成と実APIで一件の確定を確認した。[限定的な実機証拠](tests/evidence/step-8-native-smoke-20261001/SUMMARY.md)。最新候補・Microsoft IME・全native操作・release起動のPassではない。
- [測定方法と制約](docs/decisions/step-8-performance.md)、[最終証拠](tests/evidence/step-8-performance-20261001/SUMMARY.md)、[初回回帰と修正](docs/failures/step-8-test-harness.md)。入力待ち・frame間隔・大量同期の改善余地を記録し、性能やP1/P2実OS、Gate A/B/Cと技術選定は未完了。外部依存の固定版は維持し、アプリ所有manifest／lockのみ0.6.3へ整合する。

## 0.6.2 — 2026-10-01

- 保存待ちと検証の更新（PATCH）: ユーザーがAを選択し、保存済みの全変更を復元保証の対象、保存中の未commit入力を強制終了時の保証対象外とする契約をPoC／製品設計へ反映。保存状態の説明を画面へ追加。
- 待機中のYjs更新をmergeして保存回数を減らす。最初の保存を遅らせず、タイトル変更の順序、保存失敗での停止、送信前の耐久化を維持する。
- 実APIプロセスの確定前／確定後SIGKILLと、Page・block・Task・Relationを合わせた4境界のbrowser／Rust store SIGKILL試験を追加。編集直後の試験も残し、全commit済みupdate、最後の保存済み構造・本文・queue、offline復元とpeer収束を検証する。
- [判断と実装](docs/decisions/step-7-crash-recovery.md)、[検証証拠](tests/evidence/step-7-crash-recovery-20261001/SUMMARY.md)、[初回Failと承認後の契約](docs/failures/step-7-integrated-crash.md)。通常Tauriで試験専用停止featureを無効とする。Windows native／Microsoft IME、性能・互換性と最終Gateは後続で、無条件な未保存入力保持を実装したとは扱わない。

## 0.6.1 — 2026-10-01

- 製品設計の補足（PATCH）: Notion公式Helpを再確認し、[ボタン・オートメーション設計 v0.2](docs/plan/BUTTON_AUTOMATION_SPEC.md)へDB Button／Page button／DB automationのaction対応表、通知・メール・Webhookの比較事項を追加。
- 保存ビューのfilter変更は新しいeventへ適用し、実行中の対象は保持する契約と、将来の受入条件を補足。汎用action・Button・automationは未実装で、PoCの範囲・順序・Gateと既存実行物の版は変更しない。
- 検証は公式情報との照合、文書内の参照・受入条件・差分の確認。進行中のcrash試験変更はこの文書チェックポイントに含めず、新たなアプリ試験成功を主張しない。

## 0.6.0 — 2026-10-01

- 実装更新（MINOR）: Step 7の端末structured syncを追加。SQLiteへ送信前のwire request・ACK・receipt・server replica・Conflictを耐久化し、pull適用とcursor更新を同じtransactionにした。元のbase/payloadを保持して連続offline編集・再送・古い応答・tombstoneに対応する。
- 復元→pull→作成順push→pullの直列同期エンジン、bounded retry、明示再試行、Page/Task共通の接続停止を追加。送信待ち・競合・恒久エラーを同期済みにしない。
- 競合UIでbase/local/remoteを表示し、local/remoteの選択を新operationへ保存。遠隔更新中のフォーム入力とfocusを保持する。[実装判断](docs/decisions/step-7-structured-client.md)・[修正記録](docs/failures/step-7-structured-client.md)・[検証証拠](tests/evidence/step-7-structured-client-20261001/SUMMARY.md)。
- Dockerの実Rust/SQLite・PostgreSQL/HTTP結合、別runの競合UI E2Eで、ACK喪失・API再作成・store SIGKILL・cursor保存失敗・500ms/2秒/5秒遅延・接続停止/再開を検証。Windowsのnative IPC/IME、残る統合crash境界・性能・最終Gateは後続検証。
- アプリ管理下のpackage/Tauri/Cargoとlockを0.6.0へ整合し、Windows候補をDockerでcross build・hash照合。候補の実機操作は未検証。既存0.4.0実行物と区別し、ホストへtoolchainを追加していない。汎用DB/Button/automation等は将来設計のまま。
## 0.5.1 — 2026-10-01

- 製品設計更新（PATCH）: NotionのDBビュー・プロパティを基本すべて提供対象とし、型付きRecord・独立したビュー設定・レコード詳細配置を[汎用DB仕様](docs/plan/DATABASE_SPEC.md)へ整理。時間割は利用例とし、任意のGroup/Subgroup・カード表示・関連データ作成を設定する構造にした。
- [ボタン・DBオートメーション仕様](docs/plan/BUTTON_AUTOMATION_SPEC.md): Notion公式Helpを確認し、Button/action/変数/参照と追加・Property変更・定期triggerの対応目標を記録。Greivaの端末保存、実行ID、途中完了、再送、外部送信の結果不明、認可の詳細案・未決定事項・将来の受入条件を追加。
- 要件・UI・Calendar設計を更新。全機能は未実装で、PoCの範囲・Section 18・Gateは変更なし。アプリソースや既存実行物を新しい版として扱わない。
- 利用者の添付画像をGit/Dockerの入力から除外。検証は公式情報・文書の参照/整合性・差分・除外設定の確認。アプリ試験の新しい成功を主張しない。

## 0.5.0 — 2026-10-01

- 実装更新（MINOR）: Step 7のサーバー側push/pullを追加。operation IDに対する確定結果をPostgreSQLへ耐久化し、同じリクエストの再送へ同じ結果を返す。恒久エラーも履歴へ保存する。
- transaction内のサーバー順序と署名付きopaque cursorで、同時書き込み・ページ分割・API再起動後も操作を取りこぼさない。entity・履歴・Conflict・操作台帳・順序の変更は同時にcommitする。
- Task/Relationの異field編集をmergeし、同field競合はbase/local/remoteを保存する。local/remoteの明示解決を新operationとして受け付ける。削除優先、同一内容のcreate衝突、連続offline編集の前操作に対する意図の保持、既存model/台帳の移行を実装。[実装判断](docs/decisions/step-7-structured-server.md)。
- Docker検証と残る範囲は[証拠](tests/evidence/step-7-structured-server-20261001/SUMMARY.md)に記録。端末側のACK・pull適用/cursor更新、競合UI、network chaosと統合crash recoveryは未実装。Step 7全体・最終Gateの完了ではない。
- アプリ管理下のpackage/Tauri/Cargoとlockfileを0.5.0へ整合。既存Windows実行物は実際の0.4.0のまま。Microsoft IMEと新規native操作は未検証で、ホストに開発toolchainを追加していない。

## 0.4.0 — 2026-10-01

- 実装更新（MINOR）: Step 6のTask/Relation最小モデル、端末CRUD、tombstone、送信待ち操作、sync_stateを追加。entity変更とqueue追加を同じSQLite transactionで保存し、schema 2→3移行で既存Pageを保持する。
- client IDを端末SQLiteへ保存。pending操作の元のbaseと前の操作を保持し、再起動でqueueを失わない。保存失敗時は入力を残して再試行でき、成功後は入力focusを戻す。
- PostgreSQLにapplication専用モデルを追加し、version確認とtransactionで同時変更を保護。NestJSからTask/Relationを読み取るAPIを追加。push/pull・ACK・cursor前進・競合解決はStep 7であり未実装。[実装判断](docs/decisions/step-6-structured-models.md)。
- Docker検証: build・strict型・unit/integration 29件、全43 E2E、実PostgreSQL別run 2件、SQLite初期化、Linux locked Cargo checkが成功。[証拠](tests/evidence/step-6-structured-models-20261001/SUMMARY.md)。
- package/Tauri/Cargoとlockを0.4.0へ整合し、Windows候補をDockerでcross build。実機の起動とread-only観察は記録したが、操作APIのアクセス拒否により新規Task操作は未検証。[実機の限界](tests/evidence/step-6-native-local-20261001/SUMMARY.md)。Microsoft IME・最終Gateは未検証。updater・Calendar等は将来設計のまま。

## 0.3.0 — 2026-10-01

- 実装更新（MINOR）: native SQLiteへPage metadataとYjs binary updateを保存。保存commitの完了前には更新・同期応答を送信せず、保存/復元/非互換schemaの失敗時は編集・接続を停止してエラーを表示する。
- offline Page作成、端末内タイトル、保存したPageへの復帰を追加。共通の初期CRDT seedで重複paragraphを防ぎ、Page IDをsessionごとに保持。復元したPageの別画面へのリンクも修正。
- Docker内の実際のRust repositoryでtransaction rollback・dedup・整合性を検証。Chromiumで強制終了→offline復元→peer収束、保存/破損/schemaエラーを含む41 E2E、unit/integration、build・型・PostgreSQL・locked Cargo checkが成功。[Docker証拠](tests/evidence/step-5-page-store-20261001/SUMMARY.md)。
- DockerでWindows実行物をcross buildし、Windows実機をComputer Useで操作。利用者の入力なしで新規offline Page・title・本文・block移動、強制終了後のoffline復元、再接続後のnative/peer state vectorと本文の一致を確認。[実機証拠](tests/evidence/step-5-native-recovery-20261001/SUMMARY.md)。Google日本語入力の実キー変換・候補選択も記録したが、Microsoft IMEの結果には含めない。残るnative全件と最終Gateは未完了。
- 製品設計: アプリ内更新の起動時/定期検知、利用者によるダウンロード、「今すぐ更新／後で」、再起動前の保存確認・署名・配布・復旧を追加。[更新設計](docs/plan/APP_UPDATE_SPEC.md)。updaterは未実装、PoC範囲は変更なし。
- package/Tauri/Cargoとlockfileを0.3.0へ整合。新しいWindows debug候補は実際の0.3.0で、公開installerではない。ホストにtoolchainを追加していない。

## 0.2.1 — 2026-10-01

- 検証記録更新（PATCH）: Windows実機のMicrosoft IME操作中にDocker peerから12回更新し、全受領を確認。利用者が試した変換・再変換・選択・Undo/Redoはすべて正常、双方の文字保持と回答。
- Computer Useで実機のIME候補と遠隔本文をfocus変更なしに独立観察。選別した画像・時刻、送信/ACKログ、peer状態と再現脚本を保存。[証拠と限界](tests/evidence/windows-remote-ime-20261001/SUMMARY.md)。同一段落composition重複やnative全件、Gate最終Passへ拡張しない。
- アプリソース・依存・実行物は変更なし。frontend/app source 0.2.0、既存Windows shell 0.0.0を維持。自動試験は再実行していない。
- 検証: Docker内脚本構文、12送信/ACK対応、JSON・リンク・差分、PoC仕様と既存native実行物hash不変。

## 0.2.0 — 2026-10-01

- 実装更新（MINOR）: Page本文をYjs/Hocuspocusへ接続。Page分離、ランダムclientIdのログ、初回同期、一時切断・再接続、未確認更新の表示を追加。
- サーバー側に受信binary updateのappend/fsync journalと再起動復元を実装。端末SQLite保存はStep 5であり、今回の「サーバーと同期済み」と区別して画面に制限を明記。
- 共同編集のUndoをローカル操作へ限定し、構造変更・移動・選択変更を履歴境界にする。Toggle内の兄弟移動、入れ子Todoの読み上げ名も改善。
- 検証: Docker内のbuild・strict型・unit/integration・A/B収束E2E、サーバーSIGKILL復元、journal破損検出。state vectorと全文JSONを保存。[証拠](tests/evidence/step-4-collaboration-20261001/SUMMARY.md)。実機IME接続中の再試験・Gate最終判定は未完了。
- package/Tauri/Cargoとlockfileの版を0.2.0へ整合。既存Windows shell実行物は実際の0.0.0を維持し、0.2.0の新規配布物として扱わない。

## 0.1.6 — 2026-10-01

- 検証記録更新（PATCH）: 利用者が初回のWindows実機IME試験4群すべて問題なしと明示回答。変換・確定・再変換、変換中/確定後の編集、Slash/Mention候補中の入力、Todo/Toggle/移動後編集を手動Passとして保存。
- Step 3の初回local IME証拠を索引化し、操作者、元の質問・回答、実行環境、結果の限界、完了監査を記録。CodexのGUI独立観察や自動試験として数えない。入力ログ・画像は未提供。
- 後続: Yjs接続中の別client update、追加native Editor操作、Gate A最終判定とGate B/Cは未完了。アプリ本体のコード・既存実行物の版は変更していない。
- 検証: 文書リンク・JSON・バージョン一致・diff check、PoC仕様不変と検証対象のclient/shared・native実行物hashの一致。

## 0.1.5 — 2026-10-01

- 検証記録更新（PATCH）: Windowsの管理者確認後、不要なVirtualBox本体のアンインストールがreturn 0で完了したことを確認。登録情報・VBoxManage・Greiva VMディレクトリの不存在を記録し、環境文書の現在状態を更新。
- Docker開発・自動試験の構成、アプリ本体のコードと版は変更していない。
- ユーザーの実施連絡を受けたが、各IME操作の実結果は未確認。Step 3・Gate AのPassとして記録しない。
- 検証: 文書リンク・JSON・バージョン一致・diff checkと、採用したPoC仕様のSHA-256不変。

## 0.1.4 — 2026-10-01

- 検証環境更新（PATCH）: ユーザー指定によりDocker開発・自動テストを維持し、native Tauri/Microsoft IME対象をWindows実機へ変更。VMの準備を中止。
- 既存Windows実行物をDockerエディターへ接続する起動スクリプトを追加。WebView2データを子プロセスだけの環境変数でプロジェクト内へ指定し、起動時の実行物hash・版・Git状態を記録。
- 確認: スクリプト構文、既存nativeプロセス・ウィンドウの起動、WebView2の実保存先、Docker/client/shared 36ファイルのhash一致、文書のリンク・整合性とPoC仕様不変。
- 整理: ユーザー指示に基づき不要なGreiva VM・ISO・準備ディレクトリを削除（約8.4GB）。VirtualBox本体の削除はWindows Installerが管理者権限を要求して未完了。
- 未完了: native描画とMicrosoft IMEの実入力は利用者による確認待ち。Step 3・Gate Aは完了扱いにしない。アプリ本体のコード・版は変更せず、既存debug shellは0.0.0を維持。
- 詳細: [実機手順](docs/development/windows-host-ime.md)・[準備証拠](tests/evidence/windows-host-ime-20261001/SUMMARY.md)。

## 0.1.3 — 2026-10-01

- 設計更新（PATCH）: 元録音は端末内を基本にし、選んだ録音だけアプリのクラウドへ保存する回答Cを反映。
- 一括回答1A・2C・3A・4B: AI初期提供は作成・登録・録音整理、入口は共通パネル＋各画面、音声はアプリ内録音＋既存ファイル取込み、会話履歴は初期30日・期間変更・手動削除。
- 設計案: ファイル取込み元を保つコピー管理、履歴削除後も作成データと実行識別を保持、未提供の操作の案内を整理。AI初期提供とアプリ初期リリースを区別。
- 文書整理: READMEをGitHub向けの概要・機能の方向・文書案内へ再構成し、開発状況や現在のチェックポイント番号を外す。従来の詳細な開発状況・環境/試験手順・依存一覧は[開発計画とセットアップ](docs/plan/DEVELOPMENT_STATUS.md)へ移動。
- 設計案: 保存状態・他端末での再生可否、Page同期とAI処理用送信の区別、元音声の保持方針を整理。クラウドサービス・容量・upload/cache/削除契約は未決定。
- 検証: 文書の整合性・リンク・diff check、VERSION/変更履歴の一致、採用したPoC仕様のSHA-256不変を確認。
- アプリのコード・実行物は変更していない。AI/音声は未実装で、アプリ試験は再実行していない。

## 0.1.2 — 2026-09-30

- 設計更新（PATCH）: アプリ側の元録音を初期30日保存・期間変更可能とする回答Bを反映。期限後もPage・全文文字起こし・登録済みTask/予定を保持。
- 設計案: 期限・実際の削除状態の表示、音声削除後の文字起こし参照を整理。保存先・期限の起算・既存録音への設定変更・Provider側の保持条件は未決定。
- 検証: 文書の整合性・リンク・diff check、VERSION/変更履歴の一致、採用したPoC仕様のSHA-256不変を確認。
- アプリのコード・実行物は変更していない。AIは未実装で、アプリ試験は再実行していない。

## 0.1.1 — 2026-09-30

- 設計更新（PATCH）: 録音から作るPageを「要点を整理したノート＋折りたたんだ全文文字起こし」とする回答Bを反映。
- 設計案: 要約/全文の区別、候補の根拠箇所への移動、認識内容の訂正と既存Page再整理時の確認を整理。元録音の保持・保存先は未決定。
- 検証: 文書の整合性・リンク・diff check、VERSION/変更履歴の一致、採用したPoC仕様のSHA-256不変を確認。
- アプリのコード・実行物は変更していない。AIは未実装で、アプリ試験は再実行していない。

## 0.1.0 — 2026-09-30

初回のバージョン付き開発チェックポイント。これまでの実装・検証と現在の製品設計を基準として記録する。

- 実装済み: 隔離したPoC基盤、基本Editor、Slash候補・Toggleの操作改善。
- 既存の検証: [Docker証拠](tests/evidence/editor-ux-20260930/SUMMARY.md)でbuild、型検査、unit/integration 20件、E2E 30件、SQLite初期化、実PostgreSQL接続が成功。今回の文書更新では再実行していない。
- 設計: 汎用Calendar/時間割と変更範囲・例外の引き継ぎ、ヘルプ、将来の文章/音声によるAI操作。
- 今回の決定: 長い録音から抽出したTask・予定は候補一覧から選んで一括登録。短い直接指示の新規作成は直接実行を維持。
- 運用追加: `VERSION`、変更規模に応じたannotated Gitタグ、コミット/タグのGitHub反映。
- 今回の確認: 文書の整合性・リンク・diff check、採用したPoC仕様のSHA-256が不変であること。
- 未完了: Windows VMのnative起動・Microsoft IME試験、アプリの永続化・同期。Calendar・ヘルプ・AIは設計段階で、Gate A/B/Cは未判定。
