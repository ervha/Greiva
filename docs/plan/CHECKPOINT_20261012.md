# 2026-10-12 停止チェックポイント（v0.75.0）

利用者の「キリの良いところで止めて」に従い、進行中の検証・記録をまとめて停止する。次の開発/試験サイクルは始めない。

## ここまでの実装

- 個人workspaceの認証/端末保存/明示取得/永続queueの基盤を接続し、未送信・送信中・結果不明・拒否・Conflictを区別する。
- 基本DBの初期6型（Name/Text/Number/Checkbox/Select/Date）とTable/Listを実装。DB作成、既存Pageへ結び付けた行作成、型付き行編集、View作成と列順/filter/sort設定が操作できる。
- Record/Viewの競合ではbase/local/remoteを表示し、解決を新operationとして保存する。結果不明では元intent/wire/ACK pairを再確認し、別操作へ置換しない。端末保存とサーバー確認を別状態で示す。
- DBの読み込み範囲・未取得Name・未判定条件と明示取得を画面/同梱ヘルプへ接続。DB記事3件を加えて全12記事。入力・選択・focus/IME compositionを保全する操作をDocker E2Eで確認。
- v0.74.0で専用Windows preview builder・識別子・workspace起動画面・限定CSP・metadata/hash/compiled config CLIを実装。fixture候補で設定/CSPを検証した。
- v0.75.0で明示CORSとschema11までの初期化CLIを実装。実公開Supabase JWKSと認証拒否経路、専用開発schema/loopback APIを確認。実接続用Windows候補は生成していない。

通常781/別PG225/画面98がPass。型/build、通常Windows版/SHA照合も完了。[検証証拠](../../tests/evidence/private-api-native-startup-20261012/SUMMARY.md)。今回用API/forwarderは停止し、データ/volumeは保持。旧root、native schema16/server11を維持する。チェックポイント番号は製品完成/全Gate合格を意味しない。

## 残る範囲と再開計画

1. P4の実接続用Windows候補を新規隔離出力へ生成・検査し、Windows hostで実アカウント正常認証と個人workspaceを確認する。再起動・認証情報保管・期限/offline grantを含める。
2. 最新候補でnative保存/同期/失敗復旧、実Microsoft IME、端末間動作を検証する。DockerとWindows nativeの証拠を分ける。
3. Android実機/lifecycleを確認し、配備環境の通信/DB/backup暗号化、backup復元、署名/installer・提供範囲と最終Gateを整える。

本番運用・最終Gateは未完了。今すぐ利用者の対応は不要。正常認証の非公開入力や実機接続は、再開後に該当工程で案内する。Greiva DB/ログにはメール/profileを保存しない方針を維持し、本文はサーバー処理時の復号を許容する採用済み方針とする。

停止指示後の実設定Windows追加buildは自動承認審査が現在の範囲外として拒否したため、再開時へ延期した。詳細な設定/再開手順は [個人API Windows接続準備](../development/PRIVATE_API_NATIVE_STARTUP.md) に記載。
