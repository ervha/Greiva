# DataSource保存の判断

2026-10-08 / v0.43.0。[実装](../development/PRIVATE_DATABASE_SOURCE.md)、[証拠](../../tests/evidence/private-database-source-20261008/SUMMARY.md)。利用者が初期範囲Aを回答。v0.41時点の暫定記録を保持し、この時点から確定として進める。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | Aの6型/Table/Listを初期範囲へ確定 | 今回の利用者回答。全型要求は保持 |
| 2 | Source保存をRecordより先行 | authoritative definitionをwriterに渡す |
| 3 | initial schemaVersion1/immutable definition | schema変更やmigrationを暗黙に作らない |
| 4 | existing owner/device transactionを使用 | signed sessionとscopeを実PGで照合 |
| 5 | IDはcanonical lowercaseのみ | PG UUID正規化とreceiptを一致させる |
| 6 | workspace head lockでcommit順を確定 | 未commitの採番をcatalogが飛ばさない |
| 7 | Source/receiptを同transactionへ保存 | partial成功や再送二重作成を避ける |
| 8 | 同operationはexact content/result | content変更や別device replayを拒否 |
| 9 | 再送にもactive Auth/Sourceを確認 | 古いreceiptを権限の代わりにしない |
| 10 | readだけがfull definitionを返す | catalog応答をbounded headerにする |
| 11 | numeric columnで明示ORDER BY | cast後text aliasの辞書順を避ける |
| 12 | limit+1/lookaheadも検査 | 欠落/破損を成功へ隠さない |
| 13 | filtered windowのraw位置を進める | deleted行だけの範囲でも続行可能 |
| 14 | HMAC目的/owner/device/headを固定 | cursor混用と途中追加の境界を保つ |
| 15 | 明示5→6/read-only readiness | 既存DB/鍵を自動変更・修復しない |
| 16 | 元Failと最終Passを分離 | fixture失敗と実SQL順序bugを保持 |
