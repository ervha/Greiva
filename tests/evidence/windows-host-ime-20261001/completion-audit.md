# Step 3 初回local IMEの完了監査

対象は[PoC Section 18 Step 3](../../../docs/plan/POC_SPEC.md)「Windowsで日本語IME試験を行い、Gate Aの初回証拠を作る」。ユーザー指定のDocker＋Windows実機構成で実施。Gate Aの最終判定やStep 4以降の完了へ範囲を広げない。

| 現在ステップの要求 | 根拠 | 判定 |
| --- | --- | --- |
| Windowsのnative TauriでEditorを起動 | [起動](launch.json)・[Windows/WebView2環境](runtime.json)、その画面で操作した利用者の[明示回答](manual-results.json) | 起動はコマンドで確認、表示・編集は利用者確認 |
| Section 5.3.1: 日本語の変換候補・確定・再変換 | USER-IME-01: 「日本語の変換・確定・再変換」について4項目すべて問題なしと回答A | Pass（利用者確認） |
| Section 5.3.2: 変換中・確定後の選択・削除・Undo/Redo | USER-IME-02: 変換中/確定後の両方を含む依頼に対する回答A | Pass（利用者確認） |
| Section 5.3.4のlocal部分: compositionの破綻なく操作できる | USER-IME-01～04すべて問題なし。Slash/Mention候補中の入力、Todo/Toggle/移動後の編集を含む | Pass（利用者確認、下記限界あり） |
| 検証したEditorと実行環境の対応 | [36ファイルのhash](source-match.json)、native binary 0.0.0のhash、Windows 11/Home build26300、WebView2 154.0.4258.37 | 記録済み |
| 初回証拠を保存・索引化し、Docker自動試験や合成compositionと区別 | [手動結果](manual-results.json)・[要約](SUMMARY.md)・[証拠索引](../README.md)。操作者と根拠・不足情報を明示 | 記録済み |
| Failがあれば停止・失敗記録 | 利用者は依頼した4群すべて問題なしと明示。環境権限による先行起動失敗は[保存](startup-sandbox-failure.log)・通常ホスト起動で解消 | 未解決の初回IME Fail報告なし |
| Docker維持と不要VM整理の追加指定 | 稼働中dev/healthy PostgreSQLの確認、[VM削除](vm-cleanup.json)・[VirtualBox削除](virtualbox-uninstall.json) | 確認済み |

根拠の限界: 初回操作結果は利用者による手動確認であり、CodexのGUI独立観察ではない。具体的な入力本文、操作時刻、キーのログ、画像/動画は提供されていない。IME-05の追加nativeブロック全件の確認を今回の回答から推定しない。初回の利用者確認を全自動試験の件数に加算しない。

後続の要求: Section 5.3.3のcomposition中の別client Yjs updateは、順序指定のStep 4で接続後に実施する。Gate Aの最終条件として全native Editor操作・必要な画面証拠を補強する。保存・offline/crash/reconnect・structured sync、Gate B/CはStep 5以降。これらは今回の目標「現在のステップ」の完了範囲ではなく、未達の後続工程として維持する。
