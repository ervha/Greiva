# Step 8: Todo本文とチェック欄の配置

2026-10-01、v0.6.5 PATCH。Windows 0.6.4の実操作で、Todoのチェック欄と本文が別の行に配置されていた。Dockerの実DOMを確認すると、固定版Tiptapは`ul[data-type="taskList"] > li[data-checked]`を生成し、既存の`li[data-type="taskItem"]`に一致しなかった。完了時の取り消し線は別の`data-checked`規則で正常に動作していた。

横並び・label位置・本文領域の伸縮の3規則をtaskList直下のliへ適用する。通常の箇条書きに適用せず、入れ子のtaskListも同じ構造で対象になる。保存・同期・IME・Undoの処理は変更しない。

新しい実操作E2Eは2項目のチェック欄と本文の相対位置・同じ行の配置、ポインター入力による同じ項目の編集、他の項目保持とチェック後の取り消し線を検査する。修正前は位置検査Fail、修正後はPass。[証拠](../../tests/evidence/step-8-todo-layout-20261001/SUMMARY.md)。初期の診断scriptは存在しないtaskItem属性で検索して失敗したが、実DOMを読んで診断し直し、実位置を検査する回帰試験にした。

Windowsの新規Page、Slash、見出しと段落、選択置換・Undo/Redo、Toggleの内側入力・キーボード開閉・ポインター再展開、Todo入力・チェックは修正前0.6.4の限定証拠。日本語は実キーで読み・変換・候補変更・確定・Undo/Redo・選択を観察した。利用者はGoogleを使うと回答したがProvider名の独立した画面証拠はない。途中の利用者入力検出・再観察も記録した。Microsoft IME、再変換、同一段落remote composition重複、native全操作・強制終了の最終合否には読み替えない。設定アプリの操作承認は一度タイムアウトし、再試行ではtargetable windowが取得できず、入力方式の設定変更は行っていない。

修正後0.6.5を同じproject内SQLiteと新しいWebView cacheで起動し、通常再起動後の試験本文表示、Todoの同じ行の配置・pointer編集・チェック解除と再チェックを確認した。Docker previewも同じ130ファイルのsource hashで反映し、3サービスの正常応答を確認した。0.6.5の限定操作と0.6.4の日本語試験を区別する。

0.6.4 release exeもDockerでlocked/offline buildしhostのProductVersion・SHA-256を照合したが、起動・空DB隔離・時間測定は未検証。debug専用DB指定はreleaseで無効なので、既存DBを空DBとして測らない。最新0.6.5 native全操作、Windows release性能、P1/P2実OS、最終Gateは残る。
