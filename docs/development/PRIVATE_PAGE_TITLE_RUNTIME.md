# Pageタイトルの送信・同期基盤

2026-10-08 / v0.34.0。[端末保存](PRIVATE_PAGE_TITLE_DURABILITY.md)と[server](PRIVATE_PAGE_METADATA.md)を専用session・captured Auth transport・native runtimeで接続する。[判断](../decisions/private-page-title-runtime.md)、[証拠](../../tests/evidence/private-title-runtime-20261008/SUMMARY.md)。title画面/IME/focusへの接続は後続。server schema4/native schema7と既存本文/structured wireを変更しない。

## Portable sessionと認証

`PageTitleSyncSession` はissuer/subject/workspace/device/epoch/Pageをstrictに捕捉する。prepareのwireをそのまま送信し、JSONを再生成しない。呼び出し時に入力を複製・凍結し、transport/storeの関数もbindする。callerが後でID/wire/portを変えても保存先と送信内容が変わらない。

pushはprepared sequence/Page/client/operationとstrict rename requestを検査する。返信はPage/workspace/epoch/operation、ConflictのbaseVersion/local、解決intentとrejection種別を照合する。applied版が要求基底未満なら拒否する。観測baseTitle・queue順・no-op/三値の詳しい意味検証はnative storeが行う。返却は原子ACKが成功してからで、HTTP 200だけではpendingを消費しない。

pullはclient/keyset/limitとstrict response/scope/進捗を検証し、captured native receiveのcommit後に返信する。最大100件で、nextAfterは最後の候補に対応する。複数queryのsnapshot/deltaや同期完了を意味しない。sessionは単一in-flightとし、重複操作をbusyで拒否する。closeは永久取消で、遅着network resultはcommitしない。開始済みnative commitは元保存先で完了し得るが、閉じたsessionから成功を返さない。固定closed/busy/protocol/transport/storage errorだけを公開する。

`PrivateWorkspaceConnection.openTitle(pageId,port)` が固定API originの認証付き `.../pages/:pageId/metadata/rename` と `.../metadata/read` を使う。AuthorizationはAuth session内からのみ渡し、credentials omit/redirect error/cache no-store/既存15秒timeoutを継承する。workspace bootstrapから捕捉したAuth leaseをnetworkとcommitの前後で検査する。refresh/logout/connection closeは旧title sessionを永久取消し、再bootstrap後の新sessionだけが保存wireを再送できる。401/403はconnectionを閉じて他のcaptured workも取消し、503や通信切断でpendingを保持する。

同Pageのtitle session置換は旧titleだけを閉じる。別Pageのtitle、Page本文、Task/Relation sessionは独立した所有と取消を維持する。Auth取消は共通である。title portは既存native workspace registryへ書き、任意pathや別画面のcurrent storeをawait後に採用しない。

## Native runtimeと表示契約

`PrivateTitleSession.open(connection,store,pageId)` は同一connection/store bindingを確認し、local title snapshotを読む。Pageを暗黙作成したり、開く時にquery/送信したりしない。unknown baseからのmutateは保存前protocol拒否で、結果不明retry状態を作らない。版付きbaseの取得は利用者操作に対応する明示sync、Page bootstrapの確定は既存本文経路が行う。

mutateはstrict intentを複製・凍結して原子enqueueする。enqueue応答や後のlocal readを失った場合は同じoperationId/title/resolutionを保持し、新mutation/syncをbusyで止める。retryMutationはその同じintentを再確認する。storageの結果が不明なまま別nonceを作らない。保存はAuth sessionの存続中だけ可能で、native credentialやoffline認証grantは追加しない。

syncはlocal read、開始時pendingのうち最大100件のprepare/push/ACK/local read、remote read一頁（最大100件）、local readの順に進む。無制限drain/timer/自動retryを追加しない。100件を超えるpendingは次の明示cycleへ残す。query cursorはcommitとその後のlocal readまで成功してから進める。途中のread失敗は同keysetを再照会し、native candidate upsertを重複させない。mutationとreopenはqueryを先頭から始め、最終頁到達後の次cycleも先頭から読む。

stateはphase/busy/error/data/pending/retryMutation、queryComplete/hasMoreRemote/hasMoreLocalを公開し、各snapshotを凍結する。queryCompleteは最後のquery頁が終了したことだけで、同期済みやserverの現在Conflict状態ではない。`synced`を公開しない。local dataはoperation/conflictの先頭100件に限定し、hasMoreLocalで省略を示す。省略されたcandidate/historyやpendingはnativeに保持される。resolvedBy=nullやqueryからの欠落を現在未解決/解決の断定へ変換しない。

close/同Page置換/refreshでは即座にstateのprivate dataと結果不明intentを画面から外し、処理中workの完了後にobserverを解放する。共有native workspace storeはruntimeが閉じない。observer例外で保存を止めず、observerによるcloseがadmission前に起きれば書込みを始めない。admission済みenqueueは元Pageにだけ残り、閉じたruntimeへ結果を適用しない。

## 検証と次の実装

Dockerでportable strict unit、actual Rust registry/SQLiteのruntime、signed fixture HTTP/実PG/2 native storeを検証する。HTTP試験は手製metadata POSTから今回のproduction `openTitle` とruntimeへ移した。lost ACK/reopen/同wire、連続編集/三値解決、古い本文metadata、Auth refresh/失効時取消とdurable pendingを照合する。失効後の保存検査はtest driverからraw registryを開く耐久性検証で、失効した利用者へのnative権限grantではない。

次はworkspace previewにtitle draft/保存/同期・明示Conflict選択を接続し、タイトル用stateと本文用stateを区別して表示する。未送信や結果不明のdraft、IME composition、focus/selection、navigation保護をDocker E2Eで検証する。runtimeだけで旧画面の本文synced表示にtitle pendingを混ぜない。metadata delta、削除/復元/保持、実Auth正常系、Windows invoke/IME、Android/native grant、配備暗号化は別の残条件である。
