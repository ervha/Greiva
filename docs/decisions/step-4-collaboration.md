# Step 4: Page共同編集

2026-10-01 / 実装チェックポイント 0.2.0。PoC Section 18 Step 4、Section 6.1–6.2に対応する。将来のカレンダー・AI・Task/Relation同期は含めない。

## 文書・接続と編集

PageごとにY.Docを1つ生成し、Hocuspocusの文書名を`page:{pageId}`、本文のY.XmlFragmentを`body`とする。`?page=<id>`で別Pageを指定でき、既定の検証Pageは固定ID。同じPageを別画面で開くリンクを用意した。各画面はランダムなclientIdを接続URLへ送り、サーバーの接続・耐久化ログへ記録する。PoCに認証は追加していない。ポート公開はlocalhostのみ。

空文書はサーバーで1回だけ作り、初回同期後にEditorをマウントする。各clientから初期HTMLを投入しないため、空段落の二重生成を避ける。React StrictModeのcleanupでproviderとY.Docを破棄する。

[TiptapのCollaboration](https://tiptap.dev/docs/editor/extensions/functionality/collaboration)を固定版3.31.3で追加し、StarterKitのUndoRedoを無効化する。履歴はYjsのローカル操作だけを対象とする。時間だけによる連続captureでTodoチェックや移動まで本文入力と一緒に取り消されないよう、構造変更・明示的な移動・選択位置の変更を履歴境界にする。折りたたみの`addToHistory:false`は維持する。Toggleの本文内では最も近い親の兄弟ブロックを移動できる。

composition中のキーマップ誤消費防止は維持し、Yjsの受信は停止しない。実際のMicrosoft IMEとリモート更新の共存は手動試験を要する。

## サーバーの耐久化境界

固定版Hocuspocus 4.7.0の`beforeSync`でSyncStep2/Updateのraw Yjs payloadを受信順に記録する。ライブラリ実装ではこのhookをawaitしてから更新適用とSyncStatus ACKを行う。`onChange`は完了を待たないため耐久化境界には用いない。[公式hookの説明](https://tiptap.dev/docs/hocuspocus/server/hooks)と固定版ソースを確認した。

単一プロセスの同期append/fsync journalを選択した。レコードはlength、その補数、SHA-256、binary update。ファイル作成時は親ディレクトリもfsyncする。受信データのdecodeに失敗した場合は記録しない。書込み/fsyncが失敗したPageでは以後のappendを拒否し、部分記録の後ろへACK済みレコードを追加しない。再起動時はupdate列から復元する。未完了の末尾レコードだけを切り落とし、完全なレコードのchecksum/header不整合は復元を停止する。JSON projectionから文書を再作成しない。

devのjournalは専用Docker volume `collaboration-data`に保持する。testsは独立filesystem・一時ディレクトリを使い、devの文書に触れない。ログ圧縮、snapshot最適化、複数プロセス・運用バックアップは対象外。

## 状態表示と境界

接続状態、初回同期状態、未ACK件数を別々に追跡する。切断中はpendingが0でも「同期済み」にしない。操作確認用に「接続を一時停止／再接続」を用意し、切断中もEditorを保持する。

「サーバーと同期済み」は接続・初回同期完了・pending 0を意味する。**端末SQLiteへの保存は未実装**であり、オフライン編集後の画面終了・強制終了はまだ保護できない。画面にこの制限を表示する。Pageタイトルも画面内の仮入力で、Page metadata永続化はStep 5。配布用Windows実行物は作成せず、既存debug shell 0.0.0をDockerのfrontend 0.2.0に接続する。shellとfrontendの版を混同しない。

## 検証

[試験証拠](../../tests/evidence/step-4-collaboration-20261001/SUMMARY.md)へbuild・型・自動試験・ソース対応をまとめる。A/B試験は独立ブラウザcontextを使い、rendered textに加えstate vectorのclient clock map、全文JSON、Y.XmlFragmentを比較する。raw vectorも保存するが、同じclock mapの異なるエンコード順を非収束と誤判定しない。読取り専用diagnosticsはE2E起動時だけ有効で、通常dev/productionには公開しない。

Section 6.2の6ケース、local Undoの分離、新規client復元、別Page分離を検証する。サーバーは別NodeプロセスをSIGKILLし、ACK済みbinary復元と停止中編集の再接続収束を確認する。端末SQLite/crash recovery、実機composition中のremote update、Gate A/B/Cの最終判定は別の証拠を要する。
