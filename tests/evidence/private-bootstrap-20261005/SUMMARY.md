# Private workspace正本metadata・初期登録

2026-10-05、v0.12.0。fresh namespace installerとserver bootstrap store、明示port注入時だけのHTTP登録を追加。

通常111件Pass/専用PG26件skip、専用PG26件Pass、型・frontend/API build・通常Windows cross-buildがPass。追加の通常3件はstrict入力/DB接続前拒否、非同期前の捕捉とCOMMIT結果不明、安全HTTP応答の検査。PG3件は実installer/正本tables/views、再installとunknown版、並行6要求/再送/同account別端末/別issuer、ID衝突rollback、resource tombstone/device revoked/workspace deleted、署名JWT＋実HTTPの登録/拒否を検査する。

正本resource表は所属/削除のmetadataで、Task/Relation payloadやPage本文の保存機能ではない。初期ownerごと1workspaceとepochが安定し、COMMIT応答喪失時も同account/clientIdで再試行する。旧PoC DB取り込み・RLS・cloud/login/refresh・device失効の全router適用・native workspace queueは未完成。JWKS transportはfixtureで、新しい実IME/画面/Android試験ではない。

[集約](verification.json)、[通常report](vitest.json.gz)、[実PGreport](postgres-vitest.json.gz)、[source85](source-inventory.json)、[通常build](windows-build.json)、[lock監査](version-audit.json)。外部npm315/Cargo不変、秘密を含むtoken/private keyは選択reportに含めない。exe/DBはignored領域のみ。[全12判断](../../../docs/decisions/private-workspace-bootstrap.md)。
