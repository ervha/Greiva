# Page一覧と接続終了の検証

2026-10-05 / v0.25.0。新unit5/実PG3、通常224 Pass/69 PG Skip、専用PG69 Pass/0 Skip、実Browser2、型/frontend/通常Windows cross-build Pass。source116をbuild前後に照合、外部npm315/両Cargo依存不変。

- keyset pagination/reopen、live Page/foreign owner/失効、HMAC改変/用途/epoch、破損lookahead拒否、resource lock待ち期限切れを検証。
- signed fixture HTTP＋実Postgres/SQLite caseでclient query、JWT-first401、invalid cursor400を確認。
- client response capture/freeze/binding/progress、close/refresh遅着拒否。native connection.close cleanupは修正前6 Pass/1 Fail→修正後Pass、shared Auth保持。
- 専用Docker API/preview v0.25、schema3/登録/epoch/鍵保持、direct/proxy query401/authHTML200。旧SQLite/失敗Pageは変更しない。
- Browser2は既存portable codec/session＋native invoke port doubleの回帰。実Tauri invoke/通常UI/IME/Android/実Supabase loginとは分離。

[verification](verification.json)、[通常report](vitest.json.gz)、[PG report](postgres-vitest.json.gz)、[browser](playwright.json.gz)、[版監査](version-audit.json)、[source](source-inventory.json)、[Windows build](windows-build.json)、[Docker](compose-check.json)、[全14判断](../../../docs/decisions/private-page-catalog.md)。

一覧queryはmetadata同期/複数request一貫snapshotではない。rename/delete/Conflict/cache/normal UI/native Auth/offline保持契約は未完成。telemetry未実装/未収集。v0.24のEOF警告後shell継続は今回訂正し、published tagは保持。
