# 応答・外部環境が必要な事項

v0.13.0までの[継続開発118判断のまとめ](AUTONOMOUS_DECISIONS.md)を追加。[同期session12判断](../decisions/workspace-sync-session.md)はaccount/workspace/epochと元storeの捕捉、close/遅着応答の検証範囲を記録する。native prepared/receipt/cursor、offline/logout/失効契約、実Authは未完成。

2026-10-05の追加判断は[規約/改善送信12件](../decisions/privacy-telemetry-plan.md)、[独立HTTP12件](../decisions/private-http-boundary.md)、[正本metadata/bootstrap12件](../decisions/private-workspace-bootstrap.md)に全件記録。新規schemaを先行し、旧DB帰属/取り込みを推定しない。現在追加の利用者操作は不要。

2026-10-05。利用者の「応答が必要なら他の作業を先行し、必要事項/全判断を記録」に従う。現在の初期範囲は機能優先委任と個人/自端末同期先行で決定済み。[判断9件](../decisions/production-foundation-plan.md)、[基盤13件](../decisions/production-command-foundation.md)、[認可12件](../decisions/private-workspace-access.md)、[wire/cursor12件](../decisions/workspace-sync-boundary.md)、[署名session16件](../decisions/signed-session-verification.md)。

| 事項 | 必要な情報/環境 | 状態と先行できる作業 |
| --- | --- | --- |
| 実Auth検証 | Supabase検証projectのproject URL、issuer/audience等の公開設定 | 利用者は未作成・local実装/自動試験先行と回答。今は回答待ちなし。秘密鍵/tokenは求めず、policy、wire/cursor、fixture試験を進める |
| 本番接続/配布 | API/collaboration/Auth endpoint、署名/配布先/credential管理 | 未設定。public deploy/課金/ホストglobal toolchain追加をしない |
| offline/logout/失効 | 端末保存データへのoffline権限、logout/device失効時の保持/消去/再ログイン | 未決定。期限や自動削除を仮定せず、保存済みpendingを保持する |
| 旧PoC取り込み | 初期提供の有無、workspace帰属、旧pending/ACK/cursor/titleの扱い | 未決定。旧DBを移行・消去せず新contract/fixtureを先行 |
| Android通常アプリ/最終native | build環境・実SQLite/lifecycle、必要時のPixel 7接続 | browserの旧試験をNative合格へ転用しない。今は追加手操作を依頼しない |
| 規約/ポリシーの公開条件 | 運営者/窓口、年齢/料金/適用時点、責任/紛争、Provider/取扱国、保持/削除/backup | 日本先行は回答済み。[公開計画](TERMS_PRIVACY_POLICY_PLAN.md)で未確定値を明示し、実装と文言を公開前に照合 |
| 任意改善データ | 送信先・schema/目的版、各保持期間/queue上限、同意台帳/削除運用 | エラー・性能のみは回答済み。初期OFF・端末ごと同意の[設計](PRIVACY_TELEMETRY_SPEC.md)。未実装/未収集。現在追加回答待ちなし |

現在の実装はproduction adapterへ未接続の段階。旧PoCの未認可HTTP/CRDT経路を公開してよい状態ではない。Computer Useは解除済み、旧試験Page/DBを保持。

追加操作はまとめて必要な時点で依頼し、各区切りを停止理由にしない。Supabase未作成の間も、上表で独立する作業を続ける。credentialをgit/chat/evidenceへ記録しない。
