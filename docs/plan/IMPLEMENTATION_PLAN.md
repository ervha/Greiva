# 個人版の実装順と受入

最新v0.53.0：[Record端末保存](../development/PRIVATE_DATABASE_RECORD_CACHE.md)でnative10、typed snapshot/history/read receipt/既知候補の原子保存、late replyとbaseline照合、bounded読取を追加。[証拠](../../tests/evidence/private-database-record-cache-20261009/SUMMARY.md)。server11保持。View replica、DB cursor、Source/Record/View queue・runtimeとTable/List画面へ続行する。

最新v0.52.0：[DB定義取得session](../development/PRIVATE_DATABASE_SOURCE_SESSION.md)でcaptured Authの明示catalog/readを端末cacheへ接続。strict scope/6型、結果不明の同応答再保存、networkなしretry、置換/refresh/closeを追加。[証拠](../../tests/evidence/private-database-source-session-20261009/SUMMARY.md)。server11/native9保持。Source作成queue、Record/View replica・queue・DB cursorとTable/List画面へ続行する。

最新v0.51.0：[DB定義端末保存](../development/PRIVATE_DATABASE_SOURCE_CACHE.md)でnative9、Source snapshot/read receipt/版履歴とcurrentの原子保存、late reply保護、厳密6型/IPC、bounded端末一覧を追加。[証拠](../../tests/evidence/private-database-source-cache-20261009/SUMMARY.md)。再起動/COMMIT前後SIGKILLと旧データ移行を検証する。server11保持。Record/View replica・queue・DB cursor/runtimeとTable/List画面へ続行する。

最新v0.50.0：[DB変更履歴/差分取得](../development/PRIVATE_DATABASE_CHANGES.md)で明示server11、Source別永続世代/head、current・候補seed、writer/解決/ledgerとの原子event保存と認証付きbounded pullを実装。[証拠](../../tests/evidence/private-database-changes-20261009/SUMMARY.md)。PG23の移行待機/分割/競合/COMMIT前後killを確認し、元Failを保持。native8/既存APIは保持。端末DB replica/queue/runtimeとTable/List画面へ続行する。

最新v0.49.0：[DB変更パケット/cursor](../development/PRIVATE_DATABASE_CHANGES_CONTRACT.md)でRecord/View snapshot＋三値/解決状態、Source-bound検証、bounded raw進捗とgdb1署名を追加。[証拠](../../tests/evidence/private-database-changes-contract-20261009/SUMMARY.md)。portable契約とcodecで、server10/native8は未変更。actual journal/schema11/取得API、端末DB同期/Table/List画面は後続。

最新v0.48.0：[Viewヘッダー一覧](../development/PRIVATE_DATABASE_VIEW_CATALOG.md)でmax100/name/layout/現在version、Source/device/head固定gdv1 cursor、filtered raw進捗を追加。[証拠](../../tests/evidence/private-database-view-catalog-20261009/SUMMARY.md)。明示server10、旧ViewのID seedと新規位置の原子保存を実装し、native8/既存APIを保持する。Record/View変更受信、端末DB同期/Table/List画面と実Auth/native/配備暗号化は後続。

最新v0.47.0：[View設定保存](../development/PRIVATE_DATABASE_VIEW.md)でactual create/update/read、authoritative history、immutable再送結果、三値候補/新operation解決を接続。[証拠](../../tests/evidence/private-database-view-20261009/SUMMARY.md)。明示server9で既存Source/Record/Page/Taskとnative8を保持し、候補を元ledger/historyへ照合する。View一覧、Record変更受信、端末DB同期/Table/List画面と実Auth/native/配備暗号化は後続。

最新v0.46.0：[View変更・競合計画](../development/BASIC_DATABASE_VIEW_MUTATION.md)で設定5fieldのtyped intent、whole-field三値merge、新intent解決をportable Domainへ追加。[証拠](../../tests/evidence/basic-database-view-mutation-20261009/SUMMARY.md)。配列順を保持し、別field更新後のfresh解決とstale intentを区別する。server8/native8は未変更。actual View保存、Record変更受信、端末DB同期/Table/List画面と実Auth/native/配備暗号化は次工程。

最新v0.45.0：[Recordヘッダー一覧](../development/PRIVATE_DATABASE_RECORD_CATALOG.md)で認証付きmax100/Source・device・head固定cursor、filtered raw進捗、明示schema8を追加。[証拠](../../tests/evidence/private-database-record-catalog-20261009/SUMMARY.md)。旧RecordをID順seedし、新規位置はwriter/ledgerと原子保存する。値・本文の同期完了とは分離。Record変更受信/View、端末DB保存/同期、Table/List画面が次工程。実Auth/native/配備暗号化と全DBは後続。

最新v0.35.0：[Pageタイトル画面](../development/PRIVATE_PAGE_TITLE_SCREEN.md)をworkspace previewへ接続。明示保存/取消/確認、三値候補/新operation解決、拒否履歴、独立pending表示、dirty/変換/結果不明の切替保護とbounded履歴を実装。[証拠](../../tests/evidence/private-title-screen-20261008/SUMMARY.md)。query終了を同期済みと扱わず、実Auth/Windows invoke・IME/Android/native grant、metadata deltaと配備暗号化は残条件。追加の手操作依頼はない。

最新v0.34.0：[Pageタイトル送信・同期基盤](../development/PRIVATE_PAGE_TITLE_RUNTIME.md)を接続。captured Auth/scoped transport、strict portable session、native明示runtime、同wire再送/同ID保存再確認、bounded query/100件送信、世代取消を実装。[証拠](../../tests/evidence/private-title-runtime-20261008/SUMMARY.md)。title draft/解決画面は次工程。query完了をsyncedと扱わず、実Auth/Windows invoke・IME/Android/native grantと配備暗号化は残条件。追加の手操作依頼はない。

最新v0.33.0：[Pageタイトル端末保存](../development/PRIVATE_PAGE_TITLE_DURABILITY.md)を実装。native schema7、既知基底/intent/immutable wire・receipt/候補の原子保存、連続offline編集と古い応答の投影保護、strict IPC/世代取消を検証。[証拠](../../tests/evidence/private-title-store-20261008/SUMMARY.md)。専用HTTP transport/runtime・title画面は後続。実Auth/Windows invoke・IME/Android/native grantと暗号化配備の残条件を継続し、追加の手操作依頼はない。

最新v0.32.0：[Pageタイトルserver基盤](../development/PRIVATE_PAGE_METADATA.md)を追加。明示schema4、版/history/immutable結果、三値Conflictと新operation解決、bounded query、nonce/期限/失効の原子処理を実装。通常272/実PG82/型/Rust/frontend/Windows buildがPass。[証拠](../../tests/evidence/private-page-metadata-20261008/SUMMARY.md)。画面rename/端末title queue・replica/metadata delta、実Auth/native grant/IME/Androidと暗号化配備は後続。追加の利用者手操作依頼はない。

最新v0.31.0：[Task・Relation画面](../development/PRIVATE_STRUCTURED_SCREEN.md)をworkspace previewへ接続。typed CRUD、三値Conflict/別operation解決、rejection保持、draft/変換/結果不明の保護と同期状態、両runtimeの取消/cleanupを追加。通常269/実PG70/画面18/型/Rust/frontend/Windows cross-buildを確認。[証拠](../../tests/evidence/private-structured-screen-20261008/SUMMARY.md)。本番入口/native Auth・credential/offline grant、実Auth/IME/Android、Page metadata同期と暗号化配備は残る。追加の利用者操作依頼は出していない。

最新v0.30.0：[Task・Relation runtime](../development/PRIVATE_STRUCTURED_RUNTIME.md)をcaptured Auth/native storeへ接続。型付き原子保存、結果不明の同ID再試行、bounded explicit同期、三値Conflict/rejection保持、世代/stream置換取消を実装。通常268/実PG70/型/Rust/frontend/Windows cross-buildを確認。[証拠](../../tests/evidence/private-structured-runtime-20261008/SUMMARY.md)。新画面mountは次工程で、実Auth/native grant/IMEと本番配備は別条件。追加手操作を求めずTask/Relation画面へ続行する。

最新v0.29.0：[個人workspace接続画面](../development/PRIVATE_WORKSPACE_SCREEN.md)を専用entryへ追加。login/端末・server一覧/create/open/editor/sync、Auth取消、結果不明createの同ID再確認、pagination外local優先、composition/failed draftのnavigation保護を接続。通常258/実PG69/新画面10/既存画面64/Auth12/型/Rust/frontend/Windows cross-buildを確認。[証拠・初回失敗/画像修正](../../tests/evidence/private-workspace-screen-20261008/SUMMARY.md)。旧root/CSPを保持し、実native認証/IMEや本番既定入口への昇格は別工程。次はTask/Relationのworkspace接続基盤へ進む。

最新v0.28.0：[端末Page一覧](../development/LOCAL_PAGE_CATALOG.md)を追加。未送信の新規Pageもmetadata/pending件数として列挙できる。strict native command、UUID keyset、captured context/世代を検査し、一覧読取でqueueを消費しない。通常251/型/Rust/frontend/Windows cross-buildがPass。[証拠](../../tests/evidence/local-page-catalog-20261008/SUMMARY.md)。通常画面compositionへ続行し、実Auth/native IME/offline権限は別工程。

最新v0.26.0：Page本文のlive editorをcaptured native storeと認証付きHTTP sessionへ接続。[全18判断](../decisions/private-page-editor.md)、[契約](../development/PRIVATE_PAGE_EDITOR.md)、[証拠・初回失敗](../../tests/evidence/private-page-editor-20261007/SUMMARY.md)。保存→送信、ACK再送、remote commit→live反映、composition待機、Auth/同Page置換/切替、未保存本文と選択位置を検証。通常234/PG69/画面64/auth8/型/frontend/通常Windows debug buildがPass。再利用viewで、通常アプリの認証/一覧/編集compositionとnative credential/grant、metadata変更/offline保持契約は未完成。追加手操作待ちはなく、次は通常アプリの接続compositionを進める。

最新v0.25.0：認証付きPage一覧query、bounded keyset/HMAC workspace・epoch/metadata照合、connection.closeでnative cleanup開始を追加。[全14判断](../decisions/private-page-catalog.md)、[証拠](../../tests/evidence/page-catalog-20261005/SUMMARY.md)。通常224/PG69/browser2/型/frontend/Windows source116、専用API/preview v0.25/schema3を確認。一覧はsnapshot/delta同期ではなくnormal UI/metadata変更/native Authは未完成。次は利用者要望のシンプルな配色を独立して改善する。

最新v0.24.0：app-owned workspace DB root/世代handleとTauri commandを追加し、captured Auth generationのNativeWorkspaceStoreをPage/structured portへ接続。[全16判断](../decisions/native-workspace-ipc.md)、[証拠](../../tests/evidence/workspace-ipc-20261005/SUMMARY.md)。新11、通常219/PG66/型/frontend/Windows build/Browser2を検証。local handleはAuth grantではなく、通常UI/実Tauri invoke/native Auth/offline保持契約は未完成。専用APIはv0.21/schema3を保持、追加操作を求めずPage metadata/一覧へ進む。

最新v0.23.0：captured Auth/workspace/Pageのportable sessionを追加。prepared wire/Yjs構文/digest/応答bindingを検査し、保存先固定、refresh/close/同Page置換/遅着応答をguardする。[全16判断](../decisions/private-page-session.md)、[証拠](../../tests/evidence/private-page-session-20261005/SUMMARY.md)。追加15 unit、通常208/実PG66、型/frontend/Windows build、実browser WebCrypto/base64と実HTTP＋Rust SQLiteを検証。通常UI/IPC/Hocuspocus/実Auth/nativeは未完成、追加操作を求めずnative IPC接続へ進む。

最新v0.22.0：workspace別Rust SQLiteへPage binary/送信待ち/正確なwire/ACK receipt/remote diffの原子保存を追加。private local schema6はbinding確認後に5からupgradeし、structured dataを保持。[全16判断](../decisions/private-page-durable-store.md)、[証拠](../../tests/evidence/private-page-store-20261005/SUMMARY.md)。通常193/実PG66、型/frontend/Windows build、8条件SIGKILL/実HTTP＋2つのSQLiteを検証。専用APIはv0.21/schema3を保持。captured client session/通常UI・IPC/Hocuspocus/実Auth/nativeは未完成で、追加操作を求めず続ける。

最新v0.21.0：認証付きPage本文のbinary保存基盤を実装。明示schema3、初期title、append-only journal/digest/再送、state-vector diff、破損拒否/失効/期限rollback/COMMIT前後SIGKILLを検証。[全22判断](../decisions/private-page-binary.md)、[証拠](../../tests/evidence/private-page-20261005/SUMMARY.md)。通常180/実PG65、型/frontend/Windows cross-buildを確認。通常UI/IPC/端末Page queue、metadata rename/delete/Conflict、Hocuspocus継続認可・実Auth/nativeは未完成。追加操作を求めず端末耐久化/client sessionへ進む。

最新v0.20.0：個人workspace専用Task/Relation streamを実装。immutable ledger/再送、三値Conflict/causal frame、typed Relation参照、signed cursor/commit順序、明示schema2 upgradeを追加。通常177/実PG54/型/frontend/Windows build、専用API/preview更新がPass。[全20判断](../decisions/private-structured-stream.md)。Page metadata/CRDT・通常UI/IPC・実Auth/nativeは未完成で、追加操作を求めずPage同期の保護契約へ進む。

最新v0.19.0：owner/device/typed resourceの認可と業務queryを同一DB transactionへ固定。期限/失効/削除競合/返却後query/rollbackを追加4＋実PG11で確認し、通常175/PG41/型/frontend/Windows buildがPass。[全15判断](../decisions/private-sync-transactions.md)。device access入口を追加し、bootstrapの待機中期限切れもrollback。新sync server ledger/CRDT/native UIは別工程、次はworkspace別structured保存/再送/順序へ進む。

最新v0.18.0：独立browserログイン確認画面とmemory-only controller、明示login/登録/refresh/local logout、固定proxy/Compose previewを追加。通常171/PG30/専用画面8/通常画面59/実同期2/型/Windows buildがPass。[全21判断](../decisions/private-login-preview.md)。browser native fetchのreceiver不備を修正。単発Home試験の原因は未確定で再確認3/全59を通し記録へ保持。実ユーザー正常認証/OS credential/Tauri workspace IPC/new server streamは未完成。次は認証・端末所属を照合するserver同期transactionへ進む。

最新v0.17.0：明示config/read-only schema readiness、保護API専用mainとfresh初期化、独立Docker構成を追加。通常161＋実PG30/型/通常Windows build、fresh Docker build/専用Compose起動がPass。[全14判断](../decisions/private-api-startup.md)。通常PoC mainは維持し、新workspace stream/CRDT・実ユーザー認証は未完成。次はログイン検証画面とclient設定、native credential/IPC接続を進める。

最新v0.16.0：strict bootstrapとPrivateWorkspaceConnectionを追加し、認証generationのleaseで同期session/保存先を固定した。refresh/close/遅着処理を検証し、通常158＋実PG27/型/通常Windows buildがPass。[全16判断](../decisions/private-workspace-connection.md)。新同期HTTPのserver stream、通常UI/IPCと実ユーザーログインは未完成。次は明示的な保護API起動/configとログイン検証の入口へ進む。

最新v0.15.0：Supabaseの明示配置設定とmemory-only認証session、password/refresh/local logoutのREST adapter、server署名検証との接続を実装。通常148＋実PG27/型/通常Windows buildを検証。追加client14＋実HTTP2＋実PG/native SQLite1、実Supabaseの公開JWKS/不正署名拒否を分離した。[全16判断](../decisions/supabase-auth-session.md)。通常ログインUI/OS credential/新workspace同期HTTP・CRDTは未接続で、実ユーザーの正常login/refreshは未確認。次は認証済sessionから使うbootstrap/同期HTTP adapterと起動/設定UI、native bindingを接続する。

最新v0.14.0：新規workspace専用Rust/SQLite storeを実装。immutable binding、durable prepared wire、ACK receipt/pending、pull receipt/cursorをtransactionで保存する。追加12条件（実プロセスSIGKILL6を含む）＋既存回帰と通常Windows buildを検証。[全14判断](../decisions/workspace-durable-store.md)。通常Tauri IPC/active UI、実ログイン/refresh、新HTTP stream/CRDTは未接続。Supabase公開設定は受領し、実HTTPSでJWKS/Email設定を確認した。[接続手順](../development/SUPABASE_SETUP.md)。次は実Authの起動設定とclient session/credential境界、新streamのowner/device照合へ進む。

最新v0.13.0：新workspace wireのportable同期session境界を部分実装し、非同期race9を含む通常120＋実PG26/型/通常Windows buildがPass。native durable prepared/receipt/cursor adapterとactive UI/実Auth/全HTTP・CRDTは未接続。保存先を生成時に捕捉し、account切替で旧instanceを閉じる契約を先に検証した。[全判断のまとめ](AUTONOMOUS_DECISIONS.md)。以下の各版は当時の進行記録。

最新v0.12.0：新規namespaceの正本owner/device/resource metadata・read viewと初期workspace登録を部分実装。通常111＋実PG26/型/通常Windows buildを確認。旧DB取り込み、本文/structured stream、native workspace store、実Authは未完成。次はaccount/workspace切替中の古い応答を除外するclient同期境界へ進む。[全12判断](../decisions/private-workspace-bootstrap.md)。

2026-10-05、初期提供順の委任と個人利用先行の回答に基づく計画。[範囲/残契約](PRODUCTION_READINESS.md)、[architecture](ARCHITECTURE.md)、[技術](TECH_STACK.md)、[データ](DATA_MODEL.md)、[同期](SYNC_SPEC.md)、[CRDT](CRDT_SPEC.md)、[Editor](EDITOR_SPEC.md)、[認可](AUTHZ_SPEC.md)を参照。v0.7.0で[P0のDomain/portable Application](../../tests/evidence/production-foundation-20261005/SUMMARY.md)を実装。本番adapter/UI接続とworkspace導入は未完了。

| 段階 | 具体的な変更 | 受入と進行条件 |
| --- | --- | --- |
| P0 基盤 | Domain/Application port、型付きTask/Relation command、validationと端末commitの結果 | DB/UI依存なし、invalid intentで無書込み、entity/operation原子的commit、commit失敗時に成功なし。既存PoC動作保持 |
| P1 個人workspace | workspace/device/user境界、認証/認可adapter、version付きwire/stream、schema migration | 他user/workspace拒否、account切替/ACK loss、cursor所属、保存済みpending復旧、実Auth検証 |
| P2 Page/Taskの日常操作 | 本番adapter、metadata同期、navigation、Conflict、offline状態、ヘルプ基本記事 | 必須操作/IME、元データ保全、異field merge/同field3値、保存→kill→offline復元→収束 |
| P3 基本DB | 初期型付きRecord/Property、Table/List、本文Page、filter/sortとビュー保存 | view切替で複製なし、型validation、offline/Conflict、権限、binding。初期subsetを明記 |
| P4 Windows/Android提供 | Native package、実SQLite、keyboard/lifecycle、更新/署名/backup/restore | 実MS IME/Gboard、app kill、network switching、restore/入力、配布/移行失敗から復旧 |
| 後続 | 他DB view/property、Calendar/時間割、Button/Automation、AI/音声、共有/Web/Apple OS | 各既存仕様と対応platformの受入、提供時期/費用/外部契約を個別に確定 |

P0は既存contractを型/portへ整理し、テスト済PoCを一括置換しない。P1以降でwire/storage互換を変える場合は0.xのMINOR checkpointを作り、旧artifact/旧fixtureを保存する。commitは同じcodex/poc-editorで、関連checksの済んだ変更をまとめる。区切りのpushだけを停止理由にしない。

P0の9境界条件、型/通常64＋専用PG20/画面59/実同期2/通常Windows buildは検証済み。Applicationのdurable portはcontract doubleで、production atomic SQLite adapterやJWTを実装済みとはしない。実SQL adapterのworkspace所属・account切替・遅着応答はP1/P2で受入する。

P1はv0.8.0でowner/resource読取policy、正規Page文書名、PG1snapshot adapterを部分実装。10境界条件/実PG1を含む通常74＋専用PG21とbuildがPass。実session/JWT、正本view、version付きwire/cursor、migration、write/全HTTP/CRDT経路は未完了。

v0.9.0で新workspace wire/response contextと署名cursorの16条件を実装・検証。旧routes/SQLへ未接続で、live key/epoch、prepared/ACK/cursor原子性、migration/bootstrapは未完了。Supabase未作成・local自動試験先行の回答により、署名JWT fixtureから実Auth adapterの検証へ進む。

v0.10.0で署名JWTとissuer別owner、共通session→PG読取adapterを実装。通常105＋実PG22、型/通常Windows buildがPass。provider HTTPSはfixture transportで、実login/refresh/失効、全HTTP/CRDT、production view/migration/write transactionは未完了。

v0.11.0で独立HTTP session/access入口を実装し、通常108＋実PG23/型/通常Windows buildがPass。401/403/503、query偽装/削除/旧aliasをlocal検証。次はfixture tableではなく正本metadata schema/viewとbootstrapを実装する。旧PoC DBの帰属/取り込みを推定せず、新規の隔離schemaから開始する。

初期Windows/Androidを完成扱いにするには両OSの通常アプリが必要。Android実機不在ではDockerでbuildとadapter試験を進めても実Gboard/lifecycleをPassへしない。外部provider/署名/実機を要する時は必要事項をまとめ、残る独立作業へ進む。

2026-10-05追加：日本先行の[規約/プライバシーポリシー品質ゲート](TERMS_PRIVACY_POLICY_PLAN.md)を初期提供のP4へ追加する。[エラー/性能だけの任意改善送信](PRIVACY_TELEMETRY_SPEC.md)はP1の認証/端末境界とP2の設定基盤に依存し、schema/保持/送信先確定→同意port→設定UI→受信検証→限定計測→受入の順。初期OFF、端末ごとの明示同意。機能利用analyticsは対象外。未完了なら送信機能は未提供/OFFとし、設計だけで実装済みにしない。設計追加後は既存P1 HTTP開発へ戻る。
