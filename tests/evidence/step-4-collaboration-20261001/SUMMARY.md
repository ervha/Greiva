# Step 4: 共同編集の検証

2026-10-01 08:50 JST開始 / Codex / Docker Linux x64 / チェックポイント0.2.0。

ソースSHA-256: `7bf32113844ef0f6294b82492d568bbc5a37606cc19be97db43306537fad56e4`。imageにGitを含めず、[実行metadata](summary.json)と[checkout照合・隔離条件](verification-context.json)で対応を確認した。試験時のGit parentは28ddf56、今回のcommit/tagはこの一致したソースと証拠を含む。

| 検証 | 結果 | 証拠 |
| --- | --- | --- |
| Web/Node build | Pass | [log](STEP4-BUILD.log) |
| strict型（試験含む） | Pass | [log](STEP4-TYPES.log) |
| unit/integration | 22 Pass、通常runのPostgreSQL 1 skip | [log](STEP4-UNIT-INTEGRATION.log)、[JSON](vitest.json) |
| Chromium E2E | 全37 Pass、skip/retryなし | [log](STEP4-E2E.log)、[JSON](playwright.json) |
| SQLite初期化 | Pass（既存基盤のみ） | [log](STEP4-SQLITE-INIT.log) |
| 実PostgreSQL | 専用run 1 Pass | [log](STEP4-POSTGRES.log)、[JSON](postgres/vitest.json) |
| Linux locked Cargo check | Pass、greiva-poc 0.2.0 | [log](STEP4-DESKTOP-CHECK.log) |
| offline操作の安定性 | 選択範囲修正後3/3 Pass | [繰返しJSON](offline-repeat.json) |

## A/B収束

独立ブラウザcontext、ランダムclientId、同一Page。各試験はpending 0、state vectorのclock map、本文JSON、Y.XmlFragmentの一致を比較し、raw state vectorも保存した。以下のJSONはclientId、Page ID、取得日時と全文を含む。

| PoC 6.2 | 結果 | 最終比較 |
| --- | --- | --- |
| 同一Paragraphの異なる箇所 | Pass、双方の入力とカーソル位置を保持 | [JSON](convergence/STEP4-PARAGRAPH-convergence-caret.json) |
| 別Block | Pass、他clientの編集をlocal Undoで消さない | [JSON](convergence/STEP4-BLOCKS-convergence-final.json) |
| offline追加/削除 | Pass、両方の追加と各削除、新規client復元 | [JSON](convergence/STEP4-OFFLINE-convergence-fresh-client.json) |
| offline移動 | Pass、同じ順序・内容へ収束 | [JSON](convergence/STEP4-MOVE-convergence-final.json) |
| Nested Toggle | Pass、内部移動と見出し編集、親子構造一致 | [JSON](convergence/STEP4-NESTED-convergence-final.json) |
| Todo | Pass、checked・入れ子化/解除とnode構造一致 | [JSON](convergence/STEP4-TODO-convergence-final.json) |

別Pageへの本文非混入もPass。従来の全ブロック、Slash、Mention、Markdown、Drag、Toggle、Undo/Redo、合成composition安全性を同じ共同編集版で再検証した。[画面](editor-ux.png)はChromiumのUIであり、Microsoft IME画面ではない。

## サーバー復旧

`STEP4-RESTART`は別NodeプロセスのACK済みupdateを確認してSIGKILL。新プロセスへ新規clientを接続し、binary journalから本文・state vectorが復元された。停止中に既存clientが編集し、再接続後に新規clientと収束した。graceful shutdownの保存に依存しない。`STEP4-JOURNAL`では部分末尾の修復、checksum破損時の復元停止、Page名のパス逸脱防止を検証した。

## 失敗記録と未完了範囲

[初回29/37 run](previous-attempt/playwright.json)と[原因・修正](../../../docs/failures/step-4-collaboration.md)を保持した。Yjs履歴境界の実装不備と選択・NodeView対象の試験不備を区別する。

Step 4の実装とA/B自動試験は完了。この自動run保存時には実機IMEのremote更新試験は未実施だった。その後、[2026-10-01の実機試験](../windows-remote-ime-20261001/SUMMARY.md)で12回の送信と利用者の操作Pass、実機候補画面の独立観察を追加した。既存Windows shellは0.0.0、今回のDocker frontendは0.2.0。Linux Cargo/ChromiumをWindows配布ビルドや実IMEの成功として数えない。

端末SQLiteのPage/update保存、offline強制終了復元はStep 5。端末内の未送信変更はメモリー上のみで、画面終了で失われる。「サーバーと同期済み」は端末保存を意味しない。Gate A/B/Cの最終判定は行っていない。
