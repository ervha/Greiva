# Native本文編集画面

v0.89.0。[handle固定session](NATIVE_PAGE_SESSION.md)を既存PageEditorへ接続した。明示Page作成・local一覧からの選択・本文の直列端末保存を扱い、保存中、保存未確認、確認済み未送信数を区別する。サーバー送信は次工程。

## 入力と閉鎖

同じsessionのY.Docを描画中に交換しない。composition中はPage切替・作成・認証操作を無効にする。失効がcomposition中に判明した場合、内容を覆いながらcomposition終了までdocumentとfocusを保持し、その後に保存queueをsettleして閉じる。保存未確認の入力はscope付きmemory下書きとして保持する。

logoutは画面の閉鎖とnative認証のlockを開始する。旧保存やrefreshの遅い応答で画面を再開せず、閉鎖待ちの旧refreshをlogout後に発行しない。同一issuer/owner/workspace/client/epoch/Pageへの明示復帰だけが下書きをmergeする。別accountでは表示しない。app kill後の未保存入力復旧ではない。

## 配布境界

native設定ありbuildはnative.htmlだけを含むfrontendを要求し、旧entryを含むbuildを拒否する。専用CSPはbrowserのsignupだけを許可し、password/refresh通信はnative側に限定する。Chromiumで許可されたsignupの実requestと、token fetchのnetwork前拒否を確認した。

`build:native-preview -- --isolated-fixture`は固定fixture設定だけを受け付け、identifierをdev.greiva.native.fixtureへ分ける。通常候補の端末DB/WebView namespaceを共有しない。実provider用の設定ではこのoptionを拒否する。

[検証証拠](../../tests/evidence/native-editor-screen-20261013/SUMMARY.md)。DockerのIPC doubleによる本文編集/保存・復帰を、Windows起動確認とは分ける。実Windows本文invoke、最新候補の実IME、native HTTP同期とoffline lease接続は未完了。
