# v0.48.0 View一覧の検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_VIEW_CATALOG.md)、[判断](../../../docs/decisions/private-database-view-catalog.md)。小さいheader一覧の証拠で、設定の変更受信/端末DB同期/Table/List操作画面の完成ではない。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| wire/cursor重点 | 4 Pass | max100/headerだけ/BigInt/署名・目的・scope |
| 最終専用PG | 11 Pass | 明示移行、101件、raw進捗、位置/replay/rollback/HTTP/SIGKILL |
| 通常回帰 | 418 Pass | 既存414＋新4、PG別実行 |
| 全Postgres | 162 Pass | 既存151＋新11、server1–10 |
| help UI | 12 Pass | owned48、desktop/mobile、検索・入力保持 |
| 型/API/frontend/native/features | Pass | server10/native8、通常flags0 |
| Windows cross-build | Pass | Docker debug/custom-protocol。host PE/SHA確認、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source306件一致（raw296、CRLF/LFのみ10）、既存診断5件を明示除外。通常reportの162 pendingは別PGで162 Passを確認する。

初回PGはfixtureのschema suffixが許可上限40字を1字超え、全11件が初期化前に失敗した。短いfixture名へ修正した次回は10 Pass/1 Failで、既存Source catalogへ必須cursor:nullを渡していなかったHTTP assertionが400だった。既存API契約を保持してfixtureだけを修正し、最終11件/全回帰を確認する。[初回](initial-view-catalog-pg.json.gz)、[名前修正後](after-name-view-catalog-pg.json.gz)と元logを保持する。timeout/retryや外部依存を増やしていない。

明示9→10でSource内stable ID順をseedし、元View snapshot/history/request/result/鍵を保持する。過去の作成時刻/commit順を復元したとはしない。不正history、DDL衝突、再installは拒否し、readinessにcolumnがなくても自動修復しない。新空Sourceのcatalogはheadを作らず、初回createだけがhead/View/history/ledgerを同transactionへ保存する。ledger失敗は全rollbackする。

101件のnumeric creation順、100件pageと固定headを確認する。途中の102件目は新規一覧で取得し、元cursor範囲へ混ぜない。後続pageのname/layout/versionは更新後の現在観測であり、過去responseは不変。filter/sorts/visible columns/Record値/Page本文をheaderへ含めない。一覧取得だけで全設定を検証・同期したとはしない。

deleted raw windowでemptyになっても位置/cursorを進め、後続active Viewを返す。operationを消費せず、結果を削除ACKへ使わない。lookahead header、head不一致/欠落は空の成功へ変換せず、catalog/createのどちらも既存Viewの欠落headを自動修復しない。並行create/同ID再送、COMMIT前後のactual worker SIGKILLで位置/history/ledgerが一緒に復旧し、二重採番しない。

owner/device/Source、tamper/device cursor、deleted Source/失効、Source lock待機後のsession expiryを拒否する。fixture JWKS/ES256の実HTTPで401/403/400とcatalog/write/readの成功、schema10の既存Source/Record header endpointを確認する。

UIコードは変更せずhelp12を再実行した。[v0.44.0のroot64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠として保持する。実Supabase login、host invoke/MS IME、Android/native grant、配備DB/backup暗号化と全DB/native Gateは別条件。

[集約](verification.json)、[重点](focused.json.gz)、[専用PG](view-catalog-pg.json.gz)、[PG log](view-catalog-pg.log)、[初回log](view-catalog-pg-initial.log)、[名前修正後log](view-catalog-pg-after-name.log)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型](typecheck-final.log)、[API](api-build-final.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
