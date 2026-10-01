# Step 8: 回帰試験のbridge停止と版更新の修正

2026-10-01。性能の単独測定4ケースは2 runで成功したが、最初の全回帰runで2種類の試験環境の失敗を観測した。アプリのデータ消失・IME失敗の証拠とは分類しない。一方、回帰全体の成功として隠さず、最終チェックポイント前に修正・再検証する。

## Rust試験transportのbroken stdin

`STEP8-E2E`は26件Pass／17件Fail。途中で試験用Rust driverの終了とrequestが競合し、Viteのstdin writeに`EPIPE`が発生した。stdin streamにerror listenerがなく、Nodeのunhandled errorでViteが終了した。最初の失敗はEditor読み込み待ちで、以後は`ERR_CONNECTION_REFUSED`やsocket hang upへ連鎖した。`tests/support/sqlite-bridge.ts`のtransportは試験用であり、通常Tauriのinvokeではない。

broken stdinをpending store commandの失敗として返し、driverを終了・登録解除するようにした。並行の大きなJSON requestによるbackpressureの中で実Rust driverを4回SIGKILLし、全requestが応答を受け、HTTP serverと新しいdriverが復帰する専用試験を追加した。既存の全43 Editor／保存E2Eとstructured UI・crash regressionも改めて検証する。timeoutを伸ばして失敗を隠す対応はしていない。

## Cargo lockの誤った版置換

0.6.3への版更新時、アプリの0.6.2を一括置換したため、外部crate `block2` と `raw-window-handle` の固定版0.6.2まで0.6.3へ変えてしまった。checksumは元のままで、locked Cargo check／feature metadataが失敗した。これは版更新手順の誤りで、依存更新の判断ではない。

両外部crateを元の0.6.2へ戻し、アプリ所有の`greiva-poc`／`greiva-page-store`だけを0.6.3とした。両Cargo lockとnpm lockを差分で確認し、外部依存の版・checksumが前のコミットと一致することを検査してからlocked checksを再実行する。アプリ所有の名前を指定して更新することを今後の手順とする。

## 証跡

最初の全回帰は`tests/evidence/runs/container/2026-10-01T09-03-38.869Z/`。[失敗runのsummary](../../tests/evidence/step-8-performance-20261001/previous-attempt/full-regression-fail/SUMMARY.md)、raw JSON/JUnit、[失敗contextとtraceのarchive](../../tests/evidence/step-8-performance-20261001/previous-attempt/full-regression-fail/artifacts.tar.gz)を保持した。

同じbackpressure試験からerror listenerだけをDocker内で一時的に除くprobeでは、[修正前のEPIPE](../../tests/evidence/step-8-performance-20261001/previous-attempt/step8-bridge-before-fix/vitest.json)とexit=1を再現した。試験assertionが成功してもVitestのunhandled errorでrunはFail。probeはfinallyで元のsource bytesを復元した。[修正後の専用run](../../tests/evidence/step-8-performance-20261001/previous-attempt/step8-bridge-targeted/vitest.json)はPass。

[最終回帰](../../tests/evidence/step-8-performance-20261001/SUMMARY.md)は12項目Pass。通常45件・実PostgreSQL別run20件、Editor43・structured UI2・統合crash4・性能4ケースを確認した。通常runのPostgreSQL専用20件skipは別runで実行済み。外部依存の照合とlocked Cargo check／default feature検査も成功。初回Failを修正後のPassへ書き換えず、性能目安未達とnative／IMEの未検証も別に記録する。
