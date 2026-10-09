# DB差分取得・保存sessionの判断

2026-10-09 / v0.57.0。[契約](../development/PRIVATE_DATABASE_CHANGES_SESSION.md)、[証拠](../../tests/evidence/private-database-changes-session-20261009/SUMMARY.md)。既存DB journal/native deltaの接続に関する自主判断。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | server11/native12保持 | 今回は通信と保存の接続 |
| 2 | Source/context/port捕捉 | mutable参照/遅着対象の混入を防ぐ |
| 3 | native factoryはcached Source必須 | unknownを確認済みへ偽装しない |
| 4 | opening/progressはlocalのみ | 明示取得前に通信しない |
| 5 | 1window/max100/default50 | 有界取得、背景pollを導入しない |
| 6 | durable progressからcursor生成 | 呼出側after overrideを避ける |
| 7 | scope/型/journal/raw進捗照合 | portable/native両境界を保つ |
| 8 | filtered空windowも進捗 | 削除ACK/purge/queue清算と分離 |
| 9 | unknown pairをimmutable保持 | COMMIT返却消失も同応答retry |
| 10 | retryはnetworkなし | 新しい応答でunknownを上書きしない |
| 11 | post-commit progress再読取 | 古い再送で最新cursorを巻き戻さない |
| 12 | reload失敗もpair保持 | 保存成功と観測成功を区別 |
| 13 | 不正置換は旧session保持 | 構築成功後だけcloseする |
| 14 | native closeも自sessionを取消 | late HTTP/新通信を停止 |
| 15 | portable13＋signed HTTP-native PG4 | 2client/再開/解決/deny/世代を確認 |
| 16 | runtime/queue/UIへ続行 | 観測を全同期/native Gateと扱わない |
