# DB View端末保存の判断

2026-10-09 / v0.54.0。[契約](../development/PRIVATE_DATABASE_VIEW_CACHE.md)、[証拠](../../tests/evidence/private-database-view-cache-20261009/SUMMARY.md)。既存のSource/View契約に基づく自主判断。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | native10→11、server11保持 | 端末View read replicaを追加 |
| 2 | 保存済みSourceへ照合 | 列/filter/sort/schemaを検査 |
| 3 | native strict設定validator | portable検査bypassを拒否 |
| 4 | Nameをvisibleに保持 | Page由来Nameの表示契約を維持 |
| 5 | 配列順をそのまま保存 | visible/filter/sortsはwhole-field |
| 6 | filter深さ3/children20/predicate100 | finite Domainの境界を一致 |
| 7 | 6型operator/valueを照合 | contains/range/Select/Dateをcoerceしない |
| 8 | canonical receiptと原子4表保存 | exact retryと強制終了回復 |
| 9 | 同版divergenceを拒否 | 版履歴を上書きしない |
| 10 | 古いreplyでcurrentを戻さない | 最大保存版とprovenanceを照合 |
| 11 | readは既知候補観測 | absenceから解決・削除を推論しない |
| 12 | known history/late baseline検査 | 未受信版は生成せず矛盾をrollback |
| 13 | 候補20/headers100＋lookahead | bounded読取と破損検査 |
| 14 | schema10移行でRecord等保持 | foreign identity/partial DDLを拒否 |
| 15 | View22＋既存79/SIGKILL2 | 元compile/移行fixture Failを保持 |
| 16 | delta/queue/runtime/UIへ続行 | cacheをACK/fullsync/native Gateと扱わない |
