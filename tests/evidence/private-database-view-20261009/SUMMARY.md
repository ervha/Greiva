# v0.47.0 View設定保存の検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_VIEW.md)、[判断](../../../docs/decisions/private-database-view.md)。Viewのserver保存/候補取得の証拠で、端末DB同期/Table/List操作画面の完成ではない。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| wire＋Domain重点 | 14 Pass | 新wire3＋View intent/merge11 |
| 初回専用PG | 15 Pass | 明示移行、保存/再送/競合/rollback/HTTP/SIGKILL |
| 最終専用PG | 16 Pass | 上記＋valid-shaped候補とreceipt改変の拒否 |
| 通常回帰 | 414 Pass | 既存411＋新wire3、PG別実行 |
| 全Postgres | 151 Pass | 既存135＋View16、server1–9 |
| help UI | 12 Pass | owned47、desktop/mobile、検索・入力保持 |
| 型/API/frontend/native/features | Pass | server9/native8、通常flags0 |
| Windows cross-build | Pass | Docker debug/custom-protocol。host PE/SHA確認、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source300件一致（raw290、CRLF/LFのみ10）、既存診断5件を明示除外。通常reportの151 pendingは別PG実行で151 Passを確認する。

初回の[typecheck](typecheck-initial.log)はschema9 readiness検査をfresh installerにも誤挿入したため未定義versionで失敗した。挿入をread-only verifierだけへ修正し、[修正後](typecheck-after-fix.log)、最終型/全回帰を通した。PGは初回15件Pass。候補を元request/result/base/remote historyと照合する検査と改変拒否条件を追加し、最終16件を確認する。元log/reportを保持し、timeout/retryや外部依存を増やさない。

明示8→9でSource/Record/Page/鍵/元receiptを保持し、default Viewを生成しない。DDL衝突・再installは拒否し、readinessがcolumn不足で失敗しても自動修復しない。複数ViewでもSource/Recordは複製しない。既存Record replay/header、Page rename/metadata、Task APIをschema9で確認する。

exact再送/再起動、ID reuse、typed refs/Name/empty/unknown/schema違いを検証する。別fieldのstale patchをmergeし、unchanged/converged/filter object順違いをno-opとする。whole-field三値を保持し、同patchの非競合変更だけをcommitする。local/remoteを新operationで解決し、remote選択はcontent versionなしでresolved_byを保存する。元候補/receiptは不変。

unknown base、ID/観測版/選択値違い、古い準備済み基底、変更済みtargetをrejected receiptへ残し、候補を消費しない。別field更新後のfresh解決は現在基底で通す。UUID候補pageの順序/limit+1/lookaheadとhistory/receipt/candidate破損の拒否を確認する。元ledgerと異なる有効形式のlocal候補も拒否する。

ledger失敗は内容/候補/resolved_byをrollbackし、並行同IDは1結果、cross-Source同operation IDは敗者を全rollbackする。actual workerのCOMMIT前/後SIGKILLはcreateのView/history/ledgerが一緒に復旧し、再送で二重保存しないことを検証する。update/解決のrollbackはSQL失敗注入の証拠で、両操作のkillを別途実行したとはしない。owner/issuer/device/Source/View/deleted/失効、Source lock待機後のsession expiryを拒否する。fixture JWKS/ES256の実HTTPで401/403/400/409と成功/replayを確認し、Auth email/tokenをledgerへ保存しない。

UIコードは変更せずhelp12を再実行した。[v0.44.0のroot64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠として保持する。実Supabase login、host invoke/MS IME、Android/native grant、配備DB/backup暗号化と全DB/native Gateは別条件。

[集約](verification.json)、[重点](focused.json.gz)、[初回PG](initial-view-pg.json.gz)、[最終PG](view-pg.json.gz)、[PG log](view-pg-final.log)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[最終型](typecheck-final.log)、[API](api-build-final.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
