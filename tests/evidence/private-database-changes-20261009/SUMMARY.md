# v0.50.0 DB変更履歴・取得の検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_CHANGES.md)、[判断](../../../docs/decisions/private-database-changes.md)。actual server11 journal/HTTP pullの証拠。native8を保持し、端末DB適用/queue/runtime/Table/List画面は後続。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 初回専用PG | 19 Pass / 4 Fail | 元結果を保持、下記修正 |
| 修正後専用PG | 23 Pass | migration/current/候補/ledger、bounded pull、HTTP、kill |
| 通常回帰 | 426 Pass | PG185は別実行、pendingをPassへ数えない |
| 全Postgres回帰 | 185 Pass | 既存162＋新23、actual schema1–11 |
| help UI | 12 Pass | owned50、desktop/mobile、検索・入力保持 |
| 型/API/frontend/native/features | Pass | flags0、native8保持 |
| Windows cross-build | Pass | Docker debug/custom-protocol。host PE50/SHA確認、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source313件一致（raw303、CRLF/LFのみ10）、既存診断5件を明示除外。timeout/retry・依存を追加していない。

初回のnumeric101作成は10以上で失敗した。`server_order::text`のSELECT aliasをORDER BYが参照し、文字列最大9をhead10と比較していたため、SQLをtable-qualified bigint順へ修正した。pull index/payloadにも同じ修正を適用し、101件のnumeric paginationを再確認する。他3Failはfixtureの二値layoutへ成立しない三値Conflictを期待したもの（name/filterへ変更）、corruption SQLの未使用parameter、旧Page metadata HTTP pathの指定誤りだった。元[初回report](initial-journal-pg.json.gz)と[log](initial-journal-pg.log)を修正後で上書きしない。

明示10→11では旧current/history/元request/result/secretを保持し、active・resolved候補を元ledger/history/新解決receiptへ照合してseedする。history/candidate/resolution/DDLの4不整合はversion10と旧データを保持してrollbackする。reinstall/readiness欠損は拒否し、readではhead/epochを補修しない。Source createのledger失敗もdefinition/headと一緒にrollbackする。

Recordのmixed patch＋三値候補、Viewのwhole-field候補と同snapshotの複数event、remote no-op新operation解決、unchanged/rejected/exact replayを確認する。101件のmax100ページ分割、actual PostgreSQL UTF8 JSON byteによるwindow分割、deleted Page/Record/Viewの空raw進捗、lookahead/gap/head/history/ledger破損を検証する。byte試験のtrusted budgetは64KiB、ASCII40000文字と日本語14000文字を使い、default64MiBと同SQL経路で分割する。単一event超過は503相当で位置を飛ばさない。

実lock待機でschema10 writerを排出し、seed中の新transactionを待たせ、既存commitのseed＋schema11新eventを確認する。pullのPage-before-Source待機中にwriterをcommitし、応答headは元観測値、次cursorで新eventを受け取る。owner/device/Source/epoch/client/purposeと待機後expiryを拒否する。取得を全同期/削除ACK/送信queue ACKへ扱わない。

Record create、View remote no-op resolutionのそれぞれCOMMIT前後で実server workerをSIGKILLする4試行を2test内に実行する。journal/head/current/history/candidate/ledgerが一緒に回復し、同じoperation再送後にeventが二重化しない。SQL失敗をkill証拠として代用していない。署名JWT/JWKS fixtureのactual schema11 HTTPで401/400/403、Record/View write/pullと旧Source/catalog/Page/Task routesを確認する。ledgerへAuth email/tokenを保存しない。実Supabase正常loginの証拠ではない。

UI変更はなくhelp12だけを今回のowned版で再実行する。[v0.44.0のroot64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠として保持する。実Auth/host invoke/MS IME/Android、native Gate、配備暗号化/削除/保守と全DB受入は別条件。

[集約](verification.json)、[専用PG](journal-pg.json.gz)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型](typecheck-final.log)、[API build](api-build-journal.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
