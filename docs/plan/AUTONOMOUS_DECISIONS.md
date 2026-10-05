# 継続開発の判断まとめ

2026-10-05。利用者の「自律判断をすべて記録し、停止前にまとめる」指示に対応する索引。各リンク先に全件と理由/証拠/制約を記載する。未実施項目を合格へ変更せず、判断委任をデータ削除や公開環境作成の許可へ拡大しない。

| 区切り | 全判断の記録 | 件数 | 主な選択 |
| --- | --- | --- | --- |
| v0.6.26 Windows診断 | [Windows followup](../decisions/windows-profile-followup.md) | 8 | 新規profile、層別測定、貼り付け/実キー/IMEの証拠分離 |
| v0.6.27 個人版設計 | [基盤計画](../decisions/production-foundation-plan.md) | 9 | 個人/自端末先行、Windows/Android、基本Table/List、Rust port継続 |
| v0.7.0 command基盤 | [Domain/Application](../decisions/production-command-foundation.md) | 13 | 旧intent保持、非同期前捕捉、durable/結果不明の区別 |
| v0.8.0 owner境界 | [Private access](../decisions/private-workspace-access.md) | 12 | owner-only、typed resource所属、1snapshot、不通deny |
| v0.9.0 wire/cursor | [Workspace boundary](../decisions/workspace-sync-boundary.md) | 12 | version1、ACK identity、epoch、HMAC/正確なbigint |
| v0.10.0 session | [署名/issuer](../decisions/signed-session-verification.md) | 16 | fixed jose、trusted JWKS、issuer＋subject owner、fixture/live分離 |
| v0.10.1 規約/任意送信設計 | [Privacy plan](../decisions/privacy-telemetry-plan.md) | 12 | 日本先行・エラー/性能のみ（回答）、初期OFF/端末同意/撤回/受信照合 |
| v0.11.0 HTTP | [HTTP boundary](../decisions/private-http-boundary.md) | 12 | 独立factory、安全401/403/503、旧aliases未mount |
| v0.12.0 bootstrap | [Metadata/bootstrap](../decisions/private-workspace-bootstrap.md) | 12 | fresh schema、初期ownerごと1workspace、安定再送/epoch、端末ID衝突rollback |
| v0.13.0 遅着応答 | [Sync session](../decisions/workspace-sync-session.md) | 12 | 生成時account/store捕捉、close後復帰禁止、不正応答を適用前に除外 |
| v0.14.0 耐久保存/接続準備 | [Workspace store](../decisions/workspace-durable-store.md) | 14 | 新規binding、prepared/ACK/pull原子保存、SIGKILL6、Supabase公開設定確認 |
| v0.15.0 認証session | [Supabase session](../decisions/supabase-auth-session.md) | 16 | memory-only token、server検証後identity、rotation/close/期限、local logout、両Rust lock整合 |
| v0.16.0 workspace接続 | [Private connection](../decisions/private-workspace-connection.md) | 16 | strict bootstrap、auth lease、保存先捕捉、refresh/遅着処理、旧経路fallbackなし |
| v0.17.0 保護API起動 | [Private startup](../decisions/private-api-startup.md) | 14 | 明示設定/read-only readiness、fresh初期化、独立Docker、終了cleanup |
| v0.18.0 ログイン確認画面 | [Private login](../decisions/private-login-preview.md) | 21 | memory-only/明示登録/更新、browser fetch修正、safe public config、独立preview、未確定失敗保持 |
| v0.19.0 同期transaction | [Private transactions](../decisions/private-sync-transactions.md) | 15 | owner/device/resource lock、期限/失効競合、active query/rollback、device確認 |
| v0.20.0 structured同期 | [Private stream](../decisions/private-structured-stream.md) | 20 | 明示schema2/鍵保持、ledger/Conflict/順序/typed refs、実SQLite/SIGKILL、専用API更新 |

合計234件。利用者回答に基づく決定と自主判断の区別は各記録に明示。上表以前のPoC判断は[技術採用/全Gateレビュー](../decisions/poc-autonomous-review.md)、[Step8描画改善](../decisions/step-8-render-isolation.md)、[過去証拠索引](../../tests/evidence/README.md)と各docs/decisions記録へ保持している。

共通：同じcodex/poc-editor、確認後の版/tag/push、外部依存を監査、元Page/DBを保持。Computer UseはWindows診断後に解除し、今回の基盤開発では使わない。cloud/project/配布・課金・新global toolchainを作成せず、端末保持/旧DB帰属/保持期限を未決定のまま創作しない。初期OFFの改善送信は設計で、実際の収集は始めていない。

応答・環境が必要な項目は[PENDING_PRODUCTION_CONFIGURATION](PENDING_PRODUCTION_CONFIGURATION.md)。今は追加の手操作を求めずlocal検証を進めている。実Auth、Native Android、署名配布等の未完了をlocal試験で代用しない。
