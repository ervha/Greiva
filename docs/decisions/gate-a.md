# Gate A: Editor viability — Pass（受入例外あり）

2026-10-04、判定checkpoint v0.6.23。製品0.6.20。既存の明示受入例外を適用した範囲でPass。全IME操作の無条件合格ではない。[PoC仕様](../plan/POC_SPEC.md) §5.3／13／15を適用する。

## 確認済み

- [Windows通常0.6.17](../../tests/evidence/windows-native-editor-20261003/SUMMARY.md): 必須11種類、Slash／Mention／Markdown、追加・削除・入れ子・解除・keyboard移動・Undo/Redo、保存59更新とpeer全文／clock一致。
- [Windows0.6.19物理dragと保存監査](../../tests/evidence/block-drag-preview-20261004/SUMMARY.md): 利用者が修正版のハンドル列移動・Undo・見た目を確認。4→13更新は元4 blockの順序変更のみ。最終順序と試験直前の差も明記。
- [Windows0.6.20 Microsoft IME](../../tests/evidence/windows-ms-ime-20261004/SUMMARY.md): 利用者がproviderを切替、Codexが実キー通常変換・同一段落への遠隔3更新中の変換を代行。未確定文字保持、確定後の全文／構造／clock／SQLite30更新を照合。残る998段落不変。
- [Windows0.6.11の選択置換・Undo/RedoとH1／Todo／Toggle](../../tests/evidence/windows-native-ops-20261003/SUMMARY.md): 利用者による実Microsoft IME確認と保存監査。最新版の全IME組合せへ一般化しない。
- [0.6.20 Docker全59 E2E](../../tests/evidence/block-drag-large-20261004/SUMMARY.md): 選択／focus／remote／block操作と1,000 block drag／Undo・全文／clock一致。native IMEや物理mouseの代替ではない。

## 例外と残条件

選択後Alt+Tab＋Microsoft再変換の文字欠落Failは、[利用者の受入例外](step-8-ms-ime-exception.md)。原FailをPassに変えず、上流バグが独立に証明されたとも扱わない。通常変換や遠隔compositionに例外を拡張しない。

1,000 block上の実Microsoft IME連続入力について利用者は「問題なく入力できました」と回答。[保存監査](../../tests/evidence/poc-gate-review-20261004/SUMMARY.md)は30→76更新、24 UTF-16単位の追加、他999段落不変、全1,000段落とpeer全文／clock一致。短い体感確認として採用し、長時間入力やnative per-key／frame SLOへ一般化しない。

0.6.20のComputer Use native drag追加試行は移動なし、更新数30のまま。0.6.19の物理確認を保持し、helper／製品の原因を断定しない。旧0.6.17の最初の余分な空段落も原因未確定として残す。現在の新drag回帰／保存監査に同じ増加はない。

## 判断と次の検証

2026-10-04の自律判断委任に基づき、必須block／通常・遠隔composition／保存と短い連続入力の証拠を統合しPassと確定。[判断全件](poc-autonomous-review.md)。再変換原Failと旧drag異常は残し、再報告時は再現・影響を調査する。
