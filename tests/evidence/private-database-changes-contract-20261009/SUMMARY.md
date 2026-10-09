# v0.49.0 DB変更契約の検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_CHANGES_CONTRACT.md)、[判断](../../../docs/decisions/private-database-changes-contract.md)。portable packet/Source検証とserver cursor codecの証拠で、actual journal/取得API/端末適用は次工程。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 重点 | 8 Pass | mixed event/候補解決/型/refs/raw進捗/gdb1 |
| 通常回帰 | 426 Pass | 既存418＋新8、PG別実行 |
| 既存Postgres回帰 | 162 Pass | server1–10の保存/一覧/API/kill、journal追加なし |
| help UI | 12 Pass | owned49、desktop/mobile、検索・入力保持 |
| 型/API/frontend/native/features | Pass | server10/native8保持、通常flags0 |
| Windows cross-build | Pass | Docker debug/custom-protocol。host PE/SHA確認、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source309件一致（raw299、CRLF/LFのみ10）、既存診断5件を明示除外。通常reportの162 pendingは別PGで162 Passを確認する。今回の試験Failはなく、timeout/retryや外部依存は増やしていない。

Record/View混在snapshot、未解決候補とresolvedBy付き候補をclone/deep freezeする。呼出元のRecord値を変更しても受信packetは不変。workspace/Source/schema、Record/Page/View候補ID、remote観測版、候補field型/refs/三値を検査する。Page-bound NameをRecordへコピーする値、Numberへの文字列、未知property、Name非表示、typed filter/sortの不正参照を拒否する。

raw filtered progressの空応答やvisible event gapを許容し、hasMoreのまま同位置に戻る応答、重複/逆順/範囲外/0位置、次cursorなし、unsupported protocol/extra data/101件を拒否する。この受信wireはserver内部raw journalが連続することを単独では証明しない。

gdb1はexact BigInt、workspace/epoch/device/Source/journalEpochの全scope、目的とcopied secretへ束縛する。鍵配列を呼出元で変えても既存codecは不変。別鍵/世代/device/Source/作成一覧gdv1、未来位置、改変/canonical base64/署名/位置/大文字scopeを拒否する。0/headの完了cursorを表現できるが、codec成功をserver/端末commitや同期完了へ扱わない。

server10/native8、旧保存/APIは変更しない。今回のPG162は既存回帰で、新journalのPG証拠ではない。UIコードも変更せずhelp12を再実行する。[v0.44.0のroot64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠として保持する。実Auth/host invoke/MS IME/Android、配備暗号化と全DB/native Gateは別条件。

[集約](verification.json)、[重点](focused.json.gz)、[通常](normal.json.gz)、[既存PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型](typecheck-final.log)、[API/frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
