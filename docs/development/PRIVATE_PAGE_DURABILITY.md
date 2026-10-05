# Workspace別Pageの端末耐久保存

v0.22.0。WorkspaceStoreのRust/sqlx Repositoryに追加。Tauri/通常Editor/通常UIは未接続。Docker native driverとfixture JWT＋実HTTPで検証し、新native IME/Android/実ユーザーログインの証拠と区別する。

| Repository method | commitするもの |
| --- | --- |
| page_create | 初期metadata/binary/digest、正確なbootstrap wire、pending |
| page_append | 新binary/digest、正確なappend wire、pending |
| page_prepare | 最初の未ACK frameを照合して返す（送信前の耐久要求） |
| page_ack | scope/digest/order/wire/先頭seq検査、receipt/head |
| page_receive | 検証済みread responseのmetadata/binary/head（再送しない） |
| page_load | 自動作成せず管理行/metadata/binary checksum/headを検査 |

保存先はWorkspaceContextのissuer/subject/workspace/client/epochに固定する。private SQLite schema5→6はそのbindingを確認したopen transaction内で行い、既存structured dataを保持する。schema5にPage metadataがあれば未帰属なので拒否。通常PoC schema4以下/異なるbinding/unknown版/partial schemaを採用・resetしない。

ACK喪失は元prepared wireを再送する。binary/queueは端末commit後、receiptはserver commit後に保存する。ACKはlocal binaryを消さず、remote diffも端末commit後にEditorへ適用する必要がある。native Repository単独では意味的Yjs decoderや実Auth leaseではないため、次のclient sessionでYjs構文/応答の検証と遅着/close guardを追加する。

同frame ACKのhead/vectorは最新値へ変わり得る。receiptのstable identityを検査し、古いheadへ戻さない。pendingあり/古いreadでmetadataを上書きしない。remote echoをqueueへ戻さず、破損を空本文へ置換しない。初期title以外のrename/delete/Conflict、snapshot/GC/保持、失効後offline閲覧、Web store、通常IPC接続は別工程。

専用開発APIはv0.21.0/schema3のまま（server機能不変）。v0.22.0は所有source/Windows cross-build/端末Repositoryのcheckpoint。試験bridgeを製品Web永続化と扱わず、旧DB/IMEデータは保持する。

[全16判断](../decisions/private-page-durable-store.md)、[証拠](../../tests/evidence/private-page-store-20261005/SUMMARY.md)、[server保存](PRIVATE_PAGE_DOCUMENTS.md)。
