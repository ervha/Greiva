# View実HTTP・runtimeの判断

2026-10-09 / v0.66.0。[契約](../development/PRIVATE_DATABASE_VIEW_WRITE.md)。既存View queueと利用者が選択した6型/Table・Listへ続く実装判断。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | View queue全体の最古1件を明示send | create/updateは同じnative順序を使う |
| 2 | empty/Source blockedはHTTPを呼ばない | 架空wire/ACKを作らない |
| 3 | exact sequenceの元rowを捕捉 | currentやfake versionへbaseを置換しない |
| 4 | Source/base/candidate/intent/wire/contextを照合 | immutable操作と保存先のbindingを維持 |
| 5 | 固定View write URLへ元bytesをPOST | caller pathを受けずformat/key順を保持 |
| 6 | 元rowとreplyをqueue schemaで検証 | 既存のSource-bound原結果契約を再利用 |
| 7 | 全field triad/version/resultと重複fieldを検査 | malformed replyからACK retryを作らない |
| 8 | filter object key順は意味としない | 配列順/whole-field意味は保持 |
| 9 | HTTP unknownは同操作を再prepare/再送 | durablequeueとserver immutableledgerで再開 |
| 10 | ACK unknownは元pair networkless retry | 成功済みHTTPを再送せず原応答を保存 |
| 11 | generation/replacement/store closeでpair閉鎖 | 遅着応答を新Authへ採用しない |
| 12 | View senderを独立追跡 | 同connectionのRecord/Source/Pageを置換しない |
| 13 | local opening/queueFresh/byte keyset/global count | 一覧成功をserver同期完了へ変換しない |
| 14 | read failureは元dataをstale保持 | fake emptyを作らない |
| 15 | unknown enqueueをreload後も保持 | commit return lossを無保存と決め付けない |
| 16 | known busyは新attempt retryを解除 | 未保存draftの意図しない再保存を防ぐ |
| 17 | empty/blocked/原applied-conflict-rejectedを分離 | 適用成功と原結果確認を区別 |
| 18 | known ACK後read failureはACK retryなし | 原lastSendを保持し後でlocal再読込 |
| 19 | closeは私有状態と自sessionのみ | 共有workspace storeを保持 |
| 20 | Docker HTTP/native証拠とactual Auth/IMEを分離 | Gateを推定せず操作画面へ続行 |
| 21 | remote no-changeの原ACKも選択値へ必ず照合 | View/Recordで再現した不整合受入を拒否し、Record CF remoteも原reply present/valueへ照合 |
