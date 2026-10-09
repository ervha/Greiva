# 変更履歴

## 0.56.0 — 2026-10-09

- native12へDB差分受信を追加し、mixed Record/View history・候補/解決・元window/event/progressを原子保存する。server11と旧read cache/Page/queueを保持する。
- native strict scope/gdb1/型/max100/compact64MiBを検査し、saved cursorからだけ前進する。古いread/deltaで最新版・解決状態を戻さず、replayで欠損を補修しない。local候補へresolvedByを返す。
- native25＋旧101・実COMMIT前後SIGKILL2と全回帰/build/help版表示を検証する。差分HTTP/session/runtime・作成/更新queue・Table/List画面と全DB/native Gateは後続。

## 0.55.0 — 2026-10-09

- captured Source/AuthのRecord/View catalog/readを端末cacheへ接続する。header観測と内容保存を分け、型・対象・候補・raw進捗を検査する。
- 保存結果不明のkind/ID/request/responseを保持してnetworkなしで同応答を再確認する。置換/refresh/closeで遅着応答を除外し、native store closeでも自Source/content factoryを閉じる。
- 専用13条件・actual signed HTTP/native PG3と全回帰/build/help版表示を検証する。server11/native11保持。空readで既知候補を解決しない。delta/cursor・作成/更新queue・Table/List画面と全DB/native Gateは後続。

## 0.54.0 — 2026-10-09

- native11へView read replicaを追加し、Table/List設定・履歴・receipt・whole-field既知候補を原子保存する。server11と旧Record/Source/Page/pendingを保持する。
- nativeでも列/sort参照・Name必須・6型filter・深さ/件数を検査し、設定順を保持する。古いreplyの版保護・known/late baseline照合・bounded候補/headersを追加する。
- View22＋既存native79・実COMMIT前後SIGKILL2と全回帰/build/help版表示を検証する。初回共通validator参照のcompile Failと旧移行fixture5 Failを保持。DB delta/queue/runtime/画面と全DB/native Gateは後続。

## 0.53.0 — 2026-10-09

- native10へRecord read replicaを追加し、typed snapshot/履歴/receipt/既知三値候補を原子保存する。Name/Page本文は複製せずserver11を保持する。
- 同版divergence/Page変更を拒否し、late replyで最新版を戻さない。既知履歴と候補を照合し、後着baselineの矛盾もrollbackする。bounded候補/端末headersを追加する。
- 専用17条件・旧native62・実COMMIT前後SIGKILL2と全回帰/build/help版表示を検証する。対象IDまで変更していた初回fixture Failを保持。View/delta/queue/runtime/画面と全DB/native Gateは後続。

## 0.52.0 — 2026-10-09

- 認証済みworkspace/deviceを捕捉するSource catalog/read sessionとnative cache factoryを接続する。openだけでnetworkを開始せず、header観測を全DB同期へ扱わない。
- 入出力scope/6型を検証し、端末commit結果不明時に同じrequest/responseを保持してnetworkなしで再確認する。置換/Auth refresh/closeで遅着応答を除外する。
- 専用8条件・actual signed HTTP/native PG2と全回帰/build/help版表示を検証する。403時の既存connection閉鎖を期待し直した元fixture Failを保持。server11/native9、Source作成/Record/View queue・delta/UIと全DB/native Gateは後続。

## 0.51.0 — 2026-10-09

- 受信したSource定義をnative9の版履歴/read receipt/currentへ原子保存し、再起動・同一再送・古い応答・同版divergenceを処理する。server11と旧Page/title/Task/queueを保持する。
- strict native6型/Name/Select/Unicode/canonical scopeとIPC、受信済み端末SourceのUUID keyset一覧を追加する。読取でdefault entityを作らず、cache保存をACK/fullsyncへ扱わない。
- 専用13条件・旧native49・実COMMIT前後SIGKILL2と全回帰/build/help版表示を検証する。初回Unicode文字数の不一致Failを保持し修正。Record/View replica・queue・DB cursor/runtime、画面と全DB/native Gateは後続。

## 0.50.0 — 2026-10-09

- Source別のRecord/View変更journalと永続世代/head、認証付き差分取得APIを追加する。明示server10→11でcurrent/既知候補を検証seedし、writer/解決/ledgerと原子追記する。
- 取得をmax100とraw64MiBへ区切り、Page先行lock・観測head固定・history/ledger/lookahead照合・filtered空進捗を実装する。再送やunchangedでeventを増やさない。
- 専用PG23とCOMMIT前後の実SIGKILL4試行、全回帰/build/help版表示を検証する。初回19Pass/4Failを保持し、numeric順不具合とfixtureを修正。native8/既存API保持。端末DB同期・画面と全DB/native Gateは後続。

## 0.49.0 — 2026-10-09

- Record/Viewの増分受信に使うtyped snapshot/三値候補・解決状態、Source-bound型/参照検証、bounded raw進捗のportable契約を追加する。
- gdb1 cursorをworkspace/epoch/device/Source/journal世代へ署名し、exact BigInt・canonical envelope・未来位置・他purpose混用を検査する。
- 専用8条件と通常/既存PG/型/build/help版表示を検証する。server10/native8保持。actual journal/schema11/取得API、端末DB同期・画面と全DB/native Gateは後続。

## 0.48.0 — 2026-10-09

- Table/Listの小さいView header catalogを追加する。最大100件、現在name/layout/version、Source/device/head固定gdv1 HMAC、numeric順とfiltered raw進捗を実装する。詳細設定は単一View readへ分ける。
- 明示server9→10で旧Viewをstable ID seedし、新規位置をView/history/ledgerと原子保存する。再送・SQL失敗・COMMIT前後SIGKILLで位置の二重消費を防ぎ、native8と既存APIを保持する。
- 専用/全PG・通常回帰・型/build/help版表示を検証し、fixtureのschema名長とSource cursor指定の元Failを保持する。Record/View変更受信・端末DB同期・画面と全DB/native Gateは後続。

## 0.47.0 — 2026-10-09

- 基本DB Viewのactual Postgres create/update/read、authoritative版履歴、immutable operation結果と三値候補/新operation解決を追加する。Source/Record/Page本文は複製しない。
- 明示server8→9、候補の元request/result/history照合、bounded read、unknown/stale/invalid拒否履歴とremote no-op解決を実装する。既存API/native8を保持する。
- 実PG・署名HTTP・COMMIT前後SIGKILLと全回帰/build/help版表示を検証し、初回schema確認の型エラーを保持する。View一覧・端末DB同期・Table/List画面と全DB/native Gateは後続。

## 0.46.0 — 2026-10-09

- Table/List用View設定のtyped create/update intent、Source/schema/参照検証、exact基底と三値merge計画をportable Domainへ追加する。
- 列順/filter/sortsをwhole fieldとして保全し、active候補・現在remote・観測版を照合して解決を新intentへ準備する。別field変更後のfresh準備と古いintentを区別する。
- 専用11条件と既存回帰/build/help版表示を検証する。server8/native8保持。actual View保存・端末DB同期・画面と全DB/native Gateは後続。

## 0.45.0 — 2026-10-09

- 基本DB Recordの認証付きheader catalogを追加する。最大100件、Source/device/head固定HMAC cursor、numeric順とfiltered raw進捗を実装し、値/title/本文は一覧へ含めない。
- 明示server schema7→8で既存Recordのstable ID seedとSource単位headを追加する。新規位置はRecord/history/ledgerと原子保存し、exact再送・COMMIT前後SIGKILLで二重採番を防ぐ。native schema8は未変更。
- 型・専用/全Postgres・通常回帰・buildとhelpの版表示を検証する。Record変更受信/View保存/端末DB同期/Table/List画面と全DB/native Gateは後続。

## 0.44.0 — 2026-10-08

- 基本DB Recordの実Postgres create/update/read、Page binding、authoritative history、field merge/三値Conflictと新operation解決を追加する。Name/title/本文は既存Pageを参照する。
- 明示schema6→7とimmutable operation結果を原子保存し、unknown base/stale解決の拒否履歴、exact再送、bounded候補取得を実装する。明示null保存と候補観測版の照合を補強する。
- 実PG・署名HTTP・COMMIT前後のSIGKILLと全回帰を検証する。初回null試験とfixture型エラーを保持する。native schema8、既存Task/Pageを維持し、DB一覧/View/端末同期/画面は次工程。

## 0.43.0 — 2026-10-08

- 利用者回答Aに沿って基本DBの6型/Table/Listを初期範囲へ確定する。署名済みowner/device境界でDataSourceの作成・取得・bounded header一覧を実Postgresへ追加する。
- 明示schema5→6、commit順head、immutable create receipt、scope/head固定HMAC cursorを実装する。既存Page/Task同期とnative schema8を保持する。
- 専用PG12件、wire/cursor8件、signed HTTPと全回帰を検証する。初回fixture失敗とnumeric ORDER BY修正前の失敗を保持する。Record/View保存とDB画面は次工程。

## 0.42.0 — 2026-10-08

- 基本DBのtyped Record create/update intentとschema/binding/値の検証を追加する。別fieldを保持し、同fieldはbase/local/remoteの三値候補を返すpure merge planを実装する。
- active候補と現在版・値を照合し、解決を新intentとして準備する。remote選択のno-opと候補解決を分け、元履歴を消さない。DB durable writer/ledger/画面は後続とする。
- 新17/DB重点32/通常382/実PG94/root64/Auth12/workspace52、型/Rust/frontend/Windows buildを検証。[証拠](tests/evidence/basic-database-mutation-20261008/SUMMARY.md)。初回fixture型エラーと補強前の重点を保持。実adapter/Auth/native IMEと配備暗号化は別条件。

## 0.41.0 — 2026-10-08

- 基本DBのSource/Record/Propertyをportable Domainへ追加する。Name/Text/Number/Checkbox/Select/Dateの初期型、Page-bound Name、stable ID、strict scope/値の検証を実装する。
- Table/List共通のloaded-window query、型付きAND/OR filter・複数sort・未設定末尾、上限とreadonly結果を追加する。既存Taskをコピーせず、DB保存・同期・画面は後続とする。
- 新契約15/通常365/実PG94/root64/Auth12/workspace52、型/Rust/frontend/Windows buildを検証。[証拠](tests/evidence/basic-database-foundation-20261008/SUMMARY.md)。全DB対応、実Auth/native IMEと配備暗号化は別条件。

## 0.40.0 — 2026-10-08

- 個人workspace previewへ同梱ヘルプ9記事、端末内検索、カテゴリ・関連記事・アプリ版、保存/同期/接続エラーの案内を追加する。未ログイン・画面読込後のofflineでも読める。
- 記事を開いてもeditorと未保存フォームを保持し、閉じると入力focus/選択へ戻す。変換中の入口/Enter/Escapeを保護し、exact保存再確認や未送信内容を変更しない。
- 通常350/実PG94/検索契約4/workspace52/root64/Auth12、型/Rust/frontend/Windows buildを検証。[証拠](tests/evidence/workspace-help-20261008/SUMMARY.md)。Calendar/初回学習/診断export、実Auth/native IMEと配備暗号化は後続。

## 0.39.0 — 2026-10-08

- 個人workspace previewへPage情報の明示取得・続頁・保存再確認を追加する。本文未取得のcatalogと本文保存済みを分け、以前の取得結果と観測範囲の末尾を表示する。
- 受信中の未保存タイトル・変換・選択/focusを保持し、入力終了後にlocal表示を更新する。本文editorを作り直さず、別端末の解決を候補へ反映する。
- 通常346/実PG94/重点15/workspace40/root64/Auth12、型/Rust/frontend/Windows buildを検証。[証拠](tests/evidence/private-page-changes-screen-20261008/SUMMARY.md)。元画面失敗は別に保持。実Auth/native IMEと配備暗号化は未検証。

## 0.38.0 — 2026-10-08

- Pageタイトル増分をcaptured Auth transport・portable session・native runtimeへ接続する。一回最大100件を明示取得し、取得位置から再開する。
- 保存結果不明は同request/replyを通信なしで再確認し、新しい取得を保留する。保存後の読み出し失敗、ログイン更新/失効/接続置換を区別して入力を保持する。
- 通常341/実PG94/重点13＋署名HTTP二端末1、型/Rust/frontend/Windows buildを検証。[証拠](tests/evidence/private-page-changes-runtime-20261008/SUMMARY.md)。workspace画面は次工程。実Auth/native IMEと配備暗号化は未検証。

## 0.37.0 — 2026-10-08

- Pageタイトル増分をnative schema8へ原子保存し、catalog・候補/解決・取得位置・正確な再適用を接続する。本文未取得情報は独立して保持し、本文取得またはPage作成確認後に採用する。
- 未送信タイトルと保存済みwireを保持し、別端末の解決、破損window/lookahead、移行失敗、COMMIT前後の強制終了を検証する。
- 通常328/実PG93/重点49、型/Rust/frontend/Windows buildを検証。[証拠](tests/evidence/private-page-changes-store-20261008/SUMMARY.md)。認証付きsession/runtime/UIは次工程。実Auth/native IMEと配備暗号化は未検証。

## 0.36.0 — 2026-10-08

- Pageタイトル変更・競合と解決結果をworkspace別の原子journalへ記録し、認可付きの増分取得APIを追加する。同値の競合解決も通知し、再送/no-op/rejectionで変更記録を増やさない。
- 明示server schema4→5、既存title/解決候補のseed、commit順とHMAC cursor、最大100件の取得、deleted payload除外と空頁の進捗を接続する。端末schema7と本文/structured wireを保持する。
- 通常319/実PG93/専用10、型/Rust/frontend/Windows buildを検証。[証拠](tests/evidence/private-page-changes-server-20261008/SUMMARY.md)。端末受信/session/UIは次工程、実Auth/native IME・配備暗号化は未検証。

## 0.35.0 — 2026-10-08

- 個人workspace previewへタイトルの明示保存・取消・送信確認、三値候補の新operation解決、拒否履歴とbounded履歴を追加する。本文の同期状態とタイトルのpending/確認状態を分ける。
- 未保存/変換中/結果不明の入力と切替を保護し、同ID保存再確認・同wire再送を提供する。タイトル更新で本文editorをremountせず、端末一覧にも独立したタイトル未確認件数を保持する。
- Dockerで通常315/実PG83/workspace32/root64/Auth12、型/Rust/frontend/Windows cross-buildを確認。[証拠](tests/evidence/private-title-screen-20261008/SUMMARY.md)。実Auth/Windows invoke・IME/Android/native grantと配備暗号化は未検証。

## 0.34.0 — 2026-10-08

- Pageタイトルの保存済み変更を専用portable session・認証付きtransport・native runtimeで送信/再送する。応答喪失は同wire、保存結果不明は同operationIdで再確認する。
- bounded query/最大100件の明示送信、commit後の進捗、Auth取消/同Page置換、失効時pending保持を接続する。query完了を同期済みと扱わず、本文/structured wireとschemaを維持する。
- 通常313/実PG83/型/Rust/frontend/Windows buildを確認。[証拠](tests/evidence/private-title-runtime-20261008/SUMMARY.md)。title draft/解決画面、実Auth/Windows invoke・IMEと配備暗号化は後続。

## 0.33.0 — 2026-10-08

- Pageタイトルの端末保存とstrict IPCを追加。native schema7で版付き基底、offline intent、immutable wire/receiptと候補を原子的に保存し、古い応答でも新しい入力を保持する。
- 連続編集は自分の成功receiptだけで基底を進める。改名後の元Page creation再送の互換性を修正し、本文binary/Task/Relationを保持する。
- 全回帰、実PG/2 native SQLiteとsigned fixture HTTP、COMMIT前後8 SIGKILL、型/Rust/frontend/Windows buildを検証。[証拠](tests/evidence/private-title-store-20261008/SUMMARY.md)。title専用transport/runtime/画面、実Auth/Windows invoke・IMEと配備暗号化は後続。

番号は確認済みのリポジトリ開発チェックポイントを示す。[運用方針](docs/development/versioning.md)。将来機能の設計と実装は区別して記載する。

## 0.32.0 — 2026-10-08

- Pageタイトルの認証付きserver rename/readを追加。明示schema4、独立title版/履歴、同operation再送のimmutable結果、三値Conflictと新operation解決を実装する。
- 本文binary/head/creation requestを保持し、同時編集/nonce競合/期限切れを原子的に処理。readはbounded queryで、metadata deltaや同期完了の証明とはしない。
- 通常272/実PG82/型/Rust/frontend/Windows buildを確認。[証拠](tests/evidence/private-page-metadata-20261008/SUMMARY.md)。画面rename/端末title queue・replica、実Auth/native grant/IMEと配備暗号化は後続。



## 0.31.0 — 2026-10-08

- 専用workspace画面へTask/Relationのtyped CRUD、明示同期、三値Conflictと別operationによる解決、拒否された更新の表示を追加。
- draft/変換/結果不明を同期済みから区別し、入力・選択・focusを保護。両runtimeの世代取消とcleanup、未送信更新のre-login/restart復帰を接続する。
- 通常269/実PG70/専用画面18、型/Rust/frontend/通常Windows cross-buildを確認。[証拠](tests/evidence/private-structured-screen-20261008/SUMMARY.md)。実Auth/native IME/grant、Page metadata、本番入口と暗号化配備は後続。過去3checkpointの外部npm entry数の説明を監査JSONの315へ訂正（323は誤記、依存監査結果は不変）。

## 0.30.0 — 2026-10-08

- 個人workspaceのTask/Relation保存・同期runtimeを追加。captured Auth/native store、型付き原子保存、結果不明の同ID再確認、正確なwire再送、bounded pull、Conflict/rejectionの保持と同期表示を実装。
- Auth/stream置換時に旧runtimeを閉じる。strict immutable snapshotと安全なエラーを公開し、旧無認証経路を使用しない。
- 通常268/実PG70、型/Rust/frontend/通常Windows cross-buildを確認。[証拠](tests/evidence/private-structured-runtime-20261008/SUMMARY.md)。画面mount、実Auth/native IME/grant、暗号化配備は後続。

## 0.29.0 — 2026-10-08

- 専用workspace接続画面でログイン・端末/server Page一覧・作成・本文編集/同期を統合。Auth世代取消、open/cleanup直列化、未送信Page優先、結果不明createの同ID再確認、composition/未保存draftの切替保護を実装。
- darkタイトルの色と、ACK後の一覧pending件数を補正。Webのnative保存fallbackを禁止し、旧root/CSPを保持する。
- 通常258/実PG69/新画面10/既存画面64/Auth12、型/Rust/frontend/Windows cross-buildを確認。初回失敗と再確認を別記録。[証拠](tests/evidence/private-workspace-screen-20261008/SUMMARY.md)。実Auth/native grant/IME・rootへの昇格・Task/Relation scoped画面は後続。

## 0.28.0 — 2026-10-08

- bound workspaceの保存済みPage一覧と未ACK件数をnative IPC/adapterへ追加。未送信Pageを列挙し、UUID keyset/上限100/context/世代を検査、本文・wireを返さずqueueを維持する。
- 新unit2/実Rust SQLite3、通常251/型/frontend/Rust/通常Windows cross-buildがPass。[証拠](tests/evidence/local-page-catalog-20261008/SUMMARY.md)。画面/PG専用は未再実行、通常compositionと実native認証は後続。

## 0.27.0 — 2026-10-08

- アカウント別のnative端末IDを永続化。Auth検証後に同じIDを解決し、再ログインで保存済みPage・未送信更新の保存先を維持する。並行初回登録、COMMIT前後のkill、取消/遅着、missing metadataの安全な停止に対応。
- メール・プロフィール・Auth tokenを端末ID DBへ保存せず、失敗時のrandom ID fallbackを禁止。browser診断はmemory-onlyを継続。
- 通常246/実PG69/画面64/Auth画面12、型/frontend/Rust driver/通常Windows cross-buildを確認。[証拠](tests/evidence/private-device-20261008/SUMMARY.md)。通常画面composition、実native Auth/IME、offline権限、暗号化配備は未完成。

## 0.26.1 — 2026-10-07

- [ユーザー定義・個人情報・本文保護](docs/plan/ACCOUNT_PRIVACY_ENCRYPTION_SPEC.md)を追加。メール等はSupabase Authに保管しGreiva DB/ログへコピーしない。最終回答により本文は通信/DB/backupの暗号化、ログ除外、server復号許容とし、厳格なE2EE/本文復旧コードを必須にしない。
- 端末内検索と明示範囲のAI送信を維持。配備/鍵/権限/backupの保護、現同期との整合、受入・残る詳細を記録。
- 文書・相対リンク・差分を確認した設計のみのPATCH。保護設定・暗号機能の実装やアプリ試験は追加実施せず、manifest/lockfile/既存実行物はv0.26.0を保持。

## 0.26.0 — 2026-10-07

- 認証済workspaceのPage編集runtimeと再利用viewを追加。native保存→正確なwire送信、ACK喪失再送、commit後のremote反映、composition待機、Auth/Page切替の取消と未確認表示を接続する。
- 同期ボタンから本文へ戻る時のDOM選択を補正し、保存失敗後はコピー可能な本文を残して編集/送信を停止する。
- 通常234/実PG69/画面64/ログイン画面8/型/frontend/通常Windows debug cross-buildを確認。初回失敗と再確認、source/外部依存監査を保存。[証拠](tests/evidence/private-page-editor-20261007/SUMMARY.md)。通常アプリの認証/一覧/編集composition、metadata変更、実Auth/native IME/offline保持契約は未完成。

## 0.25.2 — 2026-10-06

- 機能モジュールおよび各種設定項目をユーザーがON/OFFトグルで切り替え可能にする統合設計仕様を追加。
- 統合仕様書 `docs/plan/FEATURE_SETTINGS_TOGGLE_SPEC.md`、判断記録 `docs/decisions/feature-settings-toggles.md` を作成。要件定義（`GREIVA_REQUIREMENTS.md`）および横断設計（`GREIVA_DESIGN_SPEC.md`）へ反映。
- モジュール無効化時も実データを保持する非破壊性原則、端末ローカル設定（SQLite `local_settings`）とワークスペース同期設定のスコープ分離、Material Design準拠のSwitch UI・アクセシビリティ要件を規定。
- コード変更を伴わない仕様書・計画文書の追加・更新のみ。

## 0.25.1 — 2026-10-05

- 編集画面・接続確認画面の配色を共通化。白・ニュートラルグレーと控えめな緑へ整理し、強い背景グラデーションを除去。接続確認画面のdark表示はチャコールへ変更。
- Dockerの画面操作・狭い画面の表示、型・通常試験・frontend・通常Windows cross-buildを検証。初回の画面試験失敗と単独再確認を記録し、実IME・実ユーザーAuthの証拠と区別する。[証拠](tests/evidence/neutral-palette-20261005/SUMMARY.md)。利用者の停止指示に従い、このcheckpointで停止。

## 0.25.0 — 2026-10-05

- 認証付きPage一覧queryとUUID順keyset/HMAC cursor、live metadata照合を追加。接続closeもnative handle cleanupを開始するよう修正。
- 新unit5/実PG3、通常224/PG69/browser2/型/frontend/Windows build、専用API/preview更新と既存登録・署名鍵保持を確認。全14判断を記録。normal UI/metadata変更/実Auth/nativeは未完成。

## 0.24.0 — 2026-10-05

- Native workspaceのfixed app-owned root/世代handle/commit gate、Tauri workspace_open/close/executeとstrict whitelistを追加。captured Auth generationのNativeWorkspaceStoreをPage/structured portへ接続し、旧DBと任意path/SQLを分離。
- 新native5＋port6、通常219/PG66/型/frontend/Windows build/Browser2、実registry/Rust SQLite＋signed HTTPを確認。全16判断を記録。local handleはAuth grantではなく、実Tauri invoke/通常UI/native Auth/offline保持契約/実ユーザーAuthは未完成。

## 0.23.0 — 2026-10-05

- captured Auth/workspace/Pageのportable HTTP sync sessionを追加。正確なprepared wire/Yjs構文/digest/応答bindingを照合し、保存先固定、refresh/close/同Page置換/遅着応答をguard。Browser標準WebCrypto/base64を使用。
- 新15 unit、通常208/PG66/型/frontend/Windows build、実Docker Chromium1、実HTTP＋Rust SQLiteの保存/remote/refresh/失効pendingを確認。全16判断を記録。通常UI/IPC/Hocuspocus/native Auth/実ユーザーAuth・実WebView2/Androidは未完成。

## 0.22.0 — 2026-10-05

- Workspace別Rust SQLiteへPage binary/正確な送信待ちwire/ACK receipt/remote diffの原子保存を追加。private local schema6へのbinding確認済みupgrade、queue順序/再送、corrupt拒否とpending保持に対応。旧PoC DBは保持。
- 新native13＋実PG1、通常193/PG66/型/frontend/Windows build、8条件SIGKILL、実HTTP＋2つのRust SQLiteのACK喪失/並行収束/失効pendingを確認。全16判断を記録。通常UI/IPC/captured Page session/Hocuspocus/実Auth/nativeは未完成、専用APIはv0.21/schema3を継続。

## 0.21.0 — 2026-10-05

- 個人workspace Page本文の保護HTTP保存基盤を実装。明示schema3、初期title、append-only V1 binary/digest/順序/再送、state-vector diff、未知XML保持と破損拒否に対応。認可と本文保存は同一transaction。
- 新3 unit＋実PG11、通常180/PG65/型/frontend/Windows build、COMMIT前後SIGKILL/実HTTP再起動、専用Compose schema3/metadata/鍵保持を検証。全22判断を記録。端末Page queue/通常UI/IPC/Hocuspocus継続認可/metadata編集・実Auth/nativeは未完成。

## 0.20.0 — 2026-10-05

- 個人workspace専用Task/Relation push/pullを実装。明示schema2 upgrade、immutable ledger/再送、三値Conflict/causal frame、typed Relation参照、workspace別commit順序、耐久署名鍵/cursorとwhole batch transactionに対応。
- 新2 unit＋実PG13、通常177/PG54/型/frontend/Windows buildを確認。実HTTP/2つのRust SQLite、COMMIT前後SIGKILL、専用API/preview更新とmetadata/鍵保持を検証。全20判断を記録。Page metadata/CRDT・通常UI/IPC・実Auth正常系/nativeは未完成。

## 0.19.0 — 2026-10-05

- 個人workspaceの認可と業務queryを同一PostgreSQL transactionへ固定。owner/device/resource lock、認証期限、active query/unfinished/rollback、device/access入口を追加し、bootstrapも待機後の期限切れを拒否。
- 新4 unit＋実PG11、通常175/専用PG41/型/frontend/通常Windows buildを確認。失効/削除の両順序、署名fixture HTTP、外部依存/source101と全15判断を記録。新structured stream/CRDT・実Auth/native IPCは未完成。

## 0.18.0 — 2026-10-05

- 独立browserログイン確認画面を追加。memory-only認証、明示workspace登録/refresh/local logout、password欄消去、期限/キャンセル/安全な状態表示、PC/mobile/dark/reduced motion、固定proxy/Compose previewに対応。通常PoC/CSP/旧DBは維持。
- browser native fetchのreceiver不備を修正。controller7/配置2/receiver1、通常171/PG30/専用画面8/通常画面59/実同期2/型/Windows buildがPass。単発Home試験は再確認3/全59 Passと未確定原因を併記。全21判断を記録。実ユーザー認証/OS credential/native IPC/new server stream/公開運用は未完成。

## 0.17.0 — 2026-10-05

- 保護APIの明示config/read-only schema readiness、専用起動/初期化コマンド、独立Docker構成を追加。設定/schema不備でlistenせず、失敗/終了時にlistenerとpoolを片付ける。旧PoC経路や既存DBは維持。
- 通常3＋実PG3を追加、通常161/PG30/型/Windows build、fresh Docker build/専用Compose起動を確認。全14判断を記録。実ユーザー認証/画面/native credential、新server stream/CRDT、公開運用は未完成。

## 0.16.0 — 2026-10-05

- strict bootstrapと認証済workspace接続を追加。auth generation/storeを固定し、refresh/close後の旧session復帰と遅着応答の適用を防ぐ。prepared wireを保持し、旧PoC経路へfallbackしない。
- 新10条件、通常158＋実PG27/型/通常Windows buildがPass。既存SQLite移行試験の有限lock待機を修正、両lock外部依存不変と全16判断を記録。通常UI/IPC、新server stream、実ユーザー認証は未完成。

## 0.15.0 — 2026-10-05

- Supabaseの明示配置設定とmemory-only client認証を追加。password/refresh/local logoutをRESTへ接続し、Greiva側の署名・issuer/subject/expiry検証後にidentityを公開する。account切替/遅着応答、token rotation、期限、秘密を含めないerrorを検証。
- client14＋実署名HTTP2＋実PG/native SQLite1を含む通常148＋実PG27/型/通常Windows buildを確認。実Supabase公開JWKSで不正署名拒否も確認した。通常UI/OS credential/新同期HTTPは未接続、実ユーザーの正常login/refreshは未確認。
- tracked試験用Cargo.lockの古いowner版を修正し、yoke-deriveだけを既存parent lockに揃えた。parent外部Cargo/npmは維持。全16判断・訂正と継続開発148判断の索引を記録。

## 0.14.0 — 2026-10-05

- 新規workspace専用Rust/SQLite storeを追加。account/workspace/client/epochを固定し、prepared wire、ACK receipt/pending、pull receipt/cursorを原子的に耐久保存する。旧PoC DBを自動移行・採用しない。
- 実SQLiteの12条件（commit前後のSIGKILL6を含む）、通常132＋専用PG26/型/通常Windows buildを確認。外部依存不変と全14判断を記録。通常UI/IPC、新workspace HTTP/CRDT、実ログイン/refreshは未接続。
- 提供済みSupabase公開設定で実HTTPSのJWKS/Auth settingsを確認し、設定手順を追加。ユーザーのログインやデータ送信はまだ行っていない。

## 0.13.0 — 2026-10-05

- 新wire用WorkspaceSyncSessionを追加。account/workspace/epoch/保存先を生成時に固定し、close後の遅着ACK/pull、誤所属、不正cursor進行を保存前に拒否。prepared wireの文字列を保ち、同時要求を防ぐ。
- 非同期race9条件を含む通常120＋専用PG26/型/通常Windows build、source86/外部npm315・Cargo不変を確認。全12判断と継続開発118判断の索引を記録。native prepared/receipt/cursor adapter、UI/実Auth/新HTTP streamは未接続。

## 0.12.0 — 2026-10-05

- 新規namespaceのprivate workspace/device/resource正本tables/viewsと、認証主体ごとの初期workspace登録を追加。owner uniqueとtransactionで並行/再試行を安定化し、端末IDの他account利用・削除/失効・不正schemaを拒否。
- 明示port注入時だけ認証付きHTTP bootstrapを提供。通常111＋専用PG26/型/通常Windows build、source85/外部npm315・Cargo不変を確認。全12判断を記録。旧PoC取り込み、本文/同期/CRDT、実Auth、native workspace storeは未完成。

## 0.11.0 — 2026-10-05

- 独立した認証付きNest/Fastify HTTP factoryを追加。session/workspace/Page accessを共通JWT/owner policyへ接続し、401/403/503と秘密を出さない応答を検証。旧PoC aliasesはmountしない。
- 通常108＋専用PG23/型/通常Windows buildがPass。HTTP3 doubleと実HTTP＋署名JWT＋PG1を分離、source83/外部npm315・Cargo不変を確認。全12判断を記録。実Auth/正本schema/bootstrap/write/同期/UI接続は未完了。

## 0.10.1 — 2026-10-05

- 日本向け利用規約/プライバシーポリシーの品質・公開ゲートと、エラー/性能だけの任意改善データ送信の製品設計を追加。初期OFF、端末ごとの明示同意・撤回、受信時の同意検証、禁止項目を定義。
- 利用者回答と全12判断、未確定の送信先/保持/運営条件を記録。文書リンク/整合を確認。収集は未実装、アプリ/実行物0.10.0は不変。

## 0.10.0 — 2026-10-05

- APIへ固定jose6.2.12のJWT署名/issuer/audience/期限/主体検証を追加。configured HTTPS JWKSだけを用い、不正sessionと検証不通を区別。workspace ownerをissuer＋subjectで照合し、異なる発行元の同subを拒否。
- Auth14/owner11を含む通常105＋専用PG22/型/通常Windows buildを確認。jose追加以外の外部lock不変。[証拠](tests/evidence/signed-session-20261005/SUMMARY.md)と[全判断](docs/decisions/signed-session-verification.md)。実Supabase login/refresh・production移行・旧router接続は未完成。

## 0.9.0 — 2026-10-05

- protocol/workspaceにversion付きscope/epochとACK identity検査を追加。server専用cursorをworkspace/stream/epoch/orderのHMACへ束縛し、改変・別scope・未来位置を拒否。
- 新wire8/cursor8、通常90/型/通常Windows buildを確認。bigint最大値をexactに検査し、旧wire/routes/DB/外部依存を保持。[証拠](tests/evidence/workspace-sync-boundary-20261005/SUMMARY.md)と[全判断](docs/decisions/workspace-sync-boundary.md)。production配線/移行/実Authは未完成。

## 0.8.0 — 2026-10-05

- 個人workspace所有者とtyped resource/Page文書名の読取認可を追加。不明・別workspace・削除・型違い・aliasを拒否し、非同期照合の検証済targetsを不変で返す。
- PostgreSQLのread-only snapshot adapterを追加。10境界条件/通常74＋専用PG21/型/通常Windows buildを確認、外部依存不変。[証拠](tests/evidence/private-access-20261005/SUMMARY.md)と[全判断](docs/decisions/private-workspace-access.md)。実JWT/provider・正本view/migration・HTTP/CRDTへの配線は未完成。

## 0.7.0 — 2026-10-05

- Task/Relationのintent規則をDomainへ分離し、既存protocol export/wireを保持。Applicationへ認可、入力/context/storeの固定、durable保存待機と結果不明commitの同一ID復旧契約を追加。
- 新境界9条件を含む64 unit/integration、専用PG20、全59 E2E、実同期/Conflict2、型、通常Windows buildを確認。所有版0.7.0整合、外部npm/Cargo依存不変。[証拠](tests/evidence/production-foundation-20261005/SUMMARY.md)と[全判断](docs/decisions/production-command-foundation.md)。本番Auth/SQLite adapter接続、旧DB移行、初期製品全体は未完成。

## 0.6.27 — 2026-10-05

- 利用者の機能優先委任と個人利用/自端末同期先行の回答を反映。Windows/AndroidのPage/Task/Relation＋基本DB Table/Listから進める実装順を記録。
- architecture、技術の現状、データ、sync、CRDT、Editor、認可の本番設計候補とPoCとの差を整理。native Rust Repository/npm継続/操作ID責務を判断記録付きで要件v0.8へ反映。アプリ・wire・schema変更や本番接続は未実施。

## 0.6.26 — 2026-10-05

- 通常0.6.25 sourceから隔離Windows層別診断を再現できるbuild/seed/audit toolを整備。4起動、1,001→1,005更新、1,000段落/250 pending Task、104文字貼り付け＋実キーabcと全保存/再起動を照合。
- 104文字の入力方式をCtrl+vと確認し、連続キー/実IME性能とは区別。内部rAF/IPCと通常release2秒条件の残事項、全自律判断を記録。アプリsource/manifest/lock/通常exeは0.6.25のまま。

## 0.6.25 — 2026-10-05

- Page保存/通信報告でEditorとTask一覧の不要な再描画を省き、内部状態/タイトル/接続変更の反映を維持。大量fixtureの対照診断を再実行可能にした。
- 回帰で再現した移動キー後の選択反映待ちと、ハンドル列のdrag target受入を修正。composition guardを含む55 unit/integration、全59 E2E、実同期/Conflict2を確認。
- Windows実Rustの4停止境界と通常releaseの1,000段落/250 Task、選択置換/Undo/Redo、保存/再起動、7更新/独立peer照合を記録。初回失敗とWAL seed訂正を保持し、最新版実IME/物理drag/性能/実OS不足と分けた。
- 今後の開発計画と全自律判断を記録。v0.6.24のACK起点表記を原input event測定へ訂正。外部依存/保存方式/同期契約は不変。

## 0.6.24 — 2026-10-05

- 入力・選択更新時の移動ボタン判定から、使わない2個の移動transactionと全文offset走査を除去（PATCH）。実際のmove／Undo／composition guardは維持。[判断全件・試験](docs/decisions/step-8-toolbar-availability.md)。
- 型、50 unit/integration（実DB20 skip）、全59 E2E、通常frontend／Windows release buildがPass。production-bundle1,000 block復元・104文字実入力の全文／clock／保存履歴一致、Windows native move／Undo／実キーxと保存4更新を代行確認。[原証拠](tests/evidence/toolbar-availability-20261005/SUMMARY.md)。app所有版0.6.24へ整合、外部依存不変。native日本語IME・性能SLOの新合格にはしない。Computer Use解除、既存試験データを操作せず、新試験app終了。

## 0.6.23 — 2026-10-04

- 利用者の連続Microsoft IME入力の問題なし報告を保存監査で照合。SQLite30→76更新、全1,000段落・他999段落不変、独立peer全文／clock一致。24 UTF-16単位の短い確認で、native性能SLOへ一般化しない。[証拠](tests/evidence/poc-gate-review-20261004/SUMMARY.md)。
- 利用者の自律判断委任に基づきGate A Pass（受入例外あり）／B Conditional／C Pass、技術基盤の条件付き採用を確定。PoC Step 9の判定成果物を完成し、未検証OS・性能等を[全判断と後続事項](docs/decisions/poc-autonomous-review.md)へ集約。文書／検証PATCH、製品・manifest・exeは0.6.20。新しい手操作待ちなし、Computer Use解除、Page保持。

## 0.6.22 — 2026-10-04

- 利用者のMicrosoft IME切替確認後、Codexが通常Windows 0.6.20／1,000 blockの通常変換と同一段落への遠隔3更新中の変換を実キーで代行。欠落・二重入力・composition中断を観測せず、SQLite30更新・全1,000段落・独立peer全文／clock一致、他998段落不変。[原画面・ACK・監査](tests/evidence/windows-ms-ime-20261004/SUMMARY.md)。
- 自動native dragの追加1試行は移動なし、保存更新数30のまま。0.6.19の実物理drag受入証拠と区別。文書／検証PATCHで製品版は0.6.20、Computer Use解除。連続入力の体感だけを最小手操作依頼として残し、正式Gateは未確定。

## 0.6.21 — 2026-10-04

- 通常Windows 0.6.20の隔離1,000段落で、Codexが実キー `n,i,h,o,n,g,o`→Space→Enterによる日本語変換を代行。SQLite9更新・全1,000段落・独立peer全文／clock一致、他999段落と旧WIN619-DRAG全13更新の不変を照合。[原証拠・準備修正・再開手順](tests/evidence/windows-ime-preparation-20261004/SUMMARY.md)。
- 文書／検証checkpoint（PATCH）で製品manifest／exeは0.6.20。providerがMicrosoft IMEかは未同定のため、入力方式だけの確認待ち。連続入力・遠隔composition・正式Gateの合格にはしない。試験fixtureとpeerを準備し、両Greivaを開いたまま、Computer Useは解除。

## 0.6.20 — 2026-10-04

- 1,000 blockでdragの移動先を変えるたびに全行へtransformを生成していた処理を、移動する行だけへ変更（PATCH）。元の位置へ戻る動き、選択／Undo、ハンドル列drop、reduced motionは維持。[原比較と回帰](tests/evidence/block-drag-large-20261004/SUMMARY.md)。Dockerの単回比較で50ms超のLong Taskは5回から0回へ。Windows FPSや実IMEの結果には換算しない。
- 全1,000行のdrag／Undo保持・独立peer全文／state vector一致のE2Eを追加。全59 E2E、型、通常48 unit/integration、通常frontend／Windows release buildがPass。app所有版を整合し、外部依存不変。既存のWindows試験Pageは編集せず保持、native実IME・正式Gateは残す。

## 0.6.19 — 2026-10-04

- Block dragを線中心から、持った行の内容・ハンドル・軽い影と、周りが場所を空ける表示へ改善（PATCH）。追加指定に合わせ横位置・幅を固定し、上下に動く行へ改訂。表示用変更を本文・Undo・保存へ混ぜず、遠隔変更やcomposition開始で安全に中断する。[動き・範囲・原結果](tests/evidence/block-drag-preview-20261004/SUMMARY.md)。
- ハンドル列だけでまっすぐ移動できない問題を再現して修正。本文側への横移動を要求せず、行の外へのdropは取消。列／幅・選択保持、複数行、Undo/Redo、実peer変更、reduced motion、ハンドル列の4 E2Eを追加。全58 E2E、通常48 unit/integration、型、通常frontend／Windows release buildがPass。実DB専用20件は今回skip。app所有版を整合、外部依存不変。
- 最初のカード候補の物理drag／Undoを利用者が確認し、online backupで3更新を照合。最終修正版も利用者が同じ列での操作・見た目を確認。4→13更新は空段落を含む元4 blockの順序変更のみで、全内容と旧履歴保持、余分な段落なし。最終H2→H3は最初のseedと一致し、試験直前H3→H2とは異なることを記録。Pageは開いたまま、Computer Use解除。最新実IME・正式Gateは残す。
- Material You／Liquid Glassを参考に、blockの丸みと淡い背景、共通controlの角・色、短いhover／開閉と小さいmenuの透明感を実装。[共通品質基準](docs/development/ui-quality.md)・横断設計v0.8にも反映。本文は不透明、reduced motion／transparency・blur非対応のfallbackあり。OS固有materialやPoC範囲の拡大は含めない。

## 0.6.18 — 2026-10-04

- 通常0.6.17の物理mouse drag／Ctrl+Z成功を利用者が報告し、保存済み画面・停止SQLiteで移動と復元を確認。8→12更新、最後の本文は元と一致、別Page不変。最初の移動履歴には余分な空段落があり、後の移動は正しい構造。原因未確認を残し、単純に全操作合格とはしない。[監査](tests/evidence/windows-native-profile-20261004/manual-drag-verification.json)。
- Windows0.6.17由来の隔離診断で1,000 block復元の4起動を層別測定。Page query2.7–3.7ms、Yjs22.8–24.5ms、初回Editor render→effect165.7–190msを記録。実ASCIIキー3文字の保存・2回再起動復元、999段落とstructured table不変を照合。[診断範囲と原記録](tests/evidence/windows-native-profile-20261004/SUMMARY.md)。通常releaseのSLO・実日本語IME・連続入力の合格にはしない。
- 実機可用性を再確認し、iOS Simulator不可、Pixel_10 emulator起動失敗、Pixel 7のADB未接続を記録。Computer Useは確認後に解除。文書・検証checkpoint（PATCH）で、製品manifestと通常実行物は0.6.17のまま。次のdrag表示改善は別checkpointで扱う。

## 0.6.17 — 2026-10-04

- 過去のスキップ・未実施を[現在の対応表](docs/plan/SKIPPED_VALIDATION_REVIEW.md)へ整理。通常runのPostgreSQL skip20件を別実行の成功とテスト名で照合し、現在のDockerでも20件すべて再Pass、skip／Fail 0。Pixel 7のADB未接続、native全crash中間点・性能内訳・実OS不足を残す。
- WindowsのHTML5 drag用にmain windowのnative file-drop handlerを無効化（PATCH）。app所有manifest／lockfileを0.6.17へ整合し、外部npm314 entry／Cargo依存不変、通常frontendとWindows release build、関連8 E2Eを確認。frontend／Yjs／composition処理は変更しない。[設定・診断・範囲](tests/evidence/windows-native-editor-20261003/SUMMARY.md)。
- 通常Windows 0.6.17の同じPageで必須11種類のblock、Markdown4条件、Slash、リストの入れ子／解除、Todoチェック、入れ子Toggleのkeyboard／pointer開閉、全block削除とUndo/Redo、Mentionのkeyboard移動を確認。停止SQLiteの59更新、全文・構造・clockと独立peerが一致し、元2 Pageは不変。最初の4種類の保存・再起動復元も確認。
- native dragは自動操作でdropが届かず未確認。独立した単純HTML5対照でもdropが届かないため、製品原因を断定せず物理mouse確認を残す。実IME操作可否の試行はASCII入力に留まり、最新Microsoft IMEをPassへ昇格しない。通常artifactと隔離診断artifactを区別し、Gate資料は承認前の案。利用者が応答不能なため、代行作業を終えた後の手操作・判断待ちを記録する。

## 0.6.16 — 2026-10-03

- Windows通常release 0.6.11の性能・大量データ証拠を追加（PATCH）。1,000 block上の111文字保存、1,000 structured operationのnative ACK、250 Taskの最終状態、1009件の台帳／receipt、独立Rust／Y.Doc peerとの一致を確認。[原観測・監査](tests/evidence/windows-native-release-20261003/SUMMARY.md)。製品／manifestは0.6.11のまま。
- 空SQLite・warm WebViewのUI観測上限2,662.7ms、1,000 block復元の上限3,567.4ms、1,000操作のserver応答間75,973msを記録。helper／起動／UIAを含む上限と、cold paint・per-key・実IME・native SLOを区別する。fixture／observer／監査準備の失敗も記録。復元2秒の目安は未達の観測として、内訳計測を次の課題に残す。最終Gateは未判定。

## 0.6.15 — 2026-10-03

- Pixel 7 / Android 17 / Chrome 154の実機互換性証拠を追加（PATCH）。必須blockなど自動26項目、接続停止／再接続／交互編集／connected reloadの4項目、実Gboard E/Fの日本語変換を確認。[原結果と監査](tests/evidence/android-pixel7-20261003/SUMMARY.md)。Fの実composition中に同じ段落へ遠隔3更新を送り、最終本文とstate vectorが独立peerと一致。候補表示は利用者の問題なし報告と区別して記録。
- AndroidはP2のブラウザ検証で、SQLite・native Task保存やoffline終了復旧を主張しない。compositionendのisTrusted=falseを原値のまま残す。配信frontendと確認済みrelease buildのhash一致・hook無効を照合。製品／manifestは0.6.11のまま。Windows release性能・macOS P1／iOS P2・最終Gateは継続する。

## 0.6.14 — 2026-10-03

- Windows native Conflict検証の記録（PATCH）。通常0.6.11で同fieldのbase/local/remote保持、別fieldの状態／期限merge、未保存draft保持、local pointer採用とremote Tab／Enter採用を確認。未解決Conflictを保持した強制終了・connected再起動も検証。[実操作と独立照合](tests/evidence/windows-native-conflict-20261003/SUMMARY.md)。
- native7操作／receipt9件、台帳9件、resolved Conflict2件、独立Rust peerのTask／Relation／Conflict／cursor一致を確認。元Page2件の全更新・XML・clockと前回DB一式を保持。製品・manifest・候補は0.6.11のまま。実IME・offline再起動・release性能・Androidの合格へ流用しない。
- 利用者指定により、停止指示・完了・回答が必要な問題での待機まで開発を継続。区切りのcommit後も残る実機検証へ進む。

## 0.6.13 — 2026-10-03

- Windows nativeの通信途中終了・復旧証拠を追加（PATCH）。製品・候補は0.6.11を維持。通常APIでRelationをcommit後、ACK応答を試験proxyで保留し、通常Tauriを強制終了。サービス停止中の再起動で本文・pending1件を保持し、再接続後のpullでACKとcursorを回復。[実際の境界・証拠](tests/evidence/windows-native-network-20261003/SUMMARY.md)。
- 停止SQLiteをread-onlyで監査し、実Rust load・新規structured peer・Pageごとの独立Hocuspocus peer・PostgreSQL台帳を照合。WIN611-OPSの108更新、AUTO611-BLOCKSの22更新、XML・clock不変、Task／Relation2件acknowledged・receipt2件・cursor=head、台帳2件を確認。元DB一式のhash不変。native duplicate POSTやtransaction途中停止を主張しない。
- Computer UseはUI検証後に解除。Conflict UI・残る全操作・release性能・Android実OSと最終Gateは未完了。製品変更がないため既存Docker回帰の再実行・新しいアプリbuildは行わない。

## 0.6.12 — 2026-10-03

- Windows native検証記録の更新（PATCH）。製品・候補は0.6.11を維持。利用者の実Microsoft IME通常変換、選択置換／Undo/Redo、見出し1・Todo・入れ子Toggleの問題なし回答と停止後保存データを照合。
- CodexがWindows UIでSlash／箇条書き／番号付きリスト／引用／Code／Divider／Mention、ブロック移動とUndo/Redo、Task／Page→Task Relation保存を確認。保存完了後に通常Tauriを強制終了し、本文・structured pending2件の復元をnative画面と実Rust repositoryで確認。[証拠と範囲](tests/evidence/windows-native-ops-20261003/SUMMARY.md)。元Pageの108更新・XML・clock不変、IME69-A/Bも保持。
- 利用者の「代行可能な試験は全部そちらで」指示を採用。今後の自動化可能なUI／保存／復旧試験はCodexが実施する。今回のnative crashはoffline保存完了後の1境界であり、通信途中・ACK・peer収束・release性能・Androidと最終Gateは未完了。

## 0.6.11 — 2026-10-03

- 既存structured同期の性能改善（PATCH）: 通常ACK後の表示snapshotを100ms間隔へ抑制。ACKのdurable保存順序、local変更・pull・Conflict/rejected・最終確認の即時反映を維持。1,000操作のsnapshotは1,024→300回、応答は約375→110MB。観測同期時間71.78→44.94秒は長いpullとhost負荷の影響も含むため、全差を改善の効果とはしない。
- 実SQLiteの追加3試験、通常48件／別PostgreSQL20件、全54 E2E、Conflict UI2件、統合crash4境界、性能4ケースを確認。原full runの型検査Failを保持し、試験fixtureの型guard修正後の型検査と3試験Passを別記。135ソース・外部lock不変を照合し、通常0.6.11 Windows候補をDockerでbuild。[証拠](tests/evidence/step-8-structured-progress-20261003/SUMMARY.md)。新候補のnative操作・性能はNot run。
- 通常0.6.9のA/Bと診断0.6.5 textareaのC/Dを利用者が実キーで比較。移動なしは本文保持、移動ありは `al ` 欠落。停止後SQLiteコピーとnativeイベントで照合。[原証拠](tests/evidence/windows-ime-reconfirm-20261003/SUMMARY.md)。他アプリ複数でも発生したとの利用者報告を受け、この環境のMicrosoft再変換問題を[受入例外](docs/decisions/step-8-ms-ime-exception.md)としてGreiva修正待ちから外す。観測Failは保持し、他の未実施条件・最終Gateは継続する。

## 0.6.10 — 2026-10-03

- 検証準備の更新（PATCH）: [PoCの8受入条件と証拠・残課題の対応表](docs/plan/POC_VALIDATION_MATRIX.md)を追加。参照セッションの判断を引き継いで再開し、Microsoft再変換Fail、native未実施、最終Gate未判定を保持する。
- 保存済み0.6.9証拠を監査するツールを追加。個々のPlaywright／Vitest結果、通常skip20件の実PostgreSQL別run、原12検査の11 Pass／1 Failと別feature再検査、132 baselineソース、任意のWindows候補hashを照合。CRLF差・内容差・新規ソース追加を区別し、監査成功をアプリ再試験やGate Passにしない。Dockerで監査試験9件と実証拠監査Pass。[証拠](tests/evidence/poc-audit-20261003/SUMMARY.md)。
- インストール済みWindows／WebView2／IME部品情報を読み取りで収集し、通常製品・比較入力欄での実機再開条件を固定。利用者申告のAndroid対象はPixel 7／Android 17 QPR1。実OS・Chrome版・接続経路は未確認、端末試験はNot run。
- 文書・検証環境のみ。製品manifest／lockfile／候補exeは0.6.9を維持し、今回native起動・IME操作・全E2Eを再実行していない。

## 0.6.9 — 2026-10-03

- Editorの互換修正（PATCH）: 構造が同じ遠隔文字編集で、見出し／Toggleの選択が古い絶対位置へ戻る不備を限定修正。Yjs相対位置を使用し、範囲・方向を維持する。構造変更・local Undo/Redo・composition中には介入せず、Microsoft IME再変換の未解決問題とは分ける。
- 4種類のblock×前後両方向の選択、blur中の遠隔挿入／削除、復帰後の置換とlocal Undo/Redo、4回のoffline編集／再接続と独立client復元の9 E2Eを追加。独立run9件・全回帰54件、通常45件・実PostgreSQL別run20件・競合UI2件・統合crash4境界・性能4ケースを確認。通常機能検査の初回offline cache不足Failと、Docker内の固定依存取得後のoffline再検査Passを併記。
- 132ソースとDockerのbyte一致・外部lock entry不変を確認し、アプリ所有manifest／lockの版を0.6.9へ整合。Windows候補はDockerで作成し、実機操作・IMEの合否をbuild成功と分ける。1,000 block復元最大1.77秒、入力→commit ACK p95 356.7ms、100回Yjs再接続約1.10秒、1,000 Task操作の同期約96.52秒はDocker観測であり、Windows性能の保証ではない。
- 手操作待ちの項目、複数の解決案・制約・推奨順序と再開手順を記録。利用者はWindows／Androidを利用可能と回答。最新の停止依頼に従い、このcheckpointのcommit／pushまでで停止。全Step 8受入条件・Gate A/B/C最終判定は未完了。

## 0.6.8 — 2026-10-02

- Step 8の再変換診断・比較証拠を追加（PATCH）。製品コード・app manifest／lockfileは0.6.5を維持。Dockerで診断専用の3候補をbuildし、Windows native結果と分けて記録する。
- 選択後のウィンドウ移動で日本語3文字の再変換対象が直前の `al ` を含む6文字へ広がるtrusted input記録を取得。素のtextarea／contenteditableでも同じ欠落を観測し、移動なしの手動比較では本文を保持した。遠隔更新なしでも発生し、OS／IME／WebView2内の根本原因は未確定。
- keydown実験はキー未受領で処理に到達せず、focus復帰時の選択方向更新は実行されたが防止できなかった。製品へ採用せず、実PageStore／Yjs順序再生で保存された欠落と後の手動修復を区別した。[結果・限界・証拠](tests/evidence/step-8-ime-focus-20261002/SUMMARY.md)。検証記録の区切りまでとし、Step 9へ進まない。

## 0.6.7 — 2026-10-02

- Step 8再変換の切り分け・証拠の文書更新（PATCH）。アプリ／manifest／lockfile・実行物は0.6.5を維持し、製品修正や依存変更は含めない。
- 前回の欠落は候補確定前、利用者の再変換開始後の最初の観測ですでに存在したと補足。手操作の誤りを除外できず、Return確定を原因と断定しない。
- 新規fixtureで遠隔更新なしのMicrosoft再変換は本文保持。一方、実Microsoft入力＋遠隔6更新後の別Pageでは、利用者が変換キーだけを一度押したと回答し、同じ `al ` 欠落がSQLite／fresh peerへ保存された。二回目のnative候補操作は完走記録がなく、終了原因も未観測。
- 実Rust PageStoreとYjsの順序再生で、今回のupdate 19／前回のupdate 95が直前3文字と日本語3文字を一緒に削除したことを確認。入力層の原因は未特定・未修正。[結果・限界・原証拠](tests/evidence/step-8-ime-recheck-20261002/SUMMARY.md)。この検証記録の区切りで停止し、Step 9の最終Gate判定・技術選定には進まない。

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
