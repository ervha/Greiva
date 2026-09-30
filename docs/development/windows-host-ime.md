# Windows実機でのTauri・Microsoft IME検証

2026-10-01、ユーザーは「Docker＋実機」を選択した。開発サービスと自動テストはDocker内を維持し、PoC Section 18 Step 3のnative UIとMicrosoft IMEはホストWindowsで検証する。VMの準備は中止する。

## 起動方法

リポジトリのルートからPowerShell 7で:

```powershell
./scripts/start-windows-ime.ps1
```

この起動スクリプトは既存の`apps/client/src-tauri/target/debug/greiva-poc.exe`を使う。Node、npm、Rust、C++ Build Toolsをインストール・実行しない。Docker側の`http://127.0.0.1:1420/`へ接続する開発用native shellであり、配布用ビルドの検証ではない。実行物の版とhash、起動時のGit checkpointを別々に記録する。アプリの版は既存実行物の0.0.0のままである。

WebView2のユーザーデータは子プロセスの`WEBVIEW2_USER_DATA_FOLDER`で`.data/host-ime/webview2/`へ指定する。[Microsoftの環境変数の仕様](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/webview2-idl)に従い、実際のブラウザプロセスの保存先も確認する。グローバル環境変数は変更しない。Tauri自体は`%LOCALAPPDATA%/dev.greiva.poc/`にディレクトリを作成することがあり、OS・WebView2のログ等も含めホストへの書込みが完全にゼロとは主張しない。

起動ログは`.data/host-ime/runs/`へ置く。実行物、ユーザーデータ、未選別のログはGit対象外。試験中のノートはこのPoCでは永続保存されないため、画面を再起動・再読込みする前に必要な証拠を採取する。

## 実際のIME操作

日本語文字列の貼付け、Unicode直接挿入、合成CompositionEventで代替しない。Microsoft IMEへ切り替え、実際のキー入力、候補選択、未確定状態を観察する。現在の接続にはWindows GUIを操作するツールがないため、操作と画面の確認は利用者が行う。Codexは結果と証拠を整理する。

| ID | 操作 | 期待結果 |
| --- | --- | --- |
| NATIVE-01 | Greivaのnative画面を開き、本文をクリックする | Editorが表示され、クリックした位置で入力できる。起動プロセスの存在だけではPassにしない |
| IME-01 | 「にほんご」をキー入力し、候補から「日本語」を選んで確定する | 確定は1回だけ。文字欠落・二重入力・意図しない改行がない |
| IME-02 | 確定した「日本語」を選択してMicrosoft IMEで再変換する | 再変換でき、選択範囲とカーソルが維持される |
| IME-03 | 変換中と確定後の両方で文字選択・削除・Undo/Redoを行い、候補変更と取消も試す | compositionの意図しない中断・文字欠落・二重入力・カーソル逸脱・入力不能・クラッシュがなく、期待する本文へ戻る |
| IME-04 | Slash/Mention候補が表示された状態で日本語を入力・確定する | composition中のEnter・矢印を候補UIが誤消費せず、誤ったブロック挿入や二重確定がない |
| IME-05 | 見出し・各リスト・Todo・Toggle・引用・Code・Divider・Mention、ブロック移動と入れ子Toggleを操作する | 編集を続けられ、構造・本文・Todo状態を失わない |

各行にPass/Fail/Not run、操作した人、分かる範囲の日時、入力前後の本文、実結果を記録する。利用者の明示的な合否報告は初回の手動結果として保存し、Codexによる独立観察や自動試験とは区別する。本文・具体的時刻・画面が提供されていなければその不足を記録し、推測で補わない。IME候補・未確定文字の画面が得られた場合は証拠として保存し、失敗時は再現手順も残す。Windows、Microsoft IME、WebView2、実行物hashとDockerソースの対応を記録する。

2026-10-01、利用者は変換・再変換、変換中/確定後の編集、Slash/Mention候補中の入力、Todo/Toggle/移動後編集の4項目すべて問題なしと回答した。[初回手動結果](../../tests/evidence/windows-host-ime-20261001/manual-results.json)。初回local IME証拠を記録済み。IME-05のその他ブロック全件や画面の独立観察まで確認済みとは扱わない。

## 次のステップとの境界

これはlocal Editorの初回検証である。Section 5.3の別clientからcomposition中にYjs updateを受ける試験はStep 4の接続後に追加する。初回IMEを通過してもGate A最終Passとは扱わない。残るnative Editor操作と画面証拠は最終判定に向けて補強する。Fail時は失敗記録を作ってStep 3で修正し、同期実装へ先行しない。

## 不要になったVMの整理

ユーザーは実機検証へ切り替えた後の不要なVM関連物の削除も許可した。実機でnative起動できることを確認後、Greiva専用の停止中VM・ISO・準備ファイルを整理する。対象をプロジェクト配下の正規化された絶対パスで検証し、他のVMやデータを巻き込まない。VirtualBox本体は他のVMで利用されていないことを確認してから扱う。過去の設計・検証記録は履歴として保持する。

2026-10-01、Greiva VM・ISO・準備ディレクトリに続き、VirtualBox本体のアンインストールも完了した。[確認記録](../../tests/evidence/windows-host-ime-20261001/virtualbox-uninstall.json)。Docker側の環境と実機IME試験の実行方法は変更していない。
