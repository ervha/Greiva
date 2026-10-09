# DB内容取得・保存sessionの判断

2026-10-09 / v0.55.0。[契約](../development/PRIVATE_DATABASE_CONTENT_SESSION.md)、[証拠](../../tests/evidence/private-database-content-session-20261009/SUMMARY.md)。既存Record/View cacheの接続に関する自主判断。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | Source-bound content session | 保存済み定義と対象scopeを固定 |
| 2 | context/Source/receiver捕捉 | 呼出元の変更から独立 |
| 3 | explicit read/catalog | openでHTTPを開始しない |
| 4 | Record/Page/View/三値の型照合 | 別resourceや無効値を保存しない |
| 5 | stale候補は観測として受け付ける | 最新field一致を強制しない |
| 6 | catalogはheadersだけ | 内容cache/ACK/fullsyncと分離 |
| 7 | max100/初回0/raw進捗/循環検査 | filtered空windowでも再開可能 |
| 8 | 一度に1操作 | read/catalogの交差を制御 |
| 9 | kind/ID/request/responseを保持 | 不明commitを別取得で置換しない |
| 10 | retryは同応答・networkなし | 最新readでは元commitを確認できない |
| 11 | 固定path/既存Auth HTTP再利用 | origin/path/保存先を注入しない |
| 12 | 新session成功後に旧session置換 | 無効なSourceで旧sessionを失わない |
| 13 | native store closeで自factory取消 | Source/contentの新HTTPを停止 |
| 14 | 401/403でconnection全体閉鎖 | cache保持はoffline/削除ACKと別 |
| 15 | portable13/actual HTTP-native PG3 | 専用のdriver54再利用と全回帰55を区別 |
| 16 | server11/native11保持 | delta/queue/runtime/UIへ続行 |
