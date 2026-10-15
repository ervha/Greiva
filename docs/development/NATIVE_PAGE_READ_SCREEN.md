# Native取得操作と編集中本文への反映

v0.93.0。[native取得/保存基盤](NATIVE_PAGE_READ.md)を、選択済みPageの明示取得操作と表示中の本文へ接続した。remote一覧/catalogは次工程。

## 保存確認と表示

`readPageFor`のreceivedだけが保存済みjournalのloadへ進む。read_unknown/store_pendingでは表示を変更せず、自動再取得しない。native受信の確認、journalの読み直し、本文表示への反映を別状態にする。receivedの後でload/本文検査が失敗した場合、次の「表示を再確認」はlocal loadだけをやり直し、HTTPを再発行しない。

load responseの型とPage IDを確認し、独立したY.Docへ現在のstateとjournal全件を適用して検証する。不正な後続frameがあっても表示中のDocへ先行frameを部分適用しない。検証後の差分を既存Y.Docへ専用originで適用する。Doc/Editorを交換せず、remote由来の更新をlocal append queueへechoしない。local編集と未送信操作を保持し、未送信数を確定できない場合は再確認表示にする。

## Composition・選択・終了

composition中の取得開始は拒否する。既に開始したHTTP中も編集/端末保存を続け、composition中に届いた保存済み内容はmemoryで保留する。既存PageEditorがnative composition終了を確認した後に反映する。反映直前も元handle/phaseを検査し、閉鎖/失効した接続の保留内容を新しい画面へ移さない。

既存のrelative selection処理を使用する。同じ構造内のremote文字挿入で選択対象を維持し、remote変更をlocal Undo履歴へ含めない。構造変更や全種類の入力について無条件の選択保持を保証するものではない。logout/closeは既存のdraft保全を維持し、旧取得結果を破棄する。

UIは「取得結果未確認」「取得内容の端末保存未確認」「保存済み・変換確定後に反映」「表示反映済み」を区別する。これを全端末の最新状態との同期完了とは表示しない。

[証拠](../../tests/evidence/native-page-read-screen-20261015/SUMMARY.md)。Docker画面はIPC double/合成compositionで、実Windows read invoke・Microsoft IMEの受入とは分ける。実TLS/署名API/PGとSQLite receiveの証拠はv0.92.0を保持する。
