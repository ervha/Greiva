# 個人workspaceの独立HTTP入口・全判断

2026-10-05、v0.11.0。P1のlocal認証/認可検証を継続する自主判断。実Auth環境は未作成のまま。

1. 現PoCのmain/routerを一括変更せず独立Nest/Fastify factoryにする。旧無認可経路を新入口へmountしない。
2. 注入するSessionVerifier/PrivateWorkspaceAccessStoreを必須とし、既定user・fixture identity・自動listenを実装しない。
3. v1/session、workspace/access、workspace/pages/page/accessだけを公開する。本文/一覧/write/sync/CRDT/bootstrapは未提供。
4. session→共通owner/read adapterの順を保持し、queryのsubject/workspace/roleを認可へ使わない。
5. ownerはissuer＋subject、workspace/resourceの所属・削除をserver metadataで照合する。
6. 未認証/不正session401、所属拒否403、検証不通503、metadata不通503を区別する。
7. 例外cause、SQL、token、request内容をresponseへ返さず、HTTP例外も固定の安全codeにする。
8. Nest/Fastify標準request loggerを無効にし、認証headerやURLを診断ログへ出さない。運用用の安全ログ/監視は未実装。
9. CORSを自動許可せず、前面UI接続やpublic listenを今回のfactoryから行わない。
10. 通常3 HTTP試験はverifier doubleによるroute/response検査として、実署名の証拠と分ける。
11. 専用PG試験は実loopback HTTP＋実EC署名＋実SQLで所有境界を検証する。HTTPS JWKS transportだけfixtureとし、Supabase login成功と扱わない。
12. 新規UUID namespaceだけを所有・cleanupし、旧Page/DBを変更しない。native/画面の新しい証拠は主張せず、型/通常試験/実PG/通常Windows buildで保存する。次はfixture metadataを置き換える正本schema/bootstrapを独立して実装する。

受入・制約は[試験記録](../../tests/evidence/private-http-20261005/SUMMARY.md)。規約/任意改善設計の追加は[別の全12判断](privacy-telemetry-plan.md)に記録済みで、今回収集/送信は追加しない。
