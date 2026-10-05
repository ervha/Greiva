# 個人workspaceの同期transactionに関する全判断

2026-10-05、v0.19.0。利用者の継続指示に基づく自主判断。新server streamの前に、実DBの認可/保存境界を実装する。

1. 旧PoC repositoryを保護APIへmountせず、新規private schemaに限定する。既存version1を読み、DDL/自動移行/元データ変更をしない。
2. verified issuer＋subjectだけをownerとして捕捉し、workspace/client/typed targetsもpool待機前にコピーする。request actorやroleをowner根拠にしない。
3. workspace、device、type/id順のresourceを同一READ COMMITTED transaction内で照合/lockする。schema版不明、所属違い、deleted/revoked、行欠落では業務callbackを実行しない。
4. FOR SHAREを使う。FOR KEY SHAREでは非key列deleted/revokedの更新を止められないためである。根拠はPostgreSQLの公式lock表で、実PGの待機を試験する。
5. 先に認可された処理はcommitまでlockを保持する。後からの失効/削除は待機し、その後の要求を拒否する。進行中の保存を途中取消する仕様とはしない。
6. 失効/削除が先にcommitした場合、待機後の行を再確認して拒否する。DB待機を任意sleepではなくpg_blocking_pidsで観測し、3種類の両順序を試験する。
7. 内部業務callbackへraw PoolClientを渡さず、active期間のquery portとfreezeしたcontextを渡す。返却後のqueryを拒否し、poolへ戻った接続を再利用させない。
8. queryはtrusted server SQL専用である。HTTP入力SQLを受けず、workspace絞込みを業務実装の責務に残す。transaction control/認可metadataの変更はcallback禁止、SQL sandboxや全同期完成を主張しない。
9. queryの引数はprimitiveを捕捉し、mutable object/toPostgres hooksを受けない。unfinished queryや握り潰された失敗も外側でrollbackし、忘れたawaitをcommit成功にしない。
10. 認証期限をpool待機後、lock後、query前後、commit前に確認する。query進行中の期限切れやcallback後の期限切れはrollbackする。COMMIT送信後に期限が過ぎることを取消保証とはしない。
11. 同じ問題をbootstrapにも補強する。初期確認のexpiresAtを捕捉し、待機後/commit前にも確認、期限切れは401分類のままrollbackする。実PGで新device行が残らないことを確認する。
12. query/commit内部causeをHTTPへ出さない。COMMIT応答不明はoutcome unknownで、業務処理を自動再実行しない。後続ledgerの安定operation IDで結果を照合する。
13. 新GET device/access入口だけを明示factory/runtimeへ接続する。返却はprotocol/workspace/client/epochで、tokenや認可leaseを返さない。通常のworkspace/accessは従来の読取確認であり、新同期の書込認可へ流用しない。
14. 4 unit/11実PG、通常175/実PG41/型/frontend/通常Windows buildを確認する。fixture JWTと実HTTP/PGは実Supabase正常loginやnative IMEの証拠ではない。UI変更がないためv0.18の画面回帰は既存証拠として保持する。
15. 所有版/両Rust lockを0.19.0へ揃え、外部依存不変/source101を照合し、同じbranchへtag/pushする。実Auth/native credential/IPC、新stream/schema migration/CRDT、公開運用/telemetryは別工程。schema migration中の稼働契約も後続設計で明示する。

[実装境界](../development/PRIVATE_SYNC_TRANSACTIONS.md)、[証拠](../../tests/evidence/private-transactions-20261005/SUMMARY.md)。公式資料: [PostgreSQL row locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)。実ユーザー操作待ちの事項は[まとめ](../plan/PENDING_PRODUCTION_CONFIGURATION.md)へ保持し、独立するserver ledgerを先行する。
