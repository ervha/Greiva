# DB変更履歴・取得の判断

2026-10-09 / v0.50.0。[実装契約](../development/PRIVATE_DATABASE_CHANGES.md)、[証拠](../../tests/evidence/private-database-changes-20261009/SUMMARY.md)。回答済み初期6型/Table/Listの同期基盤を進める自主判断。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | 明示server10→11 | startupによる業務DB自動変更を避ける |
| 2 | Source別durable epoch/head | 空Sourceも再起動後同じ世代を使う |
| 3 | Source createとheadを同transaction | 成功Sourceに不足journalを作らない |
| 4 | schema version UPDATE/既存SHARE barrier | 旧writerを排出してseedと新writerを原子分離 |
| 5 | current＋全既知候補seed | 未解決/解決済み状態の受信を保全 |
| 6 | stable ID順seed | 過去commit順を推測しない |
| 7 | 候補を元ledger/historyへ照合 | 三値や解決IDをshapeだけで信用しない |
| 8 | writer/ledger/event/head原子保存 | 再送・SQL失敗で二重eventや偽ACKを防ぐ |
| 9 | remote no-op解決にもevent | 内容版が変わらない解決を通知 |
| 10 | unchanged/rejected/replayは追記なし | 無変化を同期変更として増幅しない |
| 11 | Page-before-Source lock | Record writerとの逆順待機を避ける |
| 12 | 観測head固定＋再読照合 | concurrent新eventを次pullへ安全に渡す |
| 13 | max100/64MiB window＋1lookahead | 値の大きさもboundedにし、飛ばさず再開 |
| 14 | numeric/raw連続順とfiltered進捗 | 10以上の文字列順を修正し、削除ACKと分離 |
| 15 | PG23・実SIGKILL4試行・元Fail保持 | 初回19Pass/4Failを修正後Passで隠さない |
| 16 | native8/既存API保持 | 端末DB適用/UIや実native Gateへ証拠を昇格しない |
