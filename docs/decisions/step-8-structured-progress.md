# Step 8: structured同期の進捗snapshot頻度

2026-10-03、v0.6.11。1,000操作の同期では各ACK後に全Task・Relation・operation履歴をSQLiteから読み出して表示用にserializeしていた。通常ACKの表示snapshotを100ms間隔に抑え、保存と送信順序は維持する。

各ACKのSQLite transaction完了を待って次のprepare/pushへ進む。local変更、pull、最終確認は即時refreshし、Conflict／rejectedも次のpush前にrefreshする。進捗の件数は直前snapshotを短時間保持するが、最終pendingとcursor/head一致を確認するまで同期済みにしない。protocol、DB schema、再送・ACKの永続性は変更しない。

[実SQLite回帰・Docker性能比較・通常Windows build](../../tests/evidence/step-8-structured-progress-20261003/SUMMARY.md)。追加3試験で保存順序・途中表示・local変更・Conflict/rejected即時表示を確認。1,000操作のsnapshotは1,024→300回、応答は375,154,898→109,974,939 bytes。観測同期時間は71.78→44.94秒だが、beforeに長いpullがあり、全差を変更の効果とはしない。Windows実機性能・製品SLOの保証ではない。
