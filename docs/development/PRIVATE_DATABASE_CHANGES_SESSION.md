# DB差分取得・保存session

2026-10-09 / v0.57.0。[native delta](PRIVATE_DATABASE_CHANGES_STORE.md)を[認証付きjournal API](PRIVATE_DATABASE_CHANGES.md)へ接続する。[判断16件](../decisions/private-database-changes-session.md)、[証拠](../../tests/evidence/private-database-changes-session-20261009/SUMMARY.md)。server11/native12保持。明示1window取得の基盤で、画面runtime/永続操作queue/Table/Listは後続。

## 捕捉と取得

DatabaseChangesSyncSessionはSource/context/transport/load/receive portを構築時に固定する。native factoryは保存済みSourceを要求し、unknown Sourceを確認済みcacheへ変換しない。factory/local progress読取はHTTPを開始しない。pull(limit=50)は1〜100の整数だけを認め、毎回nativeのdurable progressからrequest cursorを作る。呼出側からafter/cursorを上書きしない。

private connectionは固定workspace/Source path /changes/pullと捕捉Auth leaseを使う。protocol/workspace/epoch/device/Source/schema/journal世代、typed Record/View/候補、after/raw位置差/countとcursor循環を保存前に検査する。filtered空windowもraw進捗として扱い、全DB同期済み・削除ACK・queue消去とはしない。HMAC/JWT/native grantの検証はこのportable sessionが追加するものではない。

## 結果不明と閉鎖

保存開始前にimmutable request/response pairを保持する。receive失敗、COMMIT成功後の返却消失、保存後progress読取失敗/矛盾ではpairを残す。次のpullはbusyで、そのpairをretryすると新HTTPなしで同応答を再保存する。保存後にnative progressを読み直し、同journalで受信replyのreadOrder以上、同位置なら同cursorであることを照合する。別処理で既に進んだ最新cursorを古いretry responseで巻き戻さない。

progress()はlocalの観測状態を返すだけで、未確定pairを清算しない。received/head/hasMoreはnativeの保存観測であり、全DB送信・受信完了の表示ではない。transport/protocol失敗だけではpairを作らず、private原因/値/tokenをerrorへコピーしない。

close/置換/Auth refresh/connection close/native store closeで旧sessionを閉じ、遅着HTTPを保存前に除外する。既にadmitされた旧native commitは旧storeで完了し得るが、閉鎖後成功として返さず新storeへ転送しない。新Source/sessionが構築できた後だけ旧sessionを置換し、不正な置換で正常sessionを失わない。

## 検証境界

portable13条件とactual signed HTTP/JWKS→Rust/SQLiteのPG4条件を検証する。2つの別clientID/SQLite、bounded再開、返却だけの消失/同応答retry、read先行版/遅着delta/解決、filtered空windowとdeny後のcache保持、置換/refresh/native closeのlate HTTPを含む。新SIGKILL試験を実施したとはせず、原子保存の実kill証拠はv0.56.0へ分ける。

初回typecheckではtestのevent union未narrowを修正し、portable初回12 Pass/1 Failではmutable input contextがfixture保存状態へ共有されたためfixtureの保存contextをcloneした。失敗log/reportを保持し、修正後13と最終全回帰を分ける。実Supabase正常login/Windows actual invoke/MS IME/Android/native credential・offline grant/配備暗号化/native Gateは別条件。
