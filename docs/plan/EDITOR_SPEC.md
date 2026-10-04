# Editorの本番引継ぎ候補

2026-10-05、設計案。[共通UI品質](../development/ui-quality.md)、[CRDT契約](CRDT_SPEC.md)、[既存Gate](../decisions/gate-a.md)を引き継ぐ。

初期Pageは見出し/paragraph/list/Todo/quote/code/divider/toggle、Slash、Mention、Markdown shortcut、Undo/Redo、keyboard/pointer並び替えを基準にする。現PoCの再現fixtureとschemaを移行時に保持する。基本DBはTable/Listから別段階で提供し、未実装viewを完成表示しない。

## 入力と位置の保持

compositionを文書外UIのrerender、同期、保存表示、候補/toolbar操作で終了させない。候補確定Enterとblock操作Enterを区別し、IME key229を通常shortcutへ通さない。remote update/復帰/UndoRedoの後もanchor/headと向きを保持する。位置保存はcomposition/構造変更/DOM外selectionを検査する。

toolbar/候補/drag handleはpointerでもkeyboardでも使え、focus-visibleを示す。ドラッグは列と幅を保った持つ行・周囲の移動で表現し、handle列のままdropできる。本文外/remote構造変更/Escape/compositionの取消を定義する。行を不可視にしてnative選択を壊さない。

## 見た目とモバイル

semantic色/余白/corner/shadow/motionを共通tokenへ整理し、読みやすさ、contrast、reduced motion、文字拡大を維持する。ガラス表現は局所に留め、候補・本文を読める背景を持つ。入力の反応をanimation完了待ちにしない。

Androidはkeyboard表示中のviewport、selection handle、長押しmenu、scroll、Back、background/resumeを実機で検査する。desktop handle/toolbarを縮小して置くだけにしない。共有が初期UIにない場合も自分の別端末更新とIMEが共存する。

## 性能と回帰

大量Pageのstatus更新で不要な全Editor/Task描画を避け、内部状態/タイトル/権限/保存エラーは反映する。block全走査・移動transactionの生成を可否表示だけで行わない。geometry/handleの測定とDOM変更を分け、可変高さ/Toggle/Todoで検査する。

restoreはprocess起動/WebView準備/local query/Yjs/Editor/編集応答を分け、frame機会とpresentationを混同しない。連続入力、paste、実日本語変換を別workloadにする。文字欠落/二重入力、保存全文/clock、他block不変を必ず性能測定と併せて照合する。

最新通常releaseの実MS IME/物理drag/連続入力、Android Gboard composition中reconnect、app kill/keyboard/network switchingを提供前に行う。0.6.19/0.6.20の人的結果や0.6.25診断を最新全条件のPassへ付け替えない。
