# PoC最終レビューと連続入力の保存監査

2026-10-04、checkpoint v0.6.23、製品0.6.20（commit 2b8450f3e922b047dc809a4507230d3e0cde9c8c）。Windows通常Tauri／Microsoft IME、WIN620-IME1000。利用者が連続入力、CodexがDocker内Node 24／Yjs／SQLiteで読取専用監査を担当。製品変更なし。

## 手順・期待・実結果

利用者はMicrosoft IMEへの切替を確認済み。1,000段落Pageの1行目末尾へ連続して日本語を入力する依頼に「問題なく入力できました」と回答。期待は既存本文・段落・履歴保持と保存・peer収束。追加量は24 UTF-16単位で、2〜3文や長時間の負荷試験を実施したとは断定しない。体感の報告は問題なし、監査は範囲内Pass。

2026-10-04T14:15:48.440Zの[機械可読結果](continuous-audit.json): 通常RoamingのオンラインSQLite backupで30→76更新、integrity_check=ok、全digest検証、元30更新bytesとmetadata不変。1,000段落、元1行目prefix保持、他999段落完全一致。独立Y.Doc peerの全文／state vector一致。本文と追加入力のSHA-256およびclockをJSONへ記録。

画面のaccessibility textは空で、今回は「端末に保存済み」の新しい表示確認を主張しない。保存の根拠はSQLiteのdurable更新とpeer収束。入力文字・SQLite・全文snapshotは非公開のローカル.dataへ保持し、公開証拠は長さとhashに限定。per-key遅延／native frame SLOの測定ではない。

[監査script](audit-continuous.mjs)の再現入力は、同一の非公開baseline30 SQLite／current76 SQLite／peer snapshotをそれぞれ `/tmp/ime620-baseline30.sqlite`、`/tmp/ime620-continuous.sqlite`、`/tmp/ime620-peer/final.json` へ配置。Dockerの依存済み `/workspace` で `node /tmp/ime620-audit-continuous.mjs` を実行する。自由入力を含むfixtureはGitへ登録しない。

## 結論

[自律判断全件と残課題](../../../docs/decisions/poc-autonomous-review.md)、[Gate A](../../../docs/decisions/gate-a.md)、[Gate B](../../../docs/decisions/gate-b.md)、[Gate C](../../../docs/decisions/gate-c.md)、[技術選定](../../../docs/decisions/poc-technology-selection.md)へ対応付ける。既存Docker59 E2E等は実行時の証拠を維持し、この文書更新で再実行成功とはしない。Computer Useは解除済み、既存Pageを編集せず保持。

Docker内で[文書検査](verify-docs.mjs)を実行し、12文書・354ローカルリンクと監査JSON／Gate判定の整合を確認。[結果](document-review.json)。転送した文書とhostの[ファイル一覧](inventory.txt)に基づくリンク解決で、アプリ回帰の再実行ではない。再現はrepo rootで `node tests/evidence/poc-gate-review-20261004/verify-docs.mjs`。最初はcontainerの古いworkspaceを参照して失敗したため、現在の対象文書と全repo inventoryを隔離転送して検査した。directoryリンクとscriptsへのリンクも検査対象へ含めて修正した。
