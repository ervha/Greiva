# v0.43.0 DataSource保存の検証

2026-10-08 / Docker。[実装](../../../docs/development/PRIVATE_DATABASE_SOURCE.md)、[判断](../../../docs/decisions/private-database-source.md)。A回答に沿う初期6型/Table/Listのserver基盤で、Record/View保存・端末同期・DB画面の完成証拠ではない。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 初回Source PG | 11 Fail | fixture namespaceが既存strict prefix違反、cleanupが不存在schemaを参照。business未到達 |
| fixture修正後 | 9 Pass / 3 Fail | 2件は実catalog text順序bug、1件は既存Task ACK期待のfixture差 |
| 最終専用Source PG | 12 Pass | numeric column順へ修正、既存acknowledged契約を保持 |
| wire/cursor重点 | 8 Pass | strict/canonical ID、scope、bigint、署名/目的/device/head |
| 通常回帰 | 390 Pass | 既存382＋新8、PG別実行 |
| 実Postgres全回帰 | 106 Pass | 既存94＋Source12、Auth/Page/Task/kill保持 |
| root/Auth/workspace画面 | 64 / 12 / 52 Pass | 既存UI保持。新DB画面ではない |
| 型/frontend/native/features | Pass | owned版/通常flags0、native schema8 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE版/SHAのみ、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source280件一致（raw270、CRLF/LFのみ10）。既存診断5件は対象外として明示する。通常reportの106 pendingは別PG実行で106 Passを確認する。

schema5→6の明示移行、再install拒否、DDL全rollback/read-only readinessを確認する。create/read/exact replay/content再利用、foreign Source/owner/issuer/workspace/device/失効/canonical ID、不正schema、caller入力のasync前捕捉を実PGで検証する。head lockに待機する並行create/replayのcommit順とsession期限切れ、Source保存後のledger SQL失敗全rollbackを確認する。

101件のnumeric pagination、後から102件目を追加した固定head、他device/tamper cursor、100件filtered empty→101件目、lookahead/head/header破損fail closedを検証する。deleted filter試験を削除/Trash/端末purgeの提供と扱わない。actual protected runtimeへfixture JWKS/ES256でHTTP bootstrap/create/read/catalogを通し、missing token401/reused409/unknown device403を確認する。Auth email/tokenをSource/opへ保存しない。既存Page作成/title journalとTask ACKはschema6でも継続する。

最初のprefix違反はfixtureの設定を修正し、cleanupはowned namespaceに限りIF EXISTSを付けた。次の2件はSELECTでcreation_orderをtextへcastしたaliasがORDER BYで優先され、10が2より前に来る実SQL不具合だった。両queryをqualified numeric column順へ修正した。Task試験の期待だけは既存wireのacknowledgedへ合わせた。元の11Fail/9Pass3Failを保持し、最終Passへ置換しない。timeout/retry増加で隠さない。

[集約](verification.json)、[初回PG](initial-source-pg.json.gz)、[fixture修正後](source-pg-after-fixture.json.gz)、[最終専用PG](source-pg.json.gz)、[重点](focused.json.gz)、[型](typecheck-final.log)、[通常](normal.json.gz)、[PG全体](postgres.json.gz)、[root](root-ui.json.gz)、[Auth](auth-ui.json.gz)、[workspace](workspace-ui.json.gz)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependency/cache/exeをGitへ含めない。

このreceiptはSource作成結果で、Record同期/本文ACKではない。実Supabase login、host invoke/MS IME、Android/native grant、配備DB/backup暗号化、全DB/HELP/native Gateは後続。
