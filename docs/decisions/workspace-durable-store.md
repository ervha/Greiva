# Workspace耐久保存とSupabase準備の全判断

2026-10-05、v0.14.0。P1のnative保存portを進める自主判断と、途中で提供されたSupabase公開設定への対応。

1. 既存Rust/sqlx libraryを継続し、新規WorkspaceStoreだけを追加する。新しいhost toolchainや外部依存を導入しない。
2. 新規DBのschema 5へissuer/subject/workspace/client/epochを一括transactionで固定する。未知の既存データやPoC schema 4を自動採用しない。
3. mismatchはopen時に拒否し、account/device/epochを付け替えない。旧pendingを消さず、戻った際も同じbindingが必要。
4. 通常PageStoreはschema 5を拒否する。新Storeのinnerを公開せず、旧raw Page/SQL commandを新workspaceへ無条件流用しない。
5. contextはローカル保存先の識別であり、認証証明や端末暗号化ではない。client UUIDも物理端末の証明ではない。
6. 既存のcausal prepare/pullをtransaction helperへ抽出し、旧PoCも同じ処理を使う。機能を作り直さず、通常/実PGと画面/実同期の回帰で確認する。
7. 初期prepared envelopeは1operationとし、operationのcausal baseとworkspace wireを同じtransactionで保存してから返す。protocolの最大batch数を達成済みとはしない。
8. ACK portに元prepared文字列も渡す。durable文字列との完全一致、scope/epoch/operation identityと全resultを確認してから適用する。
9. ACKのentity/conflict/pending/receiptを一括commitし、同じACKは再送可能、変更されたreceiptは拒否する。ACKだけでpull cursorを進めない。
10. pullのentity/conflict/pending、operations receiptとcursor/headを同じtransactionでcommitする。ページ順序・進行・limit・所属を拒否時に一部反映しない。現在のnative server order上限は既存SQLite signed 64-bitのままで、超過は拒否する。
11. pull receiptはbase/target/operationsを固定する。serverTimeや後続headの変化までreceipt違反にせず、同じ空ページの定期pollやcommit済みpage replayを許容する。
12. private保存エラーは固定messageへ縮約し、SQL/path/本文のcauseを公開しない。prepared/ACK/pullの各commit前後6境界をDockerの実RustプロセスSIGKILLとSQLite再openで検証する。通常Windows buildにcrash hooksを入れない。
13. 利用者提供のSupabase URL・ES256・Publishable keyを検証用に受領した。公開値でもproject固有keyを汎用ソースへ固定せずignored設定へ置く。秘密鍵/token/passwordは要求しない。
14. Dockerから公開JWKSとAuth settingsを実HTTPS取得する。HTTP 200/ES256/Email有効は接続準備の証拠に限定し、実ログイン/refresh/失効/端末間同期と混同しない。手順と必要なcallback接続を[設定ガイド](../development/SUPABASE_SETUP.md)へ記録する。

初回driver buildでは、standaloneのignored Cargo.lockが古いapp版と外部yoke-derive 0.8.4を選んだ。authoritative parent lockの0.8.3へDocker内で合わせ、全driver依存のname/version/checksum所属を監査し、最終buildをlockedで再実行した。tracked外部lockは変更しない。Windows初回buildのroot所有package-lockによる権限失敗は所有権を修正し、別のfresh出力で再実行した。最終検証と初回失敗を区別する。

v0.15追記：standalone lockは実際にはtrackedで、v0.14ではDocker内の最終lockをhostのcommitへ戻していなかった。通常Windowsのparent lockと当時のdriver最終buildは照合済みだったが、tracked試験用owner版は古かった。[訂正と両lock監査](supabase-auth-session.md)を記録して修正した。

画面回帰の初回は存在しない`/usr/bin/chromium`を指定して起動前に失敗した。既存の`/opt/playwright`を使うDocker環境設定へ修正して両suiteを再実行し、追加インストールはしない。この修正を新しいUI/実IMEの実装・証拠にはしない。

[検証証拠](../../tests/evidence/workspace-store-20261005/SUMMARY.md)。Rust libraryとDocker JSON-lines test portを実装した段階で、通常Tauri IPC/active UI、新workspaceのHTTP stream/Page CRDT、実Auth/login/credential保管、旧DB移行はまだ接続しない。ユーザーの試験Page/DBを変更せず、telemetryは未実装/未収集のまま保持する。
