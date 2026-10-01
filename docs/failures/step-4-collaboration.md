# Step 4の初期試験と修正

2026-10-01、Docker内の初回Chromium E2Eは29/37 Pass、8 Fail。[初回JSON](../../tests/evidence/step-4-collaboration-20261001/previous-attempt/playwright.json)を保存した。初回の型チェックではY.Doc引数がDOMのdocument名を隠す不備、試験配列のundefinedチェック不足を修正した。

実装不備: Yjs Undoの時間captureにより、素早いTodoチェック・移動・入れ子作成を直前の本文編集と一緒に取り消した。構造・選択・移動の履歴境界を追加し、既存Todo/Drag/Toggleの期待結果を維持した。Toggle本文の移動が親Toggle単位に限定されていたため、最も近いdetailsContent内の兄弟移動に対応した。

試験不備: decoration widgetが段落の前にあり`:first-child`/`:nth-child`が対象を誤った。NodeViewのTodo liに`data-type`がなく、Toggle summaryにも中間ラッパーがあった。実際の描画構造とaccessible controlsに合わせた。クリック/ネイティブ選択変更直後はProseMirrorのselection更新がまだ反映されない場合があり、次のキーが別の範囲へ作用した。読取り専用selection診断で操作対象と範囲を待ってから削除・追記する。独立client contextと前面化も明示した。待機条件の修正後、offline追加・削除・再接続は3/3回成功した。

画面の文字が一致するだけの試験へ緩和していない。最終試験もYjs clock map、本文JSON、fragment、pending 0の比較を要する。実機IMEの未確定入力に対する成功は、この合成ブラウザ試験から推定しない。
