# v0.81.0 全Vitest再確認と項目整理

2026-10-13。記録checkpoint v0.81.1、対象ソースv0.81.0（8b43799）。[未合格事項と検証層](../../../docs/plan/TEST_REVIEW_20261013.md)。

| 層 | Files | Pass | Fail | skip |
| --- | --- | --- | --- | --- |
| unit | 57 | 487 | 0 | 0 |
| 非PG integration | 30 | 311 | 0 | 0 |
| PostgreSQL integration | 37 | 229 | 0 | 0 |
| 合計 | 124 | 1,027 | 0 | 0 |

既存Docker開発container、実開発用PostgreSQLで `GREIVA_TEST_POSTGRES=1 npm exec -- vitest run --no-file-parallelism` を実行。291.64秒。個々のassertionはvitest.json.gz、全ログはfull.log、files/層別対応とsource照合はverification.json。テスト削除・期待値変更・retryなし。Host/Docker395件一致（raw385、CRLF/LFのみ10）。対象外5件はverification.json。

PG flagによるskipを埋めて全Vitestを確認したが、Playwright画面E2E・Rust内部unit・Windows GUI/実IME・実Supabase正常認証・性能はこのrunに含まない。既存Rust driverを使う統合試験と、Rust内部unitの再実行を混同しない。

既知のMicrosoft再変換文字欠落Failは受入例外・未修正。native provider/UI/通常IPCの全経路は未実装で、正常実Authや期限到達時の画面draft保全は未受入。1,027件の成功でこれらを合格にしない。

回収scriptの初回はDockerにhostのsource inventoryが存在せずENOENT。inventoryを渡して回収だけを再実行した。製品テストFailや再実行Passには数えない。元試験結果をそのまま保持する。
