# Native Page明示送信画面 — v0.91.0

[実装契約](../../../docs/development/NATIVE_PAGE_SEND_SCREEN.md)。実accountの認証情報・本文を使用せず、合成fixtureで検証した。

- 型検査、初期対象unit27、最終全unit525（62 files）、desktop/mobile-dark-reduced-motionの専用画面26がPass。
- 通常Rust37 Pass/Fail0。専用TLS/API/PG3件は通常runでignored、専用runnerで3 Pass/Fail0として実行した。
- 追加Rust3件でACK前の失敗・ACK commit後の応答不明・logout後の保持破棄を検査。実SQLiteの元pairを通信なしで再確認し、新しいpendingへ古いreceiptを流用しない。provider呼出し数を独立確認した。
- client portはhandle/Page以外を送らず、余分なreceipt/tokenや不正statusを拒否。logout後のlate結果と旧handleを拒否した。
- 本文sessionはHTTP待機中も同じY.Docで編集・端末保存を継続。unknown/ack_pendingはbatchを停止し、明示再操作だけで進む。合成composition中は送信しない。追加で最大32frameのbatch上限と、受領後のlocal再確認失敗でもknown ACKをunknownへ格下げせず件数だけ未確認にすることを検査した。
- 画面は端末保存と受領結果を分け、known receiptの再確認・不明結果の再操作、送信中入力/focus・logout/late ACKをdesktop/mobileで確認した。E2Eのnative IPCはdouble。
- 実TLS・署名API・PGの既存3試験を再実行。別workspace receipt拒否と応答喪失後の同wire再送、HTTP4回/server frame2件、独立Y.Docの全文/vector一致を維持した。

Windows候補build/版/SHA/source照合と合成画面の視覚確認は回収したartifact/host/source JSON・PNG・logを参照。実Windowsの本文invoke/正常Auth/実IMEの新しい証拠ではない。既知のIME再変換Failを維持する。remote読取・offline lease接続は次工程。

全unit525の後、statusの配列/オブジェクトも明示拒否する検査へ厳格化し、対象port10件を再確認した。最終buildはそのsourceを含む。frontend/Windows buildとhost版0.91.0/SHA/compiled設定/source比較はPass。最終desktop/mobile PNGを回収し、同じ状態の画面を視覚確認した。SDK PDB/chunk-sizeと非GUI inspectorの既知icon警告を保持。gzipは元byte/decompress後hashを照合済み。
