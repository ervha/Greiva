# 基本DBの行更新・競合解決画面 checkpoint

2026-10-12 / v0.71.0 / native16 / server11。[契約](../../../docs/development/PRIVATE_DATABASE_RECORD_EDIT_SCREEN.md)。

## 実装

作成/編集の切替を接続し、確認済みRecordを端末から読み、元version/Page/Sourceを捕捉して5型の指定値だけを更新する。「変更しない」とnull/値、空文字/0/falseを区別する。保存操作とconfirmed Browser表示、known busyで保持した新draft、unknown元intent/HTTP wire/ACK pairを区別する。shared field componentで行作成を保持し、Page本文を置換しない。

候補/解決履歴をNativeStoreでlimit1ずつ読み替え、resolved historyの次にある未解決候補へ進める。base/local/remoteのpresent/valueと版を見比べ、local/remoteを新operationで保存する。候補は原ACK保存後にresolvedByを読むまで消さない。変更済みremote状態と原resolution_stale拒否を反映済みにしない。長い値は折り返す。Native/API schemaと外部依存を追加しない。

## 検証

| 対象 | 結果 | 証拠 |
| --- | --- | --- |
| runtime24/native15/controller15/browser10 | 64 Pass（新3） | [report](focused.json.gz)、[log](focused.log) |
| actual signed HTTP/PG/native SQLite | 11 Pass（新1） | [report](record-write-pg.json.gz)、[log](record-write-pg.log) |
| 行作成/編集単独画面 | 18 Pass（新編集10・作成8） | [report](workspace-ui-focused.json.gz)、[log](workspace-ui-focused.log) |
| 長い値の折り返し修正後 | 2 Pass | [report](long-value-after.json.gz)、[log](long-value-after.log) |
| 通常全体回帰 | 769 Pass / 222 PG条件skip | [report](normal.json.gz)、[log](normal.log) |
| 実PG全35files | 222 Pass / 0 Fail | [report](postgres.json.gz)、[log](postgres.log) |
| 折り返し修正後の全workspace画面 | 82 Pass / 0 flaky | [report](workspace-ui.json.gz)、[log](workspace-ui.log) |
| 型・native/crash/server・features・frontend hooks0 | Pass | [型](typecheck-final.log)、[native](native-build.log)、[crash](crash-build.log)、[server](servers-initial.log)、[features](native-features.log)、[frontend](frontend-build.log) |
| final Docker Windows custom-protocol候補 | Pass・host未起動 | [build](windows-build.log)、[metadata](windows-build.json)、[PE/SHA照合](host-exe-inspection.json) |
| Host/Docker source照合 | 364：raw354、LF10、意図的excluded5 | [inventory](source-inventory.json)、[集計](verification.json) |
| npm/Cargo外部依存 | 315 / 501 / 118 unchanged | [audit](version-audit.json) |

新unitはlocal/limit1/cursor読取・unknown中の読取拒否・busy/失敗/late close、lazy ownerの開く失敗・Page保持・draft/navigation・元retryと閉鎖を検証する。actual新条件は同Recordの2 field conflictをnativeの1件windowで順に読み、remote/localの新operationで解決し、restart後に原履歴/値/pending0を実保存層で確認する。候補の端末読取にHTTPがないことも確認した。

新編集画面はtyped partial base/Enter保存、confirmed表示/本文不変、readonly/copy可能なunknown draftと元intent/wire/pair、pending0でもunknown ACK保持、三値/新op/原履歴、remote選択後の続きとstale原拒否、known busy/変換継続/読取失敗保持をdesktopと360px dark/reduced-motionで確認する。作成画面8条件も共通fieldへ変更後に通る。

## 元の失敗と修正

追加fixtureのwrite bodyをcreate intent型へ狭めていたため、update resolutionの型検査が失敗した。原[type-fixture.log](typecheck-fixture.log)を保持し、private write request schemaからparseするよう修正した。[修正後型](typecheck-after-fixture.log)、[追加tests後](typecheck-after-tests.log)、[全体型](typecheck-final.log)はPass。appの更新/解決不具合へ読み替えない。

通常769/実PG222/初回全画面82 Pass後、長いLatin値を表示する場合のwidthチェックでdesktop/mobileの2 Failを再現した。p/liだけでなく確認済み値と候補のddも折り返すようCSSを修正し、長値2・全画面82を再確認した。保存・同期のTypeScript/Rustは変更せず、frontend hooks0とWindows候補を新CSSで再生成した。原[長値report](long-value-before.json.gz)・[log](long-value-before.log)、[CSS修正前全82](workspace-ui-before-wrap.json.gz)・[log](workspace-ui-before-wrap.log)を保持する。初回82 Passを長い値の合格へ読み替えない。

[desktop編集](workspace-record-edit-desktop.png)・[mobile編集](workspace-record-edit-mobile-dark-reduced-motion.png)・[desktop候補](workspace-record-conflict-desktop.png)・[mobile候補](workspace-record-conflict-mobile-dark-reduced-motion.png)を確認した。UI fixtureのmock Auth/IPC/HTTPとactual native proofは別の証拠である。

## 境界と次工程

保存済みViewの設定/作成・既知候補解決へ続行する。Record削除/Page付替えと未取得binding拒否の解消は別工程。実Supabase正常系・最新Windows invoke/実Microsoft IME・Android native、credential/offline grant、配備暗号化・復旧/配布・最終Gateは未確認のまま。Docker synthetic composition/cross-buildは実MS IME/Gate合格ではない。Git checkpointはinstaller公開ではない。
