# v0.75.0 個人API接続準備の検証

2026-10-12。今回の実装と既存の進行中検証を区切りまで完了し、利用者指示で停止した。

- focused CORS/runtime/profile: 9 Pass。実runtime PostgreSQL: 7 Pass。
- 通常回帰: 781 Pass / 225 PG skip。別実PG回帰: 35 files / 225 Pass。
- Docker workspace画面: 98 Pass / 0 unexpected / 0 flaky。画面証拠と圧縮reportを保存。
- typecheck、server/frontend build（test hooks/SQLite bridge 0）、native/crash examples、native feature検査、通常Windows custom-protocol build: Pass。
- 通常Windows v0.75.0はhostのPE version/SHAを照合した。GUI/IMEは起動していない。専用実接続候補の生成証拠ではない。
- host/Dockerソース378件: raw一致368、CRLF/LFのみ10、対象外5をsource-inventory/verificationへ明示。binary/BOMは正規化しない。owned versionと依存不変性はversion-auditに保存。
- 実公開providerのJWKS200/ES256一致、sessionなし401、無効署名401を確認。専用schema11、loopback1443経由native Origin401/204、未知Origin403を確認。実アカウントの正常ログインは未実施。無効署名によるworkspace作成は0。
- 今回用API/forwarderを停止し、schema/volumeと既存サービスを保持（checkpoint-stop.json）。追加の実設定Windows buildは自動承認審査により停止指示後の範囲外として拒否され、実行していない。

`normal.json.gz`、`postgres.json.gz`、`workspace-ui.json.gz`、`focused.json.gz`、`runtime-pg.json.gz` は元結果の圧縮保存。live*.json/public-live.jsonはselected metadataのみで、token/key/DSNは保存しない。過去v0.72–74の初回失敗・復旧証拠は各版に保持する。

Windows GUI/実Microsoft IME、実Auth正常系/credential custody/offline grant、Android実機、配備暗号化/backup復元、署名/installer、最終Gateは別途未確認。[契約/再開手順](../../../docs/development/PRIVATE_API_NATIVE_STARTUP.md)。
