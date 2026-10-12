# 個人APIのWindows接続準備（v0.75.0）

既存の個人APIへ明示CORS設定と基本DBの段階的初期化CLIを追加する。通常起動はschemaを検査し、DDLや自動補修を行わない。

## CORS

`GREIVA_PRIVATE_CLIENT_ORIGINS` は最大8件の重複しないcanonical OriginをJSON配列で指定する。未設定/空配列では従来どおりCORS hookを追加しない。HTTPS、loopback HTTP、Windows専用 `http://tauri.localhost` を許可する。wildcard、opaque null、path/query/userinfo、非loopback HTTPは拒否する。

明示設定時は `/v1/` の承認Originだけを受け付ける。GET/POSTとauthorization/content-typeだけをpreflightで許可し、OPTIONSはAuth/DBへ進めない。実リクエストは既存JWT、owner/device、transactionの認可をそのまま通る。Originは利用者識別ではなくブラウザー読取許可であり、Allow-Credentialsは付与しない。Originなしの既存クライアントは従来の認証へ進む。設定は起動時に捕捉し、呼出側の配列変更を反映しない。

Windows専用profileは `useHttpsScheme:false` を明示し、builder metadataにfrontendOriginを記録する。実接続用v0.75.0 profileの生成・GUI起動は未実施。

## 明示schema CLI

Dockerでserver build後、`node apps/api/dist/init-private.js` を次の順で一段ずつ実行する。DATABASE_URLとGREIVA_PRIVATE_SCHEMAは非公開の環境設定として渡し、値をログや証拠へ残さない。

| 実行引数 | 到達schema |
| --- | --- |
| 引数なし | 1 |
| --structured | 2 |
| --pages | 3 |
| --page-metadata | 4 |
| --page-changes | 5 |
| --database-sources | 6 |
| --database-records | 7 |
| --database-record-catalog | 8 |
| --database-views | 9 |
| --database-view-catalog | 10 |
| --database-changes | 11 |

別schemaを明示し、既存schemaを置換しない。順序違反/同段階再実行は固定失敗としてrollbackし、到達版と既存tableを保持する。新CLIの全11段階と失敗経路は実PostgreSQLで確認した。

## 公開provider確認と停止状態

回収したSupabase公開設定により、実JWKSの200/ES256一致、sessionなし401、無効署名401を確認した。専用開発schema `greiva_private_native_preview_20261012_v75` を11へ初期化し、host loopback1443を経由した承認Originの401/preflight204、未承認Origin403を確認した。無効署名でworkspaceは作成されなかった。公開key、DSN、JWT、メールや本文は証拠に含めない。これは実アカウントでの正常ログイン検証ではない。

利用者の停止指示に合わせ、今回用APIプロセスと `greiva-native-preview-forwarder` を停止した。schema/volumeと既存サービスは保持する。実接続用Windows追加ビルドは停止指示後の範囲外として自動承認審査が拒否したため実行していない。既存v0.74.0のfixture候補と、今回の通常PoC v0.75.0成果物を実接続用候補と混同しない。

## 再開順

1. 最新ソースと設定の状態を確認し、Dockerの専用APIを明示schema11・実公開provider・承認Originで起動する。loopbackの転送先/port衝突を確認する。既存schemaへ初期化CLIを再実行しない。
2. 新規出力先へ [専用profile builder](PRIVATE_PREVIEW_PROFILE.md) で実公開設定のWindows候補を生成し、metadata/CSP/compiled config/PE/hashを検査する。ignored設定ファイルから必要な公開値だけを読み取り、keyや非公開設定を出力しない。
3. Windows hostで実アカウントの正常認証、個人workspace、native保存・再起動、認証情報保管/期限/offline grantを確認する。必要な認証入力は非公開経路で受け取り、記録しない。
4. 実Microsoft IME、Android実機/lifecycle、配備時のDB/backup暗号化・復元、署名/配布と最終Gateを別証拠で確認する。

Docker E2EやWindows実行ファイルの静的検査を、Windows GUI/IME・実Auth・最終GateのPassとして扱わない。[証拠](../../tests/evidence/private-api-native-startup-20261012/SUMMARY.md) と [停止まとめ](../plan/CHECKPOINT_20261012.md) を参照。
