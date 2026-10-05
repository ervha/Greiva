# 保護APIの明示起動

2026-10-05、v0.17.0。配置検査・read-only schema readiness・専用main/初期化コマンド・独立Docker構成を実装。

通常3条件と実PG3条件を追加。通常161件Pass/PG用30件skip、専用PG30件Pass、型/通常Windows buildがPass。実署名JWT/session/bootstrap、旧routes404、schema未作成/未知版/欠落view拒否、初期化再実行で既存schema保持、secretのないCLI出力、実プロセスSIGTERMのlistener/pool終了を検証した。fixture公開鍵を使用する。

独立Dockerfileをfresh buildし、新local PostgreSQL専用volumeへ明示的なschema作成後、提供済みSupabase project URL/ES256でAPIを起動した。host portは127.0.0.1:3001、認証なし401/旧経路404。既存PoC DB/volumeは変更していない。これは実ユーザーloginや同期の合格ではない。次の画面開発に使うためlocal API/volumeは保持した。

[全14判断](../../../docs/decisions/private-api-startup.md)、[集約](verification.json)、[通常](vitest.json.gz)、[実PG](postgres-vitest.json.gz)、[Docker build](docker-build.log)、[Compose](compose-check.json)、[source96](source-inventory.json)、[Windows](windows-build.json)、[版/依存](version-audit.json)。外部npm315/両Cargo lock不変、両owner0.17.0。build前後source hash一致、通常buildにcrash hooksなし。raw JSONのJWT/private key/Publishable key混入検査、exeはignored領域のみ。

未完成：login UI/OS credential/Tauri workspace IPC、server同期stream/CRDT、実ユーザー認証、公開TLS/CORS/運用/配布、Windows/Android新native受入。readinessは必要columns/versionを検査するが全制約/権限監査の証拠ではない。UI変更がないため画面59/実同期2は[v0.14証拠](../workspace-store-20261005/SUMMARY.md)を保持。改善送信は未実装/未収集。
