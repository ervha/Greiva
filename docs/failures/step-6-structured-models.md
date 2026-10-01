# Step 6で検出した問題と修正

2026-10-01。

- 初回client build: Tauri `invoke`へ汎用`object`を渡してstrict型検証に失敗した。固定commandの引数を`Record<string, unknown>`へ修正した。再build/typecheckは成功。
- 初回全E2E: Taskの状態selectをlabelの完全一致で特定できず、41件Pass・新規1件Failとなった。selectのaccessible nameを`Taskの状態`と明示した。[初回結果](../../tests/evidence/step-6-structured-models-20261001/previous-attempt/summary.json)。
- 重点E2E: 保存中に名前inputをdisableし、ReactのDOM更新前にfocusを戻したため、保存後の継続入力でfocusが失われた。保存中はread-onlyとし、成功後のfocusをDOM更新後のeffectで戻す。修正後に同試験は成功し、最終全43 E2Eも成功。[失敗記録](../../tests/evidence/step-6-structured-models-20261001/focus-failure/e2e.log)。
- Windows実機: 0.4.0候補の起動とaccessibility treeは取得できたが、window activationは`GetCursorPos failed: アクセスが拒否されました。 (0x80070005)`で失敗した。windowを再選択して1回再試行しても同じ。画面は操作の合格証拠に使えず、入力やTask登録を行っていない。原因をWindowsのロック等と断定せず、[独立の未検証記録](../../tests/evidence/step-6-native-local-20261001/SUMMARY.md)を残した。Dockerの結果を実機へ流用しない。

Cargo lock生成時に無関係なtransitive dependencyの更新が候補に含まれたため採用せず、既存固定版を維持してアプリ版と直接追加した`serde_json`のedgeのみ更新した。最終locked checkとWindows cross buildは成功。
