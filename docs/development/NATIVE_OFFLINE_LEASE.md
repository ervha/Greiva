# OSに保管したoffline許可と保存処理のgate

v0.80.0。[署名grant](NATIVE_OFFLINE_GRANT.md)と[資格情報marker](NATIVE_CREDENTIAL_CUSTODY.md)を接続し、local操作のたびに署名・scope・期限・最終確認時刻を検査するnative基盤を追加した。現行previewのUI/IPCへはまだ切り替えない。

`OfflineLeaseStore` はnativeで32-byte random challengeを生成し、署名の正しい同challengeの応答だけを保存する。grant・context・high-water時刻はOS credential内に置き、SQLiteには世代/lock/slot/hashだけを残す。全recordがWindows保管上限2560 byteを超える場合は拒否する。本文・email/profile・平文fileへのfallbackはない。

`check_access` は毎回OS recordを読み、公開鍵pinと全scopeを再検査する。native SystemTimeとprocess内Instantを組み合わせ、秒丸め分を除く巻き戻しを拒否し、より進んだ時刻を採用する。OSに保持したhigh-waterより古い時刻、期限ちょうど、破損、読取/更新失敗では永続markerをlockedにする。新しい時刻をOSへ保存できてから結果を返す。unknown writeでも許可結果を返さない。再起動後のmissing/破損markerをOS credentialから勝手に復元しない。

この保護は通常のOSユーザー/時計境界で、管理者や同一OSユーザーによる資格情報・全状態の意図的な巻き戻しを防ぐhardware clockではない。アプリ停止中の経過は壁時計に依存する。native時刻/OS保管をUIから変更するIPCを設けず、時計が不確かな場合はオンライン確認へ誘導する。

`OfflineWorkspaceRegistry` はraw registryを所有し、open/read/editごとにleaseを確認する。同じgateをSQLite commitまで保持し、開始済み操作を終えてからlogoutでhandleを閉じる。期限/clock/保管失敗ではhandleを閉じ、以降の操作を拒否する。local create/edit・queue・immutable prepared wireは許可するが、ACK/receive/pullは許可しない。送受信とserver結果の保存には別途有効なnative Auth経路が必要。

logout/再認証開始で旧handleを閉鎖し、世代を進める。本文、pending、Conflict、元wire/receiptを消去しない。同じ署名scopeで再認証すると、同じworkspace rootから元のpendingへ復帰する。完了済みgrantを繰り返し渡して再認証challengeを飛ばすことはできない。表示内容や入力中draftの閉鎖は今後UI側へ接続して検証する。

## 確認範囲

Docker Rust12件で、再起動/high-water逆行、期限ちょうど/一度lock後の巻き戻し、OS書込み応答喪失/破損/cleanup失敗、古いchallenge/別scopeを検査した。実WorkspaceRegistry/SQLiteで、logoutと期限切れによる拒否、同account再認証での元pending wire不変、offline ACK拒否を確認した。

Windowsは専用の架空probeを3プロセスで実行し、OS grant保存→別processで同じpending復元→logout後の別processでlock継続を確認した。署名鍵はexample内だけの固定テスト値で、製品binary/configへ導入しない。probe終了時に専用credentialのcleanupを確認する。実provider正常login、Tauri UI/IMEの検証とは分ける。

次はnative provider transport/refreshとこのgateを同じsession lifecycleへ接続し、通常runtimeの明示署名設定、UIの起動復元・offline表示・期限/失効時のdraft保全を実装する。Android secure adapterは別条件。[証拠](../../tests/evidence/native-offline-lease-20261013/SUMMARY.md)。
