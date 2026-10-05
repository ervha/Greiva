# 技術stackの現状と製品化候補

v0.21.0補足：private認可/structured ledger/Page binaryはRepository内のparameterized node-postgres queryを同じlease clientへ固定する。Drizzleの別pool/transactionで認可とwriteを分離しない。既存Drizzle/modelは保持。[全判断](../decisions/private-page-binary.md)。APIは既存固定Yjs13.6.33を明示依存に追加、外部lockは不変。

2026-10-05。sourceは製品0.6.25、[PoCの条件付き採用](../decisions/poc-technology-selection.md)を継承。以下はrepositoryの固定manifest/lock/composeから読んだ値で、最新版の調査・upgrade推奨ではない。

| 領域 | 現PoCの固定版 | 確認元 |
| --- | --- | --- |
| Node / npm | 24.19.0 / 11.9.0 | root package.json engines/packageManager |
| React / React DOM | 19.3.0 | client package.json |
| TypeScript / Vite | 7.0.2 / 8.3.1 | root/client package.json |
| Tauri core / CLI / JS API | 2.12.0 | client Cargo.toml/package.json |
| SQL plugin | 2.5.0 | client Cargo.toml/package.json |
| Rust SQLite access | sqlx 0.8.6、tokio 1.53.1 | page-store Cargo.toml |
| Tiptap / ProseMirror経由package | @tiptap群3.31.3、y-tiptap 3.0.9 | client package.json |
| Yjs / Hocuspocus | 13.6.33 / 4.7.0 | client/collaboration package.json |
| NestJS / Fastify | 12.1.1 / 5.12.5 | api package.json |
| Drizzle / node-postgres | 0.45.3 / 8.23.0 | api package.json |
| PostgreSQL開発image | 18.4-bookworm | infrastructure/postgres/compose.yaml |
| Vitest / Playwright | 5.0.2 / 1.63.0 | root package.json |

実行物のTauri/WebView版とmanifestの版は区別する。Windows診断で使ったhost Node26.1.0は既存toolの例外で、repositoryのNode固定版を変更する理由にしない。外部依存をこの文書作成では更新していない。

## 製品候補と未実装の部分

中核のReact/Tauri/Tiptap/Yjs/Hocuspocusと、structured operation/cursor/Conflictの分離は継承候補。採用の条件は既存保存契約・対応OS検証・性能残条件を維持すること。[architecture](ARCHITECTURE.md)を参照。

| 要件の方針 | PoCとの差・実装前の扱い |
| --- | --- |
| Monorepo | 委任に基づき初期はnpm workspaceを継続。将来pnpm/Turborepoを評価するならlock移行・Docker再現・全チェックを独立checkpointで行う |
| Native SQLite | 委任に基づきRust/sqlx Repository＋Tauri IPCを初期基準にする。SQL plugin依存は現在残り、除去やport接続は別検証 |
| Web SQLite WASM/OPFS＋IndexedDB fallback、y-indexeddb | 現browser補助previewは非永続。test-only Rust HTTP bridgeをWeb製品storeに流用しない。binary正本・worker・fallbackの仕様が先 |
| Supabase Auth/PostgreSQL/Object Storage | 未接続・未実装。role/RLS・deployment・費用・秘密情報管理の契約を先に決める |
| Hocuspocus本番binary store | 現file journalはPoC単体検証。workspace/schema、backup、複数instance、認可、retentionを追加する |
| Worker / Provider Adapter | 未実装。運用先・再試行・外部実行履歴を個別仕様へ落とす |

## 更新・代替評価

依存更新は入力/IME、CRDT encoding、wire/schema、native permissionへの影響を列挙し、関連Docker回帰と実OS検査を行う。既存buildの版を後から書き換えない。UI/nativeの置換はPoCで実用を妨げる失敗を観測した場合の比較対象であり、未検証だけを理由に全面置換しない。

提供前のライセンス、依存脆弱性、署名、対応OSはその時点の公式資料と実行物で確認する。本書の版表はそれらの合格証明ではない。新規stack/Providerの選択と維持費は未決定一覧へ残す。
