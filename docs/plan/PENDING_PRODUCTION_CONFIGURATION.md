# 応答・外部環境が必要な事項

v0.27.0：[stable native端末ID](../development/PRIVATE_DEVICE_IDENTITY.md)と再ログイン後の同Page/pending復帰をlocal検証した。端末IDはAuth grantではなく、実Auth/native署名/OS credential/offline権限や通常画面compositionは引き続き残る。旧private rootのdevice metadataを推測して取り込む処理は追加しない。暗号化配備・鍵管理の実装も後続。

最新v0.25.0：認証付きPage一覧query、bounded keyset/HMAC workspace・epoch/metadata照合、connection.closeでnative cleanup開始を追加。[全14判断](../decisions/private-page-catalog.md)、[証拠](../../tests/evidence/page-catalog-20261005/SUMMARY.md)。通常224/PG69/browser2/型/frontend/Windows source116、専用API/preview v0.25/schema3を確認。一覧はsnapshot/delta同期ではなくnormal UI/metadata変更/native Authは未完成。次は利用者要望のシンプルな配色を独立して改善する。

最新v0.24.0：app-owned workspace DB root/世代handleとTauri commandを追加し、captured Auth generationのNativeWorkspaceStoreをPage/structured portへ接続。[全16判断](../decisions/native-workspace-ipc.md)、[証拠](../../tests/evidence/workspace-ipc-20261005/SUMMARY.md)。新11、通常219/PG66/型/frontend/Windows build/Browser2を検証。local handleはAuth grantではなく、通常UI/実Tauri invoke/native Auth/offline保持契約は未完成。専用APIはv0.21/schema3を保持、追加操作を求めずPage metadata/一覧へ進む。

最新v0.23.0：captured Auth/workspace/Pageのportable sessionを追加。prepared wire/Yjs構文/digest/応答bindingを検査し、保存先固定、refresh/close/同Page置換/遅着応答をguardする。[全16判断](../decisions/private-page-session.md)、[証拠](../../tests/evidence/private-page-session-20261005/SUMMARY.md)。追加15 unit、通常208/実PG66、型/frontend/Windows build、実browser WebCrypto/base64と実HTTP＋Rust SQLiteを検証。通常UI/IPC/Hocuspocus/実Auth/nativeは未完成、追加操作を求めずnative IPC接続へ進む。

最新v0.22.0：workspace別Rust SQLiteへPage binary/送信待ち/正確なwire/ACK receipt/remote diffの原子保存を追加。private local schema6はbinding確認後に5からupgradeし、structured dataを保持。[全16判断](../decisions/private-page-durable-store.md)、[証拠](../../tests/evidence/private-page-store-20261005/SUMMARY.md)。通常193/実PG66、型/frontend/Windows build、8条件SIGKILL/実HTTP＋2つのSQLiteを検証。専用APIはv0.21/schema3を保持。captured client session/通常UI・IPC/Hocuspocus/実Auth/nativeは未完成で、追加操作を求めず続ける。

最新v0.21.0：認証付きPage本文のbinary保存基盤を実装。明示schema3、初期title、append-only journal/digest/再送、state-vector diff、破損拒否/失効/期限rollback/COMMIT前後SIGKILLを検証。[全22判断](../decisions/private-page-binary.md)、[証拠](../../tests/evidence/private-page-20261005/SUMMARY.md)。通常180/実PG65、型/frontend/Windows cross-buildを確認。通常UI/IPC/端末Page queue、metadata rename/delete/Conflict、Hocuspocus継続認可・実Auth/nativeは未完成。追加操作を求めず端末耐久化/client sessionへ進む。

v0.20.0：個人workspace専用Task/Relation streamを実装。immutable ledger/再送、三値Conflict/causal frame、typed Relation参照、signed cursor/commit順序、明示schema2 upgradeを追加。通常177/実PG54/型/frontend/Windows build、専用API/preview更新がPass。[全234判断](AUTONOMOUS_DECISIONS.md)。Page metadata/CRDT・通常UI/IPC・実Auth/nativeは未完成で、追加操作を求めずPage同期の保護契約へ進む。

v0.19.0：同一transactionでowner/device/resourceをlockする境界とdevice/access入口を実装。通常175/実PG41/型/Windows buildを確認。[全214判断](AUTONOMOUS_DECISIONS.md)。実ユーザーloginの追加手操作を求めず、新server ledger等を進める。旧Page/DBは保持、実Auth正常系やnativeの未完了をDB競合試験で代用しない。

v0.18.0：browserの[ログイン確認画面](../development/PRIVATE_LOGIN_PREVIEW.md)を用意。専用Compose previewの`http://127.0.0.1:1421/auth.html`で、自分の検証ユーザーによるlogin→workspace登録→refresh→再登録→logoutが後で必要。password/tokenをチャットへ求めず、今は操作依頼を出さない。[全199判断](AUTONOMOUS_DECISIONS.md)と単発Home試験の未確定原因を記録し、server同期等の独立作業を続ける。

v0.17.0：保護APIの明示設定/起動と初期化を実装。[全178判断](AUTONOMOUS_DECISIONS.md)。専用local ComposeのDB/volumeを新規に作り、認証なし401を確認。実ユーザーloginは未確認で、password/tokenをチャットに求めない。追加回答なしでログイン確認画面などの独立作業を進める。

v0.16.0：認証→strict bootstrap→固定した同期session/storeの接続を実装。[全164判断](AUTONOMOUS_DECISIONS.md)。新server streamが未接続のHTTP404でもpending保持を実PG/native SQLiteで確認した。実ユーザー認証/通常UI/IPCは未完成。追加回答を求めず、保護API起動/configへ進める。

v0.15.0：配置設定とmemory-only認証session、保護HTTPの署名検証へ接続するadapterを実装。[全148判断](AUTONOMOUS_DECISIONS.md)。provider login/refreshはfixture、実Supabaseは公開JWKS/不正署名拒否まで。正常な実ログインはUI/OS credential接続後にまとめて確認する。今は追加回答・password/tokenを求めず、新workspace同期/起動adapter等の独立作業を進められる。

v0.14.0ではnative workspace storeを実装し、prepared/ACK/pullの耐久性を実SQLite/SIGKILLで検証。[全132判断のまとめ](AUTONOMOUS_DECISIONS.md)。通常UI/IPC/実Authは未接続。利用者からSupabase URL、ES256、Publishable keyを受領し、公開JWKS/Auth settingsを実HTTPSで確認した。[設定手順](../development/SUPABASE_SETUP.md)。以下の過去版記録は当時の状態。

v0.13.0までの[継続開発118判断のまとめ](AUTONOMOUS_DECISIONS.md)を追加。[同期session12判断](../decisions/workspace-sync-session.md)はaccount/workspace/epochと元storeの捕捉、close/遅着応答の検証範囲を記録する。native prepared/receipt/cursor、offline/logout/失効契約、実Authは未完成。

2026-10-05の追加判断は[規約/改善送信12件](../decisions/privacy-telemetry-plan.md)、[独立HTTP12件](../decisions/private-http-boundary.md)、[正本metadata/bootstrap12件](../decisions/private-workspace-bootstrap.md)に全件記録。新規schemaを先行し、旧DB帰属/取り込みを推定しない。現在追加の利用者操作は不要。

2026-10-05。利用者の「応答が必要なら他の作業を先行し、必要事項/全判断を記録」に従う。現在の初期範囲は機能優先委任と個人/自端末同期先行で決定済み。[判断9件](../decisions/production-foundation-plan.md)、[基盤13件](../decisions/production-command-foundation.md)、[認可12件](../decisions/private-workspace-access.md)、[wire/cursor12件](../decisions/workspace-sync-boundary.md)、[署名session16件](../decisions/signed-session-verification.md)。

| 事項 | 必要な情報/環境 | 状態と先行できる作業 |
| --- | --- | --- |
| 実Auth検証 | 検証ユーザーのbrowser入力、後続native UI/OS credential保存 | 専用auth.htmlと保護proxyを実装。公開設定/不正署名拒否は確認済み、正常実login/失効/端末間同期は未確認。後で操作をまとめる。今は操作依頼なし、password/tokenをチャットへ求めない |
| 本番接続/配布 | API/collaboration/Auth endpoint、署名/配布先/credential管理 | 未設定。public deploy/課金/ホストglobal toolchain追加をしない |
| offline/logout/失効 | 端末保存データへのoffline権限、logout/device失効時の保持/消去/再ログイン | 未決定。期限や自動削除を仮定せず、保存済みpendingを保持する |
| 旧PoC取り込み | 初期提供の有無、workspace帰属、旧pending/ACK/cursor/titleの扱い | 未決定。旧DBを移行・消去せず新contract/fixtureを先行 |
| Android通常アプリ/最終native | build環境・実SQLite/lifecycle、必要時のPixel 7接続 | browserの旧試験をNative合格へ転用しない。今は追加手操作を依頼しない |
| 規約/ポリシーの公開条件 | 運営者/窓口、年齢/料金/適用時点、責任/紛争、Provider/取扱国、保持/削除/backup | 日本先行は回答済み。[公開計画](TERMS_PRIVACY_POLICY_PLAN.md)で未確定値を明示し、実装と文言を公開前に照合 |
| 任意改善データ | 送信先・schema/目的版、各保持期間/queue上限、同意台帳/削除運用 | エラー・性能のみは回答済み。初期OFF・端末ごと同意の[設計](PRIVACY_TELEMETRY_SPEC.md)。未実装/未収集。現在追加回答待ちなし |

現在の実装はproduction adapterへ未接続の段階。旧PoCの未認可HTTP/CRDT経路を公開してよい状態ではない。Computer Useは解除済み、旧試験Page/DBを保持。

追加操作はまとめて必要な時点で依頼し、各区切りを停止理由にしない。Supabase公開設定確認後も、上表で独立する作業を続ける。秘密credentialをgit/chat/evidenceへ記録しない。
