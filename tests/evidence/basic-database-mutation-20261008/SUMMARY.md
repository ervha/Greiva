# v0.42.0 DB変更・三値比較の検証

2026-10-08 / Docker。[実装](../../../docs/development/BASIC_DATABASE_MUTATION.md)、[判断](../../../docs/decisions/basic-database-mutation.md)。pure planとsnapshot契約で、DB adapter/operation ledger/画面の実装済み証拠ではない。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 初回型 | Fail | test fixtureのpropertyId重複（TS2783） |
| 修正後型 | Pass | 重複宣言を除き、同値をplanから取得 |
| DB重点 | 32 Pass | 新mutation17＋既存型/query15 |
| 通常回帰 | 382 Pass | 既存365＋新17、PG別実行 |
| 実Postgres | 94 Pass | 既存Auth/Page/metadata/structured/kill |
| root/Auth/workspace画面 | 64 / 12 / 52 Pass | 既存画面/版の保持、新DB画面ではない |
| frontend/native/features | Pass | owned版/通常flags0 build |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE版/SHAのみ。未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source274件一致（raw264、CRLF/LFのみ10）。既存診断5件を対象外として明示する。

初回型検査はテスト用candidate構築でpropertyIdを明示した後に同じfieldをspreadしていたことを報告した。重複fieldを除き、planの値だけを使って修正した。初回logを保持し、runtimeのFailや認可のFailとして分類しない。新unitの実行失敗はない。

create/updateのstrict schema、source/definition snapshot、Name/空patch/不正値を検証する。異field merge、同field三値、local無変更/remote一致のno-op、false/0/blank/null/missing、同版の異内容、binding/基底不一致を確認する。local/remote解決は新intentで、候補を消さず、変更された版/値/対象/解決済み、snapshotなし、改変choice、多fieldの混入を拒否する。

authoritative Source/history/activeConflictの入力をdoubleで用意している。これだけでactual認可・原子保存・候補解決・immutable操作再送を証明しない。pure proposedValuesやstatusを保存・送信成功へ扱わない。DB source/view/recordの実adapter/画面、全DB受入、実Auth、host Tauri invoke/MS IME、Android/native grant、配備暗号化は後続。既存server5/native8/wireと元証拠を保持する。

初回重点31件Pass後、保存層の設計中に「無関係なfield更新で候補まで選べなくなる」条件を補強した。候補fieldが同じなら新しい現在snapshotから解決を準備でき、旧prepared intentは追越し後の適用を拒否する。候補のremoteVersion/三値を上書きせず、新17番目の試験と全回帰を最終sourceで実行する。前段31件は[変更前重点](initial-focused.json.gz)へ分ける。

[集約](verification.json)、[重点](focused.json.gz)、[初回型](typecheck-initial.log)、[修正後型](typecheck-focused.log)、[最終型](typecheck-final.log)、[通常](normal.json.gz)、[PG](postgres.json.gz)、[root](root-ui.json.gz)、[Auth](auth-ui.json.gz)、[workspace](workspace-ui.json.gz)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependency/cache/exeをGitへ含めない。
