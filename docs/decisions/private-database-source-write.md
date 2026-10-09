# DB作成の送信・状態管理の判断

2026-10-09 / v0.60.0。[契約](../development/PRIVATE_DATABASE_SOURCE_WRITE.md)、[証拠](../../tests/evidence/private-database-source-write-20261009/SUMMARY.md)。既存create/queueを接続する自主判断。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | server11/native13保持 | schema変更を要しない |
| 2 | context/Auth/portsを生成時捕捉 | account切替で送信先や保存先を変えない |
| 3 | fixed create pathと元wire送信 | prepared bytesを再生成しない |
| 4 | explicit sendは最古1件 | 無断background drainを追加しない |
| 5 | 空queueはnetworkなし | local openingと送信を区別 |
| 6 | strict prepared/reply照合 | operation/定義/Scope/version1の混入拒否 |
| 7 | HTTP不明は元wire再送 | 架空ACKを作らずidempotency保持 |
| 8 | ACK不明は元pair再保存 | prepare/HTTPを繰り返さない |
| 9 | enqueue不明は同intent保持 | 別IDで重複createしない |
| 10 | 保存後一覧失敗もenqueue不明保持 | 同intentで結果を確かめる |
| 11 | local reloadでunknownを消さない | projection観測と操作確認を分ける |
| 12 | ACK成功後一覧失敗はstale表示 | 既知ACKを結果不明へ戻さない |
| 13 | pending-only max100/正確keyset | 完了履歴で未送信が隠れない |
| 14 | strict boolean/no schema change | Registryをcoerceせずdefaultはportableのみ |
| 15 | own writer close/共有store保持 | 画面閉鎖でPage/Task保存を止めない |
| 16 | 置換/refresh/native closeで遅着拒否 | server保存済みでも旧generationへACKしない |
| 17 | fixed error/observer安全 | private cause漏出・再入通信を防ぐ |
| 18 | portable20/native2/actual PG3 | Record/View queue・画面/native Gateへ続行 |
