# v0.56.0 DB差分端末保存の検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_CHANGES_STORE.md)、[判断](../../../docs/decisions/private-database-changes-store.md)。server11保持、native11→12。Record/Viewの差分・既知候補の解決状態・Source別cursorを原子保存する。HTTP差分session/runtime、作成・更新queue、Table/List画面は後続。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 専用native | 126 Pass | 新25＋旧101、実Rust/SQLite |
| 移行fixture再確認 | 13 Pass | 接続終了後に別接続でrollbackを検査 |
| 通常回帰・最終 | 524 Pass | PG190 skippedは別実行 |
| 全Postgres回帰 | 190 Pass | 既存signed HTTP/cacheもnative12で再確認 |
| help UI | 12 Pass | owned56、desktop/mobile、入力保持 |
| 型/frontend/native/features | Pass | flags0、server11/native12 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE56/SHA、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source327件一致（raw317、CRLF/LFのみ10）、既存診断5件を明示除外。通常初回523 Pass/1 Failは別report/logに保持する。Source schema8のpartial DDL失敗直後、Rust driverの接続解放より先にNode SQLiteを開いた際にdatabase is lockedとなった。expected failed open後にdriver終了を待ち、移行rollbackを別接続で確認するfixtureへ修正した。timeout/SQL busy timeout/retryを増やさず、検査項目を保持する。専用native初回126 Passと、修正後Source13/最終通常524を区別する。

新25条件はmixed Record/View window、read先行版と遅着履歴、三値候補/解決の単調保持、異なる解決IDやlate baseline矛盾の全window rollback、実SQLite trigger failure、filtered空window、Source/device/epoch/型/順序/count/canonical cursor、破損した元receipt/event/progress/history/候補/解決proof、欠損replay拒否、実64MiB超guard、旧schema/foreign binding/partial DDL、同時exact受信/Auth refreshを含む。17 snapshots×63 ASCII text×65536文字の実over-budget入力でnative guardを確認し、test-only size overrideを導入しない。高位orderはSQL fixtureで長期journal状態をseedし、9007199254740993→9007199254740994のactual native保存・再起動を確認する。初回受信を長期journal seedの証拠へ混同しない。

実SIGKILL2はmixed2entity・候補を含むwindowのCOMMIT前/後でnative processを停止する。current/history/entity receipt/元window/event/cursorが同じ境界で回復し、同window再受信が一度だけ保存されることを確認する。server側kill証拠は[v0.50.0](../private-database-changes-20261009/SUMMARY.md)へ分離する。

candidate coreは元null三値として不変に保持し、resolvedByと観測receiptを別columnへ保存する。read absenceや旧null/replayで解決を消さない。local loadは既知resolvedByを返し、server read/writeのactive-null制約を保持する。exact replayはproofを照合し、最新cursorを巻き戻さず、欠損event/history/candidateを補修しない。filtered空windowはraw位置だけを進め、cache削除・pending ACK・全DB同期済みを表さない。

native gdb1 envelopeはcanonical encoding/namespace/device/Source/journal/orderを照合する。HMAC鍵をnativeへ渡さず、JWT/Auth grant/署名検証を実装した証拠とはしない。native compact JSON合計64MiBはserver PG JSON text予算とは別guard。Source/schema/context/型/値と原子移行・再開を実driverで検証し、Page body/titleを生成しない。実Supabase正常login、Windows actual invoke/MS IME/Android/native credential・offline grant/配備暗号化/native Gateは別条件。

UI変更はなくhelp12のみ今回のowned版で実行し、[v0.44.0 root64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠として保持する。

[集約](verification.json)、[専用初回](initial-changes-store.json.gz)、[移行再確認](source-store-final.json.gz)、[通常初回](initial-normal.json.gz)、[通常初回log](normal-initial.log)、[最終通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型](typecheck-final.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
