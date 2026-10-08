# Page情報の受信とworkspace表示

2026-10-08 / v0.39.0。[増分runtime](PRIVATE_PAGE_CHANGES_RUNTIME.md)を個人workspace previewへ接続する。[全16判断](../decisions/private-page-changes-screen.md)、[証拠](../../tests/evidence/private-page-changes-screen-20261008/SUMMARY.md)。server5/native8・本文/structured wire、通常root入口を維持する。

## 保存情報と観測状態

controllerはcaptured native storeと同じconnectionでchanges runtimeを開き、local snapshotから開始する。login/reconnectでnetworkを暗黙開始しない。保存済みのPage情報を本文保存済み一覧とserver queryから分け、最大100件のcatalog window、先頭/続頁のlocal操作と一回最大100件の明示取得を提供する。各行の本文有無はbounded window内でactual native `hasPage`を確認し、最初のlocal一覧にないことから推測しない。本文未取得行を開く場合は既存の認証付きbody readを使い、取得後に表示を更新する。

画面は未取得/取得・保存中/以前の取得結果/観測範囲の末尾/続頁/error/保存結果不明を区別する。「前回取得した範囲の末尾まで保存しました」はそのcycleのhead末尾とlocal read一致だけで、全端末の最新・本文・pending titleの同期済みではない。metadata-only cacheを削除ACKへ解釈しない。Task/RelationのPage選択はlocal/server/cached情報をIDで重複排除し、local title投影を優先する。

native受信結果不明は以前の表示を保持し、新取得をdisableして同request/replyの保存再確認を提示する。再確認はnetworkを使わない。transport失敗やcatalog/本文有無のlocal read失敗は同アカウントの以前の情報を残す。Auth更新/closeではruntime/handleとprivate表示を閉じ、logout後の再接続は保持されたDBを再読する。入力/未送信本文・title/Task/Relationを削除しない。

## 入力・選択・変換

metadata受信は本文editorをremountせず、binaryやselectionへ触れない。active titleは受信後にnative履歴を読み直す。取得の途中でdirty titleやnative compositionを始めた場合はactive表示の更新を保留し、draft/選択/focusを保持する。保存・取消/変換終了後の安全なタイミングでlocal refreshを行い、失敗時は明示再確認を残す。変換中はreadonlyへ切り替えず、dirty/retry/composition中のPage/account切替を既存guardで拒否する。

cacheはserverの観測title、本文保存済み一覧/active editorはnativeのpendingを含むlocal title投影を表示する。両者の値が違っても未送信入力をcanonical server値で上書きしない。受信したremote resolvedByでactionable候補を消し、保存済みintent/拒否履歴は残す。metadata取得完了で本文/structured/titleの同期表示を上書きしない。

## 検証と後続

controllerの新5条件はcatalog→認証付きbody open、cache reconnect、pending wire/body identity、遅着受信とdirty/composition保留、unknown native receiptとbounded101を確認する。Docker browserはdesktopと360px dark/reduced-motionで、明示取得・再確認、relogin、cache/bodyの分離、transport失敗、変換/focus/selection/body node保持と別端末の解決反映を実操作する。

browserのfixtureは画面操作の証拠で、native durability/署名HTTPはv0.37/v0.38と同一source回帰を別に扱う。実Supabase正常login、Windows Tauri invoke・Microsoft IME/Android、native credential/offline grant、削除/復元/保持、配備DB/backup暗号化は未検証/未完成。通常入口へpreviewを昇格しない。次はaccepted P2のヘルプ・復旧案内など、外部設定や手操作に依存しない工程を続ける。
