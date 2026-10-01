# Step 7 統合crash recovery: 編集直後の保存境界

2026-10-01。初回の失敗と契約の判断を記録する。PoCの成功・Gate Passを示さない。

## 観測

DockerのChromiumと実Rust/SQLite driverに対し、offlineでPage作成、本文block追加・削除・移動、Task作成・変更、Relation作成を行った。保存完了後の強制終了、pushのサーバー確定後でACK未受信の強制終了、pull transactionの受信適用後・cursor確定前の強制終了は、offline復元とpeer収束まで成功した。実APIプロセスの確定前／確定後SIGKILLも別の2ケースで成功した。

最後に本文へ ` immediate` を入力し、保存完了を待たずChromiumとRust driverをSIGKILLしたケースでは、`keep immediate` が `keep immedia` として復元された。Yjs clockは37から35へ戻り、末尾2文字が失われた。失敗したassertionは全clock・本文JSON・fragmentの復元一致。保存完了を待つ試験へ変更して成功扱いにはしていない。

初回のraw証拠: `tests/evidence/runs/container/step7-crash-targeted/combined.log`、同directoryの`combined/playwright.json`と失敗trace。raw runsは生成物であり、検証チェックポイントには選別した証拠を収録する。

追加診断でも同じケースだけが失敗した。終了直前の表示は「端末へ保存中…」で、入力終了から39ms後に強制終了を開始した。復元は`keep immedi`（末尾3文字欠落）、clockは37から34。他の3境界は再度成功し、Rust driverのPIDと実際のSIGKILL signalを記録した。保存済みと表示した入力が失われた証拠ではない。欠落文字数が固定の2文字という意味でもない。

選別した初回証拠は[SUMMARY](../../tests/evidence/step-7-crash-boundary-20261001/SUMMARY.md)。詳細説明の後、利用者は「『保存完了』でなく保存中であったならAでいいと思います。」と回答し、Aを選択した。保存済みを保証し、保存中を区別する契約をPOC_SPEC.mdへ反映した。初回の無条件な全文復元試験のFailは履歴として保持する。

## 原因と契約の判断

`apps/client/src/editor/page-session.ts` はYjs変更を画面に反映した後、`DurabilityBoundary`の非同期queueを通してRustへ送る。RustのappendはWAL／synchronous FULLのSQLite transactionでcommitする。「保存済み」と送信可能の境界はcommit後に設けているが、rendererのメモリ内にある未commitの入力は両プロセスの強制終了では復元できない。

`docs/plan/POC_SPEC.md` 10.1の「全変更の復元」と10.2の「保存済みは耐久化後」の関係について、保存中の確定入力まで保証するかユーザーに判断を求め、詳細説明後にAの明示承認を得た。Aは保存済み全変更を保証し、保存中の入力の扱いを明示して待ち時間を改善する契約。比較したBは画面へ反映した確定入力も保証し、耐久化後の編集反映へ再設計する契約で、Tiptap/Yjs binding、Undo、選択、IMEの再検証が必要になる。

## 次の検証

復元比較前に失敗ケースもsnapshot・保存表示・終了時刻を添付し、実driverの終了signalとPIDを確認した。Aの承認後も編集直後の試験を残し、実際にcommit済みのSQLite updateをchecksum確認して全件からYjs状態を再構築し、復元結果と完全比較する。最後の保存済みのblock構造・本文とpendingはすべて維持し、保存中の末尾追加入力だけを保証対象外にする。終了直前に保存済みと表示した場合は終了直前の全文・clock一致を必須とする。

保存待ち改善は、処理開始待ちのYjs updateをmergeしてまとめて保存する。最初の書き込みをdebounceで遅らせず、タイトル変更を挟む順序、失敗時の停止、送信前の耐久化を維持する。未commit入力の無条件な保持を実装した修正とは扱わない。Windows Tauriのnative IPC／Microsoft IMEは別の証拠であり、Docker結果を流用しない。

## 承認後の検証結果

[v0.6.2の最終証拠](../../tests/evidence/step-7-crash-recovery-20261001/SUMMARY.md)では11項目がPass。保存中の境界を試験専用ビルドでSQLite確定直前に停止し、表示は「端末へ保存中…」、入力後の本文は`keep immediate`、復元は最後に保存済みだった`keep`と確認した。block移動・削除を含む保存済み全文、全commit済みYjs update、Task／Relationと3件のpending operationは保持され、再接続後にpeerへ収束した。保存完了後の他3境界は終了前の全文・clockと一致した。試験専用停止featureが通常Tauriのdependency graphに含まれないことも確認した。初回の無条件復元Failは別の履歴として残す。
