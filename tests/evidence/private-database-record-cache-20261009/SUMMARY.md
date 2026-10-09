# v0.53.0 Record端末保存の検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_RECORD_CACHE.md)、[判断](../../../docs/decisions/private-database-record-cache.md)。native9→10、server11保持。read snapshot/既知候補のcacheで、送信queue/delta/HTTP runtime/UIは後続。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 初回native6 suite | 78 Pass / 1 Fail | Record16/17＋Source13＋旧native49、元fixture Fail保持 |
| 修正後専用 | 17 Pass | 実Rust/SQLite driver、SIGKILL2を含む |
| 通常回帰 | 464 Pass | 既存447＋新17、PG187は別実行 |
| 全Postgres回帰 | 187 Pass | server11を保持 |
| help UI | 12 Pass | owned53、desktop/mobile、入力保持 |
| 型/frontend/native/features | Pass | flags0、native10 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE53/SHA、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source320件一致（raw310、CRLF/LFのみ10）、既存診断5件を明示除外。通常reportのpending187は別PG187 Passと区別する。timeout/retry・外部依存を増やしていない。

専用17条件でtyped missing/null/zero/false/text/date/select/Name除外、Unicode65536/65537、calendar、restart/retry、候補21件とheaders101件、same-version/候補ID/Page divergence、strict scope/extra fields/raw IPC、receipt/history/current/candidate/baseline/lookahead破損を確認する。Page body/title/Nameを新規保存しない。schema9→10で旧Source/Page/pending保持、foreign identity/partial DDL rollback、並行再送とAuth refresh旧instance拒否を検証する。

seed候補が未観測のbase/remote版を参照しても履歴を創作しない。後から矛盾するbaselineを受信するとreceipt/historyごとrollbackし、整合baselineは最新currentを戻さず保持する。新しい空readで候補を解決済みにせず、stale候補も観測として保持する。候補を端末loadすることはserverの全active候補や解決状態の確定ではない。

COMMIT前後で実native driverをSIGKILLする2試行を専用suiteに含む。再起動時のcurrent/history/receipt/候補の件数が同じcommit境界に従い、同応答retry後も重複しない。

初回Failはadversarial responseのRecord IDを変更した際、fixture helperがrequestの対象IDも応答から作っていたため、別Recordとして正しく保存されたものだった。対象IDを元Recordへ固定し、portable/native双方のscope拒否を確認した。元[report](initial-record-store.json.gz)/[log](record-store-initial.log)を保持する。実装のscope検証を緩めていない。

HTTP wiring/永続operation ACK/DB cursor/削除・retention/全DB同期は未実装。Auth adapterはfixtureで、cache/handleはnative grantではない。実Supabase正常login、Windows invoke/MS IME/Android、配備暗号化/native Gateは別条件。UI変更はなくhelp12のみ今回のowned版で実行し、[v0.44.0 root64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠のまま保持する。

[集約](verification.json)、[専用](record-store.json.gz)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型](typecheck-final.log)、[packages](packages-build-initial.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
