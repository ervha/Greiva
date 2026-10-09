# DB作成端末queueの判断

2026-10-09 / v0.59.0。[契約](../development/PRIVATE_DATABASE_SOURCE_QUEUE.md)、[証拠](../../tests/evidence/private-database-source-queue-20261009/SUMMARY.md)。既存Source create/cacheのdurabilityに関する自主判断。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | native12→13/server11保持 | 独立Source操作表を追加 |
| 2 | pending定義をconfirmed cacheと分離 | 架空version/creationOrderを作らない |
| 3 | pure Source定義validator共有 | 6型/Name/label/IDsを同じ規則で検査 |
| 4 | 同operation/定義だけidempotent | mutable input/ID再利用を拒否 |
| 5 | Source IDも一意 | 同じSourceへ別createを並べない |
| 6 | context付き定義checksum | 局所破損を見逃さない |
| 7 | 元wire checksumと意味を照合 | 保存bytesの変化/scope混入を拒否 |
| 8 | 再prepareで元wireを返す | key順/形式を新buildで書き換えない |
| 9 | max4MiB native wire | UTF8入力を有界にする |
| 10 | max100＋lookahead/正確sequence | list読取を送信/ACKと分ける |
| 11 | prepareは最古未ACK1件 | pendingの順と再送内容を固定 |
| 12 | strict sequence/wire/原ACK照合 | 同IDの違う結果を拒否 |
| 13 | ACK/cache/historyを同transaction | 片方だけのconfirmationを防ぐ |
| 14 | 原create envelopeを保存 | 架空read receiptを作らない |
| 15 | create cache receiptはop proof必須 | 元定義/bytes/responseを検証 |
| 16 | 同snapshotのread/ACKを許容 | 元receipt保持、readでqueueを消さない |
| 17 | late ACKでcacheを戻さない | 先行readと旧historyを両立 |
| 18 | exact ACK replayで補修しない | 欠損/破損を空成功にしない |
| 19 | 新native21＋旧126/SIGKILL6 | queue段階/移行/rollback/破損を確認 |
| 20 | HTTP/Record/View queue/UIへ続行 | local durabilityを全同期/native Gateと扱わない |
