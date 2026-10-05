# ログイン接続確認画面

v0.20.0更新：専用Compose API/previewはschema2/版0.20へ更新し、[保護structured同期](PRIVATE_STRUCTURED_SYNC.md)を提供する。auth.htmlの動作は登録確認までで、本文/Taskを自動同期しない。

v0.18.0。browserの`/auth.html`でEmail/passwordのログイン、Greivaの署名確認、個人workspace登録、明示refresh、local logoutを確認する。通常PoC画面と別entryで、本文同期や端末保存を提供する画面ではない。

## Dockerで開く

[保護API手順](PRIVATE_API_STARTUP.md)のproject URL/algorithmとschema初期化を済ませ、受領した公開キーをlocal環境変数`GREIVA_SUPABASE_PUBLISHABLE_KEY`へ設定する。`sb_publishable_`から始まるキーだけを使う。secret/service_role/user password/tokenは設定ファイルやチャットへ渡さない。

```powershell
docker compose -f infrastructure/private-api/compose.yaml build
docker compose -f infrastructure/private-api/compose.yaml --profile preview up -d preview
```

`http://127.0.0.1:1421/auth.html`を開く。preview container内の保護APIをloopback3002で起動し、Viteの固定`/v1` proxyを通す。hostへ公開するportはloopback1421だけ。通常PoCを同時に動かす場合も、そのAPI/DB/旧Pageへ接続しない。

Supabaseに**自分で用意した検証用ユーザー**を画面で入力する。入力するpasswordはdeveloperやチャットへ送らない。signup/メール確認/recovery/OAuth/CAPTCHAのUIは未実装なので、必要なprovider設定・ユーザー作成はDashboard等で別に行う。開発者は実ユーザーを自動作成しない。

1. ログインを確認：providerのresponseだけで成功とせず、Greivaの保護session確認後に認証済みを表示する。password欄は送信開始時に空にする。
2. workspace登録を確認：初回は個人workspaceと検証用端末IDを登録する。IDは画面のログインinstance内だけで保持し、native端末ID/SQLite bindingとして流用しない。
3. 認証を更新：旧接続contextを隠し、更新後にworkspace登録をもう一度確認する。自動更新/自動再送は行わない。
4. ログアウト：この画面のtokenを即破棄する。provider側の確認失敗は別表示する。access JWTの即時失効や他端末ログアウトとはしない。
5. 接続を閉じる/画面終了：待機中の応答でログインを復活させない。再読込みでは再ログインが必要。端末データを消去する操作は行わない。

PC/モバイル幅、dark、reduced motion、keyboardに対応する。期限切れは表示し、画面上の状態とserver側の検証を分ける。エラーにはprovider body/tokenを表示しない。実ユーザーでの正常ログイン/refresh/失効・端末間同期はまだ未確認。

## 配置設定

client設定は環境変数かgit対象外のroot `.env`から受ける。Viteが公開設定へ埋め込む値のため、password/token/秘密キーを置かない。明示projectとAPI originを検査し、credentialのあるURL/secret形式のキーをbundle前に拒否する。

| 項目 | 内容 |
| --- | --- |
| VITE_GREIVA_SUPABASE_URL | project HTTPS origin |
| VITE_GREIVA_SUPABASE_ALGORITHM | ES256 / RS256 |
| VITE_GREIVA_SUPABASE_PUBLISHABLE_KEY | 公開キーだけ |
| VITE_GREIVA_PRIVATE_API_ORIGIN | previewなら`http://127.0.0.1:1421` |
| GREIVA_PRIVATE_PROXY_TARGET | Vite serverだけ。preview内なら`http://127.0.0.1:3002` |

設定不足ではログインを無効にする。通常buildでもauth entryを作るが、rootの通常UIを変更せず、Tauriの既存CSPを拡張しない。nativeログイン/OS credential/再起動復元/IPCへの接続は後続。

`npm run test:auth-e2e`はDockerで実行する。provider/HTTPはfixtureの8 browser条件（PC/モバイル各4）で、実Supabaseや実MS IMEの証拠ではない。[証拠](../../tests/evidence/private-login-20261005/SUMMARY.md)、[全判断](../decisions/private-login-preview.md)、[残る外部条件](../plan/PENDING_PRODUCTION_CONFIGURATION.md)。
