# Native offline復帰の基盤 — v0.97.0

2026-10-16。[実装契約](../../../docs/development/NATIVE_OFFLINE_RESUME.md)。OS保管済みの署名許可からcontextを復元し、既存DBだけを開くoffline専用handle・local gate・IPC/client portを追加した。起動選択とEditorへの接続は次工程であり、今回の既存画面回帰はoffline編集画面の受入ではない。

- 引数なし復元で署名subjectとdurable markerのownerを照合し、native deploymentのAuth issuerも検査。marker欠損/locked、OS更新失敗、不正署名、期限切れ/時計逆行、missing/blank/corrupt DBを拒否する。空の保存先へのfallbackをしない。
- 各local操作の前後に元lease世代と期限を検査。別プロセスが同じownerの許可を再発行しても旧handleは追従しない。commit中の期限切れは成功返却を拒否し、確定済みpendingとoriginal wireを残す。
- offline handleからonline execute/send/read/catalog、ACK/receive/pullは実行できない。旧online cancelと旧offline closeが現在の別modeを閉じない。client portはstrictなoffline専用shapeで、遅着後のcleanupは対象handleだけへ送る。

検証結果は型検査Pass、単体567件/65 files Pass、通常Rust62 Pass・専用6 ignore、実TLS/署名API/Postgres6 Pass、既存SQLite保存層23件/3 files Pass、desktop/mobileの既存画面50 Pass・0 Fail・0 Skip。型/buildの完了後に画面検証を実行した。UIはIPC doubleであり、実Windows WebView invokeではない。

実HTTP試験はnative gateを終了・再構築し、同じOS custody doubleと実SQLiteから署名contextをoffline復元した。復元/編集にHTTP refresh/bootstrapを呼ばず、pendingが1から2へ増え、元wireを保持し、送受信を拒否することを確認。保存journalの本文とstate vectorを独立Yjsで照合し一致した。明示online復帰後も元pending/wireを保持する。OS custody doubleの結果を実Windows Credential Managerの受入へ読み替えない。

初回の追加Rust試験で、既存OfflineWorkspaceRegistryが別instanceによる同owner再発行後も旧handleを受理する1 Failを再現した。registryにも署名contextとdurable世代のproofを保持し、操作前後に検査する修正を加えた。同じ失敗条件を残して最終62件を再確認。元の失敗は`generation-first.log.gz`に保持する。

Windows候補0.97.0はbuild成功。SHA256は`4f6c32231aa414aaa44bac5799a913bef7bcf0ba9465aa5b3f6a991599e40b75`。PE x86_64、native-only/legacy command遮断/SQL plugin無効、host/buildの対象ソースと版を照合した。CRLF/LFのみのtext差を区別した。非GUI inspectorはexit 0。public pin未設定のためoffline準備は無効であり、実GUI・offline invoke・実Microsoft IMEは未確認。既知のbuild警告はraw logへ保持した。

gzipは元byteと展開後SHA256を照合し、`log-hashes.json`に保存。実account、私的本文、配備鍵、grant/tokenを証拠へ保存していない。次は自動online refreshより前の明示起動選択、offline Editor/local保存、期限時の入力保全、online復帰。その後Windows実機/IME、Android、性能・最終Gateへ進む。
