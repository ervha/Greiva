# 個人workspace画面の接続

v0.29.0。`workspace.html` にログイン・端末/サーバーPage一覧・作成・本文編集/同期を組み合わせた接続プレビューを追加。通常rootの旧PoCを置換せず、既存CSPも拡張しない。署名native Auth/credential custody/offline grantを完成させる前に本番の既定入口へ昇格しない。実ユーザーAuthや実Windows invokeを確認した画面ではない。

## 接続と切替

ログインは既存Auth検証とstable native端末IDを使用する。明示workspace登録後の `activeConnection` だけをcompositionへ渡し、tokenを公開しない。`PrivateWorkspaceController` はnative storeのopen/closeとPage切替を直列化し、遅い旧openが新しい主体の保存先を後から閉じないようにする。取消/認証更新/期限切れ/接続closeで世代を変え、一覧・選択・本文表示を取り除く。保存済みDB/queueは削除しない。

端末一覧を初回に読み、サーバー一覧は明示取得する。各paginationは独立し、一覧取得は本文同期やACKではない。サーバー一覧からの選択でも、strict `page_exists` でbound store内の有無を確認する。最初の端末一覧50件に出ていないPageもlocal保存を優先し、存在するPageのload失敗をremote downloadへfallbackしない。未保存Pageだけをdownloadしてnativeへcommitする。再open/downloadだけで同期済みとは表示しない。

作成は明示操作。commit結果が不明なら同じID/titleを保持して再確認し、別のIDで自動再作成しない。Page切替は開始済みのdurable書込みを待ち、composition中や未保存draftのstorage failure中は切替/作成/logout/refreshを無効にする。本文は既存Editorでコピー可能に保持する。Authの強制失効時のoffline閲覧/未保存draft復旧は未決定の契約で、今回許可を創作しない。

エラーは固定categoryだけを表示。メール/password/tokenをlocal/sessionStorageやworkspace DBへ保存せず、passwordは送信後に入力欄から除く。通常Webではnative保存を代替せず、ログイン操作を無効にする。

## 実装範囲と残工程

PC/360px、dark/reduced motion、keyboard/pointer、selection/合成compositionをDockerで確認する。fixture HTML/moduleは通常build inputへ含めない。実HTTP/PG/Rust SQLiteではcontrollerからcreate/edit/sync、close/reopen、refresh後のpending保持を別に検証する。

native CSPと実Auth正常系、署名native session/OS credential/offline権限、root既定画面への昇格、Task/Relationのscoped画面、Page metadata変更/Conflict、provider接続は後続。旧PoC DBと旧経路を保護workspaceへ取り込まない。

自主判断14件：1) 専用entryと旧root保持、2) ready connectionだけを公開、3) 明示登録後local open、4) open/cleanup直列化、5) local/remote一覧分離、6) pagination外もnative presenceで確認、7) restore/downloadと同期確認の区別、8) 結果不明createの同ID再確認、9) durable完了後のPage切替、10) Auth世代取消と即時非表示、11) composition/failed draftのnavigation保護、12) Web保存fallbackなし、13) fixed category/認証情報非保存、14) browser doubleと実PG/Rustの証拠分離。

[証拠](../../tests/evidence/private-workspace-screen-20261008/SUMMARY.md)、[端末一覧](LOCAL_PAGE_CATALOG.md)、[本文runtime](PRIVATE_PAGE_EDITOR.md)、[外部条件](../plan/PENDING_PRODUCTION_CONFIGURATION.md)。
