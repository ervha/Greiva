# v0.46.0 View変更・競合計画の検証

2026-10-09 / Docker。[契約](../../../docs/development/BASIC_DATABASE_VIEW_MUTATION.md)、[判断16件](../../../docs/decisions/basic-database-view-mutation.md)。portable Domainのintent/planの証拠で、actual View保存・同期・Table/List画面の完成ではない。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 初回/最終専用 | 各11 Pass | clone/freeze、設定型、refs、whole-field三値、fresh/stale解決 |
| 通常回帰 | 411 Pass | 既存400＋View11、PG別実行 |
| 全Postgres | 135 Pass | 既存server1–8、Source/Record/Page/Task/API/kill回帰 |
| help UI | 12 Pass | owned manifest46、desktop/mobile、検索・入力保持 |
| 型/API/frontend/native/features | Pass | server8/native8保持、通常flags0 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE/SHAのみ。未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source294件一致（raw284、CRLF/LFのみ10）、既存診断5件を明示除外。通常reportの135 pendingは別PGで135 Passを確認する。試験Failはない。初回11件の後、object key比較をlocale非依存のcodepoint順へ明確化し、cloneテストのoriginalを明示捕捉した。最終sourceの専用11/全回帰を確認する。timeout/retryや外部依存は増やしていない。

Source/schema/View ID、Name表示、未知/空/undefined patch、typed filter/sortと参照を拒否・照合する。呼出元のarray変更後もcaptured設定が不変で、operation ID/server versionを仮採番しない。別fieldの変更を両方保持し、同fieldのfilter/ordered columns/sortsはwhole-field三値を返す。object key順による偽競合を起こさず、配列順は意味として保持する。

exact base、同versionの異なるsnapshot、逆行版、候補scope/型/三値を検査する。local/remote選択は元候補を変えず新intentとなる。別fieldの更新後も対象remoteが同じなら現在baseでfresh準備できるが、以前に準備済みの古いintent、resolved候補、観測版/選択値/候補IDの改変、複数field解決、変更済み対象remoteは拒否する。remote選択の内容no-opはdurable resolved_byの保存成功ではない。

UIコードは変更せずhelp12だけを再実行した。[v0.44.0のroot64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)をv0.46の結果に置き換えない。実Supabase login、host invoke/MS IME、Android/native grant、配備DB/backup暗号化と全DB/native Gateは別条件。

[集約](verification.json)、[初回専用](focused.json.gz)、[最終専用](focused-final.json.gz)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型](typecheck-final.log)、[frontend/API](frontend-build.log)、[native](native-build.log)、[crash build](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe metadata](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
