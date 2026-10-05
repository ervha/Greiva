# 個人workspace structured streamの検証

2026-10-05 / v0.20.0。追加2 unit＋実PG13、通常177 Pass/54 PG Skip、専用PG54 Pass/0 Skip、型/frontend/通常Windows cross-build Pass。source104をbuild前後で照合し、外部npm315/両Cargo依存不変。

- 明示schema1→2 upgradeの原子性/metadata保持/permission lock待機、partial/reinstall/orphan拒否、durable key/read-only readiness。
- workspace別順序/並行6要求/ページ分割、opaque signed cursorのscope/署名/head/gap、再open後の継続。
- 同wire/同parsed JSON再送、ID再使用409/別scope403とwhole batch rollback、安定した業務rejected結果。
- 異field merge、同fieldの三値、resolution新operation、causal local-after、delete/tombstone/履歴/Conflict保持。
- Relation typed endpointの同workspace/削除/欠落/foreign参照と、削除済みRelationへのforeign遅着拒否。
- 実worker SIGKILLをCOMMIT直前/直後に実行。再送後もoperation/order/history1、鍵/epoch保持。
- fixture Auth/JWT＋実HTTP＋2つのRust SQLiteでACK喪失/driver再起動、immutable wire、pagination/収束、refresh旧lease閉鎖、失効時のpending保持。
- 実CLI upgrade/実runtimeで401/200/409/400、再起動cursor、missing key起動拒否/repairなし。待機中のcaller mutationでも元payloadを保存。
- 専用Docker image/Compose API/previewをv0.20/schema2へ更新。metadata0行は不変、cursor key保持、新経路のunauthenticated401/auth.html200を確認。

[verification.json](verification.json)、[通常report](vitest.json.gz)、[実PG report](postgres-vitest.json.gz)、[版監査](version-audit.json)、[source](source-inventory.json)、[Windows build](windows-build.json)、[Compose](compose-check.json)、[全20判断](../../../docs/decisions/private-structured-stream.md)。新UI/通常Tauri IPC/Page CRDT/実ユーザーSupabase/新MS IME/Android合格ではない。初回TS2532は行数確認後のrow参照を修正して型検査を通した。元のPoC/旧DB/旧証拠は保持、telemetry未実装/未収集。
