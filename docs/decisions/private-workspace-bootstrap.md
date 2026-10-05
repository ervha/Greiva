# 個人workspaceの正本metadata・bootstrapの全判断

2026-10-05、v0.12.0。個人利用/自端末同期先行とlocal試験先行の回答に基づく自主判断。

1. 新規の明示namespaceだけにschema1をtransactionで作る。既存namespaceへ再install/修復しない。旧PoC取り込みの帰属を推定しない。
2. 正本はprivate_workspaces/private_devices/private_resources、read viewはその所有/所属/tombstoneを直接参照する。resource表は識別/所属の正本で、Task本文やYjs binaryの実装ではない。
3. 初期はissuer＋subjectごとに1つのprivate workspace。初回登録でserver採番し、owner uniqueにより再試行/並行要求で同じworkspace/epochへ戻る。追加workspace作成は未提供。
4. client/device IDは端末が安定生成するUUID v7の登録参照で、物理端末の証明/認証秘密ではない。別accountへ同じIDを付け替えない。
5. bodyはclientIdだけのstrict schema。主体はverified sessionから取得する。role/subject/workspace/epochの自己申告を受け付けない。
6. body/issuer/subject/expiryを接続待ち前に検証・捕捉し、caller変更を取り込まない。不正入力/期限切れはDB接続前に拒否。
7. schema version検査・workspace unique挿入/row lock・device登録/row lockを明示READ COMMITTEDの同一transactionへ置く。別statementで並行winnerを読み、削除/失効と順序を付ける。
8. 端末IDの他所有者利用、workspace tombstone、device revokedは403。失敗は新workspace/deviceを含めrollbackし、削除/失効をbootstrapで復活させない。
9. COMMIT応答喪失も結果不明503とし、SQL/credential/causeを返さない。同じ認証account＋clientIdで再試行する。成功はCOMMIT応答後だけ。
10. bootstrap portを明示注入したfactoryだけPOST v1/workspaces/bootstrapを提供する。未注入は従来どおり404。既定identity/自動migration/listen/cloud作成を追加しない。
11. fixture read tablesとは別に実installer/正本viewで受入する。実PG3条件は並行6要求、冪等/他端末/issuer隔離/rollback/失効/削除/unknown版/実署名HTTPを検査。JWKS transportだけfixture、実login/失効運用の証拠ではない。
12. 本checkpointはmetadata/bootstrapだけ。RLS/role/本番deployment、device失効の全経路適用、structured本文/CRDT/native保存・queue/ACK・logout保持は未完成。外部契約なしでできるworkspace/account切替の遅着応答guardへ次に進む。改善データ収集は追加しない。

[受入証拠](../../tests/evidence/private-bootstrap-20261005/SUMMARY.md)。unique conflict/row lockの検討に[PostgreSQL INSERT](https://www.postgresql.org/docs/18/sql-insert.html)、[locking](https://www.postgresql.org/docs/18/explicit-locking.html)を参照。初期1workspaceは現在の提供方針からの設計判断で、共有/複数workspaceの将来設計を削除しない。
