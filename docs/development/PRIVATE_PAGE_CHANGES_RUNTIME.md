# Pageタイトル増分の認証付き接続

2026-10-08 / v0.38.0。[server](PRIVATE_PAGE_CHANGES_SERVER.md)/[端末保存](PRIVATE_PAGE_CHANGES_STORE.md)へcaptured Auth transport、portable session、native runtimeを接続する。server5/native8と本文/structured wireを維持する。[全16判断](../decisions/private-page-changes-runtime.md)、[証拠](../../tests/evidence/private-page-changes-runtime-20261008/SUMMARY.md)。workspace画面は次工程。

`PrivateWorkspaceConnection.openChanges` は現在のissuer/subject/workspace/client/epoch、Auth lease、固定API originと元store callbackを捕捉する。専用POST `/v1/workspaces/:workspaceId/pages/metadata/pull` だけを呼び、Bearer認証、credentials omit、redirect error、cache no-store、15秒timeoutとcombined signalを使う。Auth更新/期限/close、同workspace session置換で古いsessionは永久に閉じる。401/403はconnectionを閉じ、表示/未完了受信pairを破棄する。既に始まった保存は元store内で終わり得るため、rollbackを主張しない。

`PageChangesSyncSession.pull(request, expectedAfterOrder)` は入力をclone/strict parse/freezeし、client/取得基底、response scope/after/progress/limitを照合してからstoreへ渡す。順序はexact bigint文字列で扱う。filtered空頁は進捗を許す。cursorはopaqueなserver署名で、端末側はnativeのenvelope検査と保存済み基底照合を行い、HMAC鍵を持たない。期待する基底はruntimeが同じnative DBから読み出す。

保存を開始する前にexact immutable request/reply pairをsessionへ保持する。storage結果不明なら新pullを禁止し、`retry`で同pairを元storeへ再適用する。再確認はnetworkを使わない。nativeのdurable receiptで二重適用/巻戻しを防ぐ。transport/protocol失敗では未入庫なのでこのpairを作らない。close/失効時はprivate payloadをmemoryから外し、新世代はdurable cursorを読み直す。保存成功後のlocal read失敗はpairを残さず、次cycleのfresh readから再開する。

`PrivateChangesSession.open` と `catalog` はlocal readだけで、暗黙networkを始めない。explicit `sync`は毎回saved cursor/orderを読み、最大100 raw変更を一回取得してcommit後にlocal snapshotを読み直す。自動poll/無制限drainは追加しない。catalogは最大100件/UUID keysetのwindowで、本文未取得情報を本文保存済み一覧へ混ぜない。

stateはphase/busy/data/error/retryReceive/readComplete/hasMoreRemote/hasMoreLocalを分ける。receivedは保存済みquery receiptの有無。readCompleteはその成功cycleの観測head末尾とlocal readが一致したことだけで、全端末の最新・本文や未送信titleのsyncedではない。restart/local browsing/次cycle開始/失敗でcompletion表示を解除する。破損情報や受信失敗でも以前のlocal snapshotは残し、closedならprivate snapshotをnullへする。

portable8とactual native runtime5、ES256 fixture/JWKS・実HTTP/PGと二つのSQLite保存先の1条件を検証する。pending title/immutable wire、同版のremote解決、本文未取得catalog、restart、lost pull、deleted payloadを除く空window、失効とpending保全を通す。署名fixtureを実Supabase正常login、Docker nativeをWindows Tauri invoke/実IMEの証拠へ広げない。画面変更がないためbrowser E2Eは再実行しない。次はworkspace previewへ取得/再確認/観測状態とcatalogを接続し、dirty/変換/focusを保護したDocker実操作を検証する。
