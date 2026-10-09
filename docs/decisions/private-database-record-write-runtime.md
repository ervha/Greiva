# Record画面用runtimeの判断

2026-10-09 / v0.64.0。[契約](../development/PRIVATE_DATABASE_RECORD_WRITE_RUNTIME.md)、[証拠](../../tests/evidence/private-database-record-write-runtime-20261009/SUMMARY.md)。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | native15/server11保持 | queue schemaを変えず状態へ接続 |
| 2 | 同connection/lease/native ports固定 | account/世代/handleを取り替えない |
| 3 | local opening/enqueue/reloadはnetworkなし | server確認を捏造しない |
| 4 | 両読込みsettle後に一括採用 | half update/失敗時のfake emptyを避ける |
| 5 | create/update別pending max100 window | global countと表示件数を分離 |
| 6 | 種類別queueFresh | cached windowをserver同期完了へ昇格しない |
| 7 | separate more keyset/他window stale | 独立した進捗を保持 |
| 8 | 作成もSQL1行/32MiB window | 大きな原intent/wire/ACKを一括fetchしない |
| 9 | 元typed enqueue intent保持 | 保存結果不明とpost-read failureで同操作retry |
| 10 | reloadでunknown intentを消さない | native観測と確認手順を区別 |
| 11 | known busyはno write/new attemptを区別 | 元updateと新draftを上書きしない |
| 12 | busy後read failureでretryを捏造しない | 新draftを後から勝手に保存しない |
| 13 | empty/blocked/原ACKを区別 | rejectionや待ちを適用成功にしない |
| 14 | 原ACK unknown kind/pair保持 | pending0観測だけでunknownを消さない |
| 15 | known ACK後のread failureを分離 | 原結果を保持しnetwork再送を要求しない |
| 16 | close/observer/busy/共有store境界 | private stateを消し他機能を閉じない |
| 17 | runtime18/native24/actual HTTP-native9＋回帰 | 元型check Failと成功を分離 |
| 18 | View queue/6型TableListへ続行 | 同Record successor/新draftとnative Gateは後続 |
