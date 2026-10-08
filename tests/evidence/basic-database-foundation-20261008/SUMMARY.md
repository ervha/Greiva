# v0.41.0 基本DB基盤の検証

2026-10-08 / Docker。[実装と範囲](../../../docs/development/BASIC_DATABASE_FOUNDATION.md)、[判断](../../../docs/decisions/basic-database-foundation.md)。利用者向けDB操作画面やdurable DB adapterの完成とはしない。

| 検証 | 結果 | 対象 |
| --- | --- | --- |
| 新DB契約 | 15 Pass | 型/scope/binding、未設定、view/filter/sort、上限、clone/readonly |
| 通常回帰 | 365 Pass | 既存350＋新15。PGは別実行 |
| 実Postgres | 94 Pass | 既存Auth/Page/title/changes/structured/kill回帰 |
| root/Auth/workspace画面 | 64 / 12 / 52 Pass | 既存操作とhelp版表示、新DB画面試験ではない |
| 型/frontend/native/features | Pass | owned版と通常flags0 build |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE版/SHAのみ。未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source272件一致（raw262、CRLF/LFのみ10）。既存診断5件を対象外として明示する。

SourceのName/Property/optionの一意性、UUIDとworkspace/source/Page ID参照、Select rename後の安定ID、0/false/blank/null/欠落の保全、Numberのcoerce拒否、実在日付を検証する。Pageの実在・所属・権限の検査はadapterでの次工程で、Domainのscope一致だけで認可を証明しない。Nameをvaluesへ二重保存することと、未取得タイトルを空文字へ代入することを拒否する。filterの型/未知参照/3段・predicate上限、viewの独立性、未設定末尾/複数sort/ID tie、重複binding/1000件上限、input不変とdeep freezeを確認する。

queryは渡されたlocal loaded-windowの処理で、server検索・全体pagination・最新性の成功ではない。typed command、atomic DB保存/同期/Conflict、Table/List UIとDB-01〜17全受入は後続である。実Auth、Windows host invoke/Microsoft IME、Android、配備暗号化・native grantも別条件。既存schema5/8・wireと通常入口を保持する。

[集約](verification.json)、[DB重点](focused.json.gz)、[通常](normal.json.gz)、[PG](postgres.json.gz)、[root](root-ui.json.gz)、[Auth](auth-ui.json.gz)、[workspace](workspace-ui.json.gz)、[型](typecheck-final.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logの行末空白のみ整理し、credentials/DB/dependency/cache/exeはGitへ含めない。
