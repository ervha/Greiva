# 保存済みPageのnative一覧

v0.28.0。server一覧へ未送信の新しいPageは現れないため、bound workspace内の端末Pageを独立して列挙する。画面compositionの前提で、認証なし/offline閲覧を許可する機能ではない。

`workspace_execute` のstrict command `page_list` は `after`（nullまたはUUIDv7）と `limit`（1〜100）だけを受け取る。ID昇順のkeysetで最大limit件と `nextAfter` を返す。attributed private documentsだけを対象とし、metadataと未ACK更新数を一つのSQLite読取snapshotで取得する。本文binary、prepared wire、認証情報、任意SQL/pathを返さず、queue/receipt/本文を変更しない。schema6を維持する。

応答はcaptured context・pages（metadata/pending）・nextAfter。adapterはstrict形式、context、件数、ID順序、cursor進行、Auth世代を検査し、immutableな一覧を返す。未知・破損metadataや閉じたhandleは安全なcategoryで拒否する。pending0は同期済みを意味しない。server一覧とlocal一覧のpaginationは別契約で、複数要求を跨ぐsnapshotでもmetadata同期でもない。新規追加後は一覧を先頭から再読込する。

自主判断6件：1) local一覧をserver一覧と分離、2) private documentsだけを列挙、3) 上限100/UUID keyset、4) metadataとpendingを一読取で照合、5) strict captured context/世代の照合、6) queue非消費とrestart/別主体/破損を実Rustで検証。旧PoCや未決定のoffline権限を変更しない。

[証拠](../../tests/evidence/local-page-catalog-20261008/SUMMARY.md)、[native IPC](NATIVE_WORKSPACE_IPC.md)、[再ログイン](PRIVATE_DEVICE_IDENTITY.md)。
