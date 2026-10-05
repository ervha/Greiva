# 個人workspaceの読取認可 — 0.8.0

2026-10-05、Docker内。Domainのowner/resource policy、Applicationの不変対象capture、PostgreSQL read-only snapshot adapterを追加。[全12判断](../../../docs/decisions/private-workspace-access.md)。

| 確認 | 結果 |
| --- | --- |
| 型/通常build/Windows release cross-build | Pass |
| 通常unit/integration | 74 Pass、実DB専用21 skip。新policy10含む |
| 専用PG | 21 Pass/skip0。新policy1含む |
| 実PG policy1の内容 | ownerのworkspace/Page/typed targets、cross-owner拒否、foreign/deleted/missing拒否、両workspace所有時の拒否、次requestのowner変更反映 |
| isolation | 自分で作成したfresh schemaだけDROPしremaining0。PoC schema不変 |
| 版/依存/source | 所有0.8.0、外部npm314/Cargo不変、normal build source78ファイルhost一致 |

[集約](verification.json)、gzipのVitest原report、実build原log/hashを保持。通常exeはignoredローカル領域。既存画面/HTTP/CRDT handlerへまだ配線していないため、59画面E2Eは今回再実行していない。前回0.7.0の[回帰](../production-foundation-20261005/SUMMARY.md)と区別する。

PGはauthoritative viewと同じcolumn契約のfixture tableを使う。これはproduction migration/viewの完成ではない。session主体はfixtureから供給し、JWT署名/issuer/audience/expiry、実Supabaseログイン/refresh、device失効/RLS、write transaction、CRDT接続の長時間失効は未検証。今回を本番認可やnative IME/Android製品のPassへ換算しない。
