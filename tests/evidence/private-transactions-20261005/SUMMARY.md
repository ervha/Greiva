# 個人workspace transactionの検証

2026-10-05 / v0.19.0。Dockerで4 unit＋11実PostgreSQL試験を追加。通常175 Pass/41 PG Skip、専用PG41 Pass/0 Skip、型/frontend/通常Windows cross-build Pass。所有source101をbuild前後でSHA256照合、外部npm315と両Cargo依存不変。

- owner/issuer/device/typed resourceの隔離、欠落/重複/malformed/unknown schema拒否。
- workspace削除/device失効/resource削除の各2順序を実DBで競合させ、pg_blocking_pidsで待機を確認。認可済commit後は次の要求を拒否、先に確定した失効は業務callbackなし。
- callback失敗、握り潰されたSQL失敗、未完了queryのrollback、返却後query拒否。
- lock中/commit前期限切れとcallerのidentity/target変化、bootstrap期限切れの新device rollback。
- 署名fixture JWT＋実HTTPでdevice/accessの401/403/400/200/503、旧sync route404。
- pool待機期限/rollback失敗cleanup/COMMIT応答不明の固定errorと自動再試行なし。

[verification.json](verification.json)、[通常report](vitest.json.gz)、[実PG report](postgres-vitest.json.gz)、[版監査](version-audit.json)、[source](source-inventory.json)、[Windows build](windows-build.json)、[全15判断](../../../docs/decisions/private-sync-transactions.md)。新しいUI/実MS IME/Android/実ユーザーSupabaseの合格ではない。v0.18の画面証拠は変更しない。新server stream/schema migration/CRDTは未完成、telemetryは未実装/未収集。
