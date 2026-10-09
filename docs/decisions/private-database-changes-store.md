# DB差分端末保存の判断

2026-10-09 / v0.56.0。[契約](../development/PRIVATE_DATABASE_CHANGES_STORE.md)、[証拠](../../tests/evidence/private-database-changes-store-20261009/SUMMARY.md)。既存journal/read cache統合の自主判断。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | native11→12、server11保持 | 端末delta/progressを追加 |
| 2 | 保存済みSourceへstrict照合 | kind/scope/schema/型を固定 |
| 3 | max100/raw差/compact64MiB guard | native側のbounded window、PG予算とは別 |
| 4 | gdb1 canonical envelope照合 | namespace/device/Source/journal/orderを検査 |
| 5 | HMAC鍵をnativeへ渡さない | Auth/署名検証の証拠へ誤用しない |
| 6 | Source別receipt/event/progress | current/candidate/cursorを原子保存 |
| 7 | saved cursorからのみ前進 | 旧基底/世代変更を拒否 |
| 8 | filtered空windowは位置のみ | 削除やcache purgeを推論しない |
| 9 | readとdeltaの保存helper共有 | 同版・late replyの規則を統一 |
| 10 | delta receiptは元window/event参照 | 架空read responseで証拠を作らない |
| 11 | candidate coreと解決proofを分離 | nullで既知解決を消さない |
| 12 | 異なる解決IDを拒否 | immutable解決観測を維持 |
| 13 | local loadにresolvedByを返す | active表示/既知解決を区別、server read保持 |
| 14 | replayは照合だけで修復しない | 古い再送で巻戻し・欠損再構築を防ぐ |
| 15 | native25＋旧101/SIGKILL2 | mixed atomicity/移行/破損/byte budgetを検証 |
| 16 | HTTP delta/queue/runtime/UIへ続行 | receivedをACK/fullsync/native Gateと扱わない |
