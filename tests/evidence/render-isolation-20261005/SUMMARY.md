# 描画の分離・選択とdrag受入・Windows再起動 — v0.6.25

2026-10-05（JST）。大量入力の不要描画を削減し、回帰で再現したnative選択の反映待ちとgutter dropの受入を修正した。PoC性能/復旧の補強で、新しい製品機能・保存方式・同期契約を追加しない。[全判断](../../../docs/decisions/step-8-render-isolation.md)、[今後の計画](../../../docs/plan/NEXT_DEVELOPMENT_PLAN.md)。

## 実装と比較

PageEditor/TaskPanelをReactの通常の`memo`で囲み、同じpropsの保存/通信報告で再描画しない。独自の比較関数はなく、Editor/フォーム/engineの内部状態とタイトル・接続propsは引き続き更新される。[再現controller](../../../scripts/test-render-isolation.mjs)はDockerの2 sourceへ一時counterを入れ、必ず元byte列へ復元する。[最終比較](render-comparison.json)、[復元hash](render-source-restored.json)。

1,000段落・250 Task・21 ASCIIキー（warmup1＋測定20）で、最終runのPageEditor/TaskPanel追加呼出はmemoなし各**78**、memoあり各**0**。タイトル変更で双方各2、Task下書き変更でTaskPanelがさらに2増え、本文・下書き・250操作の保存を保持した。最初の別runはmemoなし各80であり、数字を最終runへ移さない。React Strict Modeのdevelopment呼出数で、production FPS/実IMEの改善率ではない。

## 回帰で発見した2条件

- **選択反映待ち:** 初回fullは58 Pass/1 Fail（peerのHome後offset14）、別focused runはRedoで1 Fail/2 Pass。memoを外した比較でも1 Fail/5 Pass（Home後offset3）、memoありも1 Fail/5 Pass。keyupでDOMが0へ動いた後、selectionchange時に3へ戻る[記録](focus-failure-events.json)。composition/focus/NodeSelection/範囲を守り、Home/End/Arrowのkeyupでnative DOM選択をpublic ProseMirror APIへ同期する。入力文字やIME key229のkeyupには介入しない。どの上流処理が最初の戻しを発生させたかは独立確定していない。修正後の同条件6/6、関連選択/Undo/Redo全回帰Pass。
- **gutter drop:** 修正前fullの別runは58 Pass/1 Fail。memoなし比較1 Pass/5 Fail、memoありもFail。[記録](drag-failure-events.json)はdragoverで範囲内でもdropなしでdragendとなった。所有dragのdragenterにも既存の受入処理を登録した試験6/6、最終source6/6。HTML drag target受入との関係は[WHATWGの説明](https://html.spec.whatwg.org/dev/dnd.html)に沿う。Windows物理mouseの最新追加合格とは呼ばない。

初回失敗と対照ログを保持し、再実行の成功だけで修正を主張しない。全E2Eの期待・回数・timeoutは緩めていない。Docker内で診断sourceを順に比較し、終了後にsourceを復元した。

## 最終検証

| 確認 | 結果 |
| --- | --- |
| 型、unit/integration | Pass、55 Pass/実DB専用20 skip。新しいnative選択guard5件を含む |
| 全Editor/同期/保存E2E | 59 Pass、Fail/flaky/skip 0 |
| 実PostgreSQL/HTTP/Conflict UI | 2 Pass、専用schemaをcleanup |
| production bundle＋release Rust、1,000 block/104実ASCII文字 | Pass、全文/構造/clock/保存journalを照合 |
| 通常frontend/Windows release build | Pass、normal storeにcrash hooksなし、temporary描画/drag/focus診断probeなし |
| 版/外部依存 | 所有manifest/lock 0.6.25、外部npm314 entry/Cargo依存不変 |
| Windows保存層CLI | [実OS4条件Pass](../windows-store-boundaries-20261005/SUMMARY.md)、通常UIと区別 |

原logとcompressed Playwright reportを同directoryに保持。通常skip20件を今回実行したとはしない。Rust repository、API、protocol、sync実装は変更していない。

公開前の[照合](final-review.json)では、最終buildの全126 sourceのhost/Docker hash、実exeのbyte数/hash、診断source復元、圧縮reportの件数、Windows DB/peer一致、関連Markdownの320リンクを確認した。

準備時に同じcontainerでfocused E2Eとstructured E2Eを並行起動したため、後者はport1420使用中で起動できなかった。[原log](initial-structured-port-conflict.log)を残し、以後同じportを使う検証を直列化。最終の実同期2件は別schemaで完了した。新unitの初回型検査はNodeNext import拡張子不足で停止し、`.js`参照へ訂正後に型/55件を再検証した。

## 性能の限界

[metrics](performance-metrics.json)。1,000 block、1,001初期journal、復元3 sample **555.8–565.5ms**、keydown→frame機会p95 **35.2ms**/max65.5ms、**input event→commit ACK** p95 **137.1ms**/max227.6ms。bridge/Chromium測定で、native IPC/IME/実paint/通常Windows cold restoreではない。

前の別runに対し、復元とframeは悪化した観測も残す。対照を揃えたend-to-endの性能比較はないため、描画呼出削減を入力全体の速度保証へ換算しない。v0.6.24のACK起点表記も原`inputToCommitAckMs`へ訂正し、旧数値/runは維持する。

## 通常WindowsとSQLite/peer照合

最終[build](native-build.json)は0.6.25、隔離identifier `dev.greiva.poc.validation625`と試験Page URLだけをconfig override。13,095,424 bytes、SHA-256 `e09ac644d9b7c1b3971e223fa0d46a52afbd2235f978d4f76b72ec2d519dbbad`。test frontend flags0、通常store features。前のmemoだけのcandidateは別[build](native-interim-build.json)/[audit](native-interim-audit.json)として保持する。

準備時のSQLite本体だけのcopyはWAL内の119 Taskを欠き、初回は131 Taskだった。既存利用者DBを触らず、試験用アプリを保存/終了し、実Rustで欠けた119 synthetic Taskだけを補完。元Pageは保持して両profileを250 pendingへ揃えた。[準備訂正](fixture-repair.json)。元fixture/初回backupは.dataに保持し、seed exportもonline backupへ訂正した。

memo candidateで末尾ASCII x入力後も[Task下書きを保持](native-draft-preserved.png)。Pageタイトル末尾xがRelation表示へ反映された。最終candidateでは1,000段落・250 Taskを復元し、Home→Shift+Endの選択が`WIN625 local x`であることを観測後、実キーz置換→Ctrl+Z→Ctrl+Y→Ctrl+Z。[最終Undo画面](native-final-undo.png)、[観測](native-observation.json)。

保存ラベル観測→Alt+F4→process不在→read-only接続のSQLite online backupを取得。さらに同じ最終exeを再起動し、[UI復元](native-reopened.png)/[観測](native-reopen-observation.json)後、編集せず保存確認/終了し、Computer Useをreset。[全DB照合](native-final-audit.json)は7更新でz/元本文/z/元本文の履歴、全1,000段落・他998段落保持、Task/pending250、再起動前後の全table一致。独立した既存Page serviceの[peer](native-peer-audit.json)が全文とclockに一致する。structured APIは試験serviceの503応答で、250 pendingを「server同期済み」としていない。

`audit-native.mjs`を再実行する場合は、同directoryの`completed-seed-1.json.gz`、`final-closed-1.json.gz`、`reopened-closed-1.json.gz`をDockerの`/tmp/render625-native-audit/`へ展開する。これらは今回作成したsynthetic fixtureの全table exportで、利用者の旧Pageや自由入力を含まない。

最新の実日本語/provider、物理drag、native連続入力性能をこのASCII確認へ含めない。既存の0.6.20 Microsoft/0.6.19物理mouse証拠は当時の版のまま保持する。

## 残る環境・判断

[現在の再確認](platform-recheck.json): iOS simulatorはmacOS/Xcodeがなく不可、Pixel_10のdevice_openは起動Fail、ADB接続0台。Pixel 7実機/最新版Gboardの追加試験は未実施。SDK/global toolchainやOS設定を変更しない。

通常Windowsの性能、最新実MS IME/物理drag、利用可能なmacOS/iOS/Android実環境の検証を残す。[既存Gate結論](../../../docs/decisions/poc-autonomous-review.md)は製品0.6.20の歴史的判定で、本更新で全OS/最新版の無条件Passへ上げない。製品化の初期範囲/順序は計画案として整理し、新機能の恒久実装を開始しない。
