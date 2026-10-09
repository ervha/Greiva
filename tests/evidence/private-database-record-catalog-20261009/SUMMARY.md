# v0.45.0 Record一覧の検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_RECORD_CATALOG.md)、[判断](../../../docs/decisions/private-database-record-catalog.md)。creation header catalogの証拠で、Record変更受信・View・端末DB同期・Table/List画面の完成ではない。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 重点wire/cursor | 4 Pass | max100/headerのみ/exact bigint/署名・目的・scope |
| 初回専用PG | 9 Pass | 移行、101件、filtered進捗、Auth、head/ledger、署名HTTP |
| 最終専用PG | 11 Pass | 上記＋COMMIT前/後SIGKILL |
| 通常回帰 | 400 Pass | 既存396＋新4、PG別実行 |
| 全Postgres回帰 | 135 Pass | 既存124＋新11、以前のschema/API/kill保持 |
| help UI | 12 Pass | manifest45、desktop/mobile、検索/文脈/入力保持 |
| 型/API/frontend/native/features | Pass | owned45、通常flags0、native schema8未変更 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE/SHAのみ。未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source292件一致（raw282、CRLF/LFのみ10）。既存診断5件は対象外として明示する。通常reportの135 pendingは別PG実行で135 Passを確認する。

server7→8で旧RecordをSource内stable ID順にseedし、original snapshot/history/request/result/鍵を保持する。過去の作成順を復元したとはしない。不正seed、DDL衝突、再install、readinessの列不足を拒否し、失敗後も旧7を維持する。新規RecordはSource lock下でhead/record/history/ledgerを原子保存する。ledger SQL失敗、COMMIT前/後のactual worker SIGKILL、並行create/replayで最終位置/操作が二重に進まないことを確認する。

101件のnumeric順/100件page、途中の102件目を元cursor範囲へ含めない条件、次の新規一覧での取得を確認する。値を更新するとheaderは新しいversionを観測するが、過去のresponseは変わらない。一覧範囲固定を内容snapshotや全同期完了へ扱わない。values/title/bodyはheaderへ含めない。

Page/Record tombstone filterでempty windowになってもraw位置とcursorが進み、次のvisible Recordを取得できる。filterでoperationを消費・削除しない。head不整合、lookahead header破損、欠落headを空の成功結果へ変えず、catalog自身がheadを修復しない。owner/Source/device不一致、tamper/device cursor、Source lock待機後のsession expiryを拒否する。fixture JWKS/ES256でactual protected runtimeのcatalog/create/readと401/403/400を検証する。

本checkpointで試験Failはない。9件Pass後にschema8のheadまで含むSIGKILL2条件を追加し、最終sourceで11件/全回帰を確認した。初回9件のlogも保持する。timeout/retry増加や外部依存更新はない。

UIコードの変更はなく、今回はhelp12条件へ絞る。[v0.44.0のroot64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版の実行証拠として保持し、v0.45で全128件を再実行したとは記録しない。

[集約](verification.json)、[重点](focused.json.gz)、[専用PG](catalog-pg.json.gz)、[初回PG log](catalog-pg-initial.log)、[最終PG log](catalog-pg-final.log)、[最終型](typecheck-final.log)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[API](api-build-final.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependency/cache/exeをGitへ含めない。

実Supabase login、host invoke/MS IME、Android/native grant、配備DB/backup暗号化、全DB/HELP/native Gateは別条件。取得成功を本文ACKや端末保存成功へ使わない。
