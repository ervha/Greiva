# Step 8: 入力時のハンドル再生成の改善

2026-10-01、v0.6.4。PoC Section 13／18 Step 8の1,000 block連続入力を改善する。保存保証・同期順序・Undo・IMEの契約とPoC範囲は維持する。

## 観測と変更

v0.6.3の[性能測定](../../tests/evidence/step-8-performance-20261001/SUMMARY.md)で入力・frame・保存ACKの待ちを観測した。追加のCDP CPU samplingでは実キー入力中のProseMirror DOM更新、widget作成／破棄、座標計算が目立ち、`block-drag.ts`が各transactionでkeyのない全widgetを作り直していた。生成コードとsource mapを照合して元コードへ対応させた。samplingはnative layout／待ち時間すべてを分解するものではなく、保存待ちの原因が一つとする証明にはしない。

各ハンドルは「現在の何番目のブロックか」を表すwidgetとしてkeyを持ち、通常の入力ではProseMirrorがDOMを保持する。再利用したDOMのlistenerへ作成時のposition／nodeを閉じ込めず、dragstart時に`getPos()`と現在のdocumentから位置と本文を読む。blockの移動・挿入・削除では番号表示を現構造へ対応させ、drag中にdocumentが変われば既存の中止規則を維持する。mousedown取消やcompositionの先行確定を追加しない。

## 正確性と試験の意味

新しい実操作E2Eは、先頭と最後の本文を編集した後の全ハンドルDOM保持、現在のdrag payload、実pointer移動とUndo/Redoを確認する。元の実装ではDOM保持がFail。keyだけ追加し作成時の位置を使うfault probeでは「third edited」を要求するpayloadが「second」となりFail。固定sourceはDocker内で一時的に切り替え、finallyで復元してbyte照合する。どちらのFailも試験が退行を検出できる証拠として保持する。

[最終回帰](../../tests/evidence/step-8-editor-performance-20261001/SUMMARY.md)は12項目Pass。通常45件／PostgreSQL別run20件、Editor44、structured UI2、統合crash4、性能4ケースを確認した。1,000 block／104文字の実入力後に1,000個すべてのhandle DOMが保持され、本文・構造・Yjs clocksと全commit journalの復元が一致する。保存層と同期規則の変更はない。

## 時間の観測と限界

最終runのkeydown→commit ACKはp95 106.7ms、最大176.2ms。keydown→次のframe機会はp95 48.0ms、最大106.3ms。1,000 block復元の3 sampleは387.58／387.74／417.46msだった。v0.6.3最終runのp95 961.7ms／最大1,319.4msや復元最大2,472.85msから短縮を観測したが、別run間のhost負荷とcacheは固定していない。1,000 Task同期の時間変化を今回のEditor変更の効果と断定しない。

production frontend／release Rustの試験専用HTTP bridgeによる数値であり、Windows native IPC、実際のpaint完了、Microsoft IME、Windows release起動の達成値へ読み替えない。安定性・native全操作・最新候補IME、P1/P2実OSとGate A/B/Cは残る。性能観測だけで全GateのPassや技術選定結論を出さない。

[ハンドルだけの追加比較](../../tests/evidence/step-8-editor-performance-20261001/handle-comparison.json)では、同じ0.6.4の試験・release Rust・production bundle設定で`block-drag.ts`だけを変更前／修正版へ切り替えた。baselineでも全本文・構造・clock・保存差分の一致を要求し、ハンドル保持のassertionだけは両runで外して観測した。各一回で保持0→1,000、keydown→commit ACKのp95 294.4→126.3ms、keydown→frameのp95 67.3→38.5msを観測した。host負荷、順序とcacheは未固定で、比較中には別containerのcache snapshot作成も行われていたため、短縮率を性能保証にしない。診断scriptのleaf suite集計エラーは試験完了後に修正し、成功したbaselineを再実行せずraw reportから検証して後続測定を続けた。両run後のapp／test／runner bytesが正規sourceへ戻ったことを照合した。
