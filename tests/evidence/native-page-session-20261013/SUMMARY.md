# Native Page session — v0.88.0

[実装契約](../../../docs/development/NATIVE_PAGE_SESSION.md)。実Yjs binary＋IPC journal doubleのclient試験で、実ユーザー本文やcredentialを使用しない。

- 新session6＋native port8＝対象14 Pass。全unit513（61 files）・型、専用native候補のfrontend/Windows buildを確認。
- 直列appendを独立Y.Docでreplayし、本文/vector完全一致、saving0/unsaved0/pending3を確認。
- 先行保存のresponseを保持してhandleを切替。後続旧更新を新handleへ送らず、保存未確認の入力をcloseからcopyして同contextで明示復帰。既に保存したYjsを二重表示しない。
- known failure/unknown commitで自動retryを止め、追加入力をY.Docに保持。閉鎖後の同scope復帰でも正確な全文を独立replayした。
- foreign scopeの下書きは書込み前に拒否。不正Yjs/loadはeditor有効化前に拒否。composition中のcloseはbusyでdocument保持、確定後にqueue完了を待って閉鎖。
- unknown createは再送せず、明示local reopenで保存済みPageを取得する。
- host/Dockerのnative/auth/新session source・build script/manifest/lock、Windows PE/版/SHAを確認。外部依存版は変更しない。

`target.log.gz`/`unit.log.gz`/`type.log.gz`/`preview.log.gz`/`frontend.log.gz`/`windows.log.gz`、artifact/profile/host/source/version JSONを参照。gzipは元byte hashと一致。chunk-size/SDK PDB/default icon resource警告は保持。

このcheckpointではsession基盤を実装し、専用画面にはまだmountしていない。IPCはdoubleで、このclient経路の実SQLite/Windows invoke・実IME・app kill後の未保存入力復帰・native remote sync/7日offlineの受入ではない。v0.85.0の実SQLite/TLS/PG証拠と混同しない。
