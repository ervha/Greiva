# Step 8: Todo配置の修正と限定的な実機操作

2026-10-01、担当Codex。修正ソース・反映済みpreviewと修正確認は0.6.5、修正前のnative操作とrelease artifactは0.6.4。[判断](../../../docs/decisions/step-8-todo-layout.md)。

## Dockerの修正と回帰

Tiptapの実DOMに一致しないtaskItem属性セレクターをtaskList直下のliへ修正した。完了の取り消し線は元から動作し、変更していない。

| 確認 | 結果・証拠 |
| --- | --- |
| 新しい実位置・pointer編集検査を元のCSSへ実行 | 期待したFail。[JSON](before/playwright.json)、[JUnit](before/playwright.xml)。本文x=163がcheckbox右端180より左 |
| 修正後の同じ検査 | Pass。[JSON](fixed/playwright.json)、[JUnit](fixed/playwright.xml) |
| Build・型・通常試験・全E2E・locked/offline Tauri check | 5項目Pass。[条件・時刻](summary.json)、BUILD/TYPES/UNIT-INTEGRATION/EDITOR-E2E/DESKTOP-CHECKのraw log |
| 全E2E | 45件Pass、skip/flakyなし。[JSON](playwright.json)、[JUnit](playwright.xml) |
| hostと試験sourceの一致 | 130ファイル。[inventory](source-files.json)、[hash確認](source-verification.json) |

source SHA-256: `c0f39a8a19274ef4150c4c770189fce4b927e21befb9c542bb24402975846205`。通常試験45件Pass、実DB専用20件skip。今回PostgreSQL専用run・統合crash・性能は再実行しておらず、[0.6.4の別証拠](../step-8-editor-performance-20261001/SUMMARY.md)と区別する。全Gateや最新nativeのPassではない。

## Windows 0.6.4の実操作

[起動情報](native-0.6.4/launch.json)、[時刻・accessibility記録](native-0.6.4/operations.json)。専用Page `01a0f723-8015-71d9-9445-0579cfef41a3`をUIから作成。0.6.4 debug shellの通常production frontendとproject内の専用SQLiteを使用しhost toolchain追加なし。

- SlashのDown・Enterで見出し1、段落入力、単語選択置換とUndo/Redo、保存・同期表示を観察。
- Toggleの内側へEnterで移動し入力、Ctrl+Enterで[閉じる](native-0.6.4/toggle-collapsed.png)、pointerで[再展開・本文保持](native-0.6.4/toggle-opened.png)。
- Todo入力・チェックと修正前の[別行配置・正常な取り消し線](native-0.6.4/todo-before.png)。最初のpointer入力は末尾の通常段落に入り、UpでTodo内へ移動して入力先を確認した。
- 実キー`n i h o n g o`の[未確定入力](native-0.6.4/ime-preedit-1.png)、Spaceの変換・次候補、Upで前候補、Returnで[確定](native-0.6.4/ime-committed.png)、Undoで除去・Redoで復元して[選択](native-0.6.4/ime-selected-after-redo.png)。literal Unicodeで代替していない。

利用者はGoogle日本語入力を使うと回答したが、Provider名の独立した画面証拠はない。利用者入力を検出した途中の試行は合否に数えず、空段落を再観察して実キー列を開始した。Microsoft IME、再変換、同一段落remote重複、native全操作・強制終了・peer全状態比較・SQLite全commitの独立監査は未検証。保存表示の観察と完全復元の検証を区別する。

## 修正後の0.6.5 Windows候補

[Docker build](windows-build-0.6.5/build.json)、[host照合](windows-build-0.6.5/host-artifact.json)。修正ソース130ファイルのhashは上記回帰と同じ。normal production frontendを埋め込むdebug候補、storeのcrash-test-hooksなし。ProductVersion 0.6.5、18,558,464 bytes、SHA-256 `b3f09fbaad951d76f657550bdeec017cca474fd939fdc701700d2e8cfe655863`。

利用者の実機自動操作再開許可を受け、0.6.4を通常終了し、同じproject内SQLiteと新しいWebView cacheで0.6.5を[起動](native-0.6.5/launch.json)した。[終了前](native-0.6.5/before-upgrade.json)と[再開後の操作](native-0.6.5/operations.json)に試験Pageの見出し・段落・Toggle内本文・Todo・確定済み日本語が見える。これは通常再起動時の表示確認であり、強制終了や完全なDB状態比較ではない。

Todoの[同じ行の配置](native-0.6.5/todo-fixed.png)、pointerで[チェック解除](native-0.6.5/todo-unchecked.png)、本文クリック・End・literal suffixの[同じTodo内への入力](native-0.6.5/todo-edited.png)、[再チェックと取り消し線](native-0.6.5/todo-checked-after-edit.png)をWindowsで観察した。隣の段落と日本語は保持されている。最新native全操作・Microsoft IME・remote composition・強制終了のPassには読み替えない。

## 反映済みDocker preview

[実行中source照合と1420/3000/1234の200応答](deployment.json)、[image・loopback ports・init・no-new-privileges](runtime.json)。実行中130ファイルのhashは上記修正後回帰と一致する。Dockerの反映結果とWindowsの証拠は分けて記録する。

## 0.6.4 releaseの準備

[Docker build](release-0.6.4/build.json)、[host照合](release-0.6.4/host-artifact.json)。source SHA-256は0.6.4の`668dbab5744083b681f91a83cf4fe954bcfeaa0c280ebf47deddcc85639d0be3`、130ファイル。normal frontend、custom-protocol、storeにcrash-test-hooksなし。warningはraw logに保持。0.6.5 artifactではない。

ProductVersion 0.6.4、13,092,864 bytes、SHA-256 `3ea6e65c998768daf9d32eb15d5f0169deb8377b8da73268f918cda0954fe3e5`。exeはGit対象外。起動・空DB隔離・性能、P1/P2実OSとGate A/B/Cは未検証／未判定。
