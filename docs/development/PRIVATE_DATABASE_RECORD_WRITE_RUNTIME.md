# Record保存・送信の画面用runtime

2026-10-09 / v0.64.0。[Record実HTTP送信](PRIVATE_DATABASE_RECORD_WRITE.md)とnative queuesを画面用状態へ接続する。[判断18件](../decisions/private-database-record-write-runtime.md)、[証拠](../../tests/evidence/private-database-record-write-runtime-20261009/SUMMARY.md)。native15/server11保持。View queue、6型Table/List操作画面は後続。

## local openingと未送信一覧

PrivateDatabaseRecordWriteSessionは同connection/native storeを照合し、元lease、create/updateのenqueue/load portsと追跡済みRecord送信sessionを固定する。opening/reload/enqueueでHTTPを呼ばない。両queueをpending-only/max100で読み、両方の読込みがsettleするまで待つ。一方の失敗で半分だけ新しいdataを採用したり、架空の空一覧でreadyにしたりしない。

dataはcreate/update別のwindow、global pending数、exact sequence/nextAfterを持つ。queueFreshは種類別で、最後の成功した端末読込みを表す。server同期完了や外部操作まで含めた常時最新保証ではない。work開始/失敗で両方をfalseとし、古いdataを保持する。通常reloadは両方の先頭を再読込みし、moreは指定種類のnextAfterだけを進めて他windowを最新と扱わない。nextAfterがないmoreはIOを行わない。

作成queueも更新queueと同じ32MiB window目安/128MiB単一行上限を追加する。SQLを1行ずつ取得し、max100/検査済みlookahead/global count/exact nextAfterを維持する。大きい原intent/wire/ACKの2行でbyte分割と、切れ目のlookahead破損拒否を検証する。schema変更はない。

## 保存結果・処理待ち・再確認

create/update enqueueはtyped Source/intent/contextを非同期前に捕捉する。保存結果不明または保存後の一覧更新失敗では元kind/operation/intentを保持し、同intentをnetworkなしで再保存できる。reloadだけで保持intentを消さない。新しい保存/送信はbusyとする。

known busyは同Recordの元updateを上書きせず、未保存の新attemptと既存operationIdをlastEnqueueで区別する。known busyの直後に一覧更新が失敗してもretryEnqueueを捏造しない。後で勝手に新draftをenqueueしない。呼出画面は返ったbusyに応じて新draftを保持し、保存済みと表示してはならない。同Recordのoffline successor/durable新draft自体は後続。

lastEnqueueのqueuedはoperationの保存確認を表し、server確認や編集値の適用を表さない。lastSendはkind付きempty/blocked/ackを分け、ackにはapplied/conflict/rejectedの原replyを保持する。Source/Page blockedでHTTPを呼ばず、emptyで同期完了を捏造しない。

HTTP unknownはdurable operationを残し、元wireを明示再送する。native ACK unknownは元pairとretry kindを送信sessionが保持し、runtimeのreloadでpending0が見えても消さない。retryは元pairの保存だけでHTTP/prepare/captureを行わない。known ACKの後に一覧更新だけが失敗した場合は原lastSendを保持し、retryAckを捏造しない。原known rejectionを適用成功へ変換しない。

## busy・閉鎖と証拠

runtimeは1workだけ実行し、固定error stageだけを表示状態へ渡す。observer例外は保存を妨げない。close/lease失効/session replacement/native closeは旧workを除外し、保持intent/queue/result/pairを消す。閉鎖は自身のsessionとlistenersに限定し、共有workspace storeを閉じない。closeは同promiseを返し、開始済みworkの終了を待つ。

portable runtime18＋既存送信17条件、作成native24（新byte条件1＋既存23）、actual signed HTTP-native Record9（新runtime3＋既存6）を確認する。実SQLite enqueue return loss、reload後もunknown保持、exact retry、known busy/no overwrite、HTTP loss/restart、known ACK/list failure、Auth refresh中の遅着と新runtime復旧を含む。

初回型チェックはprivate enqueue portと公開methodの同名衝突を検出した。portをenqueueCreateStore/UpdateStoreへ改名し、元Fail logと修正後Passを分ける。actual Supabase正常login、Windows actual invoke/MS IME、Android、native credentials/offline grant、配備暗号化やnative Gateは別条件。今回のruntimeだけでTable/List操作画面を完成扱いにしない。
