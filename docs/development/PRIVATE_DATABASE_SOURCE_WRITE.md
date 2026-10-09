# DB作成の送信と状態管理

2026-10-09 / v0.60.0。[端末queue](PRIVATE_DATABASE_SOURCE_QUEUE.md)をcaptured Authのcreate HTTPへ接続する。[判断18件](../decisions/private-database-source-write.md)、[証拠](../../tests/evidence/private-database-source-write-20261009/SUMMARY.md)。server11/native13を保持。Record/View操作queueとTable/List画面は後続。

## 端末保存と明示送信

PrivateDatabaseSourceWriteSession.open/reloadは端末のpending-only一覧を読むだけでHTTPを始めない。enqueueは呼出側が作ったoperationId/Source定義を非同期処理前に検査・捕捉する。保存または保存後の一覧再読取が失敗した場合、同じintentを保持し、新enqueue/sendを止める。retryEnqueueはそのintentだけをnetworkなしで再保存する。reloadだけでは結果不明を清算しない。

一覧はpendingOnly=true/after sequence/limit100で過去のACK済み操作を除く。global pending数と今回windowのoperations/nextAfterを区別する。102件目などのpendingが100件の完了履歴に隠れず、moreは正確なsequence keysetを使う。pendingOnlyはportable default false、Registryでは必須booleanでcoerceしない。schema変更はない。

sendは最古未ACKのnative prepared wireを1件だけ送る。空queueではHTTPなし。生成時workspace/client/epoch/Auth leaseとprepare/ACK portsを固定し、/v1/workspaces/:workspaceId/databases/createへ保存済みbytesをそのまま送信する。prepared operation/Source/client/workspace、原replyのoperation/定義/version1/created/scopeを照合する。

## 結果不明と画面状態

HTTP応答不明ではACK pairを作らず、端末の元wireを次のsendで同じoperationとして再送する。serverの元結果とidempotencyで重複作成を防ぐ。native ACKの結果不明ではimmutable prepared/reply pairを保持し、retryAckはprepareもHTTPも行わず同じpairを再保存する。別send/新enqueueを止め、local reloadはこのpairを消さない。

ACK成功後に一覧再読取だけ失敗した場合はACK確認済みである。retryAckを捏造せず、旧一覧をcatalogFresh=falseで保持し、reloadで最新一覧を回復する。phase/busy/error/retryEnqueue/retryAck/catalogFreshを画面へ公開する。操作中や失敗時の旧一覧を現在のpending件数と扱わない。エラーは固定stageのみで、token/body/内部例外を表示・記録しない。

generation/session/native store closeやwriter置換は旧runtimeとprivate stateを閉じる。遅着HTTPを端末ACKへ渡さない。サーバーで既に保存された場合も元wireは端末でpendingのまま残り、新sessionで元結果を再取得できる。403はconnection全体を閉じるが端末queueを削除しない。runtime.closeは自分のwriterだけを閉じ、共有workspace storeを保持する。observer例外・busy時observerによるcloseで保存順序を壊さず新HTTPを始めない。

## 検証と残範囲

portable writer10/runtime10、pending-only native2、actual signed HTTP/JWKS→Postgres→Rust SQLite3と全回帰を確認する。新native表・SIGKILL境界はv0.59.0の証拠を保持し、今回の全回帰でも再実行する。実署名fixtureでの通信を実Supabase正常loginやWindows actual invoke/MS IME/Android/production暗号化の合格へ置き換えない。画面は未接続で、次はRecord/Viewのdurable書込みと確認済みSource・Page bootstrap依存を扱う。
