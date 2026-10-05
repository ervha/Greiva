# Supabase Authの検証用設定

2026-10-05。個人利用・自端末同期の認証検証用。Supabase Authを使用し、Greivaの本文保存や同期サーバーをSupabaseへ移したとはしない。

1. Supabase Dashboardで検証用projectを作成する。DB passwordは手元のcredential管理へ保存する。
2. AuthenticationのEmail providerを有効にする。最初はEmail/passwordで検証する。メール確認を使用する場合、確認メールの配送とURLも確認する。[Password Auth](https://supabase.com/docs/guides/auth/passwords)
3. JWT Signing Keysでcurrent keyのalgorithmを確認する。Greivaの検証adapterはES256/RS256を許可する。今回のprojectはES256。新規検証projectが旧HS256の場合は非対称keyへ移行・rotateする。既存利用者のいるprojectの旧keyをこの手順だけでrevokeしない。[Signing keys](https://supabase.com/docs/guides/auth/signing-keys)
4. AuthenticationのURL Configurationで開発用Site URLを`http://localhost:1420`にする。実装したcallback URLをRedirect URLsへ個別登録する。現在のGreivaには実ログインcallback UIがなく、URL設定だけでログインは完成しない。[Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
5. ConnectまたはSettings / API KeysでProject URLとPublishable keyを取得する。公開キーは`sb_publishable_`から始まる。secret/service_role、JWT secret、DB password、access/refresh tokenはチャットやgitへ保存しない。[API keys](https://supabase.com/docs/guides/getting-started/api-keys)

## 提供済みの公開設定

| 項目 | 値 |
| --- | --- |
| Project URL | `https://lfvipbtayyfhxtprenme.supabase.co` |
| issuer | `https://lfvipbtayyfhxtprenme.supabase.co/auth/v1` |
| audience | `authenticated` |
| JWKS | `https://lfvipbtayyfhxtprenme.supabase.co/auth/v1/.well-known/jwks.json` |
| 許可algorithm | `ES256` |

Publishable keyは利用者から受領済み。project固有のキーを汎用コードへ固定せず、git対象外の`.data/workspace-store/supabase-public-config.json`に検証設定を保持した。秘密鍵/token/passwordは受領していない。

Dockerから実HTTPSでJWKSと`/auth/v1/settings`を取得し、両方HTTP 200、ES256公開鍵、Email有効を確認した。設定取得は提供済みPublishable keyを使用した。これは公開設定への到達確認で、ユーザーの実ログイン・token更新・失効・端末間同期の合格ではない。

v0.17.0の[専用起動手順](PRIVATE_API_STARTUP.md)で明示設定から保護APIを起動できる。通常PoC main・ログインUI・新workspace本文/structured streamへは未接続。旧PoCの未認可経路をこのproject設定で公開しない。

次はログイン検証画面と端末credential保存、native workspace IPC、所属/失効を照合するserver同期経路を順に接続する。実ユーザーのpassword/tokenを開発者へ送る手順にはしない。

v0.15.0で`supabaseConfiguration`、`supabaseAuthSession`、`createSupabasePrivateApp`を追加した。project URL/algorithmと、client側のPublishable key/Greiva API originを明示的に渡す。通常PoC起動に自動適用するenv名・ログインUIはまだない。client tokenはメモリのみで、refreshとlocal logoutを実装し、署名検証後のidentityだけを公開する。正常login/refreshはprovider fixture＋実保護HTTP/PG/SQLiteで検証した。実Supabaseでは公開HTTPSと実JWKSによる不正署名拒否を確認し、実ユーザーの正常ログインは未確認。[全判断と制約](../decisions/supabase-auth-session.md)。

 v0.16.0でPrivateWorkspaceConnectionを追加。認証済AuthSessionと明示API origin/client IDからbootstrapし、同じbindingのworkspace storeへ同期sessionを作る。refresh後は新bootstrapが必要。serverの新同期streamはまだなく、HTTP404でpendingを保持する。通常PoC main/UIにはまだ自動接続しない。[全判断](../decisions/private-workspace-connection.md)。

v0.18.0で[browserログイン確認画面](PRIVATE_LOGIN_PREVIEW.md)を追加した。受領した公開設定をignored環境へ渡し、専用Compose previewの1421/auth.htmlを起動している。自分の検証用ユーザーのpasswordは画面だけへ入力する。developerへ送らない。provider/認証responseのbrowser自動試験はfixtureで、実ユーザー正常系/端末間同期は未確認。normal Tauri UI/OS credentialは未接続。
