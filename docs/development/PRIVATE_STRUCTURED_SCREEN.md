# 個人workspaceのTask・Relation画面

v0.31.0。専用workspace接続プレビューへ `PrivateStructuredPanel` を追加する。旧root/CSPは保持し、native Auth/grantと配備の条件が整う前に本番入口へ昇格しない。

## 操作と保存

Taskはtitle/status/date-only期限の明示作成・編集・削除、RelationはPage/Taskのtyped endpointを選ぶ明示作成・編集・削除に対応する。削除は既存native/serverのtombstone契約を使用し、物理削除・旧DB取り込みを行わない。Page候補は取得した端末/サーバー一覧から選び、同期済みTaskも含む実参照の認可/存在確認はserverが行う。未送信Pageは本文同期後に関連付ける説明を表示する。

フォームは明示保存までnativeへ書かない。Task入力中は「まだ保存していません」と表示し、変換中は保存/接続切替を停止する。選択中の編集baseを保持し、local版が変わったら別の版へ黙って上書きしない。入力取り消しは未送信フォームだけを戻す。保存結果不明のフォームはコピー可能なread-onlyで保持し、同じoperationの再確認を使う。確認後にフォームを初期化し、別nonceで二重作成しない。

Taskの編集開始でtitle、Relationでは元の選択欄にfocusを移す。status更新や同期状態表示でフォームを再mountしない。入力/変換/結果不明/処理中はnavigation/logout/refresh/明示closeを無効にする。Authが強制失効した場合は既存世代取消で表示を閉じ、未保存フォームのoffline閲覧/復旧を新たに許可しない。

## Conflictと同期

Conflictは対象とfield、base/local/remoteを表示する。各値を選ぶと、現在版をbaseにした別operationを記録する。同entityのpendingがある間は解決を停止する。ACK前にConflictを消したり、三値をLWWへ変えたりしない。rejectionの元operationを保持し、サーバーの生error messageは表示しない。取り消し/履歴復元/任意の第三値での解決は後続の操作設計。

フォーム未保存、変換、結果不明、pending、Conflict、rejection、error、hasMoreを同期確認から区別する。「取得した更新まで同期済み」は成功cycleの観測headに対する表示で、将来のremote変更まで保証しない。Page本文とstructured同期は独立して明示操作する。

controllerは一つのnative storeをPage editorとstructured runtimeへ渡し、世代切替/closeで両方の操作受付を同期的に停止する。cleanupをawaitしてから元storeを閉じ、次のopenと直列化する。viewの取消やログアウトは保存済みTask/Relation/pendingを削除しない。

自主判断12件：1) 専用previewにscoped runtimeをmount、2) Task/date/statusの明示フォーム、3) typed endpoint選択、4) tombstone削除、5) 未保存フォームの明示状態、6) captured edit base、7) 結果不明のコピー/同ID再確認、8) focus/DOM継続とdark native dateテーマ、9) composition/draft中の切替保護、10) 三値/別operation解決、11) rejection記録とsafe error、12) Page/structured cleanupと証拠分離。

[証拠](../../tests/evidence/private-structured-screen-20261008/SUMMARY.md)、[runtime](PRIVATE_STRUCTURED_RUNTIME.md)、[専用workspace画面](PRIVATE_WORKSPACE_SCREEN.md)、[残条件](../plan/PENDING_PRODUCTION_CONFIGURATION.md)。
