# DB差分の画面用runtime

2026-10-09 / v0.58.0。[取得session](PRIVATE_DATABASE_CHANGES_SESSION.md)を画面で扱える状態とlifetimeへ接続する。[判断16件](../decisions/private-database-changes-runtime.md)、[証拠](../../tests/evidence/private-database-changes-runtime-20261009/SUMMARY.md)。server11/native12保持。runtime基盤で、作成・更新queueとTable/List画面のmountは後続。

## 操作と表示状態

PrivateDatabaseChangesSession.openはcaptured connection/native storeと保存済みSourceに属するdelta sessionを開き、local progressだけを読む。opening/reloadはHTTPを開始せず、offlineでも確認済みの端末位置を読める。unknown Sourceや壊れたprogressを空の成功状態に置き換えない。

syncは1回最大100件の明示pullで、nativeのdurable cursorから始める。hasMoreがtrueでも自動loop/poll/retryを開始しない。次回syncが次windowを読む。native保存後の最新progressをdataへ反映する。

snapshotはphase/busy/data/error/retryReceive/observedHeadを区別する。observedHeadは成功した明示取得または再保存後のnative progressにhasMoreがないことだけを示す。opening/local reloadではtrueにしない。全DB同期済み・Page送信完了・作成更新queue ACKを表すflagは追加しない。取得中/エラー/unknown/閉鎖では観測完了を表示しない。

保存結果不明では旧dataを保持してstorage errorとretryReceiveを示し、新pullをbusyとする。local reloadでCOMMIT済みprogressが読めてもunknown pairは残す。retryReceiveは同応答をnetworkなしで再保存して最新位置を返し、成功した場合だけretryを解消する。private cause/値/tokenをerrorへコピーしない。

## lifetimeと検証

serial operationと捕捉Auth/contextを維持し、Auth refresh/session置換/native store close/connection closeでruntimeを閉じる。自分のdelta sessionだけを所有し、共有workspace storeやPage/Taskの処理を勝手に閉じない。closeはdata/pairを消して処理終了を待つ。observer exceptionやobserverからのcloseで保存を中断・新通信開始・close再帰させない。

portable11条件とsigned HTTP→Rust/SQLite PG2条件を検証する。actual103→104 event headを最大100の1windowと次windowに分け、途中の新変更を次回取得する。offline opening/transport failure、unknown/local reload/retry/restart、Auth/native closeのlate HTTP、runtime閉鎖後も既存Page pendingが保持されることを含む。新SIGKILLではなく原子保存kill証拠はv0.56.0へ分離する。

初回PG0 Pass/2 Failはfixture schema名suffixの長さ超過を短縮し、次のPG1 Pass/1 FailはPage loadのpendingが件数なのに配列lengthを期待した箇所を修正する。初回・中間report/logを保持し、最終2と全回帰を別に記録する。timeout/retryを増やさない。実Supabase正常login/Windows actual invoke/MS IME/Android/native credential・offline grant/配備暗号化/Gateは別条件。
