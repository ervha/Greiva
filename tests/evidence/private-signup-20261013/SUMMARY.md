# v0.82.0 新規登録と実Windows保存・同期

2026-10-13。[実装契約](../../../docs/development/PRIVATE_SIGNUP.md)。

| 検証 | 結果と範囲 |
| --- | --- |
| 単体 | 494 Pass、Fail/skip 0。新規登録7条件：送信先/body固定、auto-confirm responseを認証に使わない、不正入力/設定、HTTP400/429/500、二重送信・取消・遅着、私的例外の非公開 |
| 認証画面 | 最終18 Pass、retry/flaky/skip 0。登録依頼/認証の区別、password消去、composition、PC/狭幅dark/reduced motion、既存login/refresh/取消 |
| workspace画面 | 最終98 Pass、retry/flaky/skip 0。既存Page/Task/Relation/DB/View/ヘルプ・draft/選択保持 |
| 型/build | 最終typecheckとfrontend/server/Windows候補build Pass。test hooks/SQLite bridge/crash hooks 0。owned0.82.0、外部依存npm315/Cargo506・135不変 |
| Source | Host/Docker398件一致（raw388、改行のみ10）。対象外5件はverification.json |
| 実provider | 利用者が登録・確認メール・ログインを手動実施。正常ログインの報告後、native「認証を確認しました」→「ログイン済み」・workspace開通を観察。password/tokenは取得しない |
| 実Windows保存 | 架空Pageの2更新を端末保存後、対象候補だけを強制終了。手動再認証後に同じPage/本文/pending2復元。停止コピーを独立SQLite/Yjsで確認、integrity ok |
| 実同期 | nativeの明示同期後、pending未ACK 0・receipt2。元wireのhash不変、端末と実PGの全文XML/state vector一致、server更新2・digest重複なし |

候補exe SHA-256 `9ecf16dd9c19e83f581f162f965af624fced7b223be8ebedba6a3d649a629cfb`。hostの版0.82.0・SHAを照合した。artifact.jsonのhostLaunched:falseはbuild時点の情報で、後続の手動起動・実機確認はmanual-record.jsonを参照する。

## 原Failと回復

認証画面の初回追加検査は16 Pass/2 Fail。未ログイン時の「接続を閉じる」がなかったため、同じ試験でtimeoutした。ボタンを常時表示し、パスワード消去をsnapshot通知にも接続して同じ18件がPass。元JSON/logをinitial-authとして保持し、Failを消さない。

workspace初回は97 Pass/1 Fail。失敗は `Execution context was destroyed, most likely because of a navigation`。検証中にソース同期/ビルドを並行させたため、結果の実行条件を安定させる必要があった。製品のView破損と断定せず、ソース・buildを固定した同じ全98件がPass。元JSON/logをinitial-workspaceとして保持する。

同期後の稼働中DBはWindows lockでhash検査できず、最初のコピー解析もopen拒否となった。アプリを通常終了し、別の停止コピーで成功。これは保存機能のFailやcrash受入の追加Passではない。未送信のraw保存行は履歴として残るため、receiptとのLEFT JOINで未ACK件数を集計した。2履歴行/2receiptはpending0であり、送信重複ではない。

## 証拠と限界

単体/画面の個々の結果は圧縮JSON、原ログは各log。native-kill-audit/native-final-audit/native-server-auditは本文・wireのhashと件数/一致だけを保存する。DB/WAL、Auth identity、DSN、メール、password、JWT、確認リンク、実画面の画像はgitへ含めない。専用schemaと検証用Pageは保持した。

今回の強制終了復元は保存完了後の1境界で、再起動後はオンラインで手動再認証した。offline再認証なしの復元、transaction内部全停止点、実refresh/失効、IME/remote composition、7日offline権限、最終Gateの全合格ではない。全PG/Rust内部unitは今回再実行せず、[前の全Vitest確認](../test-review-20261013/SUMMARY.md)と[v0.80.0 Rust/OS証拠](../native-offline-lease-20261013/SUMMARY.md)を保持する。

メール確認後のlocalhost接続エラーは[未整備記録](../../../docs/failures/private-signup-confirmation-redirect.md)を残す。native画面取得は最初に自動承認審査が拒否し、利用者の「computer use使っていいです」回答後に検証用画面だけを取得した。Supabase管理ユーザー一覧へはアクセスしていない。実機候補は保存照合のため通常終了した。
