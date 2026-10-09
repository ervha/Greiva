# DB内容の認証付き取得と端末保存

2026-10-09 / v0.55.0。[Record cache](PRIVATE_DATABASE_RECORD_CACHE.md)/[View cache](PRIVATE_DATABASE_VIEW_CACHE.md)へ認証付きread/catalogを接続する。[判断16件](../decisions/private-database-content-session.md)、[証拠](../../tests/evidence/private-database-content-session-20261009/SUMMARY.md)。server11/native11保持。DB差分cursorと解決状態の受信、Source/Record/View作成・更新queue、Table/List画面は後続。

## captured Source session

DatabaseContentSyncSessionはworkspace context、canonical6型Source定義とtransport/store receiverを生成時にclone/freezeする。Source workspace/schema/対象Record・Page/View、型/設定/三値候補、件数/afterConflictを検査する。明示readRecord/readViewで同じrequest/responseを端末へ渡す。stale候補を最新field値への不一致だけで拒否しない。

catalogRecords/catalogViewsはdefault50/max100のheader観測のみで、snapshotや候補を保存しない。raw進捗/初回0/Source/版/重複/順序/hasMore循環を検査し、filtered空windowとexact bigintを保持する。opaque cursorのHMACはserverで照合する。catalog終端を値受信・全DB同期済みへ扱わない。

一度に1操作だけを実行する。HTTP/protocol失敗ではnativeを呼ばず保存retryを作らない。native commit結果不明時はkind/対象ID/request/responseの同じ組を保持し、別kindのread/catalogでも置き換えない。retryは新HTTPを行わず、同応答commitを確認する。closeでprivate pairを解放し、再起動後は明示readを行う。永続の送信queue/operation ACKとは別である。

## connectionとnative factory

PrivateWorkspaceConnection.openDatabaseContentsはtrusted API origin/workspace/device/Auth lease/Sourceを捕捉し、固定records/views catalog/read pathと既存HTTP timeout/abort/status処理を使う。inputからorigin/保存先/workspace/SQLを変更できない。無効なSourceで既存sessionを閉じず、成功した新sessionの作成後に旧sessionを置換する。置換/Auth refresh/connection closeでlate HTTPを保存前に除外し、admitted旧commitが完了しても成功や新storeへの適用を返さない。

NativeWorkspaceStore.databaseContentsは保存済みSourceをloadしてからfactoryを作る。開いただけではHTTPを開始しない。native store closeは自分が作ったSource/content sessionも閉じ、新HTTPを停止する。既存Source factoryも同じclose追跡へ接続する。401/403は従来どおりconnection全体を閉じ、cacheを消去しない。新しい認可済みconnection/bootstrap/native openで保存データを読み直す証拠はoffline grantや削除ACKではない。

## 検証と境界

portable13条件とschema11のactual signed HTTP/JWKS fixture→Rust/SQLite cacheの3PG条件で、typed read/headerだけのcatalog、unknown返却/同応答retry、再起動、実server三値候補、置換/refresh/store close/403を確認する。serverでremote解決した後に空readが返っても、cacheの既知候補を勝手に解決しないことを確認する。解決状態の反映はDB差分受信へ分ける。

専用PG初回では確認済みv0.54.0 native driverを再利用し、全PG回帰ではv0.55.0へ揃えて再buildしたdriverで確認する。新SIGKILLは追加せず、native原子保存はv0.53.0/v0.54.0証拠へ区別する。Auth login/identity adapterはfixtureで、実Supabase正常login/Windows invoke/MS IME/Android/native Auth・offline grant/配備暗号化/Gateは別条件。
