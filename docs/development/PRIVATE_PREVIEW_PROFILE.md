# 個人workspace Windows候補のbuild profile

v0.74.0 / P4の検証準備。既存PoCの既定起動を変更せず、同梱workspace.htmlから個人workspace接続プレビューを開く専用候補をDockerで生成する。[Tauri設定](https://v2.tauri.app/reference/config/)・[CSP](https://v2.tauri.app/security/csp/)と、既存のWindows診断buildのTAURI_CONFIG override方式を使う。installer/署名・本番公開・Native Auth完成を意味しない。

## 入力と保存先

`scripts/build-private-preview.mjs`はDocker内・repo root・Node24で実行する。Vite productionと同じpublic設定の読込順（.env/production/環境変数）を使い、project URL、ES256/RS256、publishable key、専用API originの4項目を必須検査する。keyはsb_publishableのみ。credential/query/pathを含むorigin、非HTTPS provider、非loopbackのHTTP APIを拒否する。検査失敗では出力を作らずcompilerも呼ばない。設定値をerrorに含めない。

専用identifierはdev.greiva.private.preview、productはGreiva Private Preview、main windowはworkspace.html。Native rootは既存Rustのapp_config_dirに基づくため、識別子で旧dev.greiva.pocの通常保存先を分ける。移行や旧DB importは行わない。デバッグ時のGREIVA_TEST_DATA_DIR overrideは別の検証機構であり、通常起動で設定しない。未ログインのデータ閲覧・credential永続化/offline grantはこのprofileで追加しない。

CSPの接続はself/IPCと検査済みprovider/API originのみを許可し、wildcard/旧PoC HTTP/WSを追加しない。外部script/objectを許可しない。既存capabilityのmain windowを維持する。test hooks/SQLite bridgeはbuild時に必ず0。fixture HTMLを配布assetsへ含めない。既定tauri.conf.jsonとRustの保存/認証処理をその場で編集するbuilderではない。

## 出力と照合

出力はworkspace .data配下の新しいdirectoryだけに限定し、既存directoryを上書きしない。最寄りの既存親directoryの実pathも照合し、symlinkでworkspace外へ抜ける出力を拒否する。public keyを含まないtauri override、step logs/status、候補exe、設定検査CLI、version/target/features/origin・hashと未検証境界のartifact.jsonを保存する。Windows/cross-buildは既存Docker toolchain/targetを使い、hostへglobal toolchainを追加しない。

設定検査CLIはtauri::generate_context!に組み込まれたidentifier/product/version/window URL/CSP/bundleActiveだけを返す。GUI/event loopやapplication DBを開かない。候補と同一build invocationの設定を検査し、host側でPE version・SHAと期待したoverrideを照合する。CLI起動をWebView起動、実invoke、実IMEの証拠へ読み替えない。

公開設定が未配置の検証では、明示したfixture provider/public keyとloopback APIで構成のbuild/照合だけを行う。この成果物から実Supabaseへの正常loginができるとは案内しない。実接続用候補は配備先の公開設定で新directoryへ再buildする。公開設定と署名/秘密鍵・個人認証情報を混ぜない。

[証拠](../../tests/evidence/private-preview-profile-20261012/SUMMARY.md)。次は同じ公開設定の専用API/実Supabase正常系、Windows WebView/実invoke・MS IME、Android native/lifecycle、Native Auth custody/offline grant、署名/backup/restore/配布を順に受入する。既存P3と保存層の証拠は保持する。
## Dockerでの再現

公開設定を配置した後、repo rootで `npm run build:private-preview -- .data/private-preview/0.74.0` を実行する。既存出力を消して再利用するのではなく、別の新directoryを指定する。通常PoC候補と混ぜず、artifact.jsonと2つのexeのhashを保持する。

isolated CSP検証では、fixtureの明示public設定でAPI originをhttp://127.0.0.1:1439に指定してbuildし、`GREIVA_PRIVATE_PREVIEW_CONFIG=<output>/tauri-override.json npx playwright test -c playwright.private-preview.config.ts` をDockerで実行する。built frontend hashを確認した上で、実ブラウザーの指定APIへの通信と指定外originの送信前拒否を検査する。loopback fixtureの検証で配備先のCORS/TLS/実Authが通るとはしない。