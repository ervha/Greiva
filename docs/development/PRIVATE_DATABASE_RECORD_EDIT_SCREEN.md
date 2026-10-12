# 基本DBの行更新・競合解決画面

v0.71.0 / P3初期範囲。確認済みSourceの行操作を作成/編集へ切り替える。[行作成](PRIVATE_DATABASE_RECORD_CREATE_SCREEN.md)、[Record runtime](PRIVATE_DATABASE_RECORD_WRITE_RUNTIME.md)、[更新queue](PRIVATE_DATABASE_RECORD_UPDATE_QUEUE.md)、[実HTTP](PRIVATE_DATABASE_RECORD_WRITE.md)を使い、Name/Text/Number/Checkbox/Select/DateとTable/Listの初期範囲を保持する。

## 確認済みの行と変更

編集対象はBrowserが読み込んだRecord windowから選ぶ。NameはPage情報のタイトル参照で、本文の複製・Page付替え・Name値の直接更新はしない。選択時に端末の確認済みRecord/candidateを読み、元Record ID/Page/Source/schema/versionを捕捉する。NativeWorkspaceStoreのSource・context・receipt/history検証を通した値のみを編集のbaseとする。DB全件を検索したとは表示しない。

5型の各fieldに「変更しない」「空値（null）」「値を入力」を用意する。変更しないfieldはintent.valuesから省き、空文字/0/false/nullを区別して既存Domain validatorへ渡す。1つ以上の指定が必要で、操作IDは明示保存時に新規生成する。端末queueへ元baseVersion/intentを保存し、HTTPや確認済みBrowser表示への反映は別操作とする。

作成/更新フォームは同時に表示せず、draft/composition/保存中/unknownがある間は切替とSource/Page選択・logoutを止める。共通field componentは行作成の入力/型検査も保持する。長い確認済み値・候補の値は折り返し、desktop/360pxで横はみ出しを防ぐ。自分の変換中inputをreadonlyへ変えず、保存・取消・送信・選択を止める。known busyは新しい入力を保存せず編集可能に保持し、先の更新を確認する案内と取消を用意する。新しい未保存入力を先のpending intentへ上書きしない。

## 候補・履歴のbounded読取

runtimeの`readRecord(sourceId,recordId,afterConflict)`はcaptured NativeWorkspaceStoreを通じた端末読取だけで、HTTPしない。候補/解決履歴はlimit1、次cursorで置換し、全件を蓄積しない。初期windowに解決履歴があっても続きの未解決候補を読める。Record値は同じ読取時点のsnapshotであり、保存操作のcandidateをconfirmed baseにしない。queue5件の件数・cursorとcandidateのcursorは独立する。

読取中はbusy/世代をguardする。読取失敗では前の選択Record・候補・入力を保持し、以前の表示であることを示す。閉鎖/世代変更の遅着は返さない。unknown enqueue/ACK中の候補切替で元操作を失わない。共有storeはworkspace ownerが閉じる。

## 三値比較と新しい解決操作

確認済みの各候補にbase/local/remoteの値とpresentを表示し、未設定と明示null、0、false、空文字を区別する。元版/remoteVersionと解決済み履歴を示す。現在のRecordと候補のscope/remote状態を`prepareDatabaseResolution`で確認し、local/remoteを選んだ新しいoperationをupdate queueへ保存する。選択だけで候補を消さず、原ACK/receiptの保存後にnative cache上のresolvedByを読み直す。

remote状態が変わった候補は解決ボタンを無効にし、行/candidateを読み直す案内を出す。保存後にサーバーが`resolution_stale`を返した場合も原拒否結果を保持し、反映済みとしない。元base不明/不適切な解決の拒否も区別する。サーバーの最新状態はBrowserの明示DB変更取得を使い、端末読取をサーバー確認に読み替えない。

## 結果不明と表示

unknown enqueueはreadonly/copy可能な入力または元解決操作を保持し、同intentで再確認する。HTTP unknownは同wireで明示再送、native ACK unknownは元sequence/wire/responseをnetworklessで再保存する。queue pending0だけではunknownを解除しない。known busyは再編集できる入力を保持する。known ACK後のqueue読取失敗は原結果と旧行の「応答確認済み・一覧再読込待ち」を表示し、ACK unknownと区別する。

送信はworkspace全体の更新FIFOで、選択行だけを送る保証はない。原結果を適用/競合/拒否として表示する。選択行の再読取とBrowserの行表示更新は明示操作で、未送信編集を確認済み値へ混ぜない。

[証拠](../../tests/evidence/private-database-record-edit-screen-20261012/SUMMARY.md)。Dockerの型/UI mock・actual signed HTTP/PG/native SQLite・native/crash buildとWindows cross-buildは区別する。実Supabase login、Windows invoke/実Microsoft IME、Android native、credential/offline grant、配備暗号化/復旧・配布・最終Gateは別条件。native16/server11、外部依存と旧rootを保持する。

次工程は保存済みView設定の作成/更新/候補解決。Record削除/Page付替えと未取得bindingの拒否解消、追加型/高度なDB機能はこの画面で実装済みとしない。
