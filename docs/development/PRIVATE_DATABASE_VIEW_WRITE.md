# View実HTTP送信と画面用runtime

2026-10-09 / v0.66.0。[View端末queue](PRIVATE_DATABASE_VIEW_QUEUE.md)の元設定・wireをcaptured Authの固定HTTPへ接続する。native16/server11保持。[判断](../decisions/private-database-view-write.md)、[証拠](../../tests/evidence/private-database-view-write-20261009/SUMMARY.md)。6型Table/Listの操作画面は次工程。

## 元操作の送信

DatabaseViewWriteSyncSessionはworkspace contextとprepare/queue/ACK/transport portsを一度捕捉する。明示send1回で最古未ACK1件を扱い、nullまたはSource blockedならcapture/HTTP/ACKを呼ばない。confirmed Source/current Viewから新たなbaselineを作らず、正確なsequence直前のkeyset・limit1・pendingOnly falseで元queue rowを取得する。

捕捉rowのcontext/sequence/operation/Source/typed intent/base/candidate/未ACK状態/wireを照合する。元wireは8MiB UTF8以内、JSON format/key順を再生成せず固定POST `/v1/workspaces/{workspace}/databases/{source}/views/write`へ渡す。Source IDはstrict prepared/requestで検査済み。Auth/lease/contextを固定し、世代変化後の遅着処理を拒否する。

原replyはSource-bound snapshot、5field/参照/型、元intent・base・候補、scope/version/resultを照合する。queue provenance schemaを原row＋原replyに対する検証として再利用し、検証用の値を新queueや架空historyへ保存しない。conflict fieldの重複、base/local/remoteの不整合を拒否する。applied resolutionではlocalがbaseと同じでもreply対象fieldを選択値へ必ず照合する。whole-field filterのobject key順は意味とせず、columns/sorts/childrenの配列順を保持する。local未変更とremote変更、remote no-change resolution、rejectedを区別する。

HTTP結果不明はdurable未ACKの同operation/wireを再prepare・再捕捉して送る。未検証replyからACK retryを作らない。native ACK結果不明はimmutable prepared/原reply pairを保持し、retryはprepare/capture/HTTPを呼ばず同pairを再保存する。pair保持中は新sendを拒否する。replacement/refresh/401・403/native store closeは旧session/pairを閉じ、durable queueを消さない。

PrivateWorkspaceConnectionはView senderを独立して追跡する。同connection上のRecord/Source/Page sessionを置換しない。NativeWorkspaceStore.databaseViewWritesは4つの既存native methodsのうちprepare/queue/ACKをbindし、自身の閉鎖でsenderも閉じる。

## 画面用状態

PrivateDatabaseViewWriteSessionは同connection/store/leaseに固定し、local opening、pending-only max100/byte window/global count/keysetとqueueFreshを公開する。opening/reload/enqueueはHTTPを呼ばない。queueFreshは端末の最終読込状態でありserver同期完了ではない。failed readは元dataをstaleとして保持し、fake emptyへ変換しない。moreは正確なnextAfterで次windowだけを読む。進捗がなければI/Oしない。

unknown enqueueまたはqueued後read failureは元intentのexact retryを保持し、reloadでは消さない。保持中は新enqueue/sendを拒否する。known busyはattemptOperationIdと既存operationIdを分け、無書込みが既知なので後続read失敗前にretry intentを解除する。未保存attemptを勝手に再保存しない。

lastSendはempty/Source blocked/原ACKを区別する。unknown ACKのpairはpending0を観測しても保持しnetworkless retryを行う。known ACK後の一覧失敗は原結果を保持しACK retryを捏造しない。原rejectedは適用成功へ変換しない。

busy/observer/late lease/private state閉鎖を検査する。closeはprivate intent/list/result/pairを消し、自分のsenderだけを閉じ、共有NativeWorkspaceStoreは保持する。新runtime/senderは残ったdurable操作を元wireで再開できる。同View offline successor/durable新draftは今回追加していない。

## 検証と境界

portable28（送信16/runtime12）、actual signed HTTP→PG schema11→Rust SQLite schema16の9条件と全回帰/build/helpで検証する。初回actualPG1 Failは存在しない試験用テーブル名の参照で、正しいprivate_page_documentsへ修正した。追加filter negative1 Failはremoteを選ぶ試験で未選択localだけを変更していたfixtureを選択側の不整合へ修正した。元Failを保持する。

追加否定試験で、修正前のView sender/View native ACK/Record native ACKがremote no-change選択と異なる原replyを受け入れることを再現した（3 Fail/1 Pass）。ViewとRecordのnative/protocol/senderへapplied選択値検査を追加し、Record conflict remoteも原replyのpresent/valueへ照合する。修正後は否定5 PassとView28＋既存Record sender18=46 Pass。元再現Failと修正前の通常740/PG217成功を別に保存し、変更後の最終回帰と混同しない。schemaはnative16/server11のまま。

actual Supabase正常login、Windows actual invoke/MS IME、Android/native credentials・offline grant、配備暗号化とnative Gateは別条件。操作画面を実装済みとは数えず、次はSource/Record/View runtimesとName/Page titleを6型Table/Listへ接続する。
