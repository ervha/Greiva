# DB定義の認証付き取得と端末保存

2026-10-09 / v0.52.0。[端末Source cache](PRIVATE_DATABASE_SOURCE_CACHE.md)へ、captured AuthのHTTP read/catalogを接続する。[判断16件](../decisions/private-database-source-session.md)、[証拠](../../tests/evidence/private-database-source-session-20261009/SUMMARY.md)。server11/native9を保持する。Source作成queue、Record/View replica/queue/DB差分cursorとTable/List画面は後続。

## portable session

DatabaseSourceSyncSessionはworkspace contextとtransport/store関数を生成時に捕捉する。catalogはdefault50/max100のserver header観測だけで、定義をcacheへ保存しない。明示read(Source ID)はprotocol/workspace/epoch/client/Source/6型を照合し、read request/responseをclone/freezeして端末へ渡す。初回catalogのafter0、件数、raw範囲、hasMore中の同位置/cursor循環を拒否し、filtered空進捗とexact bigintを保持する。catalog終端を全DB同期済みへ扱わない。

一度に1操作だけを実行する。HTTP失敗やprotocol不正ではnative receiveを呼ばず保存再試行を作らない。native receiveを呼び出した後に失敗した場合は結果不明とし、Source ID/request/responseの同じ組をmemoryに保持する。別read/catalogで置き換えず、retryはHTTPを再取得せず同じ応答のcommitを確認する。cacheのsame-version照合により、COMMIT済みで返却だけ失われた場合も重複しない。closeでprivate pairを解放し、再起動後は明示readをやり直す。永続の送信operation queueやACKを実装したとはしない。

## captured connectionとnative factory

PrivateWorkspaceConnection.openDatabaseSourcesはtrusted API origin、workspace/device、Auth leaseと固定read/catalog pathを捕捉する。Authorizationをmemory-only Auth adapterで付け、既存15秒timeout/abort/status/JSON処理を再利用する。JWTやメール/profileをSource request/cacheへ追加しない。read inputからURL origin、workspace、DB pathやSQLを変更できない。

NativeWorkspaceStore.databaseSourcesは自分のcaptured connectionとdatabaseSourceReceiveを渡す。開いただけではHTTPを実行しない。Source session置換/connection close/Auth refreshで旧sessionを閉じる。遅着HTTPは保存前に除外し、既に旧storeへ入ったcommitが完了しても旧sessionへ成功を返さず、新storeへ再適用しない。

401/403は既存方針でconnection全体を閉じ、native instanceも旧世代として拒否する。保存済みデータを削除する処理は追加しない。認可済みの新connection/bootstrap/native openで既存cacheを読み直す試験は、Sourceの削除ACKやoffline grantを証明しない。現在のread/catalog sessionは操作入口であり、画面の自動背景同期は開始しない。

## 証拠と残範囲

portable8条件で型/範囲/immutable ports/結果不明再試行/busy/closeと遅着commitを確認する。実schema11 APIの署名JWT/JWKS fixtureとRust/SQLite native driverを繋ぐ2PG条件で、6型定義のHTTP→cache→再起動、返却だけ失ったcommitのnetworkなし再試行、403時の閉鎖/データ保持、session置換/Auth refresh中のlate HTTPを検証する。Auth login/identity adapter自体はfixtureで、実Supabase正常loginやWindows invoke/MS IME/Android/native Gateではない。
