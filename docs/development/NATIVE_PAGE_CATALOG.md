# Native Page一覧と明示取得

v0.94.0。Windowsのnative接続プレビューで、サーバーのPageを明示的に一覧取得し、選択した本文を取得して端末へ保存してから開く。

- `native_page_catalog(handle, more)` のみ公開する。token、workspace、endpoint、cursorを画面から受け取らない。nativeが元admissionのclientIdを付け、固定の `/v1/workspaces/{workspace}/pages/query` にPOSTする。
- 1回20件、応答8 MiB。タイトルの既存上限とJSON escapeを考慮する。protocol/workspace/epoch、正規Page文書名、metadata、昇順・重複なし、cursor/hasMoreを検証してから公開する。
- cursorはnativeの現在の接続内だけで保持する。続きの失敗は同じcursorで明示再試行する。先頭からの再取得を始める時は旧cursorを無効化するため、その再取得が失敗しても旧一覧の続きを取得しない。並行queryは待ち行列にせず拒否する。
- close/logout/再認証/失効/別accountへの遅着応答を採用しない。画面は表示済みmetadataを失敗時に保持し、接続終了時に消去する。一覧は端末のPage journalへ保存しない。
- 一覧は取得した範囲であり、複数requestをまたぐ固定snapshotではない。sync cursor、受信receipt、ACK、サーバー上の総件数や本文保存の証拠に換算しない。focus/復帰で自動取得しない。
- 「取得して開く」は既存native readを呼び、`received` 後にjournalとYjsを検証してからEditorを作る。`read_unknown` / `store_pending` / journal不正ならEditorを開かず、local createへfallbackしない。元の端末pendingと入力draftは既存方針で保持する。
- title/本文composition中は一覧操作を無効化する。HTTP待機中のログアウトを許可し、遅着結果を復帰表示しない。

Dockerのnative Rust・実TLS/署名API/Postgres・画面IPC doubleの証拠は[検証記録](../../tests/evidence/native-page-catalog-20261015/SUMMARY.md)。この記録は実Windows GUI/実Microsoft IMEの受入ではない。自動再接続、変更feed、offline leaseの画面接続・性能受入は後続工程。

検証順序：package/distを書き換えるbuild・typecheckを完了してからVite画面E2Eを開始する。同じworkspaceで並行実行すると、HMR/reloadがfixtureのpending保存を中断するため検証条件が変わる。v0.94.0の初回2runと再接続traceを保持し、直列runで回帰を確認した。
