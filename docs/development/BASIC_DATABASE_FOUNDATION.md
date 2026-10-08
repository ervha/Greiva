# 基本DBの型とローカルビュー基盤

2026-10-08 / v0.41.0。[受入順P3](../plan/IMPLEMENTATION_PLAN.md)と[DB要求](../plan/DATABASE_SPEC.md)の初期subsetを実装する。[判断16件](../decisions/basic-database-foundation.md)、[証拠](../../tests/evidence/basic-database-foundation-20261008/SUMMARY.md)。portable Domainの基盤で、利用者がDBを作成・編集できる画面やDB同期の完成ではない。

## 初期subsetと正本

任意のDataSourceと型付きRecord/Propertyを扱い、Name、plain Text、finite Number、Checkbox、Select、date-only Dateの6型を検証する。Table/Listは同じRecordを読むview definitionとローカルqueryを共有する。初期選択A/B/Cの任意質問に回答はまだなく、継続開発と初期順の委任に基づきAを暫定初期案としている。将来の型/ビュー要求を削らず、提供済みへ昇格しない。

Sourceはworkspace ID、安定ID、schemaVersion、property集合を持つ。PropertyとSelect optionの名前は参照キーに使わない。NameはSourceにちょうど1つ、Recordは本文Page IDを保持する。Nameの値はPage metadataから得た`pageTitle` read projectionとし、Record.valuesへ二重に保存することを拒否する。Task/Scheduleの正本をRecordへコピーするbindingは実装しない。

Recordはactive snapshotの契約で、ID/workspace/source/Page/versionと型付きvaluesを検証する。物理schema、tombstone/履歴、認可済みPageとの原子binding、schemaVersion競合と移行は次工程。IDは既存UUID v7、versionは正のsafe integerを受け、opaque cursorやserverOrderを数値へ変換する契約ではない。

## 型と未設定

`null`と欠落はqueryの未設定として扱うが、保存用projectionのkey有無は保持する。空文字・false・0を未設定へ置換しない。Numberへ文字列やBooleanをcoerceせず、NaN/Infinityを拒否する。Selectは定義中のoption IDだけを認める。Dateは実在する日付かつyear 1以降で、Task dueやUTC日時へ変換しない。rich Text、date-time/range/timezone、Number表示書式、派生型と型変更/復元は後続である。

## ビューとqueryの範囲

ViewはSource参照、Table/List、表示property ID、filter/sortを持つ。Nameを隠す、未知/重複IDを参照する、別Sourceへ参照する定義を拒否する。filterは最大3段のAND/OR、eq/not_eq、文字列contains、Number/Dateのlt/lte/gt/gte、is_unset/is_setを検証する。eqは型付き値の厳密一致、not_eqは未設定も異なる値として含み、containsは大文字小文字を保持した部分一致とする。is_unsetはnull/欠落だけで、空文字はeq `""`で探す。

Source最大64 properties、Select最大100 options、label120文字、Text/Name65536文字、view最大8 sorts、groupのchildren最大20・合計predicate100、query最大1000 rowsを明示的に制限する。超過を黙って切り捨てない。これは初期portable処理の上限で、全DB件数や恒久的な製品上限ではない。

queryは渡された認可済みlocal windowだけをfilter/sortし、`scope: loaded-window`を返す。network/store/searchログのportはなく、全Source/全端末の最新一覧と主張しない。入力はparseしてcloneし、結果をdeep freezeする。重複Record/Page bindingや別workspace/source、未取得Nameを空文字へ代入することを拒否する。並びは複数sort→安定Record ID。未設定はasc/descとも末尾、Selectはoption順、文字列はdeterministicなcode-unit順で、locale collationは別仕様である。

## 次工程

typed commandとcaptured workspace/schema boundary、atomic durable mutation、immutable操作/再送、異field mergeと三値Conflict、native/server adapterを順に接続する。その後Table/ListとPage詳細画面、view保存/復帰を実装する。DB-01〜17の全受入、実Auth/native IME/Android、既存Task binding、Trash/復元/保持、配備暗号化は未完了のまま保持する。既存server5/native8・本文/structured wire・root/help画面を変更しない。
