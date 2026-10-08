# Pageタイトル編集画面

2026-10-08 / v0.35.0。[title runtime](PRIVATE_PAGE_TITLE_RUNTIME.md)を個人workspace previewへ接続する。[全18判断](../decisions/private-page-title-screen.md)、[証拠](../../tests/evidence/private-title-screen-20261008/SUMMARY.md)。server schema4/native schema7、本文/structured wire、通常アプリ入口を維持する。実Auth正常系・Windows invoke/実IME・Android・native credential/offline grant・配備暗号化は別の残条件。

## 入力と保存

タイトルは独立したcontrolled draftで編集する。保存ボタンまたは変換中でないEnterで明示的に端末へ保存し、blurで自動保存しない。保存済みタイトルを本文見出しと端末一覧へ反映するが、本文Doc/editorを作り直さない。取消は最新の保存済み値へ戻し、入力へfocusを戻す。pristine入力だけがmetadata更新へ追従し、dirty/composing入力と選択位置を上書きしない。

composition開始・入力変更はその場でcontrollerへ通知する。未保存/変換中/保存処理中/結果不明ではPage作成・切替、refresh/logoutなどの画面遷移を止める。nativeEvent.isComposing、composition ref、keyCode229でEnter保存を防ぐ。active composition中の入力をreadonlyへ変えない。Auth失効は権限取消なので例外的にprivate stateを消す。Dockerのcomposition eventは実Windows IMEの証拠ではない。

enqueueまたは後続readの結果が不明なら同operationId/title/resolutionをruntimeが保持する。draftはコピー可能なreadonly入力に残し、同じ保存の再確認だけを許可する。未確認の状態で別operationを作らず、取消/通常sync/遷移を禁止する。保存済みpendingは遷移を禁止せず、別Pageや再ログイン後の端末一覧にも独立したタイトル未確認件数を表示する。

## 確認・候補・履歴

title送信・queryは明示ボタンで行い、自動networkやtimerを追加しない。unknown baseでは編集保存を止める。タイトル確認時にまず既存本文経路でPage作成を確定し、続いてtitle queryへ進む。known baseのtitle確認は本文syncを暗黙実行しない。本文変換/保存失敗/同期中やtitle draft中はtitle確認を止める。

本文の同期表示とタイトルの確認表示を分ける。title pending、結果不明、error、取得候補の続き、query終了を区別し、「取得したタイトルを確認しました」は最後のquery頁が終わった範囲だけを表す。title syncedを追加せず、全端末の最新状態やConflict解消を保証しない。

候補は基準/端末入力/取得server値の三値を表示する。保存済み候補が他端末で解決済みの場合もあることを説明し、新operationによるlocal/remote選択を明示する。pending/dirty/composing中は解決を止める。stale/rejectedは候補と元入力を保持し、固定文言で拒否履歴を示す。server causeやtokenを画面/logへ出さない。resolvedBy=nullやqueryからの欠落を現在の未解決判定へ広げない。

remote候補queryの続きとnative候補/operation履歴の続きは別操作で、各100件までの選択windowを表示する。候補とoperationの最後のkeyを別々に保持し、一方が終了しても他方の続頁で先頭へ戻さない。読取失敗ではkeyを進めず、先頭復帰/保存/syncでwindowをresetする。native history読取はqueueを消費せず、先頭へ戻す操作も提供する。端末一覧は一頁最大50Pageについてtitle snapshotを各limit1で読み、本文pendingとtitle pendingを独立保持する。読取後の世代検査で旧workspace応答を適用しない。

## 所有と検証

controllerが本文/title/structured runtimeと共有native storeを所有する。Page切替はadmitted本文保存を待ち、旧title observerを外して旧runtimeを閉じてから新runtimeを開く。refresh/logout/lease取消は旧世代を閉じ、共有storeはruntime cleanup後にcontrollerが閉じる。title runtime単独closeはstoreを閉じない。

Docker画面試験は専用fixtureのHTTP/native doubleを使い、PCとmobile dark/reduced-motionでkeyboard、composition、選択保持、同ID再確認、lost ACK/同wire、三値解決/stale、101件pagination、本文との状態分離を検証する。actual Rust registry/SQLite runtimeとPostgreSQLの試験は別reportで、画面doubleを実Tauri invoke/実Auth/実IMEと扱わない。既存root/Auth画面、型、Rust feature境界、frontend、Windows cross-buildも確認する。再現手順と最終件数は証拠へ記録する。
