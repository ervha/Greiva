# 最終runより前の実PostgreSQL試験

初回9件中8件Pass・1件Fail。[raw log](postgres.log)、[Vitest JSON](vitest.json)、[JUnit](vitest.xml)を原形で保持する。

失敗は故意の台帳挿入例外について外側のmessageを検証していたassertionで、Drizzleが保持したcauseを検証するよう修正した。rollbackとretryの検証は削除していない。これは連続offline intent用local frameを追加する前のソースの結果で、最終版の試験として扱わない。[修正の説明](../../../../docs/failures/step-7-structured-server.md)。
