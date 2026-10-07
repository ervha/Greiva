# Greiva 開発計画・状況・セットアップ

最新v0.30.0：[Task・Relation runtime](../development/PRIVATE_STRUCTURED_RUNTIME.md)をcaptured Auth/native storeへ接続。型付き原子保存、結果不明の同ID再試行、bounded explicit同期、三値Conflict/rejection保持、世代/stream置換取消を実装。通常268/実PG70/型/Rust/frontend/Windows cross-buildを確認。[証拠](../../tests/evidence/private-structured-runtime-20261008/SUMMARY.md)。新画面mountは次工程で、実Auth/native grant/IMEと本番配備は別条件。追加手操作を求めずTask/Relation画面へ続行する。

最新v0.29.0：[個人workspace接続画面](../development/PRIVATE_WORKSPACE_SCREEN.md)を専用entryへ追加。login/端末・server一覧/create/open/editor/sync、Auth取消、結果不明createの同ID再確認、pagination外local優先、composition/failed draftのnavigation保護を接続。通常258/実PG69/新画面10/既存画面64/Auth12/型/Rust/frontend/Windows cross-buildを確認。[証拠・初回失敗/画像修正](../../tests/evidence/private-workspace-screen-20261008/SUMMARY.md)。旧root/CSPを保持し、実native認証/IMEや本番既定入口への昇格は別工程。次はTask/Relationのworkspace接続基盤へ進む。

最新v0.28.0：[端末Page一覧](../development/LOCAL_PAGE_CATALOG.md)を追加。未送信の新規Pageもmetadata/pending件数として列挙できる。strict native command、UUID keyset、captured context/世代を検査し、一覧読取でqueueを消費しない。通常251/型/Rust/frontend/Windows cross-buildがPass。[証拠](../../tests/evidence/local-page-catalog-20261008/SUMMARY.md)。通常画面compositionへ続行し、実Auth/native IME/offline権限は別工程。

最新v0.27.0：[アカウント別native端末ID](../development/PRIVATE_DEVICE_IDENTITY.md)を実装。同じissuer＋subjectで同IDを再利用し、再ログイン後の保存済みPage・pending exact wire再openを実HTTP/PG/Rust SQLiteで確認した。通常246/実PG69/画面64/Auth画面12、型/frontend/driver/通常Windows cross-buildがPass。[全16判断](../decisions/private-device-identity.md)、[証拠](../../tests/evidence/private-device-20261008/SUMMARY.md)。source221一致、外部依存不変。device metadata欠損時は空の代替DBへ切り替えず停止する。メール/tokenをこのDBへ保存しない。通常画面composition、native Auth/grant/offline権限、旧private root取り込み、実Windows/IMEと暗号化配備は後続。次は通常アプリの接続compositionとnative認証契約へ進む。

最新v0.26.1：利用者の最終回答を[ユーザー定義・個人情報・暗号化仕様](ACCOUNT_PRIVACY_ENCRYPTION_SPEC.md)と[全8判断](../decisions/account-privacy-encryption.md)に反映。メールはSupabase Authだけに保管しGreiva DB/ログへコピーしない。本文は通信/DB/backupの暗号化とログ除外、server復号を許容。E2EE/本文復旧コードは必須にせず、端末内検索/明示範囲AI送信を維持する。文書/相対リンク/差分を確認した設計のみのPATCHで、配備保護や鍵管理の実装・アプリ試験を追加実行していない。既存実行物はv0.26.0。通常アプリの接続composition等の既存残作業も完了扱いにしない。

最新v0.26.0：開発を再開し、Page本文の編集runtime/viewを認証済connection・native保存・HTTP同期へ接続した。[契約](../development/PRIVATE_PAGE_EDITOR.md)、[全18判断](../decisions/private-page-editor.md)、[証拠・初回失敗](../../tests/evidence/private-page-editor-20261007/SUMMARY.md)。通常234/実PG69/画面64/ログイン画面8、型/frontend/通常Windows debug cross-buildがPass。source226がホストとDockerで一致し、外部依存は不変。保存失敗時の未保存本文保持、composition待機、Auth/Page切替の取消、ボタンから本文への選択復帰を確認。通常アプリの認証/一覧/編集composition、metadata変更、native Auth/offline保持契約、実IME検証は残る。以下のv0.25.1停止は当時の記録で、今回の再開指示により解除済み。次は通常アプリの接続compositionへ進む。

最新v0.25.2：利用者指示に基づき、機能モジュールおよび各種設定項目をユーザーがON/OFFトグルで切り替え可能にする設計仕様書を追加。[仕様設計](FEATURE_SETTINGS_TOGGLE_SPEC.md)、[判断記録](../decisions/feature-settings-toggles.md)。非破壊性原則（OFFにしても実データを保持）、端末ローカル設定（SQLite local_settings）とワークスペース同期設定のスコープ分離、Material Design準拠のSwitch UI・アクセシビリティ要件を規定。コード変更を伴わない仕様書・計画文書の追加・更新のみ。

最新v0.25.1：利用者要望のシンプルな配色へ変更。編集・接続確認画面を白/ニュートラルグレー/控えめな緑で統一し、接続確認のdark表示はチャコールへ整理。[判断記録](../decisions/neutral-palette.md)、[証拠・初回失敗](../../tests/evidence/neutral-palette-20261005/SUMMARY.md)。型/通常224/frontend/通常Windows cross-build、source117と外部依存不変、Docker画面操作・360pxの表示を確認。専用preview0.25.1、既存API0.25.0を継続。実IME/実Supabase Authの追加検証ではない。**「切りのいいところで止めて」に従い、このcheckpointで停止。次回はPage編集接続から再開し、metadata変更/通常UI/native Auth/offline保持契約の残事項を確認する。**

最新v0.25.0：認証付きPage一覧query、bounded keyset/HMAC workspace・epoch/metadata照合、connection.closeでnative cleanup開始を追加。[全14判断](../decisions/private-page-catalog.md)、[証拠](../../tests/evidence/page-catalog-20261005/SUMMARY.md)。通常224/PG69/browser2/型/frontend/Windows source116、専用API/preview v0.25/schema3を確認。一覧はsnapshot/delta同期ではなくnormal UI/metadata変更/native Authは未完成。次は利用者要望のシンプルな配色を独立して改善する。

最新v0.24.0：app-owned workspace DB root/世代handleとTauri commandを追加し、captured Auth generationのNativeWorkspaceStoreをPage/structured portへ接続。[全16判断](../decisions/native-workspace-ipc.md)、[証拠](../../tests/evidence/workspace-ipc-20261005/SUMMARY.md)。新11、通常219/PG66/型/frontend/Windows build/Browser2を検証。local handleはAuth grantではなく、通常UI/実Tauri invoke/native Auth/offline保持契約は未完成。専用APIはv0.21/schema3を保持、追加操作を求めずPage metadata/一覧へ進む。

最新v0.23.0：captured Auth/workspace/Pageのportable sessionを追加。prepared wire/Yjs構文/digest/応答bindingを検査し、保存先固定、refresh/close/同Page置換/遅着応答をguardする。[全16判断](../decisions/private-page-session.md)、[証拠](../../tests/evidence/private-page-session-20261005/SUMMARY.md)。追加15 unit、通常208/実PG66、型/frontend/Windows build、実browser WebCrypto/base64と実HTTP＋Rust SQLiteを検証。通常UI/IPC/Hocuspocus/実Auth/nativeは未完成、追加操作を求めずnative IPC接続へ進む。

最新v0.22.0：workspace別Rust SQLiteへPage binary/送信待ち/正確なwire/ACK receipt/remote diffの原子保存を追加。private local schema6はbinding確認後に5からupgradeし、structured dataを保持。[全16判断](../decisions/private-page-durable-store.md)、[証拠](../../tests/evidence/private-page-store-20261005/SUMMARY.md)。通常193/実PG66、型/frontend/Windows build、8条件SIGKILL/実HTTP＋2つのSQLiteを検証。専用APIはv0.21/schema3を保持。captured client session/通常UI・IPC/Hocuspocus/実Auth/nativeは未完成で、追加操作を求めず続ける。

最新v0.21.0：認証付きPage本文のbinary保存基盤を実装。明示schema3、初期title、append-only journal/digest/再送、state-vector diff、破損拒否/失効/期限rollback/COMMIT前後SIGKILLを検証。[全22判断](../decisions/private-page-binary.md)、[証拠](../../tests/evidence/private-page-20261005/SUMMARY.md)。通常180/実PG65、型/frontend/Windows cross-buildを確認。通常UI/IPC/端末Page queue、metadata rename/delete/Conflict、Hocuspocus継続認可・実Auth/nativeは未完成。追加操作を求めず端末耐久化/client sessionへ進む。

2026-10-05、checkpoint **v0.20.0**。[個人workspace structured同期](../../tests/evidence/private-stream-20261005/SUMMARY.md)を実装し、通常177/実PG54/型/Windows build、DB COMMIT前後のSIGKILL、実HTTP/2つのRust SQLiteを検証。専用API/previewはschema2/版0.20へ更新済み。[全234判断](AUTONOMOUS_DECISIONS.md)。実Auth正常系/通常UI・IPC/Page metadata/CRDTは未完成。次はPage同期の保護契約へ進む。

2026-10-05、checkpoint **v0.19.0**。[個人workspaceの認可と保存transaction](../../tests/evidence/private-transactions-20261005/SUMMARY.md)を実装。owner/device/resourceを同じtransactionでlockし、失効/削除の両順序と期限切れを実PGで確認。通常175/専用PG41/型/Windows buildがPass。[全214判断](AUTONOMOUS_DECISIONS.md)。新structured stream/CRDTと実Auth/native IPCは未完成。追加手操作を求めず、workspace別のserver ledgerへ進む。

2026-10-05、checkpoint **v0.18.0**。[browserログイン接続確認](../../tests/evidence/private-login-20261005/SUMMARY.md)を実装し、通常171/実PG30/専用画面8/通常画面59/実同期2/型/Windows buildを検証。専用Compose previewはloopback1421で起動済み。[全199判断](AUTONOMOUS_DECISIONS.md)。実ユーザーcredentialを入力せず、正常実Auth/OS credential/native IPC/server同期/CRDTは未完成。次はserver同期経路へ進む。

2026-10-05、checkpoint **v0.17.0**。認証済workspace接続（v0.16.0）と[保護APIの明示起動](../../tests/evidence/private-runtime-20261005/SUMMARY.md)を実装。通常161/実PG30/型/Windows build、独立Docker build/Compose起動を確認。[全178判断](AUTONOMOUS_DECISIONS.md)。実ユーザー認証、login UI/OS credential/native workspace IPC、新server stream/CRDTは未完成。以下は過去の各checkpoint時点の記録。

2026-10-05、checkpoint/所有版 **v0.13.0**。[workspace同期sessionの遅着応答/保存先固定](../../tests/evidence/workspace-session-20261005/SUMMARY.md)で通常120＋実PG26/型/通常Windows buildがPass。非同期race9条件はportable port doubleで、新しいnative永続化/HTTP stream/画面の証拠ではない。[全12判断](../decisions/workspace-sync-session.md)、[継続開発118判断のまとめ](AUTONOMOUS_DECISIONS.md)。規約/改善送信は設計に追加済み、収集未実装。残るP1/P2作業はworkspace別durable prepared/receipt/cursorとactive UIの接続、実Auth/失効/端末保持契約。旧DB/実行物を保持。

2026-10-05、checkpoint/所有版 **v0.12.0**。[正本metadata schemaと初期workspace登録](../../tests/evidence/private-bootstrap-20261005/SUMMARY.md)で通常111＋実PG26/型/通常Windows buildがPass。並行/再送、issuer/端末境界、rollback、削除/失効、unknown版を検証。[全12判断](../decisions/private-workspace-bootstrap.md)。fresh namespaceに限定、旧PoC移行/本文/同期/native queue/実Authは未完成。次はaccount/workspace切替の遅着応答guardを実装する。

2026-10-05、checkpoint/所有版 **v0.11.0**。[認証付き独立HTTP入口](../../tests/evidence/private-http-20261005/SUMMARY.md)で通常108＋実PG23/型/通常Windows buildがPass。session/access限定で、JWT/owner policyと安全な401/403/503を検証。[全12判断](../decisions/private-http-boundary.md)。旧main/DBを保持、実provider/全router/正本view/移行は未完成。次は正本metadata schema/bootstrapを独立実装する。

2026-10-05、checkpoint **v0.10.1**/所有製品版 **0.10.0**。[日本向け規約/プライバシーとエラー・性能のみの任意改善送信](../../tests/evidence/privacy-plan-20261005/SUMMARY.md)を設計に追加。初期OFF・端末別明示同意・撤回・server照合を定義。[全12判断](../decisions/privacy-telemetry-plan.md)。文書/リンク確認のみで収集未実装、公開文面未完成。利用者指示に従い次は進行中のP1 HTTP入口の開発/試験へ戻る。

2026-10-05、checkpoint/所有版 **v0.10.0**。[署名session＋issuer別owner](../../tests/evidence/signed-session-20261005/SUMMARY.md)を追加。固定jose6.2.12、HTTPS JWKS/署名/issuer/audience/期限/主体、不通category、同sub別issuer拒否を検証。通常105＋専用PG22/型/通常Windows buildがPass、外部変更はjose1件だけ。[全16判断](../decisions/signed-session-verification.md)。HTTPSはfixture transport、実Supabase/login/refresh/失効/移行/全routerは未完成。次は独立HTTP経路をlocalで検証する。利用者操作不要、旧Page/DB保持、Computer Use解除。

2026-10-05、checkpoint/所有版 **v0.9.0**。P1の[version付きworkspace wire/cursor境界](../../tests/evidence/workspace-sync-boundary-20261005/SUMMARY.md)を部分実装。workspace/epoch/ACK identity、署名/形式/未来位置/Number精度超の16条件、通常90/型/通常Windows buildがPass。旧routes/DBは保持、外部依存不変。[全12判断](../decisions/workspace-sync-boundary.md)。Supabase未作成・local先行の回答に従い、次は署名JWTのlocal検証adapterへ進む。実DB21/画面59は前checkpointの結果で、今回の新実機/新provider合格とはしない。

2026-10-05、checkpoint/所有版 **v0.8.0**。P1の[個人workspace読取認可](../../tests/evidence/private-access-20261005/SUMMARY.md)を部分実装。owner/workspace/typed resourceと正規Page文書名の境界、不変targets、実PG1snapshotを検証。通常74＋専用PG21、型/通常Windows buildがPass、外部依存不変。[全12判断](../decisions/private-workspace-access.md)。実JWT/provider・正本view/移行・HTTP/CRDTへの接続は未完成。Supabaseは未作成・local実装/自動試験先行と利用者回答、[必要事項](PENDING_PRODUCTION_CONFIGURATION.md)を記録。独立するwire/cursor契約へ続行する。新しい画面/実IME合格ではない。

2026-10-05、checkpoint/所有製品版 **v0.7.0**。[Domain/Application基盤](../../tests/evidence/production-foundation-20261005/SUMMARY.md)を追加し、Task/Relation intentの旧wireを保持。認可拒否/不通、context/store固定、durable待機、結果不明commitの安定IDを検査。型/64 unit＋専用PG20/画面59/実同期Conflict2/通常Windows buildがPass、外部依存不変。[全13判断](../decisions/production-command-foundation.md)。新Applicationは本番adapter/UI未接続で、既存PoCにAuth/workspaceを追加したとしない。次は個人workspace認可契約の実装。旧DB/試験Pageは保持、Computer Use解除、利用者操作なし。

2026-10-05、checkpoint **v0.6.27**/製品 **0.6.25**。利用者の「優先はおまかせ」「個人利用と自分の端末間同期を先行」を受け、[Windows/Android・Page/Task/Relation・基本DB Table/Listの実装順](IMPLEMENTATION_PLAN.md)を選定。本番architecture/技術/データ/sync/CRDT/Editor/認可の設計候補、[PoCとの差/残契約](PRODUCTION_READINESS.md)、[全9判断](../decisions/production-foundation-plan.md)を記録。native Rust Repository/npm workspaceの継続とoperation ID責務を要件v0.8へ明記。アプリ/DB/wire/外部接続は変更なし。次はP0のdomain/application portと型付きcommandを独立して実装する。

2026-10-05、checkpoint **v0.6.26**/製品source **0.6.25**。[Windows診断4起動・104文字貼り付け・実キーabc・1,005更新/全保存/再起動照合](../../tests/evidence/windows-profile-20261005/SUMMARY.md)を利用者操作なしで追加。診断の内部時間と通常native2秒/連続IME性能を区別し、通常source/manifest/lock/exeは不変。全8判断と残事項は[判断記録](../decisions/windows-profile-followup.md)。診断app終了、Computer Use解除。次は既存要件の本番architecture候補と未決定契約を整理し、新機能の恒久実装へは広げない。

2026-10-05、checkpoint/製品 **v0.6.25**。保存/通信報告によるPageEditor/TaskPanelの不要描画を標準memoで省き、回帰で再現したnative選択反映待ちとgutterのdragenter受入を修正。[55 unit/integration・型・全59 E2E・実同期/Conflict2・描画比較・production bundle104文字・通常Windows build/選択置換Undo/Redo/再起動/全7更新/peer](../../tests/evidence/render-isolation-20261005/SUMMARY.md)。[Windows実Rust/SQLiteの4停止条件](../../tests/evidence/windows-store-boundaries-20261005/SUMMARY.md)も補完し、通常Tauri内部全条件とは区別。初回Fail、seed WAL copy訂正、速度保証できない測定を保持。利用者操作なし、試験app終了、Computer Use解除。最新版実IME/物理drag/native性能と実OS環境は残す。[全13判断・必要事項](../decisions/step-8-render-isolation.md)、[今後の実施範囲と製品化案](NEXT_DEVELOPMENT_PLAN.md)。新機能の恒久実装は未開始、既存Gate結論は実行版0.6.20の歴史的判定を維持。

2026-10-05、checkpoint／製品 **v0.6.24**。再開指示に従い、1,000 block入力時のtoolbar移動可否判定から不要なtransaction生成・全文走査を除去。[全59 E2E・50 unit/integration・型・Windows build・production-bundle104文字／保存・native move／Undo／x入力／SQLite4更新](../../tests/evidence/toolbar-availability-20261005/SUMMARY.md)。外部依存不変。既存Gate結論とWindows性能／未実施OSのConditionalは維持。[今回の全自律判断](../decisions/step-8-toolbar-availability.md)。利用者操作なし、Computer Use解除、新試験app終了。

2026-10-04、checkpoint **v0.6.23**／製品 **0.6.20**。利用者の連続入力報告と[保存監査](../../tests/evidence/poc-gate-review-20261004/SUMMARY.md)で30→76更新・1,000段落・他999段落不変・peer一致を確認。判断委任に基づき、Gate Aは受入例外ありPass、Gate BはConditional、Gate CはPass、技術選定は条件付き採用と確定。PoC Step 9を完了し、全Gate無条件Pass・本番提供とは区別。[全自律判断と後続事項](../decisions/poc-autonomous-review.md)。現在の回答／手操作待ちはなし。Computer Use解除、既存Pageは保持。

## 過去の記録（当時の判定）

2026-10-04、checkpoint **v0.6.22**／製品 **0.6.20**。利用者がMicrosoft IMEへ切替済みと回答。Codexが[通常変換・同一段落遠隔3更新中の変換](../../tests/evidence/windows-ms-ime-20261004/SUMMARY.md)を実キーで代行し、SQLite30更新・全1,000段落・peer全文／clock一致を確認。残る998段落不変。自動native dragの追加試行は移動なし、0.6.19の物理受入結果と区別する。連続入力体感だけを最小手操作依頼、保存照合はCodexが行う。両Greivaは開いたまま、Computer Use解除。正式Gateと環境／性能の残条件は維持する。

2026-10-04、checkpoint **v0.6.21**／製品 **0.6.20**。[Windows実キー日本語1変換・1,000段落保存照合](../../tests/evidence/windows-ime-preparation-20261004/SUMMARY.md)をCodexが代行。SQLite9更新・独立peer全文／clock一致、他999段落・旧WIN619-DRAG全13更新不変。Microsoft provider未同定のため、利用者に入力方式の確認だけを依頼。再開用fixture／peer・監査準備まで終え、回答待ちで停止。新旧Greivaは保存済みで開いたまま、Computer Use解除。製品・manifest・exeを0.6.21とは呼ばない。実IME連続入力・同一段落遠隔composition、正式Gateは残る。

2026-10-04、checkpoint／製品 **0.6.20**。1,000 blockでdragの全行スタイル生成を省き、移動する行だけを更新。[単回比較・全59 E2E・型・48 unit/integration・通常Windows build](../../tests/evidence/block-drag-large-20261004/SUMMARY.md)。Docker診断のLong Task5→0、全1,000行の移動／Undo・独立peer全文／clock一致。Windows性能・実日本語IMEの合格には換算しない。利用者操作なしでこの更新を検証し、既存WIN619-DRAGは編集せず開いたまま保持。残る実IME／正式Gateの準備を続ける。

2026-10-04、checkpoint／製品 **0.6.19**。ドラッグを、元の列・幅を保って上下へ持つ行と、周囲が場所を空ける表示に改善。ハンドル列のdropを修正し、丸いblock・共通control・短い動き・小さいmenuの透明感を追加。[全58 E2E・型・48 unit/integration・Windows release build](../../tests/evidence/block-drag-preview-20261004/SUMMARY.md)。利用者が最終修正版を確認し、online backupの4→13更新で純粋な順序変更・全4 block保持を照合。最終H2→H3と試験直前H3→H2の差も記録。Computer Useは解除済み、Pageは開いたまま。[共通品質基準](../development/ui-quality.md)を反映。次は新しい表示の大量block性能と残るPoC検証を進める。最新実IME／1,000 block連続入力・正式Gateは残る。利用者指定により、操作依頼を最小限にして停止・完了・必要な回答待ちまで継続する。

2026-10-04、記録checkpoint **v0.6.18**／製品 **0.6.17**。[層別性能診断・実キー3文字保存／復元](../../tests/evidence/windows-native-profile-20261004/SUMMARY.md)と利用者の物理drag→Undoを停止DBで照合。元の本文・別Pageは保持。最初の移動履歴に空段落の増加があり原因未確認、後の移動は正しい構造。実日本語IME・正式Gateは未完了。利用者は手操作可能へ復帰し、ドラッグ中のblockを持ち上げ周囲が場所を空ける表示を依頼。確認済み区切りをcommit後、表示改善へ進む。

2026-10-04、v0.6.17の区切りで[過去のスキップ・未実施の現在対応](SKIPPED_VALIDATION_REVIEW.md)を整理。Dockerの実PostgreSQL20件を再実行して全Pass、旧skip20件と名前で照合。通常exe・program/config135ファイルのhash一致、Pixel 7のADB未接続を確認。残る物理drag／実Microsoft IME・Gate判断を記録し、利用者が応答可能になるまで待つ。

2026-10-04、checkpoint／製品 **0.6.17**。main windowのHTML5 drag設定を追加し、通常Windowsの同一Pageで全11種類のblock、Markdown4条件、Slash、Bullet indent/unindent、Todo check、入れ子Toggleのkeyboard／pointer開閉、全block削除とUndo/Redo、Mention keyboard移動を確認。[59更新・peer照合と配送診断](../../tests/evidence/windows-native-editor-20261003/SUMMARY.md)。元2 Pageの全文／clock不変、最初の4種類のconnected再起動復元も確認。native dragは単純HTML5対照でもdrop未配送で物理mouse確認待ち、最新Microsoft IMEは自動キー試行がASCIIに留まり未確認。設定のcheckpointはdrag修正完了やGate Passを意味しない。通常／診断Greivaを保存後終了、Computer Use解除済み。[Gate資料案と必要なA/B/C](GATE_REVIEW_DRAFT.md)に引継ぎを記録。利用者応答不能時は独立作業を先に終え、必要な操作・判断だけを待つ。過去の未実施項目は下記履歴として保持し、現在の対応は最新資料で確認する。

2026-10-03、最新記録checkpoint **v0.6.16**、製品 **0.6.11**。[Windows通常release](../../tests/evidence/windows-native-release-20261003/SUMMARY.md)で1,000 block／111文字の保存、native1,000操作ACK・250 Task、台帳／receipt1009件、独立peer一致を確認。空SQLiteの観測上限2.663秒、1,000 block復元3.567秒（起動・UIAを含む）、server応答間75.973秒。復元目安の未達観測と内訳未測定を明示する。Computer Useは区切りで解除。残るnative必須操作・最新実IMEと最終Gate資料を続ける。

2026-10-03、最新記録checkpoint **v0.6.15**、製品は **0.6.11**。[Pixel 7 / Android 17実機](../../tests/evidence/android-pixel7-20261003/SUMMARY.md)で自動26項目、接続停止／再接続など4項目、実Gboard E/Fを確認。Fの同一段落composition中の遠隔3更新を保持し、全文／clockが独立peerと一致。AndroidはP2 browserでSQLite復旧を含まない。試験用CDP・ADB転送は使用後に解除し、Windows release性能・残るP0操作と最終Gateへ続ける。以下は過去checkpointの履歴。

2026-10-03、最新記録checkpoint **v0.6.14**、製品・候補は **0.6.11**。Windowsの同field Conflict3値保持・状態／期限merge・draft保持、local pointer採用とremote Tab／Enter採用、未解決Conflictを保持した強制終了・connected再起動を確認。[実機Conflict証拠](../../tests/evidence/windows-native-conflict-20261003/SUMMARY.md)。native7操作・receipt9件、台帳9件・独立peerが一致。元Page2件は全更新・XML・clock不変。利用者指定により停止指示・完了・回答が必要な問題での待機まで継続する。残るWindows操作／release性能、Android実IME／再接続・P2・最終Gateを続けて確認する。以下は過去checkpointの履歴。

2026-10-03、最新記録checkpoint **v0.6.13**、製品・候補は **0.6.11**。Windows通常TauriのRelation ACK応答保留中に強制終了し、サービス停止中の再起動・pending保持、再接続のpullによるACK／cursor復旧を確認。[native通信境界・独立peer照合](../../tests/evidence/windows-native-network-20261003/SUMMARY.md)。Page2件の本文・clock、Task／Relation、実Rust load、新規peerとサーバー台帳2件が一致。元DB一式のhash不変。Computer UseはUI検証後に解除。次はnative Conflict UI・残る全操作とrelease性能。native transaction途中の全境界・Android実OS・最終Gateは未完了。以下は過去checkpointの履歴。

2026-10-03、最新記録checkpoint **v0.6.12**、製品・候補は **0.6.11**。利用者の通常IME／選択置換／Undo/Redo、見出し1・Todo・入れ子Toggleの問題なし回答と保存履歴を照合。Windows UIの代行環境を確認し、Codexが他のblock・Mention・移動／Undo/Redo・Task／Relation保存を実施した。通常Tauriの保存完了後offline強制終了と再起動で、本文・structured pending2件をnative画面と実Rust loadで確認。[今回の証拠](../../tests/evidence/windows-native-ops-20261003/SUMMARY.md)。WIN611-OPSの108更新は不変。利用者指示に従い、代行可能な試験を手動依頼せずこちらで実施する。通信途中・ACK・peer収束のnative境界、残る全操作、release性能・Android実OSと最終Gateは未完了。

2026-10-03、最新checkpointは **v0.6.11**、製品・Windows候補も **0.6.11**。structured同期の通常ACK後snapshotを100ms間隔に抑え、1,000操作のsnapshot回数・応答量削減と保存順序・収束を確認した。[Docker回帰・型再検査・候補build](../../tests/evidence/step-8-structured-progress-20261003/SUMMARY.md)。新候補のnative操作・性能はNot run。利用者の手操作が可能になり、通常0.6.9 A/Bと旧診断0.6.5 textarea C/Dを再確認。window移動ありだけで直前の文字が欠落し、停止後SQLiteとnative eventを照合した。[実機証拠](../../tests/evidence/windows-ime-reconfirm-20261003/SUMMARY.md)。他アプリ複数でも同症状との利用者報告を受け、この環境のMicrosoft再変換は[受入例外](../decisions/step-8-ms-ime-exception.md)としてGreiva修正待ちから外す。原Failは保持する。次は最新Windowsの他の必須操作・保存／復旧、Android実OSの検証。Gate最終未判定。

以下の各版の状況は過去checkpointの履歴として保持する。

[プロジェクト紹介へ戻る](../../README.md)。以下のコマンドは、特記がなければリポジトリのルートで実行します。

2026-10-03、最新の検証準備checkpointは **v0.6.10**、製品・Windows候補は **0.6.9**。利用者の再開指示と参照セッションの判断を引き継ぎ、[8受入条件・証拠・実機再開順序](POC_VALIDATION_MATRIX.md)と保存済み証拠の監査を追加した。[今回の証拠](../../tests/evidence/poc-audit-20261003/SUMMARY.md)。専用Dockerで監査試験9件と実証拠監査Pass。原full runの11 Pass／1 Fail、別offline feature再検査Pass、通常skip20件と実PostgreSQL別run20件の対応を確認。Windows worktreeの改行差と内容差を区別し、候補exeのhashを再照合した。Windowsインストール済み環境を読み取りで記録、Android対象は利用者申告のGoogle Pixel 7／Android 17 QPR1。最新native／IME・Android実OSはNot run、Microsoft再変換FailとGate最終未判定を維持する。今回は文書・検証ツールだけで製品版を変更しない。以下の0.6.9停止は過去checkpointの履歴である。

2026-10-03時点。開発チェックポイント **v0.6.9**。Step 8のDocker回帰で、遠隔文字編集後に見出し／Toggleの選択が古い文字位置へ戻る不備を再現し、文書構造が同じ遠隔編集に限ってYjs相対位置を使う修正を追加した。[修正・証拠](../../tests/evidence/step-8-focus-20261003/SUMMARY.md)・[不備の記録](../failures/step-8-remote-selection.md)。新しい9 E2Eと全54 E2E、通常45件／実PostgreSQL別run20件、Conflict UI2件、統合crash4境界、性能4ケースを確認。通常機能検査は初回offline cache不足Fail後、Dockerで固定依存取得後のoffline再検査Pass。132ソースとhost／Dockerを照合し、アプリ所有版を0.6.9へ整合。Windows embedded候補はDocker build・host hash照合のみで、新しい実機試験はNot run。Microsoft IME再変換の対象範囲拡大は別件として未解決、Gate最終判定は未完了。利用者の最新指示「キリの良いところで止めて」に従い、このcheckpointのcommit/tag/pushまでで停止する。[手操作待ち・複数の対策案](DEFERRED_VALIDATION.md)・[作業境界](../decisions/step-8-validation-boundary.md)。Windows／Androidを検証対象として確認したが、Androidの機種・OS版・接続方法と実OS試験は未確認。停止中のDocker previewは既存0.6.5のままで、0.6.9候補へ反映していない。[変更履歴](../../CHANGELOG.md)・[バージョン運用](../development/versioning.md)。

2026-10-01〜02の0.6.5 nativeではGoogle日本語入力中の同一段落遠隔3更新・変換・local Undo/Redoと最終本文一致、Microsoft通常変換中の同一段落遠隔6更新保持を確認した。Microsoftの候補一覧は更新後に一度隠れ、Upで再表示した。Windows releaseの隔離設定候補は新規DB／WebView保存先の一回で主要UI確認まで上限1,962msを観測。native大量データ性能・全操作組合せ・最新統合crash・P1/P2実OSは未完了。[停止境界と残課題](../decisions/step-8-validation-boundary.md)。以下は各版の実施履歴であり、当時の未検証事項は今回の結果へ読み替えず保持する。

[POC_SPEC.md](POC_SPEC.md) のSection 18に沿って進めています。Step 1の基盤とStep 2の最小Editorを実装し、Slash・Toggleの操作改善を含むDocker内の全30件のE2Eが成功しました。Step 3はWindows実機へ切り替え、既存native shellの起動とWebView2保存先を確認しました。初回local IMEの4群は利用者がすべて問題なしと明示回答し、手動結果と初回証拠を記録しました。[Step 3初回IME記録](../../tests/evidence/windows-host-ime-20261001/SUMMARY.md)。[版の記録](../decisions/specification-version.md)、[Step 2の範囲・検証状況](../decisions/step-2-scope.md)、[Editor操作の改善](../decisions/editor-ux.md)を参照してください。

Step 4ではPage本文のYjs/Hocuspocus接続とサーバーbinary journalを追加しました。6つのA/B収束ケース、local Undo分離、新規client復元、別Page分離とサーバーSIGKILL復元を検証し、Dockerの全37 E2E、unit/integration 22件、build・型・Linux locked Cargo checkと専用PostgreSQL試験が成功しました。[Step 4の実装判断](../decisions/step-4-collaboration.md)・[証拠](../../tests/evidence/step-4-collaboration-20261001/SUMMARY.md)。[接続中の実機IME追加試験](../../tests/evidence/windows-remote-ime-20261001/SUMMARY.md)も、12回の更新を受ける間に試した操作すべて正常・双方の本文保持と利用者が回答し、候補画面を独立観察しました。同一段落のcomposition重複と残るnative全ブロック証拠は最終Gateに向け補強します。端末SQLiteのPage/update保存とoffline強制終了復旧はStep 5、Task/Relation同期はStep 6以降。Gate A/B/Cは未判定です。

製品設計には[Calendar・定期予定・時間割の追加設計](CALENDAR_TIMETABLE_SPEC.md)を記録しました。曜日＋時限/自由な時刻、週次の繰り返し、一回の取消・振替・追加を汎用モデルで扱う案です。Calendarは未実装で、PoCの対象と検証順序は変更していません。

[ヘルプ・利用案内の追加設計](HELP_SUPPORT_SPEC.md)も記録しました。ヘルプ内検索、FAQ、操作の文脈案内、ショートカット、offlineで読める基本ガイド、問題解決と診断情報の確認を扱う案です。ヘルプ画面・記事は未実装です。

[将来のAI・文章/音声操作の設計](AI_ACTION_SPEC.md)では、Page作成・Task/予定登録と、通常UIと共通の操作経路へ段階的に接続する案を記録しています。新規作成は直接実行、既存変更・削除は確認後に実行する方針です。現在のPage・予定と関連するノート/Taskを参照し、外部送信は初回設定で許可した送信先・データ種別の範囲内で毎回の確認を省略できる設計です。Provider等は未決定で、AI・音声機能は未実装です。

音声の将来設計には、短い操作指示と、長い会議・講義の録音からのPage作成・Task/予定候補の抽出を含めます。Pageは整理したノート＋折りたたんだ全文文字起こしとし、抽出候補は一覧から選んで一括登録します。元録音は初期30日保存で期間を変更でき、基本は端末内、選んだ録音だけアプリのクラウドへ保存する設計です。期限後もPage・文字起こしを残します。保存・削除契約、候補保持・処理上限は未決定です。

AI初期提供の方針は作成・登録・録音整理から開始し、既存編集・削除・検索は後続追加とします。入口は共通パネルと各画面を併用し、音声はアプリ内録音と既存ファイル取込みに対応します。AI会話履歴は初期30日保存、期間変更・手動削除が可能です。履歴やアプリ管理下の録音が期限切れでも、作成したPage・文字起こし・登録済みTask/予定や取込み元のファイルは消しません。これらは将来設計であり、今回のPoCでは実装していません。

追加の製品設計として[アプリ内更新](APP_UPDATE_SPEC.md)を記録しました。起動時・定期確認、利用者が開始するダウンロード、「今すぐ更新／後で」と再起動前の確認、未送信データの保全を合意済みです。未実装で、提供時期は未決定です。

Step 5ではnative Page metadataとYjs binary updateをSQLiteへ保存し、commit後に同期送信する境界を実装しました。[実装判断](../decisions/step-5-page-store.md)。[Dockerの8項目・Chromium全41 E2E](../../tests/evidence/step-5-page-store-20261001/SUMMARY.md)が成功し、強制終了・復元の選択状態を確認する試験も追加で3回成功しました。DockerでWindows 0.3.0候補をcross buildし、利用者の入力なしでnativeの新規offline Page・title・本文・block移動、強制終了後のoffline復元、再接続後のnative/peer state vectorと本文一致を確認しました。[実機証拠](../../tests/evidence/step-5-native-recovery-20261001/SUMMARY.md)。初期の制限付き起動によるWebView生成失敗は通常権限での起動で解消しました。Google日本語入力の実キー変換・候補選択は記録済みですが、Microsoft IME・native全項目・最終Gateは未検証で、結果を流用しません。Step 6の進捗は次の段落に記録しています。

製品設計に[汎用DBビュー・プロパティ](DATABASE_SPEC.md)と[ボタン・DBオートメーション](BUTTON_AUTOMATION_SPEC.md)を追加しました。Notion公式Helpのビュー/型/ボタン/action/triggerを比較対象とし、時間割は任意の分類軸・カード表示・関連データ作成を設定する一利用例として扱います。将来の受入条件、offline/再送/部分完了、元仕様との差異を記録しています。未実装で、PoCの対象・順序・Gateは変更していません。この文書更新で既存の実行物の版は変わりません。

## 通常の開発・試験はDocker内で実行

Step 6ではTask/Relationの端末CRUD・tombstone、entityとqueueの同一SQLite transaction、schema移行、stable client ID、PostgreSQL最小モデル・Nest読み取りAPIを追加しました。[実装判断](../decisions/step-6-structured-models.md)、[全43 E2E・unit/integration 29件・実PostgreSQL別run 2件の証拠](../../tests/evidence/step-6-structured-models-20261001/SUMMARY.md)。Windows候補0.4.0はDockerでcross buildしましたが、[実機操作APIのアクセス拒否](../../tests/evidence/step-6-native-local-20261001/SUMMARY.md)により新規Task操作は未検証です。push/pull・ACK・cursor前進・base/local/remoteの競合処理はStep 7、Microsoft IMEと最終Gate A/B/Cも未完了です。

Step 7のサーバー側push/pull、操作台帳、順序付きcursor、field merge・Conflictと明示解決、連続offline編集の意図保持を追加しました。[実装判断](../decisions/step-7-structured-server.md)と[検証証拠](../../tests/evidence/step-7-structured-server-20261001/SUMMARY.md)。Dockerの通常29件、実PostgreSQL別run12件、全43 E2Eとbuild/型・保存層・locked Cargo checkが成功しました。サーバー側だけの当時の区切りです。端末側の進捗は次の段落に記録します。既存Windows実行物は0.4.0のままで、Microsoft IMEと最終Gateも未完了です。

Step 7の端末ACK・transactional pull/cursor、prepared再送、pending intentのprojection、Conflict UI、復元→pull→push→pull engineを追加しました。[実装判断](../decisions/step-7-structured-client.md)・[Docker証拠](../../tests/evidence/step-7-structured-client-20261001/SUMMARY.md)・[修正/未解決記録](../failures/step-7-structured-client.md)。実Rust/SQLiteと実PostgreSQL/HTTPでACK喪失・API再作成・store SIGKILL・cursor保存失敗・遅延・接続停止/再開を確認し、別runの競合UIでlocal/remote選択・入力/focus保持・offline復元を検証します。Windows 0.6.0候補はDockerでcross build・hash照合済みですが、実機操作は未検証です。0.6.0時点ではPage＋Task＋Relationの統合crash境界とAPIプロセスSIGKILLが未実施でした。最新の検証は次の段落に記録します。性能/P1/P2・native/IME・最終Gateは後続です。Page初期復元が5秒を超えた一回の原因は未確定として記録し、再検証成功だけで解消扱いにしません。
Step 7の保存待ち改善と統合crash recoveryをv0.6.2で確認しました。[判断](../decisions/step-7-crash-recovery.md)・[最終証拠](../../tests/evidence/step-7-crash-recovery-20261001/SUMMARY.md)・[初回Failと承認A](../failures/step-7-integrated-crash.md)。保存済み全変更を保証し、保存中を明示する契約を反映しました。待機Yjs updateを順序を保ってmergeし、Dockerの11項目、通常44件・実PostgreSQL別run20件、Editor43・structured UI2・統合crash4 E2EがPass。実APIの確定前／確定後SIGKILLと、Page／block／Task／Relationの4境界で保存済み内容・queueのoffline復元とpeer収束を検証しました。試験専用停止featureは通常Tauriに含まれず、プレビューの126ソースと検証ソースの一致・3サービスhealthを確認済みです。Windows候補は既存0.6.0、実機操作とMicrosoft IME、Step 8性能/P1/P2とStep 9最終Gateは未完了です。

Step 8ではproduction bundle／release Rustで、空SQLiteのWeb補助起動、1,000 block復元と実キー入力・保存ACK、100回Yjs編集・再接続、1,000 Task操作の実UI engine同期を測定しました。[方法と残課題](../decisions/step-8-performance.md)・[最終証拠](../../tests/evidence/step-8-performance-20261001/SUMMARY.md)。最終回帰12項目（通常45件・実PostgreSQL別run20件、Editor43・structured UI2・統合crash4・性能4ケース）はPass。正確性と時間を区別し、1,000 block復元は3回中1回が2.47秒で2秒目安を超過、入力からcommit ACKはp95 962ms・最大1.32秒だったため、入力待ち・frame間隔・大量同期を改善課題として記録しています。初回回帰の試験transport EPIPEとCargo版置換の誤りは[修正記録](../failures/step-8-test-harness.md)へ保持しました。Windows既存0.6.0では利用者補助なしで新規Page・title／本文のliteral入力、Task作成・保存／同期表示と実APIでの一件確定を確認しましたが、[限定的なsmoke](../../tests/evidence/step-8-native-smoke-20261001/SUMMARY.md)です。最新native候補・Microsoft IME・全native操作、Windows release起動／性能、P1/P2実OSと最終Gateは未完了。プレビューは0.6.2の検証済みimageを維持しています。

v0.6.4では入力時のドラッグハンドルDOM再生成を改善しました。[判断](../decisions/step-8-editor-performance.md)・[証跡](../../tests/evidence/step-8-editor-performance-20261001/SUMMARY.md)。12項目、通常45件／実PostgreSQL別run20件、Editor44・structured UI2・統合crash4・性能4ケースがPass。1,000 block／104文字入力で全handleを保持し、前の本文変更後の位置・payloadと実pointer移動・Undo/Redoも検証。最終runのkeydown→commit ACKはp95 106.7ms・最大176.2ms、ハンドルだけの追加比較でも保持0→1,000と待ち短縮を観測しました。短縮率を製品やnative IPCの保証とせず、試験sourceは元へ戻して照合しています。0.6.4 Windows候補はDocker buildとhost artifact照合済みで、ホストtoolchainは追加していません。最新native全操作・Microsoft IME、Windows release性能、P1/P2実OSと最終Gateは残ります。プレビューは0.6.4へ更新し、実行中130ファイルと検証sourceのhash一致・3サービスhealthを確認しました。

v0.6.5ではWindows 0.6.4で観察したTodoの別行配置を、固定版Tiptapの実DOMに一致するCSSへ修正しました。[判断](../decisions/step-8-todo-layout.md)・[証拠](../../tests/evidence/step-8-todo-layout-20261001/SUMMARY.md)。修正前に失敗する実位置検査、修正後のpointer編集と全E2E45件、build／型／通常45件（実DB専用20件skip）／locked Tauri checkがPass。実機0.6.4のSlash・選択置換／Undo/Redo・Toggle・Todoと実キー日本語変換は限定証拠として保持します。Googleを使うと利用者が回答しましたが、今回の画像でProvider名を独立確認しておらず、Microsoft IME・再変換・同一段落composition重複・全native操作の合格には読み替えません。0.6.4 release exeはDocker build・host照合済みで、起動・空DB隔離・性能は未検証。0.6.5ではTodoの配置・pointer編集・チェックをWindowsで確認し、Docker previewにもsource一致を確認して反映しました。最新native全操作、P1/P2実OSと最終Gateは残ります。
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
