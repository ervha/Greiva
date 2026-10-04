# Step 9の判定資料案

2026-10-04、v0.6.19追記: [列に沿うdrag表示・同じ列のdrop修正・丸いUI・全58 E2E・Windows build](../../tests/evidence/block-drag-preview-20261004/SUMMARY.md)。利用者が修正版の操作／見た目を確認。online backup4→13更新は元4 blockの純粋な順序変更のみで余分な段落なし、最終H2→H3と試験直前H3→H2の差も記録。旧異常の原因、最新実Microsoft IME／1,000 block連続入力、Gate判断を別条件として保持する。

2026-10-04、v0.6.18追記: 利用者の物理mouse drag／Undoと停止DBを照合し移動・最終復元を補完。ただし最初の移動に空段落1つの増加があり、後の移動は正しい構造。次のdrag表示改善で再確認する。[原履歴](../../tests/evidence/windows-native-profile-20261004/manual-drag-verification.json)。[層別診断](../../tests/evidence/windows-native-profile-20261004/SUMMARY.md)でYjs復元22.8–24.5ms等を測定したが、通常版のcold起動・連続入力・実IMEや性能目安の合格ではない。利用者は応答・手操作可能に復帰した。以下の応答不能時の記述は履歴。

2026-10-04、0.6.17の通常Windows block操作・停止DB監査とdrag配送診断を追加。これは[POC_SPEC](POC_SPEC.md) §15/18に従う提出準備で、正式なGate判定・採用決定ではない。Conditional／Failを承認なしに成功扱いで進めない。

## 判定候補と残る根拠

| Gate | 現時点の案 | 完了前に必要な内容 |
| --- | --- | --- |
| A: Tiptap＋Yjs Editor | 判定保留。通常0.6.17の全block・削除・keyboard移動・物理drag／Undoは補完済み | 最初のdragの空段落増加を新しい表示の回帰でも確認。最新Microsoft IMEの同一段落遠隔composition・1,000 block入力体験。旧自動dragは単純HTML5対照もdrop未配送 |
| B: offline保存・Yjs収束 | Conditional案 | P0保存済み復旧・収束証拠を統合。macOS P1／iOS P2未実施とWindows復元目安未達観測を承認対象として明示 |
| C: structured同期 | Pass案、正式判定はA/Bの扱い決定後 | 全operation／cursor／Conflict evidenceの対応を最終レビュー。1,000操作約76秒のserver応答間とnative ACK commit時間の未分離を記録 |

## 現在の証拠

- [スキップ・未実施の再確認表](SKIPPED_VALIDATION_REVIEW.md): 通常runのPostgreSQL20 skipを旧別実行と現在の20 Passへテスト名で照合。native・Android・性能・実OS不足を補完済みと残条件へ整理。
- [0.6.11 Docker回帰](../../tests/evidence/step-8-structured-progress-20261003/SUMMARY.md): 通常48件／実PostgreSQL別20件、Editor54 E2E、Conflict UI2、統合crash4、性能4。初回typecheck失敗と修正後再検査を保持。
- [Windows操作・offline保存済み復旧](../../tests/evidence/windows-native-ops-20261003/SUMMARY.md): 利用者のMicrosoft通常IME、置換Undo/Redo、H1／Todo／入れ子Toggle。Codexの他block・Mention・移動、Task／Relationのpending保持。全native組合せとはしない。
- [Windows ACK前終了・offline再起動・pull回復](../../tests/evidence/windows-native-network-20261003/SUMMARY.md): actual normal Tauri・停止DB・Rust load・peer／台帳一致。SQLite transaction全中間点のnative注入試験ではない。
- [Windows Conflict](../../tests/evidence/windows-native-conflict-20261003/SUMMARY.md): base/local/remote保持、field merge、draft保持、pointer／Tab・Enterの明示解決、未解決Conflictの強制終了・connected再起動。2解決を新operationとして保存。
- [Android P2](../../tests/evidence/android-pixel7-20261003/SUMMARY.md): Pixel 7 / Android 17 / Chrome 154、26自動操作＋4接続／復元、実Gboard E/F・同一段落composition中遠隔3更新、全文／clock一致。browserにSQLite保存はない。
- [Windows normal release](../../tests/evidence/windows-native-release-20261003/SUMMARY.md): 1,000 block／111文字、1,000 native ACK・250 Task、台帳／receipt1009、独立peer一致。空SQLite上限2.663秒、restore上限3.567秒。helper／起動／UIA込みでcold paintやper-key SLOではない。
- [Windows通常0.6.17](../../tests/evidence/windows-native-editor-20261003/SUMMARY.md): 同一Pageで全11種類、Markdown4条件、Slash、入れ子／解除、Toggle keyboard/pointer開閉、全block削除とUndo/Redo、Mention keyboard移動。59更新とpeer全文／clock一致。元2 Page不変。drop未配送の対照診断とIME provider未確認を別記。

Microsoft IMEの選択後Alt+Tab＋再変換は[利用者の受入例外](../decisions/step-8-ms-ime-exception.md)。原0.6.9 A/B・0.6.5 textarea C/Dの文字欠落Failは保持し、上流バグが独立に証明されたとはしない。この例外を通常変換や別のnative drag失敗へ拡張しない。

## 技術選定の案

Tiptap／Yjs／Hocuspocus／SQLiteと、Task／Relationのoperation log＋cursor＋base/local/remote Conflictという分離は、収集した保存・収束・競合証拠から継続候補とする。採用決定はGate Aの残試験とGate BのConditional判断を終えてから行う。Calendar・AI・ヘルプ等のproduction設計をPoC実装へ追加しない。

Windows runtimeに固有のWebView2設定はDocker browser試験だけでは捕捉できない。修正後のnative証拠を必須とし、採用時の再検査項目へ残す。性能については1,000 journal update decode、1,000 block/handle描画、250 Task描画、WebView起動と観測コストの層別計測が次の調査案で、今回確定した原因ではない。

正式提出は `docs/decisions/gate-a.md`／`gate-b.md`／`gate-c.md` と技術選定結論、受入条件の最終対応表を一緒に作る。各結果をPass／Conditional／Failと証拠・未解決リスク・次の判断で記録する。

## 利用者が応答可能になった時の確認セット

2026-10-04、利用者は以後応答不能で、必要な問題があれば独立作業を先に終え、できる作業がなくなったら記録して待つよう指定した。手操作や承認を時間経過で代替しない。

- A（操作）: 通常0.6.17のWIN611-ALL-OPSで、物理mouseでH3 handleをH2の前へdrag→Ctrl+Z。結果と保存表示を確認。既存Pageの最終順序を元に戻す。
- B（操作）: Microsoft IMEを選択し、通常0.6.17の別fixtureで実日本語変換中に同一段落へ遠隔3更新。1,000 block上の実IME連続入力も確認。Codexはfixture／peerを準備し、実入力だけを利用者に依頼する。ASCII Niになった自動キー試行は合否に使わない。
- C（判断）: A/B証拠を得た後、Gate BのP1 macOS／P2 iOS未検証、Windows復元2秒目安超過の内訳未測定を条件として次段へ進めるか、先に追加環境／層別計測を行うかを判断する。Gate Cの正確性証拠は維持するが、A/Bの未完了を隠して全PoC Passにしない。

通常Greiva・診断Greivaは保存後終了、Computer Useは解除済み。SQLite停止コピー・実行物・fixtureは `.data/windows-drag-0617/` と `.data/host-ime/builds/` に保持する。
