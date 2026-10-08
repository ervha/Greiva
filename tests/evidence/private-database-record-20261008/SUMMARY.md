# v0.44.0 Record保存・競合の検証

2026-10-08 / Docker。[実装](../../../docs/development/PRIVATE_DATABASE_RECORD.md)、[判断](../../../docs/decisions/private-database-record.md)。actual server writerの証拠で、Record一覧/View・native DB同期・Table/List画面の完成証拠ではない。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 初回Record PG | 15 Pass / 1 Fail | 明示nullを欠落keyへ保存する変更がpure planでno-opになる |
| 補強中の型 | Fail | unit fixtureの重複propertyId（TS2783）、追加PG fixtureのunion narrowing不足 |
| 修正後重点 | 23 Pass | protocol4＋mutation19、観測版照合/null保存/remote欠落保持 |
| 最終専用Record PG | 18 Pass | actual writer/history/Conflict/解決/ledger/署名HTTP/SIGKILL |
| 通常回帰 | 396 Pass | 既存390＋新wire4/mutation2、PG別実行 |
| 実PG全回帰 | 124 Pass | 既存106＋Record18 |
| root/Auth/workspace画面 | 64 / 12 / 52 Pass | 既存UI/操作保持。新DB画面ではない |
| 型/frontend/native/features | Pass | owned版/通常flags0、native schema8 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE版/SHAのみ、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source286件一致（raw276、CRLF/LFのみ10）。既存診断5件は対象外として明示する。通常reportの124 pendingは別PG実行で124 Passを確認する。

schema6→7の明示移行、既存Source/Page/secret保持、DDL失敗全rollback、再install拒否/read-only readinessを確認する。create/read/exact replay、6型の値/Name複製拒否、scope/schema/property/type/binding uniqueness、不正owner/issuer/device/Page/Source/削除後replayを実PGで確認する。SQL causeやAuth email/tokenはrequest/result保存・公開logへ含めない。

異field stale merge、同field三値と非競合fieldの同時保存、local無変更/同じremoteのno-op、missing/null/0/false/blankを検証する。unknown base、準備後の追越し、観測版改変、choice値改変、解決済み、remote field変更に対するdurable rejectionを確認する。無関係fieldの更新後は現在版で選び直せる。remote解決はversionを変えず新operationとresolved_byを記録し、元candidateと元receiptを残す。

並行create/replayとasync前入力捕捉、Source lock待機中のsession期限切れ、ledger挿入失敗時のcurrent/history/candidate/解決reference全rollbackを検証する。再送receiptはhistorical snapshot/元candidateとも照合する。壊れた保存scope/lookahead/receiptを空値や成功へ変えない。active候補は最大20件のkeysetで取得する。

COMMIT直前・直後にactual Node server workerをSIGKILLし、beforeは全rollback、afterは確定済み結果から同operationをexactに再確認する。各境界でRecord/history/operationは最終1件だけになる。test-only real-driver barrierを使い、product crash hookを追加しない。fixture JWKS/ES256でactual protected HTTP write/readと401/403/409を確認する。schema7でもPage rename journalとTask acknowledgedを保持する。

初回15Pass1Failは欠落/nullを同値として比較した結果、明示入力の保存まで消えていた。基底/現在双方にkeyがない場合の明示nullを保存し、remote選択は欠落状態を保持する条件を補強した。新unitで両側を確認する。fixture型Failは重複fieldを除き、candidateとupdate kindを明示的に捕捉して修正した。元Fail/logを最終Passへ置換しない。timeout/retryを増やさない。

[集約](verification.json)、[初回PG](initial-record-pg.json.gz)、[最終専用PG](record-pg.json.gz)、[重点](focused.json.gz)、[初回重点](focused.log)、[重複field型](typecheck-after-null.log)、[narrowing型](typecheck-after-fixture.log)、[修正後型](typecheck-after-narrowing.log)、[最終型](typecheck-final.log)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[root](root-ui.json.gz)、[Auth](auth-ui.json.gz)、[workspace](workspace-ui.json.gz)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependency/cache/exeをGitへ含めない。

実Supabase login、host invoke/MS IME、Android/native grant、配備DB/backup暗号化、全DB/HELP/native Gateは別条件。このread/receiptをDB全体の同期完了や本文ACKへ使わない。
