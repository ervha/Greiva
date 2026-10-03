# Step 8: 遠隔の文字編集後に選択が別の文字へ移る

2026-10-03。Docker Chromiumと実Hocuspocus／Rust SQLite bridgeで再現し、0.6.9候補へ限定修正を追加した。Windows候補のnative回帰は別に記録する。Microsoft IMEの再変換対象拡大とは別の不備であり、[IME未解決記録](step-8-ms-ime-reconversion.md)を解消扱いにしない。

## 発生条件と原因

通常製品0.6.5の見出し2／Toggle summaryで `MS65 local 日本語` の日本語3文字を前方向または後方向に選択する。タイトルへfocusを移し、独立clientから同じblockの先頭に `R1 `、`R2 `、`R3 ` を追加する。本文へ戻ると選択が `65 ` になる。本文自体はまだ失われていないが、次の置換・削除で意図しない文字を変更する。

初回9ケースのうち見出しとToggleの4ケースがこの不備でFailした。Todoの2ケースは試験の文字数計算が非表示のcheckbox説明まで数えたことによる測定不備であり、製品の不備として数えない。段落2ケースと繰り返す再接続1ケースはPass。

editable blockだけを測る診断比較では、遠隔更新後・focus復帰前からPM選択のoffsetが11のままで、復帰後のDOM選択も11〜14だった。期待する日本語は20〜23へ移っていた。TodoではPM／DOMとも20〜23へ追従した。[原証拠](../../tests/evidence/step-8-focus-20261003/SUMMARY.md)。

固定した `@tiptap/y-tiptap 3.0.9` の `restoreRelativeSelection` は、旧／新blockの本文が異なると `recoverSelectionEndpoint` の構造変更用fallbackを使う。固有のblock型を旧offsetで探す経路が、文字挿入だけの場合にも有効なYjs相対位置を上書きする。依存のソースを調べた推論と、Greivaの再現結果を対応付けた。全依存環境や全blockで同じとは一般化しない。

## 検討した対策

| 案 | 利点 | 制約・判断 |
| --- | --- | --- |
| A: 文書構造が同じ遠隔文字編集だけ、前のview stateのYjs相対bookmarkから選択を補正 | schema／同期／データを変えず、前後両方向と挿入・削除を扱える | 採用候補。既存の構造変更fallback・local Undo/Redoには介入せず、composition中も処理しない。固定版APIで限定検証する |
| B: 依存へ再現資料を用意し、修正版が存在する場合に版変更を比較 | 根本処理を依存側で直せる | 対応版と全回帰は未確認。推測で依存を更新しない。上流への送信は今回行わない |
| C: 依存のコードを再現可能なpatchとして保持する | 誤ったfallback経路を直接限定できる | 配布物・patch適用・保守の負担が増えるため今回未採用。node_modulesへの一時変更で製品修正済みとしない |

## 限定修正と検証範囲

`CollaborationSelection` extensionが公開されているYjs相対位置APIでbookmarkを取り、同じ文書構造の遠隔文字編集後だけ選択transactionを追加する。本文の補完・巻き戻し、focus強制、DOM selection方向反転、event取消、同期停止は行わない。bookmarkが旧選択と対応しない場合、非TextSelection、local Undo/Redo、構造／属性変更、composition中はbindingの処理を維持する。補正transactionは履歴対象外。

追加E2Eは段落・見出し2・Todo・Toggle summary×前後両方向の8ケースで、blur中の3回挿入と1回削除、復帰時の範囲・方向、置換・local Undo/Redo、独立clientの全文・構造・clock一致を検証する。再接続の1ケースは4回の両端末offline編集・交互再接続・markerの一件性・fresh client復元を確認する。実際のキー選択を使うが、日本語fixtureはliteral文字列でありnative IME試験ではない。

初期の修正確認で接続5秒待ち、focus直後の未確定snapshot、peerのHome直後の選択を待たない測定上の失敗も記録した。既存試験と同じ15秒の接続待ち、観測したPM offsetと実際のDOM範囲・clock収束の待機へ直し、時間だけのsleepで選択を推測しない。新しい9ケースの独立runと全回帰を証拠に残す。

残るnative回帰とIMEの複数案・再開手順は[手操作待ち一覧](../plan/DEFERRED_VALIDATION.md)へ記録する。Dockerの成功はGate AやStep 8全体の完了を意味しない。
