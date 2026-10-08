# Structured sync本番契約候補

v0.38.0：[増分runtime](../development/PRIVATE_PAGE_CHANGES_RUNTIME.md)はcaptured Auth/scope/after/limitを検査し、一回最大100件の明示取得を行う。storage結果不明は新pullを止め同pairを再確認、post-commit read失敗はsaved cursorから再開する。観測head末尾はsyncedではない。画面接続は次工程。

v0.35.0：[title画面](../development/PRIVATE_PAGE_TITLE_SCREEN.md)で明示保存/送信・query/新operation解決を接続。unknown baseは本文Page作成の確認後にtitle queryし、known baseでは本文syncを暗黙実行しない。結果不明の同ID再確認、remote/local各100件の続頁、独立pending表示を提供し、syncedとは表示しない。

v0.34.0：[title専用session/runtime](../development/PRIVATE_PAGE_TITLE_RUNTIME.md)でcaptured Auth/scoped rename/readを接続。明示cycleは最大100送信＋query一頁100件、commit/local read後の進捗、同nonce再確認と世代取消を行う。query完了をsyncedと扱わず、本文/structured sessionと独立。title画面とmetadata deltaは後続。

v0.33.0：[title端末保存](../development/PRIVATE_PAGE_TITLE_DURABILITY.md)で最古pendingのimmutable wire/ACKと観測基底・投影を保存する。自分の成功receiptのみ未prepared子の基底を進め、古い本文metadataでmanaged titleを上書きしない。local title pendingと本文pendingを分離し、queryを同期済み証明にしない。専用transport/runtime/画面は後続。

v0.32.0：[private Pageタイトル](../development/PRIVATE_PAGE_METADATA.md)のrename/readを独立wire/routesで追加。既存Task/Relation streamとPage本文wireを維持し、title版・immutable再送・三値Conflict/新operation解決をserverで検証した。readはbounded keyset queryで、snapshot/delta/ACKではない。native title queue/replica/画面接続は後続。

v0.20.0で[private structured stream](../development/PRIVATE_STRUCTURED_SYNC.md)を実装。schema2の新Task/Relation ledger/history/Conflict、workspace別transaction counterと耐久署名鍵、strict push/pullが動作する。batchは全体原子的、ID異内容再使用は409/rollback、foreign対象/参照は403。通常177/実PG54/2つのRust SQLite/SIGKILLで確認。以下の「server streamなし」は過去checkpointの記録で、Page metadata/CRDT/通常UI・IPCと実Auth正常系は引き続き未完成。

v0.19.0では[同一transactionの認可境界](../development/PRIVATE_SYNC_TRANSACTIONS.md)を実装。owner/device/既存typed resourceをFOR SHAREでlockし、業務callbackのquery/期限/終了を管理する。新push/pullやmetadata作成validation/ledgerを実装した状態ではない。schema移行中の稼働/排他とworkspace stream順序を後続で定義する。

2026-10-05、設計案。[architecture](ARCHITECTURE.md)、[データ](DATA_MODEL.md)、[PoC検証](../decisions/gate-c.md)を基準にする。初期版は個人workspace/自分の端末間。新wireの独立型/境界を部分実装し、旧PoCのTask/Relation経路と本番案を分ける。

v0.9.0でprotocol/workspace subpathへprotocolVersion1/workspace/client/response streamEpoch、ACK/pull scope検査を追加し、server専用gw1 cursorを実装した。[証拠](../../tests/evidence/workspace-sync-boundary-20261005/SUMMARY.md)。新経路/queue/SQLへは未接続で、旧PoC wireを変えない。cursorはuser認証ではなく、owner認可を別に通す。

## 入出力と不変条件

v0.13.0で[portable WorkspaceSyncSession](../../tests/evidence/workspace-session-20261005/SUMMARY.md)を実装。生成時のissuer/subject/workspace/client/epochとtransport/store callbackを捕捉し、close→新instanceで古い応答を適用前に拒否する。prepared JSON文字列を変更せず送信し、ACK identity/pull進行を検査、同時要求を拒否する。receipt/pending・pull/cursorの原子的commitは注入storeの責務で、native adapterは未実装。開始済みの旧store commitはclose後に完了し得るが、新storeへ付け替えず、active成功も返さない。

commandはworkspace/対象/intentを受け、認可・domain validation後にentityとoperationを同一local transactionで保存する。IDはofflineで安定生成し、時刻を順序へ使わない。commit後のoperationを受信しただけで外部actionを再実行しない。

push envelopeにはprotocol version、workspace、client/device、operationId、entity type/ID、kind、payload、baseVersion/causal predecessorを持たせる案。serverはtoken主体とworkspace所属を検査し、client申告actorを信用しない。operation/resultはimmutable、同じIDで違う内容の再送を成功としない。

| 状態 | 保存/復旧の契約 |
| --- | --- |
| optimistic / saving | 画面は変更可、まだ保存保証なし。失敗を明示 |
| durable pending | entity/intentが端末commit済み。offline終了で保持 |
| prepared | 送信wireを耐久化。ACK喪失後も同じID/内容を再送 |
| acknowledged | result/receiptを耐久化し、pending解消を同じtransactionで確定 |
| rejected | 永続的拒否と元intentを保持。勝手に破棄・無限再送しない |
| conflict | base/local/remoteを保持。端末保存と解決済みは別 |

serverはaccepted/rejected/conflict結果をoperationの冪等キーで再取得可能にする。transport timeoutはcommit有無が不明なので新しいoperationIdで作り直さない。HTTP成功だけを端末ACK保存成功としない。

## pullとpending投影

cursorはworkspace/stream/epochに所属するopaque token。適用するentity/history/receipt/Conflictとcursorを同一transactionへ入れ、commit後にのみ進める。clientがheadCursorへ飛ばして未読operationを省略しない。

受信したserver基底へ未送信intentを投影し、同field競合は3値で保持、異fieldはmerge、削除はtombstone優先。Conflict解決は新operation。account/workspace切替や過去responseの遅着で他storeのcursorを更新しない。

起動/reconnectはrestore→session/認可→pull（全page）→pending push→再pull。WebSocketは再pullの契機で、通知欠落しても正確性を保つ。session失効・権限拒否は通信失敗と分け、認証の再確認まで送信を止める。offline読取の失効扱いは認可仕様へ残す。

## wire変更・migration

現PoCにはworkspace/protocol version/authがなく単一structured cursorを使う。本番案を現schemaへ足すだけでは旧operation/旧server resultの所属が確定しない。取り込みは明示的なmigration/import契約で行い、旧cursorを流用しない。unknown version/epoch、期限切れcursor、履歴compaction後のbootstrapはserver snapshotとpending再投影を含む別契約として確定する。

retry backoff/同時送信数/batch上限、cursor保持期間、offline端末の再bootstrap期限は運用契約で決める。PoC timeoutをそのまま製品SLOにしない。

新wireの初期境界上限は既存batch100/pull500を継続し、production性能SLOにしない。batch内のoperationId重複/client混在を拒否し、request間retryでは同じoperation ID/内容を使う。orderはPG bigint範囲のdecimal string。gw1はworkspace/structured/epoch/orderをHMAC-SHA256へ束縛し、head超過/別scope/悪署名/非canonical tokenを拒否する。live keyはCSPRNG32bytes以上とepochを耐久保存する必要があり、起動ごとに作り直さない。

## 受入

同ID/同wire duplicate、同ID/違うwire拒否、server commit後ACK loss、local ACK保存中kill、pull適用/cursor間kill、複数page、pending上へのremote、same-field Conflict解決、account切替中response、他workspace read/write/CRDT拒否を検査する。実DB transactionと実OS保存復旧の証拠を分ける。外部action成功の保証はこのsync ACKに含めない。

v0.18.0時点：native WorkspaceStore（v0.14.0）のprepared/ACK/pull durability、認証済PrivateWorkspaceConnection（v0.16.0）、browser確認画面を実装済み。上記v0.13.0段落のnative未実装は当時の状態。新server stream/CRDT・通常Tauri IPCへの接続はまだない。HTTP404でも保存済みpendingを維持し、画面のworkspace登録確認を同期済みへしない。次はowner/deviceを同じDB transactionで照合するserver同期を進める。
