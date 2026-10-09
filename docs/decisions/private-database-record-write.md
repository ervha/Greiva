# Record実HTTP送信の判断

2026-10-09 / v0.63.0。[契約](../development/PRIVATE_DATABASE_RECORD_WRITE.md)、[証拠](../../tests/evidence/private-database-record-write-20261009/SUMMARY.md)。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | native15/server11保持 | 既存queueとwriterを接続する |
| 2 | 種類明示の最古1操作 | 無制限drainや順序変更をしない |
| 3 | empty/Source・Page blocked分離 | 依存未確認でHTTPを呼ばない |
| 4 | prepare後の正確sequence capture要求 | currentから元base/候補を捏造しない |
| 5 | limit1/pendingOnly=false/keyset | ACK先行でも元operationを照合する |
| 6 | typed原replyと元triad検査 | 不正replyをstorage unknownにしない |
| 7 | 元format/空白/value key順保持 | 元wireの意味とbytesを分離する |
| 8 | 8MiB UTF8上限 | nativeと同じ送信限界 |
| 9 | context/Auth lease/ports固定 | account切替と遅着を除外 |
| 10 | 固定Record HTTP/Source ID照合 | origin/ownerを入力から選ばない |
| 11 | HTTP unknownは原wire再送 | server operation idempotencyで回復 |
| 12 | ACK unknownは元pairのみretry | network/prepare/captureを再実行しない |
| 13 | pending pairは両kindをbusyにする | 結果不明中の別操作を混ぜない |
| 14 | applied/conflict/rejected原結果分離 | ACKと値の適用を混同しない |
| 15 | close/refresh/replacement/403を永久閉鎖 | durable queueから新sessionで回復 |
| 16 | portable17/actual signed HTTP-native PG6＋回帰 | runtime/View/画面とnative Gateは後続 |
