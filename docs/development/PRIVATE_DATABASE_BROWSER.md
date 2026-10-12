# 基本DBの読み込みとTable/List画面

2026-10-12 / v0.68.0。[基本DB初期範囲](../plan/DATABASE_SPEC.md)、[読み込み済みquery](BASIC_DATABASE_LOADED_QUERY.md)、[証拠](../../tests/evidence/private-database-browser-20261012/SUMMARY.md)。個人workspace接続プレビューへ接続し、旧rootや本番入口の提供条件を変更しない。

## 読取・取得・表示

- 「基本DBを開く」で共有native storeに属する専用browserをlazy openする。初回は端末の確認済みSourceだけを読み、HTTPは呼ばない。DBを開けない場合もPageの保存先・本文・structured sessionを置換しない。
- 端末Sourceは5件、サーバーcatalogは10件、Viewヘッダーは10件、Recordヘッダーは20件。次の範囲は置換して表示し、無制限に蓄積しない。Recordは1行ずつ候補limit1でloadし、32MiBを目安に分割する。最初の大きな1行は表示できるよう許容する。byte境界で止めた場合も元IDのkeysetを保持する。
- catalogは定義や行を保存しない。利用者が選んだ定義のreadと、Sourceごとの1回最大100件の変更取得を別の明示操作とする。自動全件取得・poll・暗黙の送信はない。
- Table/Listは同じ読み込み済みRecordを表示する。保存済みViewの列・filter・sort・layoutを評価し、表示だけのレイアウト切替は保存設定を変更しない。既定の表示は未保存で、架空のView/versionを作らない。
- Record/Viewは確認済みのcacheを読む。未送信の編集・作成をこの表示へ混ぜず、その制約を画面に明記する。読取・受信をqueueのACKへ変換しない。
- Nameは現在表示しているPage情報から参照する。未取得と空タイトルを区別し、Name条件/並び順を評価できない行を別に表示する。既知のNameから既存のPage本文を開く。全件検索・全DB同期済みという表示はしない。
- Textの空文字、Numberの0、Checkboxのfalse、SelectのIDに対応する表示名、Dateの日付文字列、未設定を区別する。RecordとViewの取得済み競合・履歴と、その続きの有無を表示する。候補limit1を全候補の確認済み状態と扱わない。

## 失敗・世代・入力

受信したSource/変更の保存結果が不明なら、元応答の同一pairを保持する既存sessionの再確認を使う。HTTPは追加しない。再確認中のSource/View切替やworkspace navigationを止め、再確認ボタン自体は使えるようにする。既知の受信成功後に一覧だけ失敗した場合は、受信済みと古い一覧を分ける。読取失敗で以前の表示を空の成功へ置き換えず、読取の鮮度をfalseにする。

controllerとbrowserは所有するsessionだけを閉じ、共有storeを保持する。ownerが閉じるとprivate状態を同期的に消し、旧非同期処理の遅着を反映しない。observer例外や生のcauseを利用者へ転送せず、固定のerror stageだけを表示する。

DBの操作は既存Page/Title/Taskのdraft・保存失敗・変換中には止める。DB読取中や結果不明ではworkspace navigationを止める。画面の再描画で本文をremountせず、DOMの選択・focusとcompositionを保つ。select値はイベント発生時に捕捉し、非同期化後のcontrolled DOM値を読み直さない。Tableはモバイルで領域内の横スクロール、Listはカード表示にし、キーボードとdark/reduced-motionを検証する。

DB作成・typed値の編集・View設定の保存/競合解決画面は次の工程。既存の保存・送信runtimeを利用し、同entity未ACKのbusy契約を維持する。実Supabase正常系、最新Windows invoke/MS IME、Android native、credential/offline認可、配備暗号化と最終Gateは別条件。
