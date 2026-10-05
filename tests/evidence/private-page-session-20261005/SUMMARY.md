# 認証付きPage sessionの検証

2026-10-05 / v0.23.0。追加15 unit、通常208 Pass/66 PG Skip、専用PG66 Pass/0 Skip、型/frontend/通常Windows cross-build Pass。source111をbuild前後で照合、外部npm315/両Cargo依存不変。実Docker Chromium1ケースがPass。

- exact native prepared wire、Page/client/schema/digest/V1構文/完全消費、strict ACK/read binding、head/order/vector/title、600k/未知XML保持を検証。
- async hash中closeはnetwork呼出前に拒否、in-flight遅着ACK/readは保存しない。immutable context/captured port、同ID ABA、busy直列化、安全なtransport/storage errorを確認。
- Auth refresh/close/403で旧Page sessionを閉じ、同Page置換では他Pageを保持。fresh bootstrapで同storeを再開、失効時はpendingを保持。
- signed fixture HTTP＋実PG/2つのRust SQLiteの既存ケースを拡張。Page session経由の追加保存/remote受信、refresh旧session拒否/再登録、失効403でpendingと本文を保持。
- real Docker Chromium secure contextでWebCrypto SHA-256/atob/btoa、portable Page sessionの正確なwire/commit/不正digest拒否を確認。client codecはNode Buffer/cryptoを使わない。

[verification.json](verification.json)、[通常report](vitest.json.gz)、[実PG report](postgres-vitest.json.gz)、[browser report](playwright.json.gz)、[版監査](version-audit.json)、[source](source-inventory.json)、[Windows build](windows-build.json)、[全16判断](../../../docs/decisions/private-page-session.md)。Playwrightのconfig envを削除して選択reportをscan、ignored raw reportは保持。

初回関連試験はPass。通常Tauri IPC/Editor/Hocuspocus継続認可/native Auth/OS credential/実ユーザーログイン/実WebView2・Android crypto/新native IMEは未完成。すでに開始済みの旧store commitはclose後に完了し得るがsession成功や新storeへの適用とはしない。専用API/previewはv0.21/schema3を保持、local6/wire1。旧PoC/DB/IMEデータは変更せず、telemetry未実装/未収集。
