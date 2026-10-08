# Pageタイトル画面の全判断

2026-10-08 / v0.35.0。継続開発・手操作なしの依頼に基づく自主判断。製品回答・本番配備許可の追加ではない。

1. title runtimeの次にworkspace previewへ入力/保存/確認/解決を接続し、通常アプリ入口への昇格を含めない。
2. schema4/7と本文/structured wireを維持する。title表示だけの更新で本文Doc/editorをremountしない。
3. controlled draftを保存済み投影と分け、dirty/composing中にmetadata更新で上書きしない。
4. 保存ボタン/非変換Enterを使い、blur autosaveを追加しない。composition ref/isComposing/229で誤保存を防ぐ。
5. 入力/変換開始時にnavigationを同期的に止め、取消で最新保存値と入力focusへ戻す。
6. 結果不明はコピー可能なreadonly draftと同ID再確認を保持し、新保存/取消/sync/遷移を止める。権限取消はprivate stateを消す。
7. 保存済みpendingはPage移動を許可し、offscreen/再接続後も端末一覧へ独立title pendingを出す。
8. 一覧一頁50件のtitle読取を各limit1へ限定し、await後にcaptured世代を再検査する。
9. unknown baseの編集を止め、明示title確認で本文Page作成を確定してからtitle queryする。known baseで本文syncを暗黙実行しない。
10. 本文変換/保存失敗/同期とtitle draft中はtitle確認を止め、保存先やAuth leaseを切り替えない。
11. 本文同期とtitle確認を別表示にし、query終了からsyncedや全候補解消を推定しない。
12. base/local/remoteを表示し、保存済み候補が外部で解決済みの可能性を明記する。
13. 解決を新operationへ記録し、pending/dirty中は止める。stale/rejectionで候補と入力を保持し、固定文言の履歴を表示する。
14. remote続頁とlocal履歴続頁を分け、各100件のwindowと先頭復帰を提供する。operation/候補のlast keyを独立保持し、一方の終了で先頭へ戻さず、失敗時は進めない。history読取でpendingを消費しない。
15. Page切替/取消時のtitle observer/runtime cleanupを本文と組み合わせ、共有storeをcontrollerだけが閉じる。
16. neutral theme、pointer/keyboard、mobile dark/reduced-motion、focus/selectionとsynthetic compositionをDocker E2Eで確認する。実IMEに代用しない。
17. UI double、actual Rust SQLite runtime、実PG/署名fixtureを別証拠にする。初回型検査の失敗と修正後Passを分けて残す。
18. owned版/locks、外部依存、source一致、関連回帰/build/証拠を確認し、版付きcommit/annotated tag/指定remote pushと短い再開メモの更新まで完了する。

[画面契約](../development/PRIVATE_PAGE_TITLE_SCREEN.md)、[証拠](../../tests/evidence/private-title-screen-20261008/SUMMARY.md)、[判断索引](../plan/AUTONOMOUS_DECISIONS.md)。
