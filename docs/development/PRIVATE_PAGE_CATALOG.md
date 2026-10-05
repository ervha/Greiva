# 個人workspaceのPage一覧

v0.25.0。POST /v1/workspaces/:workspaceId/pages/query。JWTを先に検証し、bodyはprotocolVersion1/clientId/cursor（null既定）/limit（50既定、1〜100）のstrict object。server schema3のPage document/live resourceを同owner/device transactionで読む。

応答はprotocolVersion1/workspaceId/workspaceEpoch/pages/nextCursor/hasMore。UUID順keyset、lookaheadを含むmetadata検証、gq1 HMAC workspace/epoch binding。本文binaryは返さない。削除済みPageは除外、失効403、無効cursor400、保存破損503。秘密鍵は既存structured configから読み、queryで鍵/DB/本文を書換えない。

PrivateWorkspaceConnection.queryPagesは現在のAuth/登録をcaptureして固定APIへ送る。refresh/close/403後に遅着応答を採用せず、strict metadata/件数/順序/進捗を検査したimmutable responseだけ返す。native store/cacheへの自動保存はない。

これは一覧queryで、複数requestの一貫snapshotやchanges stream/metadata receiptではない。途中で作成/削除/更新があればfresh queryが必要。rename/delete/三値Conflict/catalog durable cache/normal UIは未実装。

generationSignalはAuthとconnectionの両取消を反映し、connection.closeもnative cleanupを開始する。同Authの再bootstrapで同signalを維持。すでにadmitted旧commitは完了し得るがclosed成功を返さず、DB/pendingを削除しない。local handleをnative Auth grantへ拡大しない。

[全14判断](../decisions/private-page-catalog.md)、[検証](../../tests/evidence/page-catalog-20261005/SUMMARY.md)。
