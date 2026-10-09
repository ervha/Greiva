# DB定義の端末保存

2026-10-09 / v0.51.0。[server journal](PRIVATE_DATABASE_CHANGES.md)の次に、受信したSource定義をnative workspaceへ保存する。[判断16件](../decisions/private-database-source-cache.md)、[証拠](../../tests/evidence/private-database-source-cache-20261009/SUMMARY.md)。native8→9、server11保持。Record/View replica/operation queue/DB差分cursor、Source作成queue、HTTP runtime/Table/List画面は後続。

## 保存と移行

bound workspaceを開くtransaction内でSource historyとcurrent projectionの2表を追加する。native0/5/6/7/8から9へ移行し、bindingを先に照合する。既存Page/Task/Relation/title/metadata/送信queueの内容は変更しない。旧通常PoC DBを個人workspaceへ取り込まない。未知schema/partial DDL/foreign bindingはrollbackし、readinessで列を検査する。schema9を旧binaryへ戻す操作は提供しない。

受信はdatabase_source_receiveでSource ID、read request、read responseを厳密に照合する。protocol/workspace/workspaceEpoch/client/Source、positive exact int64 creationOrder、safe positive metadata/schema版、6型/64property/Select100option/重複ID/1個のPage-bound Name/canonical UUIDをnative側でも検査する。labelは既存Zodに合わせUnicode codepoint120まで、空白判定はECMAScript trimと同じ集合である。Name/title/bodyをSourceへ複製しない。

snapshotとscope付きread responseを版履歴へ保存し、currentはその履歴へ参照する。すべて同transactionでcommitする。同じ版の内容違い、creation位置変更/別Sourceの位置衝突はrollbackする。古いreplyは履歴に保持しても最新currentを戻さない。再送は同じ内容なら1履歴のままである。currentが最新保存版を指すことも読取で検査する。projection/history/receiptのscope・版・内容不整合は空Sourceへのfallbackや補修ではなく拒否する。

Source read responseを保存したことはnativeでJWT署名を検証した証拠ではない。trusted captured connection/HTTP compositionが先に認証・認可する責務を持つ。現在のnative handleは保存先bindingで、Auth grant/offline利用権限とは別である。read cacheの成功を送信queue ACK、作成完了、全DB同期済みへ扱わない。

## 読取とIPC

database_source_loadは保存済みのsnapshot、未受信ならnullを返す。未知Source読取でdefault DB/Page/Record/Viewを作らない。database_source_listはUUID keyset、default50/max100＋1lookahead。currentをhistory/receiptへ照合し、lookaheadの不整合も拒否する。これは端末で受信済み定義の一覧であり、server catalogの全件取得/変更受信/削除/retentionを表さない。

WorkspaceRegistryのstrict commandとapp-owned root/handleを再利用する。DB path、SQL、token/profileをrequestへ追加できない。portable NativeWorkspaceStoreも入出力のschema/context/ID/件数/順序を照合してclone/freezeする。Auth refresh/closeで旧世代を閉じ、同じIDsで新規bootstrapしても旧instanceを再活性化しない。COMMIT前に入ったnative処理は既存registry gateで保存先固定のまま完了し、その後の旧handleを拒否する。

## 検証境界

実Rust/SQLite driverで6型、late reply、同版divergence、101件一覧、position衝突rollback、raw IPC bypass、Unicode/空白、snapshot/receipt/projection/lookahead不整合、schema8→9/foreign binding/DDL rollback、Auth世代/並行再送を検証する。before/after COMMITで実native driverをSIGKILLし、history/receipt/projectionが一緒に回復し再送が重複しないことを確認する。追加13条件と旧4native suite49条件を対象にする。

版2 fixtureはcacheの古い応答処理を検証するためであり、Source編集server/UIを追加したとはしない。Docker native driver証拠とWindows actual Tauri invoke/MS IME/Android/配備暗号化/native Gateを分離する。
