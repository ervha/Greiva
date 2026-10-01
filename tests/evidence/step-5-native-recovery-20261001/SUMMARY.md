# Step 5 Windows実機: offline保存・強制終了・復元・再接続

2026-10-01、Codex Computer UseでWindows Tauriを操作した。利用者のキー入力や結果回答に依存しない。[実行物・操作者・キー列](execution.json)、[最終候補の起動記録](final-launch.json)。Dockerでcross buildしたembedded debug shell 0.3.0を使用し、Windowsの通常権限で起動した。host toolchainの導入はない。test SQLiteとWebView cacheはプロジェクト内へ子プロセスだけの環境変数で指定した。

| 操作・確認 | 結果・証拠 |
| --- | --- |
| Docker dev停止中に新しいPageを作成、タイトル・本文2段落を入力しCtrl+Shift+↑で移動 | Pass。[保存済み・offline](before-kill.json)、[画面](before-kill.jpg) |
| path確認後にnativeを強制終了し、devを停止したまま新規WebView cacheで再起動 | Pass。[終了記録](termination.json)、[title・本文・順序の復元](restored-offline.json)、[画面](restored-offline.jpg) |
| 復元Pageの「別画面」リンクを修正した候補で再復元 | Pass。[正しいPage UUIDと本文](final-artifact-restored.json)、[画面](final-artifact-restored.jpg) |
| dev再開後、nativeからpeerへの本文送信とpeerからnativeへの段落受信 | Pass。[native保存・同期状態](reconnected.json)、[画面](reconnected.jpg)、[peer ACK/本文](peer.json) |
| nativeを終了してDB/WAL/SHMをまとめて保全し、実際のRust repositoryでY.Docを復元してpeerと比較 | Pass。[native復元](after-snapshot.json)、[state vector・本文一致](convergence.json)。titleも保持 |

初回の5 binary updateは[停止後のnative SQLiteコピーから復元](before-snapshot.json)した。コピーしたDBはDocker側だけで検査し、live DBへ直接SQLを流していない。DBコピーは私的な検証領域に置き、Gitへ含めず、明示した検証用Pageのmetadata・vector・本文だけを選別した。`inspect-native-page.mjs`のloadはコピーのlast-page stateへ書込むため、Docker copyでroot所有になったコピーに対しては検証ユーザーへの所有権調整が必要だった。readonlyエラーはこのfixtureの所有権でありlive保存の失敗ではない。

## 実際のIMEと限界

`press_key`で`n i h o n g o`を入力し、未確定の「にほんご」、Spaceの変換、2回目のSpaceで候補一覧、Upで「日本語」を選びReturnで確定した。[preedit](ime-preedit.jpg)、[変換](ime-conversion.jpg)、[候補](ime-candidates.jpg)、[確定](google-ime-committed.jpg)。候補footerの「Google」からGoogle日本語入力と確認した。literal Unicodeの直接入力をIME証拠にしていない。

Google IMEの確定文字も次の強制終了・復元とpeer同期で保持された。IME中のremote重複、再変換・Undo/Redo・全block、日本語入力の他Providerはこの結果から推定しない。Microsoft IMEへの切替を確立していないため、**Microsoft IME試験は未検証**。Googleの結果で代替しない。

[初期の起動失敗](../step-5-native-startup-20261001/SUMMARY.md)は制限付き起動と通常権限での起動を区別する。新しい候補ではPageリンクも修正したため、旧候補のhash・画面を最終候補の結果と混同しない。nativeの全Editor操作、保存故障注入、AndroidとGate A/B/Cの最終判定は残る。
