# Step 7サーバー検証の修正記録

2026-10-01。初回の実PostgreSQLで、台帳挿入に故意の例外を起こすrollback試験のassertionが失敗した。DrizzleはPostgreSQLの例外をcauseへ保持するため、外側messageに直接一致させるassertionでは意図した例外を検出できなかった。causeの`injected ledger failure`を確認するよう修正し、entity・履歴・台帳・counterがrollbackされ、retryが一回だけcommitする検証を維持した。初回ログ/結果を[証拠](../../tests/evidence/step-7-structured-server-20261001/previous-attempt/)に保持する。

連続offline更新を先のACK versionへ無条件に付け替えるだけでは、先の同field競合を消してpeerの値を上書きする可能性を見つけた。前操作IDと操作後のlocal frameを保持して元の意図を比較対象にする。追加の実PostgreSQLで競合fieldの保持、別fieldの継続変更、create alias、依存検証、tombstone後の連続操作、台帳移行と再送結果不変を検証する。

これはサーバーの修正・検証であり、端末ACK/pull/cursorやConflict UIの完成を示さない。Windows操作APIの接続失敗とMicrosoft IMEの未検証も別の制約として残る。
