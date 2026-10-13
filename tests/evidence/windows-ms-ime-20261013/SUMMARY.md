# 最新候補のMicrosoft IME通常入力・保存・同期

2026-10-13。記録checkpoint v0.82.1、実行物0.82.0。前の[実Windows保存・同期](../private-signup-20261013/SUMMARY.md)の架空Pageだけを使用した。

## 操作と結果

1. 利用者が同じWindows候補へ手動ログインし、検証用Pageを開いた。英語本文の末尾でEnterし、Microsoft IMEの実キー入力・変換・確定で `日本語の入力確認です。変換しても本文を保持します。` を追加した。貼付けやComputer Useのliteral入力をIME試験として扱わない。IME providerと完了は利用者が確認した。
2. 確定後のnative画面で、元の英語と追加日本語を確認。端末保存完了・未確認74更新を観察した。74は編集更新の件数で、文字数や変換回数ではない。
3. 最初の同期操作は自動承認審査に拒否されたため実行せず、追加本文の送信を利用者へ明示確認した。利用者のA回答後に同期確認を再開。操作時にuser input検出が返り、再取得した画面は同期完了だった。二度目の同期を追加で実行せず、最終保存値を検査した。実際の送信操作の主体を断定しない。
4. 候補を通常終了し、対象SQLiteを新しい隔離copyへ保存。独立Node SQLite/Yjsと実PGで同じPageを復元・照合した。

| 検査 | 結果 |
| --- | --- |
| 期待値 | 英語 `Native local save and sync check.` と指定日本語の正確な2段落。追加段落・欠落・二重入力なし |
| 本文/収束 | nativeとserverの全文XML/state vector一致 |
| 保存 | local更新78、server更新76、ACK履歴76、未ACK 0、SQLite integrity ok |
| 元の履歴 | v0.82.0の英語試験からの元wire hash保持。server digest重複なし |
| 実環境 | Windows 11 Home 10.0.26300、対象アプリ直接childのWebView2 154.0.4258.62。providerは利用者確認のMicrosoft IME |

候補0.82.0 SHA-256 `9ecf16dd9c19e83f581f162f965af624fced7b223be8ebedba6a3d649a629cfb`。test hooks/SQLite bridgeなし。buildを新しく行わず、記録PATCHの版を実行物へ付け替えない。local78/server76は同じraw履歴行数ではなく、受信差分も保存するnativeとserver更新をそれぞれ集計した数字。全文/vector一致を別にassertした。

audit.mjsは前回の `native-final-audit.json` を `/tmp/ime-baseline.json` に配置し、停止コピー `.data/ime-20261013/native-copy/workspace.sqlite` と専用APIの非公開設定 `/tmp/greiva-live-private75.json` を使ってDockerで実行する。設定やcontextは出力せず、固定の架空Pageだけをqueryする。audit.jsonとenvironment.jsonへ値の一致・hash・件数だけを保存した。SQLite/WAL、DSN、Auth identity、メール、password、JWT、確認リンク、画面画像はgitへ含めない。

## 合格範囲と未実施

これは通常の短いローカルIME入力・変換・確定の結果、保存、明示同期の限定確認。composition中のnative event traceや候補UIを連続観測していない。入力中の遠隔更新、composition中の再接続、再変換/Alt+Tab、長時間入力、native frame/per-key性能、offline再起動は今回未実施。

[再変換の原Fail](../../../docs/failures/step-8-ms-ime-reconversion.md)と[受入例外](../../../docs/decisions/step-8-ms-ime-exception.md)は維持する。今回の成功で再変換を修正済み・全IME組合せ/Gate Aを無条件Passにしない。既存Gateは実行版0.6.20時点の判断として保持する。
