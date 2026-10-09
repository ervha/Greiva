# DB Record端末保存の判断

2026-10-09 / v0.53.0。[契約](../development/PRIVATE_DATABASE_RECORD_CACHE.md)、[証拠](../../tests/evidence/private-database-record-cache-20261009/SUMMARY.md)。既存のSource/Record契約に基づく自主判断。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | native9→10、server11保持 | 端末read replicaを独立追加 |
| 2 | 保存済みSourceを必須 | property/Select/schemaを照合 |
| 3 | nativeでもstrict型/scope | portable検査のbypassを防ぐ |
| 4 | canonical receipt hash | 同じ観測のretryを重複保存しない |
| 5 | current/history/receipt/候補を原子保存 | 強制終了で部分状態を残さない |
| 6 | 同版divergenceを拒否 | 既存snapshotを書き換えない |
| 7 | 古いreplyはhistoryのみ | 最新projectionを戻さない |
| 8 | Page binding固定/Source内unique | Recordのresourceをすり替えない |
| 9 | Page body/Nameを生成・複製しない | typed resource参照と本文を分離 |
| 10 | read候補は既知観測として保持 | absenceからresolutionを推論しない |
| 11 | stale候補のremoteは旧版のまま | 最新fieldへの一致を強制しない |
| 12 | known historyだけ照合 | 未観測baselineを創作しない |
| 13 | late baselineの影響を100件ずつ確認 | 矛盾は新履歴と一緒にrollback |
| 14 | 候補20/headers100＋lookahead | bounded local読取と破損検査 |
| 15 | 17条件/旧native62/SIGKILL2 | 初回fixture Failも保持 |
| 16 | View/delta/queue/runtime/UIへ続行 | cacheをACK/fullsync/native Gateと扱わない |
