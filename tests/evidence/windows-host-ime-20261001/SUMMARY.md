# Step 3: Windows実機の初回IME検証

2026-10-01 JST。ユーザー指定によりDocker開発・自動テストを維持し、native/IME対象をWindows VMから実機へ変更した。**Step 3の初回local IME試験は利用者確認で完了、Gate A最終判定は未実施**。根拠は[明示的な実操作結果](manual-results.json)と起動・環境の記録。CodexによるGUI自動試験や画面の独立観察として扱わない。

## 確認した範囲

| 項目 | 結果 | 根拠 |
| --- | --- | --- |
| 既存Windows native shell起動 | 起動確認 | プロセス19096、タイトルGreiva PoC、非ゼロのwindow handle、Responding=true。[起動記録](launch.json)・[環境記録](runtime.json) |
| Dockerとのソース対応 | 一致 | 起動中image `sha256:89b3f4a82356b47528f7c72d82112db7e55d6306f07eda4d2ea1c371a7020bc1`。client/shared 36ファイルのSHA-256をcheckoutと個別照合した。[各ファイルの照合記録](source-match.json) |
| WebView2保存先 | 確認 | Greiva直下のWebView2ブラウザプロセスの`--user-data-dir`が`<repo>/.data/host-ime/webview2/EBWebView`を指す。ホスト全体の環境変数は変更していない |
| native画面の描画・編集 | 利用者確認 | 起動したGreivaで4項目を実施し、すべて問題なしと明示回答。プロセスの存在だけを根拠にしていない |
| 初回local Microsoft IME | Pass（利用者確認） | 変換・確定・再変換、変換中/確定後の選択・削除・Undo/Redo、Slash/Mention候補中の入力、Todo/Toggle/移動後編集の4項目。[結果](manual-results.json) |
| 配布ビルド・永続化・同期・crash/reconnect | Not run | 既存開発用shellとDockerエディターを使用。同期等は後工程 |

Windows 11 Home `10.0.26300`、WebView2 `154.0.4258.37`。日本語入力設定にはMicrosoft IMEのTIP `{03B5835F-F03C-411B-9CE2-AA23E1171E36}/{A76C93D9-5523-4E90-AAFA-4DB112F9AC76}`を確認した。設定の存在を実入力の成功とは扱わない。

実行物は2026-09-30作成の既存debug shell、ProductVersion `0.0.0`、SHA-256 `1F397C61588B42F26CAA05EF7F23BA4C435CDF140F35536D70F299C8138D410C`。起動時checkoutは`f3d9bfe37b9335e25a593170ad0b620925c9f648`（v0.1.3）、今回の運用更新はv0.1.4。既存実行物をv0.1.4へ付け替えない。Rust部分は今回変更・再ビルドしていない。

最初の制限された起動はAppDataの初期化でアクセス拒否となり終了した。[失敗ログ](startup-sandbox-failure.log)。既存プロセスの終了を確認後、ユーザーが指定した実機検証として通常のホストアクセスで再起動し、window handleとWebView2の起動を確認した。当初の表示・IME未確認の状態は`runtime.json`に残し、後の利用者確認は`manual-results.json`へ別途記録した。

## VM関連物の整理

[削除記録](vm-cleanup.json)。停止中のGreiva VMだけを対象に、設定・VDIがプロジェクト内に収まること、他のVMプロセスがないことを確認して登録解除・削除した。ISOを含む`.data/windows-vm/`も削除し、約8.4GBを解放した。デフォルトのVirtualBox registryは存在せず、プロジェクト用registryのVMはGreivaだけだった。

VirtualBox本体も**削除完了**（2026-10-01 08:03:23 JST）。通常のsilent MSI実行ではerror 1730/exit 1603となったが、Windowsの管理者確認（UAC）後の実行はreturn 0で終了した。アンインストール登録情報とVBoxManage実行ファイルの不存在も確認した。[完了確認](virtualbox-uninstall.json)。元の[削除記録](vm-cleanup.json)の「本体未削除」は当初の時点の状態として保持する。Dockerと旧検証証拠は削除していない。

## 初回の操作結果と後続検証

[実機試験手順](../../../docs/development/windows-host-ime.md)に沿い、文章の変換・再変換、変換中と確定後の編集、候補UIと入力、Todo/Toggle/ブロック移動の4群を利用者が操作した。回答Aは「前の4項目すべて問題なし」と明示した選択肢への回答であり、初回local IMEの手動結果として採用する。貼付け・合成composition・Docker E2Eを実IMEの成功として流用していない。

「行いました」だけの時点では合否を付けず、その後の明示回答Aで結果を確定した。操作した正確な時刻、入力前後の本文、キー単位のログ、スクリーンショット/動画は提供されていない。これらを推測・生成せず、今回の証拠が利用者の合否報告であることを明示する。IME-05の見出し・各リスト・引用・Code・Divider等の追加native操作は、この4項目の回答だけでは全件Passとしない。

Step 3で要求された初回IME証拠は保存済み。[完了監査](completion-audit.md)。Step 4でYjs/Hocuspocusを接続してから、Section 5.3の別client updateをcomposition中に受ける試験を追加する。Gate Aの最終判定では残るnative Editor操作と必要な画面証拠も補強する。Gate B/C、永続化・crash/reconnect、配布ビルドの成功を今回の確認で主張しない。
