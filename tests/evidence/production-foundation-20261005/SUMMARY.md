# Task/Relation Domain/Application基盤 — 0.7.0

2026-10-05、Docker内で実行。Domainへ既存intent規則を移し旧protocol exportを維持。Applicationへ認可→durable atomic storeのportable境界を追加。actor/intent/portの固定、拒否/不通、durable待機、結果不明commitと同一ID retryを検査する。[全13判断](../../../docs/decisions/production-command-foundation.md)。

| 確認 | 結果 |
| --- | --- |
| 型チェック | Pass |
| 通常unit/integration | 64 Pass、20実DB専用skip。新境界9条件含む |
| 専用PostgreSQL | 上記20を別実行、20 Pass/skip0 |
| 全画面E2E | 59 Pass/skip0 |
| 実HTTP/Rust SQLite/PG同期・Conflict UI | 2 Pass、専用schema清掃remaining0 |
| 通常frontend/Windows release cross-build | Pass、hook flags0/保存層crash hooksなし |
| source照合 | Windows buildの75ファイルがhost一致 |
| 版/外部依存 | 所有版0.7.0一致、npm314外部records/Cargo外部不変 |

JSON原reportsはgzipで保持。結果集約は[verification.json](verification.json)、build実行/実行物hashは[windows-build.json](windows-build.json)。実行物はローカルignored領域に保持しgitへ入れない。Dockerは既存Node24.19/npm11.9環境を使用。E2Eはtest-only保存bridgeを使い、通常Windows artifactには含めない。

新ApplicationはまだUI/本番adapterへ接続していない。9条件のcontract doubleは実SQLite原子性/JWT認証の証明ではない。実SQL/HTTP試験は既存実装の回帰。今回の成功をnative IME/物理drag/性能SLO/Androidアプリ/本番認可のPassへ換算しない。旧DB/wire/外部providerは変更しない。

準備時のnpm installはnode_modules/@greivaへのsymlinkでEACCES。Docker内の当該directory所有者を修正後成功した。TypeScriptの例外unionはinstanceofでnarrowし、Account/store差替え条件を追加して最終64件を再実行した。初回63件は最終結果に置き換え、製品の動作失敗とはしない。
