# Step 8の検証記録と停止境界

2026-10-02、文書・診断証拠チェックポイントv0.6.8。利用者は「今のステップの作業が終わるまで」と停止位置を修正し、後に「検証の終わりなど切りの良いところまで進めて」と再確認を許可した。v0.6.7の記録後に再開し、選択後のウィンドウ移動をnative event・素の入力欄・二つの対策実験で比較した。この診断・保存監査の区切りまでとし、Step 9の最終Gate判定と技術選定には進まない。

[最新の診断比較](../../tests/evidence/step-8-ime-focus-20261002/SUMMARY.md)で、選択後のblur／focusを挟むと3文字の範囲がnative削除eventで6文字へ広がる記録を得た。素のtextarea／contenteditable、遠隔更新なしでも発生し、移動なしの手動比較は本文を保持した。OS／IME／WebView2内の根本原因は未確定。keydown対策は失敗回でイベント未受領、focus復帰時の方向更新は実行されたが防止できず、製品へ採用していない。通常製品0.6.5とは別の診断source overrideであり、native全項目Passに読み替えない。

[今回の再確認](../../tests/evidence/step-8-ime-recheck-20261002/SUMMARY.md)では遠隔なしのMicrosoft再変換一回で本文保持、実Microsoft入力＋遠隔6更新後の別fixtureで同じ欠落をSQLite／fresh peerに確認した。今回のupdate 19、前回のupdate 95が直前3文字と日本語3文字を削除する。削除更新は特定したが入力層の原因は未確定。前回も欠落は候補確定前の最初の開始後観測ですでに存在したと補足し、手操作誤りの可能性を保持する。二回目はnative候補操作の完走と終了理由を観測していない。無条件なアプリ不具合の帰属やcrash試験成功を主張しない。

[検証結果](../../tests/evidence/step-8-platform-validation-20261001/SUMMARY.md)では、Googleの同一段落remote composition・local Undo/Redoと最終本文一致、Microsoftの通常変換中の6遠隔更新保持を確認した。一方、Microsoftの再変換後に選択範囲直前の `al ` が欠落し、peerとSQLiteにも伝播した。[失敗記録](../failures/step-8-ms-ime-reconversion.md)。未修正・原因未確定であり、Step 8全受入条件を完了したとは扱わない。

Windows releaseはidentifier／初期Page URLだけを変えた0.6.5隔離候補をDockerでbuildし、新規DB／WebView保存先の一回で主要UI確認まで上限1,962msを観測した。初回の観測間隔が空いた試行も保持する。正確なfirst paint、reboot後のcold起動、native大量データ性能の結果ではない。

残る検証はMicrosoft再変換の切り分け・修正後回帰、native全block／selection・削除・Undo/Redo組合せ、最新native統合crash、大量データ性能、P1／P2実OS。利用可能なAndroid／iOS／macOS実機を確認できておらず、Docker結果を代用しない。

今回の変更は文書・診断証拠のみ。通常製品とアプリ所有manifest／lockfileは実際の0.6.5を維持する。診断候補3本のsource override／artifact hash／buildとnative結果を分離し、根拠のある製品修正や全回帰の新しい成功を主張しない。Windows診断アプリは通常終了し、process不在とSQLiteコピーのhashを確認済み。2026-10-01に作った二つのbenchmark保存先はhash確認済みbackupへ退避後に除去済み。前回と今回のdebug失敗fixture、監査コピーと既存のDockerサービスは保持する。

再開時は失敗記録に沿う限定的な切り分けから進める。失敗記録を残すことは受入条件の緩和ではなく、[POC_SPEC.md §1.3](../plan/POC_SPEC.md)で定めた対応である。今回のcheckpointと停止は全PoCの完成・Gate合格を意味しない。
