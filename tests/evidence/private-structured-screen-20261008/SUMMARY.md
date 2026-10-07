# 個人workspace Task・Relation画面の検証

2026-10-08 / v0.31.0。専用workspace previewへscoped Task/Relation runtimeをmount。旧root/CSPは保持。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 通常 | 269 Pass / 70 Skip | controllerのstructured所有/close/reopen/draft guardを追加。旧native/保存/同期回帰 |
| PostgreSQL | 70 Pass | signed HTTP＋実PG/Rust SQLiteでcontrollerのPage→Task Relation、kill/reopen pending、同ledger1件、Auth更新時取消。runtime三値/ACK loss/拒否/失効も含む |
| 専用画面 | 18 Pass / retry0 | PC/360px dark/reduced motion、typed CRUD、date/status、focus/keyboard、pending re-login、保存結果不明の同ID、copyable draft、composition、三値解決、rejectionと未保存状態、既存Page操作 |
| 型/fixture型 | Pass | app/test、独立TSX fixture noEmit。最後のdate CSS/assertion以外の全sourceを確認 |
| Rust/frontend/Windows | Pass | normal/crash examples、通常flags0 frontend/default native feature、locked debug/custom-protocol。host exe version/SHA確認。未起動/IME未実施 |
| source/依存 | Pass | 236一致：raw224/LFのみ12、診断5を除外。外部npm315/両Cargo118・501 entry不変 |

画面初回14 Pass/2 Failは、nested labelのtext照合でselectが見つからないlocatorの誤り。実際のaccessible nameが正しいcomboboxへ変更し16 Passを確認した。追加状態試験を含む次の17 Pass/1 Failは、fixtureが前のsync完了を待たず、busy中にseed/pullしたため。観測した同期完了をawaitしてから注入するよう修正した。

その次の16 Pass/2 Failは、画面試験と通常/frontend buildを並行実行し、Viteの再読込みが途中で起きた検証手順の誤り。ログにnavigationとexecution context destroyedを保持する。buildが完了してから画面試験を単独実行し18 Passを確認した。retriesを増やさず、失敗を後のPassで置換しない。

PG初回69 Pass/1 Failは、追加したaudit queryがledgerにない物理columnを参照した誤り。既存schemaに従いimmutable result JSONのentityType/entityIdを読んで確認するよう修正し、全70 Pass/unhandled0を再確認した。

画像レビューでdarkの日付アイコンが黒かったため、native date inputへlight/darkのcolor-schemeを指定し、CSS assertionと18件の画面回帰、通常frontend/Windows buildを再確認した。根拠のない本番/native合格へ転用しない。既存root/Auth UIは今回未再実行（前checkpointの64/12を保持）。

再現はDockerの `npm run typecheck`、`npm test`、既存DB設定の `npm run test:postgres`、独立fixture型検査、normal flags0の `npm run build`、locked Rust examples/Windows cross-build、build完了後に `npm run test:workspace-e2e`。検証のbuildとdev画面試験を同じsource treeで並行させない。

[集約](verification.json)、[通常](normal.json.gz)、[PG](postgres.json.gz)、[画面](workspace-ui.json.gz)、[初回locator](initial-workspace-ui.json.gz)、[fixture busy](busy-workspace-ui.json.gz)、[並行build再読込み](reload-workspace-ui.json.gz)、[PG audit初回](initial-postgres.json.gz)、[型](typecheck.log)、[fixture型](fixture-types.log)、[Rust](native-build.log)、[crash](crash-build.log)、[frontend](frontend-build.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[features](native-features.log)、[source](source-inventory.json)、[依存](version-audit.json)、[desktop](workspace-structured-desktop.png)、[360px dark](workspace-structured-mobile-dark-reduced-motion.png)、[修正前dark](before-calendar-mobile.png)、[契約/12判断](../../../docs/development/PRIVATE_STRUCTURED_SCREEN.md)。reportはconfig除外/gzip、logは行末空白だけ整理。secret/JWT pattern/相対リンクを確認し、DB/trace/実行物をGitへ含めない。

実Auth正常系、Windows invoke/Microsoft IME、Android、native Auth/credential/offline grant、本番入口への昇格、暗号化配備、Page metadata同期は残条件。今回の追加利用者操作依頼はない。v0.28–0.30のsummaryにあった外部npm数323は、既存監査JSONの315へ説明だけ訂正した。
