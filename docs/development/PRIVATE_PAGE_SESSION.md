# 認証付きPage client session

v0.23.0。PageSyncSessionはHTTP保存基盤のportable client。PrivateWorkspaceConnection.bootstrap後にopenPage(pageId, capturedStore)で作る。Auth refresh/close/失効で古いinstanceを閉じる。同Pageの置換はそのsessionだけ、connection終了はすべてを閉じる。

pushはRust Repositoryのpage_prepareが返すsequence/pageId/kind/digest/wireを受ける。本文bytesをV1構文/完全消費/canonical base64url/SHA-256で検査し、元wireを同じPage pathへ送る。scope/ACK検査後、captured storeのacknowledgeだけを呼ぶ。pendingのprepareやretryをsession内で勝手に再生成しない。

pullはprotocolVersion/clientId/editorSchemaVersion/stateVectorを受ける。応答binding/metadata/head/vector/binary/digestを検査し、captured storeのreceiveへ渡す。remote diffの端末commit前にlive Docへapplyしない。通常UI/IPC接続時にはcommit後にもactive guardを置き、composition/selection/Undo境界を保持する。

構築時のcontext/portは固定。hash・network・commitのawait境界でcloseを照合し、古い応答を新storeへ適用しない。始まっている旧store commitは完了し得るがsession成功へ復帰しない。busy/closed/protocol/transport/storageは安全なcategoryだけを返す。

client codecはBrowser標準のatob/btoa/WebCryptoを使用するためsecure contextが必要。Docker Chromium/localhostで確認済み。Tauri WebView2/Androidの本番起動時の利用可能性は通常IPC/UI接続の実機gateで検証する。server Page responseにはepochを新設せずbootstrap/Auth lease/native bindingで固定する。epoch reset/compactionは未導入。

現在のnative接続は試験driver portで、通常Tauri command/UI、Hocuspocus provider、実ユーザー認証/OS credential、metadata rename/delete/Conflict、Web durable store、失効後offline利用は別工程。tokenをdisk/log/chatへ保存しない。旧DBの帰属を推定せず、改善送信未実装/未収集を維持。

[全16判断](../decisions/private-page-session.md)、[証拠](../../tests/evidence/private-page-session-20261005/SUMMARY.md)、[native耐久保存](PRIVATE_PAGE_DURABILITY.md)、[server保存](PRIVATE_PAGE_DOCUMENTS.md)。
