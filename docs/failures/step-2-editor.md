# Step 2 Editor: Docker E2Eで発見した不具合（修正済み）

環境: Docker Linux、Node 24.19.0、Tiptap 3.31.3、Playwright 1.63.0 Chromium。初回runは21/23件成功、次のrunは22/23件成功、最終runは23/23件成功。[最終証拠](../../tests/evidence/step-2-docker-20260930/SUMMARY.md)、[履歴修正前の失敗・trace](../../tests/evidence/step-2-docker-20260930/previous-attempt/SUMMARY.md)。

## Dragが開始しない

再現: first/second/thirdを入力し、3番目のhandleを1番目の行へdragする。期待はthird/first/second、初回結果は順序不変。

原因: handleのmousedownでpreventDefaultを呼び、ブラウザのnative drag開始まで抑止していた。widgetのstopEventがProseMirrorの選択変更を防ぐため、mousedownのキャンセルを削除した。実dragのE2Eが成功した。

## composition Enterが消費される

再現: Slash候補表示中にisComposing=trueのEnterイベントを送信。期待はpreventDefaultされず候補が維持されること。候補UI自身は拒否していたが、後続のProseMirror keymapがEnterを消費した。

修正: editorPropsのhandleDOMEventsでisComposing/view.composing/keyCode=229のkeydownをProseMirror keymapへ渡さず、native IMEのdefault handlingはキャンセルしない。合成イベント試験は成功したが、Microsoft IMEの実入力・変換・再変換の証拠ではない。

## 移動のUndoが直前入力も取り消す

再現: 3段落の入力直後にdragし、Undoを1回実行。期待は元の3段落の順序へ戻ること。結果は空段落まで戻った。

原因: 移動transactionが直前入力と同じhistory eventへまとめられた。moveTopLevelBlockでcloseHistoryを呼び、各移動を独立したeventにした。直前入力・移動・Undo/Redoの境界をunit試験で検証し、drag/Undo/keyboard移動のE2Eも成功した。

## 試験コマンドの補足

部分再試験でplaywrightを直接起動した際、compiled serverのbuildを抜かしたためAPIのdist/main.js不足で起動に失敗した。正しい部分再試験は`npm run test:e2e -- --grep STEP2-MOVE`。これは試験起動手順の誤りであり、Editor不具合の再発とは扱わない。
