# 基本DBの行作成画面

v0.70.0 / P3初期範囲。基本DBの確認済みSourceを選択後、既存Pageを関連付ける行作成画面を明示して開く。Name/Text/Number/Checkbox/Select/Dateの範囲を保持する。[読取画面](PRIVATE_DATABASE_BROWSER.md)、[Record runtime](PRIVATE_DATABASE_RECORD_WRITE_RUNTIME.md)、[送信契約](PRIVATE_DATABASE_RECORD_WRITE.md)を使う。

## 入力と永続化

本文が端末に保存されたPageから選ぶ。NameはPageタイトルの参照で、本文やタイトルをRecord値へ複製しない。Text/Number/Checkbox/Select/Dateには「値なし（未設定）」「空値（null）」「値を入力」を用意し、空文字・0・falseも区別する。Selectはoption ID、Dateは日付値、Numberは有限数として既存Domain validatorで確認する。明示保存時に新しいoperation/record IDとSource定義を捕捉し、baseVersion:nullのcreate intentを端末queueへ保存する。保存だけではHTTPも確認済みRecordも作らない。

フォームのdraftや元intentを未保存のまま確認済み表示へ混ぜない。作成queueはworkspace全体のFIFO、画面は選択Sourceに属する保存操作を表示する。queue読取は種類ごとに5件の置換windowと継続cursorを使い、workspace全体のpending件数と表示件数を区別する。100件の既存runtime既定値とnative byte boundは保持する。

## Page bindingの保存前確認

見えているRecord20件・pending5件の除外に加え、`database_record_page_binding`はSource/Pageを指定した索引読取で確認済みRecordと作成ledgerを1件ずつ調べる。返却はcontext/Source/schema/Page、Record header、作成operation/record/ACK有無のみ。本文・values・wire・candidateをIPCへ返さず、windowを全件蓄積しない。native側は既存current/history/receipt、作成intent/index/hashとoriginal ACK proofを検証する。確認済みSourceと保存待ちSourceの両方を既存規則で検証し、既知の関連付けを補修しない。schema migrationはなくnative16/server11を保持する。

runtimeは書込前・元操作再確認前にこの関連付けを読む。別の行/作成操作へ関連付いていれば、書込なしのknown busyとして入力を保持し、再編集・取消できる。元operation/recordと一致した関連付けなら元intentを再実行する。初回preflight読取失敗は保存未実行なのでunknown enqueueにしない。preflight後の競合はnativeの原子的unique検査が防ぎ、結果不明は元操作で再確認する。再確認時に別の関連付けが確認できた場合はunknownを解除し、入力を残す。

端末で未取得のサーバー行まで未関連と保証しない。別端末の未取得bindingによるサーバー拒否の解消/Record削除・Page付替えは未実装で、配備前の別工程。保存前確認は端末の確認済みcache/作成ledgerに関する観測である。

## 結果不明・送信・原応答

unknown enqueueは入力をreadonly/copy可能に保持し、同じintentで再確認する。queue再読込だけではunknownを解除しない。HTTP応答喪失は保存済みの同じwireで明示再送する。native ACK応答喪失は元sequence/wire/responseの再保存で、HTTPしない。Page/Sourceの作成確認待ちは送信しない。pending0の観測だけを元ACK成功の代用にしない。

原ACK保存済みでqueue読取だけ失敗した場合は原結果を保持し、旧queue行を「反映は確認済み・一覧再読込待ち」と示す。ACK unknownとは別に表示する。確認済みの行表示は明示更新し、その表示windowに収まらない行の存在も継続cursorで示す。最後の結果と送信対象はworkspace全体に関する原結果で、選択Sourceだけを送る保証はしない。

## 操作・所有権と検証境界

draft/保存中/unknown enqueue/unknown ACKでSource・Page選択やlogout/接続変更を止める。自分のcomposition中inputをreadonlyにせず、保存・取消・送信・選択変更を止める。開く/読取失敗でPage store/editorを置換しない。lazy runtimeは自身のsenderを閉じ、共有NativeWorkspaceStoreはworkspace ownerが閉じる。閉鎖・世代変更の遅着は反映しない。ポインター/keyboard、360px dark/reduced-motionとdesktopをDocker E2Eで確認する。

[検証証拠](../../tests/evidence/private-database-record-create-screen-20261012/SUMMARY.md)。UI fixtureのmock Auth/IPC/HTTPと、実signed HTTP/PostgreSQL/native SQLite検証は別に保持する。synthetic composition・Docker cross-buildをWindows invoke/実Microsoft IMEや最終Gateの証拠にしない。

次工程は確認済みRecordの型付き更新・既知Conflict解決、保存済みViewの設定/作成。現在の画面は行作成のみで、未来のDB全体仕様を実装済みとしない。