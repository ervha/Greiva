# Step 8: Windows native block dragが移動しない

2026-10-03。通常Windows release 0.6.11でWIN611-ALL-OPS（01a1021e-b82a-7528-aa1f-064c12de483e）のH3行をhandleからH2行の前へドラッグしたが、2回とも順序がH2→H3のままだった。[原観測](../../tests/evidence/windows-native-editor-20261003/observations.json)・[画面](../../tests/evidence/windows-native-editor-20261003/before-drag-fix.jpg)。Computer UseのSendInputによるpointer操作であり、人の物理mouse操作ではない。元のIME失敗fixtureは変更していない。

Docker Chromiumでは同じHTML5 drag実装の既存MOVE／HANDLE試験がPass。Tauriのmain windowで `dragDropEnabled` を指定していなかったため、WebView2のnative file-drop handlerが既定で有効だった。[Tauri公式設定資料](https://v2.tauri.app/reference/config/#windowconfig)はWindowsでfrontend HTML5 drag/dropを使うにはこのhandlerを無効にする必要があると説明している。

製品0.6.17候補はmain windowの `dragDropEnabled: false` を追加。frontendやYjs移動transaction／composition guardを変更していない。candidate overrideも製品window設定を引き継ぎ、修正前と同じ隔離SQLite／Pageへ起動した。[build](../../tests/evidence/windows-native-editor-20261003/build.json)。DockerのMarkdown6件とMOVE／HANDLE2件がPass、外部npm314 entry／Cargo依存は不変。

**修正後のnative移動は未確認**。Computer Useのactivationが `failed to activate captured window` を返し、fresh window選択からの再試行も同じエラーだった。[記録](../../tests/evidence/windows-native-editor-20261003/fix-activation-state.json)・[読み取りだけの画面](../../tests/evidence/windows-native-editor-20261003/fix-activation-state.jpg)。入力を停止・Computer Useを解除し、利用者へH3→H2前へのdragとCtrl+Z復元を依頼した。起動中の0.6.17でこの確認が終わるまで、native修正をPass・Gate Aを完了にしない。

未承認の恒久回避、Windows設定変更、global toolchain追加は行わない。native dragの失敗をkeyboard移動の成功で置き換えない。

## 最新の扱い（2026-10-04）

後続の隔離診断ではEditor2回・独立した単純HTML5対照1回のtrusted dragstart／dragover等を記録したが、dropは全3回で0件だった。[原イベント](../../tests/evidence/windows-native-editor-20261003/diagnostic-events.jsonl)。物理mouse、自動操作層、WebView2、製品の原因を断定できない。下記再試行時点の「配送は未切り分け」「起動状態を保持」は履歴であり、現在は配送観測済み・通常／診断appは保存後終了している。

通常0.6.17の別Pageで全11種類・削除／Undo/Redo・入れ子Toggle・keyboard移動を確認し、停止SQLite59更新とpeer全文／clockが一致した。[通常検証と診断](../../tests/evidence/windows-native-editor-20261003/SUMMARY.md)。この成功をnative drag修正Passにしない。0.6.17は設定と限定検証のcheckpoint、物理drag→Undoは未確認。元WIN611-ALL-OPSと原失敗fixtureは保持し、Computer Use解除済み。[残項目の整理](../plan/SKIPPED_VALIDATION_REVIEW.md)。

2026-10-04、利用者の画面復帰報告を受けComputer Useを再試行。前面化・本文クリックは成功したが、0.6.17で位置変更・本文フォーカスを含めた3回のpointer dragでも順序は変わらなかった。[追加観測](../../tests/evidence/windows-native-editor-20261003/retry-observations.json)・[最終保存画面](../../tests/evidence/windows-native-editor-20261003/retry-final-saved.jpg)。activation不能は解消した一方、移動成功は未確認のまま。設定変更だけで修正済みとはしない。物理mouseとSendInputの違い、dragstart/drop配送は未切り分け。本文・タイトルを変更せず起動状態を保持し、Computer Useを解除した。
