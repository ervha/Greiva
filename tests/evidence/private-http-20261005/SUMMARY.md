# 個人workspaceの認証付きHTTP入口

2026-10-05、v0.11.0。独立の`createPrivateApp`を追加。旧PoC router/DBは変更しない。

通常108件Pass/実PG用23件skip、専用PG23件Pass/skipなし、型確認・frontend/API build・通常Windows cross-buildがPass。通常3件はverifier/read doubleのHTTP検査。追加PG1件は実loopback HTTP、EC署名JWT、実PostgreSQLのowner/resource snapshotで401/403/503、削除、query主体偽装、複数Bearer、旧alias拒否を検査する。JWKS fetchだけfixtureであり、実Supabase/login/refreshではない。

通常Windows buildはhostと83 source hashを照合し、test flags/crash hooksを含めない。生成物はローカルignored領域に保存し、exe/DB/tokenはcommitしない。外部npm315/Cargoは変更なし。selected JSONはcompact JWT/private-keyの混入を検査してgzip保存。

[検証集約](verification.json)、[unit](vitest.json.gz)、[実PG](postgres-vitest.json.gz)、[source](source-inventory.json)、[build](windows-build.json)、[版/lock](version-audit.json)。生の各logも保持する。初回typecheckのtype-only importとHTTP試験のlisten戻り値の誤用を修正して最終checksを実行した。

提供するのはsession/owner accessの独立HTTP経路だけ。本文/一覧/write/sync/CRDT、正本view/migration/bootstrap、live provider/失効、前面UIとの接続/公開運用は未完成。新しい実IME/Android/画面検証ではない。[全12判断](../../../docs/decisions/private-http-boundary.md)。
