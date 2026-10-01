# Step 7: 統合crash recoveryとPage保存待ちの改善

2026-10-01。PoC Section 18 Step 7のnetwork chaos／crash recoveryを補強する。Windows native IPC／Microsoft IMEと性能試験、最終Gateは別途検証する。[証拠](../../tests/evidence/step-7-crash-recovery-20261001/SUMMARY.md)、[初回失敗と判断](../failures/step-7-integrated-crash.md)。

## 保存の契約

初回の編集直後SIGKILLでは、保存中の入力の末尾2文字、追加診断では3文字が欠落した。追加診断の保存表示は「端末へ保存中…」。保存済みデータが失われたと解釈しないが、画面表示済みの全入力を無条件に復元する設計ではなかったことを記録する。

詳細説明後、ユーザーは「『保存完了』でなく保存中であったならAでいいと思います。」と回答した。POC_SPEC.mdのSection 10と受入条件、製品要件・UI設計へ、端末保存完了した全変更を保証し、保存中の入力は保存完了前の強制終了では保証対象外とする契約を反映した。IME未確定候補の保存を保証する追加要求ではない。保存中と保存済みを区別し、説明をhoverに依存させない。

## 保存待ちの改善

PageWritesは、最初の書き込みをすぐqueueへ追加し、処理開始前のYjs updateだけをmergeする。debounceによる意図的な待ちは追加しない。開始済みの書き込みへ後続updateを混ぜず、metadataのタイトル変更をまたいでまとめない。待機batchの合計は4MiBまでとし、既存の16MiB update上限に無制限のbatchを送らない。

DurabilityBoundaryのpromiseはbatchのSQLite commit完了を表し、送信frameは自分の変更を含むpromiseを待つ。保存失敗はboundaryを停止し、後続保存・送信を通さない。連続入力の試験では、最初の書き込みを停止させた間の201更新（挿入と削除）を次の1 batchへまとめ、計2回の保存で全文・state vectorが一致することを確認する。これは制御した負荷での保存回数の検証であり、実機入力遅延の数値やIMEのPassではない。

## 強制終了の境界

- standalone Nest APIプロセスを実際にSIGKILLする。PostgreSQLの確定前はrow lockで停止して未確定を確認し、確定後は実HTTP応答を保留してACKを失わせる。再起動後の再送で一件だけ確定し、cursorとclient／peer／server Taskが整合する。
- Chromiumと実Rust driverを編集直後、保存完了後、サーバーpush確定後・ACK未受信、pull適用中・cursor確定前の4箇所でSIGKILLする。offlineでPageとblock編集、Task作成・更新、Relationを復元し、再接続して別clientへ収束させる。
- 編集直後も省略しない。外部のread-only SQLite読み取りでcommit済みupdateとchecksumを取得し、全updateから再構築したYjs状態に復元内容が一致することを確認する。最後の保存済みの全文・block構造・queueは保持する。保存中の場合は最後の未commit追加入力だけが欠落可能で、保存済み表示だった場合は終了直前の全文・clock一致を要求する。
- 保存待ち改善後の初回full runでは編集直後にも保存が完了していたため、最終runは試験専用featureでPage appendのSQLite commit直前を停止する。保存中表示、停止markerと終了driverのPID一致、未確定transactionのrollback、全保存済み内容の復元を確実に検証する。通常ビルドに停止処理は含めない。
- pullは試験専用のRust featureで、receipt／entity／Conflictをtransaction内へ書いた後、cursor確定前に停止する。外部readerから見える確定済みstateを比較し、SIGKILL後のatomic rollbackと再取得を確認する。通常Tauriのdependency graphにこのfeatureが含まれないことを別チェックで検証する。

## 範囲と次段階

入力予測・部分保存・差分保存に関する追加検討: 現在も本文全体を書き直さず、実際の編集が生成したYjs binary updateをSQLiteのjournalへ追記している。予測した文字列やIME候補を確定入力として保存しても、実際の未commit入力を復元する保証にはならない。次段階では入力発生からSQLite commitまでと保存待ちqueueを計測し、小さい差分の保存・待機差分の集約・IPCとcommitの待ちを改善する。将来のsnapshot／journal圧縮は復元高速化として別に検証し、暇な時間の処理が入力時の保存を遅らせないこと、commit済みupdateを圧縮前に失わないことを要求する。これらの追加最適化や入力予測は今回実装済みとはしない。

Chromeのプロセスと実Rust保存層の結合試験は、Windows WebView／Tauri IPCのプロセス境界そのものではない。旧Windows実行物の版を更新した扱いにせず、Microsoft IMEやnative全操作の成功へ読み替えない。初回の無条件復元Failと、A承認後の試験内容・結果を別の証拠として残す。

Step 8では1,000 block復元・連続入力、100回のYjs更新、1,000件のTask操作queueの性能、P1/P2の実行可能範囲を検証する。P0 nativeの残る操作・IMEを確認してから、Step 9のGate A/B/Cと技術選定結論を確定する。今回のcheckpointを最終Gate Passにしない。
