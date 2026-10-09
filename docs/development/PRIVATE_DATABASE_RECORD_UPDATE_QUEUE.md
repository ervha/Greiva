# Record更新・競合解決の端末queue

2026-10-09 / v0.62.0。[Record作成queue](PRIVATE_DATABASE_RECORD_CREATE_QUEUE.md)に続き、既存Recordのupdateと新operationによる競合解決を保存する。[判断20件](../decisions/private-database-record-update-queue.md)、[証拠](../../tests/evidence/private-database-record-update-queue-20261009/SUMMARY.md)。native14→15/server11保持。View queue、Record送信session/runtime、6型Table/List画面は後続。

## 元の編集と処理待ち

enqueueは確認済みSource、実際に受信したbaseVersionのRecord history、typed update intentを照合して捕捉する。NameはPage titleとして扱い、Record値へ複製しない。確認済みRecordのPage bindingを使うため、本文の端末ダウンロードは必要ない。架空versionや自己ACKを前提にしたbaselineを作らない。

同Recordには未ACK updateを1件だけ保持する。別operationを保存しようとした場合は既存operationId付きbusyを返し、無書込みで元操作を保持する。busyは保存結果不明と区別する。後続画面は新しい編集を別draftとして保持し、保存済みと表示してはならない。自分のACKが出すversionへ自動的にbaseを進める処理、offline successorの暗黙変換は今回の範囲に含めない。別Recordの保存は独立して可能。同operationのexact retryは元captureと照合する。

解決操作は既知かつ未解決の候補、現在の確認version、元base/local/remote、property/remoteVersion/choiceを照合する。元候補をoperationと保存し、後からremoteが変わっても選択を上書きせず元intentを送る。serverのresolution_stale等は原結果として保持する。

## wire・原ACK・cache

context/Source/intent/base/candidate/indexのSHA256と元wire文字列SHA256を検査する。局所破損検知でAuth grantや署名ではない。canonical IDと6型、UTF8 wire 8MiBを検査し、enqueue後に永久にprepare不能な操作を作らない。Record create/update間でもoperation IDの再利用を拒否する。

prepareは最古未ACK1件の元wireを同transactionで固定し、再prepareでformat/key順を再生成しない。Source metadata変更は元操作を変えず、schema変更は自動変換しない。ACKは元sequence/wire/client/workspace/epoch/operation/Source/schema/Record/Pageとversion、typed field、三値候補を照合する。未設定と明示null、zero/false、local未変更とremote変更を区別する。

applied/conflict/rejectedの原envelopeを保存し、queue ACK/write receipt/history/currentを同SQLite transactionで確定する。conflictは部分mergeと元候補を保持する。rejectedも確認済みの原結果だが「編集値が適用された」と表示するための結果ではない。解決appliedだけがresolvedByと解決proofを同transactionで確定する。remote選択で値・versionが変わらない場合も新operationとして解決を記録する。rejectedでは候補を消費しない。

write receiptは元queueのcapture/wire/原ACK proofを検査する。内部cache適用用にrecord/conflictsを抽出するが架空read receiptを作らない。read/deltaはqueueを消さず、原ACKは遅着しても新しいcurrentを戻さない。deltaが同じ解決を先に観測した場合は最初のhistory/解決proofとcursorを保持する。異なるoperationの解決を上書きしない。exact replayは欠損history/projection/candidateを補修せず失敗する。

## 有界一覧・移行・証拠

queueは正確な整数sequenceのkeyset、pending-only、max100件と検査済みlookaheadを使う。SQLは1行ずつ取得し、32MiBを目安にwindowを分割する。単一の有効な大きい行は128MiB上限で返せる。global pending数とwindow件数を区別し、nextAfterは最後に返したsequenceとする。実際の大きなconfirmed baseline/原ACKを持つ2行で分割・次頁を検証する。

bound context照合後にnative0/5〜14から15へ移行する。Source/create queues、Record/View/cache/delta cursor、Page binary/本文queue/title、Task/Relationを保持する。foreign binding/partial DDL/unknown schemaはrollbackする。strict IPC/portable adapterはscope/型/sequence/結果を検査し、Auth refresh/close後の旧storeを拒否する。

Dockerの実Rust/SQLite、実SIGKILL6 trialsと全回帰/build/help版表示で検証する。初回破損注入2件はfixture接続の外部キー制約により注入前に失敗した。意図した欠損を作る試験接続だけ修正し、元Fail reportを保存する。Record実HTTP/runtime、View queue、Table/List、actual Supabase正常login、Windows actual invoke/MS IME、Android/native credential・offline grant、配備暗号化とnative Gateは別条件。
