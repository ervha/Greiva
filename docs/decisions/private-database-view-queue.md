# View端末queueの判断

2026-10-09 / v0.65.0。[契約](../development/PRIVATE_DATABASE_VIEW_QUEUE.md)。ユーザー選択Aの6型/Table・Listと既存View mutationを実装するための技術判断。追加の利用者手操作を必要としない。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | 作成/更新/解決を1つのView queueへ保存 | 同Viewの順序とpendingを共通で守る |
| 2 | createにbase/candidateを作らない | 未送信設定をconfirmed Viewと混同しない |
| 3 | pending Source定義を捕捉しsource blocked | Source確認前にfake schema/versionを作らない |
| 4 | Page本文へ依存しない | Viewは設定でありPage Record bindingを持たない |
| 5 | updateは実際のhistoryを捕捉 | 自己ACK予測や暗黙rebaseをしない |
| 6 | resolutionは既知候補と現在baseを照合 | remote値を保つ別field更新後のfresh明示解決を許容 |
| 7 | 同View未ACK1件、別attemptはbusy/noWrite | 元操作と未保存draftを区別し上書きを防ぐ |
| 8 | operation IDとcreate entityを一意にする | immutable replayとcreate/update再利用防止 |
| 9 | UTF8 wire 8MiBをenqueue前に確認 | 保存後に永久prepare不能な操作を作らない |
| 10 | Source/capture/index/wire SHAを照合 | 局所破損検知でAuth署名と主張しない |
| 11 | 元wireのformat/key順を保持 | retryで同じbodyを送れる |
| 12 | 配列順を保持しobject key順は無視 | View filter/column/sortの意味を維持 |
| 13 | ACK candidate base/local/remoteを原capture/replyへ照合 | 不整合な三値をqueue成功として保存しない |
| 14 | 原ACK/cache/historyとresolution proofは同transaction | 強制終了や失敗で片方だけ確定させない |
| 15 | remote no-change choiceも新operationのapplied解決 | 値を変えず候補を消費できる |
| 16 | rejectedは原結果保持、候補を消費しない | 編集適用成功と混同しない |
| 17 | read/deltaとqueue ACKを分離 | read先行だけで未送信を消さない |
| 18 | late ACK/current・first history/proof/cursor保護 | 古い結果で新観測を戻さない |
| 19 | receipt verifierは元queueだけを検査 | history/candidateとの循環再帰を防ぐ |
| 20 | exact replayは欠損を非補修で拒否 | 破損を成功へ変換しない |
| 21 | max100/1行SQL/32MiB window/256MiB single row | 大きなfilter・三値・原ACKでも全件fetchをしない |
| 22 | native16へbound移行、server11保持 | 既存queue/replica/Page/Taskを残す |
| 23 | native/Docker証拠とWindows IMEを分離 | PE/Driver/人工compositionはnative Gateではない |
| 24 | View HTTP/runtimeとTable/Listは次工程 | 端末queueを操作画面完成として数えない |
