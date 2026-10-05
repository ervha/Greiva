# 保護された同期transactionの境界

v0.20.0更新：schema1/2の版行も最初にFOR SHAREでlockする。schema upgradeは同じ行をFOR UPDATEでlockして待機する。resource作成/tombstoneは[新scoped repository](PRIVATE_STRUCTURED_SYNC.md)内でのみ行い、任意callbackからworkspace/device/schema認可を変更しない。以下v0.19は境界の初期説明。

v0.19.0。PostgresPrivateTransactions.runは、署名検証済みsessionとworkspace/client ID、既存typed resource参照を受けるtrusted server portである。新しいstructured push/pullは未実装。

同一transactionでversion1、owner issuer/subject、登録deviceの所属/失効、resourceのtype/id/所属/tombstoneを確認する。workspace→device→sorted resourcesのFOR SHARE lockをcommit/rollbackまで保持する。resourceなしはworkspace/device単位の処理用で、resource作成を許可する全業務validationではない。現時点の参照上限100は内部境界で、将来のsync SLOではない。

callbackのqueryはworkspaceに絞る業務SQL専用である。HTTP/bodyからSQLを組み立てない。transaction controlや認可metadata更新、外部通信/長時間待機をcallbackへ置かない。query portの権限自体はSQL sandboxではない。後続のmetadata作成/削除やstream更新は固有のlock/型/所属検証が必要。

query/commit前の期限チェック、active port、inflight/fault追跡により、期限切れ/返却後のquery/握り潰されたSQL失敗/未完了queryでは成功commitにしない。rollbackに失敗した接続は破棄する。COMMITの応答喪失は結果不明で、自動retryしない。業務callbackにも生の接続を公開しない。

GET /v1/workspaces/:workspaceId/devices/:clientId/accessはJWTを検証し、この境界を通した登録確認を返す。200はprotocolVersion/workspaceId/clientId/epochだけ。認証不備401、owner/失効/所属不備403、ID不備400、DB/版不備503。返却contextは後続要求の認可を保証しない。既存workspace/accessも書込みleaseではない。

新schemaのインストールや旧DBの移行は行わない。実運用でschema変更を行う間の排他/maintenanceと新stream ledgerは後続工程である。原子性/失効の試験はDockerの専用isolated schemaで行い、元のPage/DBを変えない。

[全判断](../decisions/private-sync-transactions.md)、[検証結果](../../tests/evidence/private-transactions-20261005/SUMMARY.md)。実Auth/native認証の必要事項は[保留表](../plan/PENDING_PRODUCTION_CONFIGURATION.md)。
