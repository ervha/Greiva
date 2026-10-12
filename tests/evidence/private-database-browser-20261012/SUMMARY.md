# 基本DBのTable/List読み込み画面 checkpoint

2026-10-12 / v0.68.0 / native16 / server11。[契約](../../../docs/development/PRIVATE_DATABASE_BROWSER.md)、[実装順](../../../docs/plan/IMPLEMENTATION_PLAN.md)。

## 実装と今回の受入

個人workspaceへlazy openのDB browserとTable/List画面を接続した。確認済みSource/Record/Viewのbounded cache、明示catalog/定義read/差分取得、失敗時の旧表示と鮮度、元応答のnetworkless再保存、Auth/owner閉鎖を扱う。Table/Listで6型の値・保存済みViewのfilter/sort/列設定を読み、表示だけの切替で行や保存設定を複製しない。Name未取得・空タイトル・条件未判定を区別する。Page入力/選択・compositionとキーボード・mobile dark/reduced-motionを確認する。DB作成・値編集・View設定保存の画面は後続。

| 対象 | 結果 | 証拠 |
| --- | --- | --- |
| 新browser8＋既存controller15 | 23 Pass | [report](focused.json.gz)、[log](focused.log) |
| actual signed HTTP/PG/SQLite（新browser2＋既存runtime2） | 4 Pass | [report](browser-pg.json.gz)、[log](browser-pg.log) |
| 新DB画面desktop/mobile | 6 Pass / 0 flaky | [report](workspace-ui-focused.json.gz)、[log](workspace-ui-focused.log) |
| 全通常回帰 | 758 Pass / 219 PG条件skip | [report](normal.json.gz)、[log](normal.log) |
| 実PG全35files | 219 Pass / 0 Fail | [report](postgres.json.gz)、[log](postgres.log) |
| workspace全画面desktop/mobile | 58 Pass / 0 flaky | [report](workspace-ui.json.gz)、[log](workspace-ui.log) |
| 型/native/crash/features/frontend/Windows | Pass | [型](typecheck-final.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[frontend](frontend-build.log)、[Windows](windows-build.log) |

通常758=以前750＋browser8。実PG219=以前217＋browser2。画面58=既存52＋DB6。byte分割は20件未満の17＋8行でもkeysetと全25行を保持する。定義readと差分receiveのCOMMIT後戻り値喪失、元pair再保存、未送信Pageを消費しないこと、actual Record/View三値候補、Auth refresh後の遅着拒否を実HTTP/SQLiteで確認した。fixtureのUI試験はreal Auth/SQLを代用しない。

画面：[Table desktop](workspace-db-table-desktop.png)、[Table mobile](workspace-db-table-mobile-dark-reduced-motion.png)、[Name条件 desktop](workspace-db-desktop.png)、[Name条件 mobile](workspace-db-mobile-dark-reduced-motion.png)。T3 browserで既知NameからPage本文を開き、選択Page/bindingと元Record IDsを照合した：[限定fixture inspection](live-preview-inspection.json)。

## 元失敗・修正・再確認

- 初回型checkはfixtureが存在しないProgress型名をimportしたFail：[log](typecheck-tests-initial.log)。既存schemaのReturnTypeへ修正した。
- 初回単独23条件は21 Pass / 2 Fail：[原report](initial-focused.json.gz)、[原log](focused-initial.log)。public guardのbusyがPromise拒否より先に同期throwになった。非同期public APIに揃え、23 Passを確認した。誤って操作を許したわけではない。
- 初回DB画面は6 Fail：[原report](initial-workspace-ui.json.gz)、[原log](workspace-ui-initial.log)。controlled selectのイベント値を非同期化後に読んだため、元のDOM値へ戻って選択を反映できなかった。イベント時点でIDを捕捉し、6 Passと全58 Passを確認した。
- 初回actualPGは3 Pass / 1 Fail：[原report](browser-pg-initial.json.gz)、[原log](browser-pg-initial.log)。追加fixtureがView updateへsettingsを渡し、正しいpatch契約に拒否された。fixtureを修正した。
- E2Eと並行したPG再確認では既存101-write条件が15秒timeout（3 Pass / 1 Fail）：[原report](browser-pg-contention.json.gz)、[原log](browser-pg-contention.log)。timeoutを延ばさず単独4 Pass、最終全PG219 Passを確認した。元timeoutを消さず、並行負荷下の失敗と後の結果を分ける。

Docker source359、raw349一致・CRLF/LF text-only10、診断等excluded5：[source](source-inventory.json)。外部npm315/Cargo501・118を変更せずアプリ所有版だけ68へ更新：[版監査](version-audit.json)。PE ProductVersion/FileVersion68とDocker/host SHA一致：[build](windows-build.json)、[host](host-exe-inspection.json)。Windows executableをhostで起動していない。compiler-family/PDB/chunk sizeの警告はlogへ保持する。[機械可読結果](verification.json)。

## 続行と境界

次はDB作成と型付き行・View設定の編集を既存の永続queue/runtimeへ接続する。実Supabase正常系・最新Windows invoke/MS IME・Android native、credential/offline認可、配備暗号化・復旧/配布と最終Gateは別工程。Dockerのsynthetic compositionを実MS IMEの合格へ読み替えない。Git checkpointはinstaller公開ではない。
