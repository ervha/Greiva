# 1,000ブロックのdrag表示更新（0.6.20）

2026-10-04。製品の0.6.19 checkpoint `4c9df18c0b267ea4fad057a83ba3515b737b3fbe`を基準に、移動しない行への個別transform生成を省略するPATCH。文書／移動transaction／保存／composition処理は変更しない。移動先から戻る行にも共通transitionを適用し、reduced motionでは無効にする。

## 実操作と比較条件

Docker Chromium、1280×1000 viewport、開発frontend・試験用実Rust SQLite bridge。Hocuspocusの独立peerで1,000段落を用意し、実mouseのHTML5 dragをハンドル列のまま行い、全1,000行の順序を検査。Ctrl+Zで全行復元し、peerの全本文とstate vectorまで一致を確認する。新しい試験用Pageだけを使用し、Windowsで開いたままのWIN619-DRAGや既存のIME失敗データは変更しない。

最初のfixtureはserverの共有空段落を置換せず追加し、1,001行で試験失敗した。[原結果](fixture-failure.json)。peerの同期後、同じtransaction内で既存seedを置換して正確な1,000行を作るよう修正。製品のdragによる空行増加ではない。

| 観測 | 0.6.19基準 | 疎なスタイル更新 |
| --- | --- | --- |
| dragstart→2回requestAnimationFrame | 518.2ms | 16.8ms |
| dragover→2回requestAnimationFrame | 15.4–295.2ms | 12.4–51.1ms |
| 50ms超のLong Task | 5回、196–311ms | 0回 |

[基準の原timing](baseline-timing.json)・[変更後の原timing](sparse-timing.json)、各[基準run](baseline.json)・[変更後5条件run](sparse.json)。両方とも移動とUndoの全文検査がPass。各1回の診断で、同時にframe callbackが複数待機する場合もある。実FPS、実paint、Windows releaseのSLOや実IMEの合格には換算しない。原JSONの`dispatch`はwindow captureのmicrotaskまでの時間で、後続handler全体の処理時間ではないため比較に使用せず、最終試験ではこの誤解を招く指標を削除した。

## 最終確認

[controller](verify.mjs)・[結果と99ソースhash](verification.json)・[型](TYPECHECK.log)・[unit](UNIT.log)・[E2E](E2E.log)、[Playwright JSON](playwright.json)／[JUnit](playwright.xml)。型、通常48 unit/integration、全59 E2EがPass。通常runの実PostgreSQL専用20件はskipのままで、以前の別実DB20 Passを保持する。API/schema変更はない。

最終runの[1,000行timing](final-timing.json)は2 workersの全体回帰条件。dragstart→2rAF80.1ms、dragover9.5–89.4ms、gesture中のLong Taskは3回（67–82ms）。Undo／照合中に別の2回（73／101ms）も記録。単独試験の0回をすべての負荷条件へ一般化しない。source tarの初回展開はcontainerの既存file所有権により失敗し、rootでの上書き展開後に99ファイルのbyte hash照合を通してから検査した。既存の試験用Rust driverは再利用しており、このrunの0.6.20 Windows binaryとは別の実行物。

[通常build controller](build.mjs)・[build metadata](build.json)・[frontend build](BUILD.log)・[release cross-build](RELEASE-CROSS.log)。frontend test flags=0、crash-test-hooksなし、main window dragDropEnabled=false。配置を分離するidentifierと初期Pageのみのconfig override。exeは13,094,912 bytes、SHA256 `8dc52aa61302777a41b927de599cbd4239592894e16e61ca68329b1ad5b8d115`。hostにtoolchainを追加していない。

[版監査](version-audit.json)でapp所有manifest/lockfileを0.6.20へ整合し、外部npm314 entryとCargo依存不変を確認。通常Windows 0.6.20の起動・実IMEはこのrunでは未実施。0.6.19の利用者による物理drag／Undo・見た目確認は[別の証拠](../block-drag-preview-20261004/SUMMARY.md)。実Microsoft IME、1,000 blockでの日本語連続入力、P1/P2環境不足と正式Gateの残条件を維持する。
