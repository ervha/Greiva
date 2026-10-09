# Record作成・更新・競合解決の送信session

2026-10-09 / v0.63.0。[作成queue](PRIVATE_DATABASE_RECORD_CREATE_QUEUE.md)、[更新・解決queue](PRIVATE_DATABASE_RECORD_UPDATE_QUEUE.md)の元wireを実HTTPへ接続する。[判断16件](../decisions/private-database-record-write.md)、[証拠](../../tests/evidence/private-database-record-write-20261009/SUMMARY.md)。native15/server11保持。画面用runtime、View queue、6型Table/List操作画面は後続。

## 明示送信と元capture

DatabaseRecordWriteSyncSessionはworkspace単位でcreate/updateの種類を明示し、最古未ACK1操作を処理する。空queueはnull、作成のSource/Page依存待ちはblockedを返し、capture読込み/HTTP/ACKを行わない。blockedに架空wireやversionを与えない。自動無制限drain、順序変更、元intentの再baseはしない。

prepareした正確sequenceの直前から、limit1/pendingOnly=falseのkeysetで元queue captureを取得する。元context/operation/sequence/wire/Source定義/typed intent、更新の実base/元候補を照合する。別操作やconfirmed currentを元captureの代わりに使わない。操作確認のlookahead/byte windowはnative queueの既存契約を使う。

元wireはUTF8 8MiBを検査し、format/空白/value key順を再生成せず送る。既存queue schemaのintent比較もキー順ではなく意味を照合する。Source metadataや後続remoteが元操作を変えない。元captureを参照して応答の6型/scope/version/applied field/元三値候補を検査する。未設定/null/zero/false、unchanged localとnew remoteを区別する。

## AuthとHTTP・結果不明

PrivateWorkspaceConnectionは開設時のcontext/issuer/subject/client/epoch/Auth leaseとprepare/queue/ACKの元portsを固定する。validated Source IDを元wireと照合し、固定POST /v1/workspaces/{workspace}/databases/{source}/records/writeへ送る。queryや入力値からorigin/ownerを選ばない。NativeWorkspaceStoreは開設時にcreate/updateのprepare/queue/ACK methodsをbindし、同store/contextからsessionを追跡する。

HTTP結果不明では原ACK pairを捏造せず、durable operationと元wireを次sendで再prepare/照合して再送する。serverの同operation idempotencyで確認する。不正replyはprotocol failureで、ACKを保存せず、local ACK retryを捏造しない。

local ACK結果不明ではkind/prepared/原replyをimmutable pairで保持する。retryは元pairだけを同native ACKへ再保存し、prepare/capture読込み/HTTPを行わない。この間は両kindの新送信をbusyとする。ACKが既にCOMMIT済みでも同操作exact replayで確認する。rejectedは既知の原ACKであり、編集値の適用成功とは区別する。

replacement/refresh/session close/native store close、401/403による接続閉鎖は旧sessionを永久に閉じ、保持pairを破棄する。遅着HTTP/ACK結果で次世代を更新しない。durable queueは保持し、新しいbootstrap/sessionから元wireを再送できる。port errorsのprivate body/token/path/causeを返さない。

## 証拠と残範囲

portable17条件と、署名JWT/JWKS fixtureから実HTTP→full PG schema11→Rust Registry/SQLite native15の6条件を検証する。Source/Pageは既存の正規sessionで確認する。peer editは同じ実Postgres Record writerを使用する。Source/Page待ち、create/updateのHTTP/ACK loss＋restart、部分merge/三値候補/local・remote no-change解決、stale解決の原rejected、replacement/refresh/native close、device403と再bootstrapを含む。

初回portable2 Failは、呼出元contextとfixtureのdurable queue contextが同じobjectを参照し、immutable capture試験が両方を変えていたため。fixtureの保存済みcontextだけをcloneし、実装のcontext照合は保持した。初回15 Pass/2 Failと修正後17 Passを別reportに残す。

actual Supabase正常login、Windows actual invoke/MS IME、Android、native credentials/offline grant、配備暗号化やnative Gateの証明ではない。画面用runtime/未送信一覧・busy/draft/error/retry状態、View queue、6型Table/List画面、同Record offline successor/durable新draftは後続。
