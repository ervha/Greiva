# Native handle固定の本文保存session

v0.88.0。[native認証port](NATIVE_AUTH_IPC.md)へ`NativePageSession`を追加した。これは本文editorへ渡すsession基盤で、専用画面へのmountは次工程。

## 保存と状態

明示createだけがPageを作る。local openはstrict metadata/Yjs journalを読み、pageIdを検査してからdocumentを有効化する。unknown create結果を自動再送せず、利用者の明示local reopenで保存済みPageを確認する。

sessionは開始時のimmutable native handle/contextを保持し、`executeFor`で同じhandleだけへ送る。更新byteはevent時にcopyし、直列queueでappendする。Page切替時の開始済み保存は元handleで完了できるが、再認証/別handleへ新しい保存先を転送しない。load replayを送信queueへechoしない。

savingは確認待ち、pendingは確認できたnative未送信数、unsavedは保存を確認できない更新数。append成功後だけunsavedを減らす。失敗/unknown responseで保存成功や同期を表示せず、後続の自動append/retryを止める。Y.Doc内の入力を保持し、error causeを固定categoryへ変える。server sync/ACKを行わない。

## compositionと下書き

composition中のcloseはbusyで拒否し、documentを破棄しない。確定後のcloseは開始済みqueueがsettleするまで待つ。保存未確認の入力があれば、context/pageId/titleとYjs全stateのcopyを呼出し元へ返してからdocumentを破棄する。呼出し元がこの戻り値を保持する画面接続は次工程であり、app kill後の未保存下書き復元ではない。

下書きはmemoryだけで扱い、localStorage/平文file/ログ/サーバーへ自動保存しない。明示`restoreDraft`は同一issuer/owner/workspace/client/epoch/Pageだけへ適用し、既に保存されたYjs stateとmergeする。unknown responseで既にcommitされていた更新を重複表示せず、不足する更新だけを現handleのlocal queueへ入れる。異account/epochへ移し替えない。

[証拠](../../tests/evidence/native-page-session-20261013/SUMMARY.md)。実Yjs binaryとIPC journal doubleで保存順序、本文/vector一致、handle切替/unknown commit/下書き復帰/composition拒否を確認した。実SQLite admissionの証拠はv0.85.0で、この新client sessionから実Windows invokeを通した意味ではない。次は既存PageEditorへmountし、保存状態・再認証・閉鎖/下書き保全を画面E2Eで確認する。
