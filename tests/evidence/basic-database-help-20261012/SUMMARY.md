# 基本DBの同梱ヘルプ checkpoint

2026-10-12 / v0.73.0 / native16 / server11。[契約](../../../docs/development/BASIC_DATABASE_HELP.md)。

基本DBの作成/確認済み表示、行作成・型付き更新、View設定と競合解決の3記事・基本DBカテゴリ・操作付近の3入口を追加した。計12記事。start/save-sync/local-saveを改訂2へ更新し、未提供のDB案内を修正する。読み込み範囲/Name未取得、独立した保存・確認状態、型値/三値/原拒否、元保存の再確認・HTTP再送とACK再保存を案内する。削除/型追加/高度なDB/backup取り込みを提供済みとしない。

| 対象 | 結果 | 証拠 |
| --- | --- | --- |
| 既存ヘルプunit | 4 Pass（記事ID/改訂の受入を更新） | [report](focused.json.gz)、[log](focused.log) |
| 全unit | 471 Pass | [report](normal.json.gz)、[log](normal.log) |
| ヘルプ専用画面 | 16 Pass（新DB 4） | [report](workspace-ui-focused.json.gz)、[log](workspace-ui-focused.log) |
| 全workspace画面 | 98 Pass / 0 flaky | [report](workspace-ui.json.gz)、[log](workspace-ui.log) |
| 型・server・frontend hooks0 | Pass | [型](typecheck.log)、[server](servers.log)、[frontend](frontend-build.log) |
| Docker Windows custom-protocol候補 | Pass・host未起動 | [build](windows-build.log)、[metadata](windows-build.json)、[PE/SHA照合](host-exe-inspection.json) |
| Host/Docker source | 369：raw359、LF10、意図的excluded5 | [inventory](source-inventory.json)、[集計](verification.json) |
| 外部依存 | npm315/Cargo501・118 unchanged | [audit](version-audit.json) |

追加画面は未ログイン/オフラインで3記事のカテゴリ・全角View検索と0件保持を確認し、検索のHTTPがないことを確認する。unknown View元入力/operation/queue/Page本文を変えず、ヘルプ閉鎖後に同input/focus/選択範囲を復帰でき、元retryをそのまま使えることを確認した。変換中は入口を止める。既存ヘルプの本文/タイトル/Task保全も全画面で保持した。

初回は14 Pass / 2 Fail。新試験がtype=search inputをtextbox roleで探してtimeoutした。原[report](initial-workspace-ui.json.gz)・[log](workspace-ui-initial.log)を保持し、既存と同じgetByLabelへ修正後、16/全98 Passを確認した。appの検索不具合へ読み替えない。

[desktop記事](workspace-db-help-desktop.png)・[mobile記事](workspace-db-help-mobile-dark-reduced-motion.png)を保存し、mobileの表示を確認した。記事とRoot入口だけの変更で、保存/API/認証/schemaを変えない。実PG/native SQLiteの全223条件は[直前v0.72.0](../private-database-view-screen-20261012/SUMMARY.md)の結果であり、この区切りでは再実行していない。全unit471を通常integration含む775の新回帰とはしない。

次はP4の個人workspace候補の起動設定・隔離した成果物と再開手順へ進む。Windows cross-buildはactual invoke/MS IMEの合格ではない。実Supabase正常系/Native Auth custody/offline grant、Android native、配備暗号化/backup/restore・署名/配布と最終Gateは別条件。