# PoC技術選定 — 条件付き採用

2026-10-04、判定checkpoint v0.6.23。**利用者の明示判断委任に基づくPoC結論。Step 9の成果物作成を完了し、技術基盤を条件付き採用とする。本番提供の承認ではない。**

Tiptap／Yjs／HocuspocusでPage本文を同期し、SQLiteで端末保存。Task／Relationは操作ログ＋cursor＋base／local／remote Conflictを用い、NestJS／Fastify／PostgreSQLへ同期する分離を条件付き採用とする。

| 領域 | 根拠と現在の扱い |
| --- | --- |
| Editor／日本語IME | [Gate A](gate-a.md)。必須block・通常変換・実Microsoft遠隔compositionと保存保持を確認。短い連続入力と保存監査済み、Pass。再変換Failは利用者の明示例外 |
| offline／Yjs収束 | [Gate B](gate-b.md)。保存済み復旧・peer一致を確認。macOS／iOS未検証とWindows性能の残条件を含むConditional、判断委任に基づき残条件を受入 |
| structured同期 | [Gate C](gate-c.md)。durable ACK・冪等性・cursor・Conflict解決・1,000操作の整合に基づくPass確定 |

Gate Aは確定、Gate Bの残条件は判断委任に基づき受入済み。採用の条件として、保存済み／保存中／同期中／Conflictの意味を維持すること。対応OSの実機検査や通常release性能の追跡を残す。未commit入力を保存済み保証へ含めず、PoCのコードをそのまま本番へ昇格する前提を置かない。

今回の判断はCalendar／AI／認証等のproduction scopeへ進む指示を含まない。[全自律判断・後続事項](poc-autonomous-review.md)を参照。問題が報告された場合は再現・影響・改善案を記録し、基盤の置換や要件緩和は[PoC仕様](../plan/POC_SPEC.md) §1.3に従って判断する。
