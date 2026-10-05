# 保護APIの開発用起動

v0.17.0。通常PoCと別コマンド・別schemaで起動する。日本向け個人版P1の接続検証用で、公開配布用の設定ではない。

Docker内の`@greiva/api`には`dev:private`/`start:private`/`init:private`を用意した。前二者は既存schemaのread-only readiness検査後に起動する。初期化・旧DB移行・自動修復は行わない。`init:private`は明示的にfresh schemaを作る専用コマンドで、既存schemaなら失敗し、そのまま保持する。

| 設定 | 必須/既定 | 内容 |
| --- | --- | --- |
| GREIVA_SUPABASE_URL | 必須 | HTTPSのproject origin。issuer/JWKSを導出 |
| GREIVA_SUPABASE_ALGORITHM | 必須 | ES256かRS256 |
| DATABASE_URL | 必須 | PostgreSQL接続先。秘密を含み得るためgit/log/chatへ出さない |
| GREIVA_PRIVATE_SCHEMA | 必須 | `greiva_private_`＋英小文字/数字/underscoreのfresh namespace |
| GREIVA_PRIVATE_HOST | 127.0.0.1 | Docker内で明示的に0.0.0.0を使う場合、host側portはloopbackへ制限 |
| GREIVA_PRIVATE_PORT | 3001 | 1〜65535の整数 |

serverにPublishable key、user password、access/refresh token、service_role keyは設定しない。clientの公開キーとは別の設定である。

## 独立Docker構成

PowerShellの例。既存PoCのvolumeやDBに接続しない。検証用DB passwordはこのlocal構成だけの固定値で、本番へ流用しない。

```powershell
$env:GREIVA_SUPABASE_URL = 'https://lfvipbtayyfhxtprenme.supabase.co'
$env:GREIVA_SUPABASE_ALGORITHM = 'ES256'
docker compose -f infrastructure/private-api/compose.yaml build
docker compose -f infrastructure/private-api/compose.yaml up -d --wait postgres
docker compose -f infrastructure/private-api/compose.yaml --profile setup run --rm schema
docker compose -f infrastructure/private-api/compose.yaml up -d api
```

schemaコマンドは初回だけ。再起動は`up -d api`で、再初期化しない。終了は同構成の`down`を使い、volumeを削除する`-v`は付けない。hostの`http://127.0.0.1:3001/v1/session`は認証なしで401となる。401は未認証という応答で、正常なユーザーログインの証拠ではない。

起動ログはservice/event/listening addressか固定した失敗stageだけ。設定不足・schema不通/未対応・listen失敗ではpool/listenerを片付けて非0終了する。SIGINT/SIGTERMではlistenerとpoolを閉じる。署名JWT/session/access/bootstrapだけを提供し、旧PoC routes・新同期stream・CRDTはmountしない。clientによるworkspace登録は認証後の明示操作である。

[Supabase公開設定](SUPABASE_SETUP.md)、[実装状況](../plan/IMPLEMENTATION_PLAN.md)、[判断](../decisions/private-api-startup.md)、[証拠](../../tests/evidence/private-runtime-20261005/SUMMARY.md)。browserログインUIとnative credential接続は後続。CORS/公開TLS/proxy/credential/監視・backupはこのlocal起動だけでは完成しない。
