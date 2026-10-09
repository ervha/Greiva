# DB作成の端末queue

2026-10-09 / v0.59.0。[server create](PRIVATE_DATABASE_SOURCE.md)のSource定義を送信前から端末へ保持する。[判断20件](../decisions/private-database-source-queue.md)、[証拠](../../tests/evidence/private-database-source-queue-20261009/SUMMARY.md)。native12→13、server11保持。HTTP送信session/runtime、Record/View操作queue、Table/List画面は後続。

## pending定義と送信内容

database_source_enqueueはoperationId＋Source定義を捕捉し、canonical UUID/workspace/schema1/6型・Name1個/label/property/option数を検査する。pure Source定義validatorをcache snapshot validatorから分け、pendingへ架空versionやcreationOrderを与えない。確認済みSource IDへの新create、operation IDやSource IDの再利用を拒否し、同じoperation/定義の再試行は1行だけを保持する。

Source operations表は独立した定義/sequence/immutable wire/原ACKを持つ。sequenceは正確な正のi64文字列。定義はcontext/operation/Sourceのcanonical SHA256、wireは保存した文字列のSHA256を照合する。局所的な破損検知で、悪意あるDB全体改変に対する署名/Auth grantではない。

prepareは最古の未ACK操作1件を選び、protocol/client/operation/定義のrequest bytesを同transactionで固定する。既存wireはscope/定義/checksumを照合してその文字列を返し、key順などを新buildの形式へ再生成しない。4MiBのnative UTF8 wire guardを持ち、property/option/label数も制限する。queue読取はmax100＋lookahead/sequence keysetで、pending・未prepared・原ACKを区別し、読取で準備・送信・清算しない。

## ACKとcacheの原子確認

ACKはsequence/保存wire/operation/client/workspace/epoch/定義/version1/createdを照合する。queueの原ACKとSource cacheのhistory/currentを同transactionで保存する。Source cacheはreadとcreate ACKの元envelopeを区別し、create ACKが対応する保存済み操作・定義・wire/response proofへ一致することを読むたびに検査する。架空read responseへ変換しない。

同versionの同snapshotをread/ACKの両経路で観測でき、先に保存した元receiptを保つ。同version内容違い/creation position違いはACKも含めrollbackする。先行する新しいread versionは古いcreate ACKで戻さない。readが先に確認済みSourceを保存してもqueueは未ACKのまま残す。

ACK後のexact retryは元ACK・cache・原version1 historyを照合するだけで、欠損projection/historyや壊れたqueue proofを補修しない。statement failureではACK/confirmationをともにrollbackし、intent/wireを再試行できる形で残す。拒否/通信不明を削除やACKへ推論せず、HTTP未接続の今回はnative queueの契約だけを実装する。

## 移行と検証

bound contextの照合後、native0/5〜12から13へ移行し、既存Source/Record/View/delta/progress/Page/title/Task/Relation/旧queueを保持する。foreign binding/partial DDL/unknown schemaはrollbackし、通常PoC DBの帰属を変えない。Registry/Native adapterはstrict IPC/scope/型/件数を検査し、Auth refresh/closeで旧instanceを拒否する。

新native21条件＋旧126がPass。enqueue/prepare/ACKのCOMMIT前後で実SIGKILL6 trialsを行い、intent/wire/ACK/cacheがそれぞれ同じ境界で保持され、同operationの再試行で重複しないことを確認する。format互換と高位sequenceは明示SQL fixture seedを分け、その後のactual native prepare/ACK/restartを検証する。初回Rust syntax/driver compile Failを別logへ保持し、修正後build/native147・全回帰と区別する。

実HTTP/JWKSによるcreate送信は次工程である。実Supabase正常login/Windows actual invoke/MS IME/Android/native credential・offline grant/配備暗号化/native Gateと分離する。
