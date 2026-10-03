# Step 8の検証記録と作業境界

## 現在の進め方（2026-10-03）

0.6.9停止後、この作業treeで利用者が参照セッションを引き継いで再開するよう指示した。v0.6.10では[保存済み証拠の監査](../../tests/evidence/poc-audit-20261003/SUMMARY.md)と[8受入条件・実機再開順序](../plan/POC_VALIDATION_MATRIX.md)を追加。手操作・新しいnative試験は未実施、最終Gateを判断していない。Pixel 7／Android 17 QPR1を利用者申告として記録した。以下の0.6.9停止は履行済みの履歴である。

利用者は開発再開を指示し、手操作が必要な試験を記録して後回しにすること、質問を通知すること、検証済みの区切りでcommit／pushすることを指定した。その後の最新指示「キリの良いところで止めて」に従い、今回は選択位置修正0.6.9の検証・Windows候補準備・commit/tag/pushまでで停止する。新しい実機試験へ進まない。下記のv0.6.8の停止は当時の履歴として保持する。

Step 8内の自動回帰で、遠隔文字編集後に見出し／Toggleの選択が別の文字へ移る不備を再現した。[限定修正の記録](../failures/step-8-remote-selection.md)。Dockerの文字選択試験とMicrosoft IMEのnative再変換を混同せず、元のIME本文保持Failを維持する。全Gateの成功を前提とした本番機能追加・基盤選定は行わない。

手操作待ちの検証、複数の解決候補・制約・推奨順序は[再開一覧](../plan/DEFERRED_VALIDATION.md)にまとめる。architecture変更等の判断が必要になれば具体案を質問し、回答に依存しない作業を続ける。

## v0.6.8時点の診断と停止履歴

2026-10-02、文書・診断証拠チェックポイントv0.6.8。利用者は「今のステップの作業が終わるまで」と停止位置を修正し、後に「検証の終わりなど切りの良いところまで進めて」と再確認を許可した。v0.6.7の記録後に再開し、選択後のウィンドウ移動をnative event・素の入力欄・二つの対策実験で比較した。この診断・保存監査の区切りまでとし、Step 9の最終Gate判定と技術選定には進まない。

[最新の診断比較](../../tests/evidence/step-8-ime-focus-20261002/SUMMARY.md)で、選択後のblur／focusを挟むと3文字の範囲がnative削除eventで6文字へ広がる記録を得た。素のtextarea／contenteditable、遠隔更新なしでも発生し、移動なしの手動比較は本文を保持した。OS／IME／WebView2内の根本原因は未確定。keydown対策は失敗回でイベント未受領、focus復帰時の方向更新は実行されたが防止できず、製品へ採用していない。通常製品0.6.5とは別の診断source overrideであり、native全項目Passに読み替えない。

[今回の再確認](../../tests/evidence/step-8-ime-recheck-20261002/SUMMARY.md)では遠隔なしのMicrosoft再変換一回で本文保持、実Microsoft入力＋遠隔6更新後の別fixtureで同じ欠落をSQLite／fresh peerに確認した。今回のupdate 19、前回のupdate 95が直前3文字と日本語3文字を削除する。削除更新は特定したが入力層の原因は未確定。前回も欠落は候補確定前の最初の開始後観測ですでに存在したと補足し、手操作誤りの可能性を保持する。二回目はnative候補操作の完走と終了理由を観測していない。無条件なアプリ不具合の帰属やcrash試験成功を主張しない。

[検証結果](../../tests/evidence/step-8-platform-validation-20261001/SUMMARY.md)では、Googleの同一段落remote composition・local Undo/Redoと最終本文一致、Microsoftの通常変換中の6遠隔更新保持を確認した。一方、Microsoftの再変換後に選択範囲直前の `al ` が欠落し、peerとSQLiteにも伝播した。[失敗記録](../failures/step-8-ms-ime-reconversion.md)。未修正・原因未確定であり、Step 8全受入条件を完了したとは扱わない。

Windows releaseはidentifier／初期Page URLだけを変えた0.6.5隔離候補をDockerでbuildし、新規DB／WebView保存先の一回で主要UI確認まで上限1,962msを観測した。初回の観測間隔が空いた試行も保持する。正確なfirst paint、reboot後のcold起動、native大量データ性能の結果ではない。

残る検証はMicrosoft再変換の切り分け・修正後回帰、native全block／selection・削除・Undo/Redo組合せ、最新native統合crash、大量データ性能、P1／P2実OS。利用可能なAndroid／iOS／macOS実機を確認できておらず、Docker結果を代用しない。

今回の変更は文書・診断証拠のみ。通常製品とアプリ所有manifest／lockfileは実際の0.6.5を維持する。診断候補3本のsource override／artifact hash／buildとnative結果を分離し、根拠のある製品修正や全回帰の新しい成功を主張しない。Windows診断アプリは通常終了し、process不在とSQLiteコピーのhashを確認済み。2026-10-01に作った二つのbenchmark保存先はhash確認済みbackupへ退避後に除去済み。前回と今回のdebug失敗fixture、監査コピーと既存のDockerサービスは保持する。

再開時は失敗記録に沿う限定的な切り分けから進める。失敗記録を残すことは受入条件の緩和ではなく、[POC_SPEC.md §1.3](../plan/POC_SPEC.md)で定めた対応である。今回のcheckpointと停止は全PoCの完成・Gate合格を意味しない。
