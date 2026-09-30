# Step 3: Windows実機の初回IME検証準備

2026-10-01 JST。ユーザー指定によりDocker開発・自動テストを維持し、native/IME対象をWindows VMから実機へ変更した。**Step 3未完了、Gate A未判定**。

## 確認した範囲

| 項目 | 結果 | 根拠 |
| --- | --- | --- |
| 既存Windows native shell起動 | 起動確認 | プロセス19096、タイトルGreiva PoC、非ゼロのwindow handle、Responding=true。[起動記録](launch.json)・[環境記録](runtime.json) |
| Dockerとのソース対応 | 一致 | 起動中image `sha256:89b3f4a82356b47528f7c72d82112db7e55d6306f07eda4d2ea1c371a7020bc1`。client/shared 36ファイルのSHA-256をcheckoutと個別照合した。[各ファイルの照合記録](source-match.json) |
| WebView2保存先 | 確認 | Greiva直下のWebView2ブラウザプロセスの`--user-data-dir`が`<repo>/.data/host-ime/webview2/EBWebView`を指す。ホスト全体の環境変数は変更していない |
| native画面の描画・編集 | Not run | 利用者の画面確認待ち。プロセス・window handleの存在で描画成功としない |
| Microsoft IME必須操作 | Not run | 実際の日本語キー入力、候補選択、再変換、composition、Undo/Redo、Slash/Mentionとブロック操作の観察が必要 |
| 配布ビルド・永続化・同期・crash/reconnect | Not run | 既存開発用shellとDockerエディターを使用。同期等は後工程 |

Windows 11 Home `10.0.26300`、WebView2 `154.0.4258.37`。日本語入力設定にはMicrosoft IMEのTIP `{03B5835F-F03C-411B-9CE2-AA23E1171E36}/{A76C93D9-5523-4E90-AAFA-4DB112F9AC76}`を確認した。設定の存在を実入力の成功とは扱わない。

実行物は2026-09-30作成の既存debug shell、ProductVersion `0.0.0`、SHA-256 `1F397C61588B42F26CAA05EF7F23BA4C435CDF140F35536D70F299C8138D410C`。起動時checkoutは`f3d9bfe37b9335e25a593170ad0b620925c9f648`（v0.1.3）、今回の運用更新はv0.1.4。既存実行物をv0.1.4へ付け替えない。Rust部分は今回変更・再ビルドしていない。

最初の制限された起動はAppDataの初期化でアクセス拒否となり終了した。[失敗ログ](startup-sandbox-failure.log)。既存プロセスの終了を確認後、ユーザーが指定した実機検証として通常のホストアクセスで再起動し、window handleとWebView2の起動を確認した。表示・IMEは未確認なのでEditorのPass/Failを推定しない。

## VM関連物の整理

[削除記録](vm-cleanup.json)。停止中のGreiva VMだけを対象に、設定・VDIがプロジェクト内に収まること、他のVMプロセスがないことを確認して登録解除・削除した。ISOを含む`.data/windows-vm/`も削除し、約8.4GBを解放した。デフォルトのVirtualBox registryは存在せず、プロジェクト用registryのVMはGreivaだけだった。

VirtualBox本体は**未削除**。通常のsilent MSIアンインストールはerror 1730（管理者としての実行が必要）で終了コード1603となった。続いてWindowsの管理者確認（UAC）付きで起動し、記録時点では確認待ちである。自動承認レビューの拒否ではなく、Windows Installerからの要求である。Docker・起動中の実機Greivaと旧検証証拠は削除していない。

## 未完了の試験

[実機試験手順](../../../docs/development/windows-host-ime.md)のNATIVE-01・IME-01～05は利用者の実操作待ち。現在の接続にはWindows GUI操作ツールがない。各項目の操作・日時・実結果、IME候補や未確定文字の画面を得てから判定する。貼付けや合成compositionで代替しない。全項目の成功が確認されるまでStep 4へ進まない。Yjs接続後のcomposition中の別client updateは後で追加検証する。
