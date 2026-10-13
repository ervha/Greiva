# Native sessionの検証・復元・世代境界

v0.83.0。[採用した方針](../plan/NATIVE_SESSION_POLICY.md)に沿い、`NativeSession`を[native資格情報保管](NATIVE_CREDENTIAL_CUSTODY.md)へ接続した。これはnative libraryの実装であり、現行previewのmemory-only認証を置き換えるHTTP/IPC/UI接続は次工程。

## 信頼と保管

`NativeProvider`はnative側で固定設定から構築する依存port。password/refreshでtoken pairを取得し、trusted APIの検証によるissuer・subject・期限を`verify`で取得する。JWT payloadの読取りだけでこの応答を作らない。UIからprovider/issuer/検証済みidentityを受け取るIPCは登録していない。具体的なHTTP adapterはまだ提供しない。

OSへ保管するのは最大2560 byteのrefresh credentialだけ。accessは最大8192 byteのnative memory buffer、passwordは最大4096 byteで、直接管理するbufferをdrop時にzeroizeする。secretとidentityはDebug/Serializeを実装しない。SQLiteには従来のhash/世代/slotだけを残す。snapshotはphaseと期限だけで、メール・利用者ID・tokenを含まない。

## 状態と失敗

login/restore/refresh開始時に以前のmemory sessionを閉じる。providerへ送る前にSQLite markerをlockedへcommitする。restoreはownerを固定し、失敗・timeout・OS書込み応答不明・中断後に回転credentialを自動再利用しない。新しい明示loginで復帰できる。処理中の二重login/restoreは拒否する。

検証結果のissuer、token responseと一致するsubject、native clock/high-water、期限を確認し、OS置換＋marker commit後にも期限と永続世代を確認して初めてVerifiedへ進む。復元で別ownerを受けた場合は拒否する。providerの各待機には15秒の上限を設け、logout時はgeneration通知で待機futureをdropする。HTTP adapter側もabort/dropを実装する必要があり、既に送ったHTTP副作用の取消を保証しない。

`authorized`は送信前とbuffered応答の受渡し前に、期限・clock・OS読取/書込・SQLiteのownerと世代を確認する。callback内でworkspace commitやACK処理を行わない。現行workspace adapterとの原子的な結果適用はまだ未接続。scopeとsubjectだけでなくgenerationを照合するため、別instanceが同じownerで再ログインした場合も古いaccessを使い続けない。

明示logoutはmemoryを即座にLockedへ変え、SQLiteの永続lockとOS cleanup結果を返す。commit失敗を確認済みlogoutと表示しない。古いlogin/期限切れの自動cleanupは自分の永続世代だけをlockし、別instanceの新しい認証を解除しない。OS削除失敗でもlockを戻さず、cleanup pendingを残す。workspace/pendingには触れない。

呼出しfuture自体が中断された場合、永続markerはlockedのまま。memoryが処理中表示のままなら明示logoutを経て再loginする。timeoutは各provider呼出し単位であり、全loginの15秒上限ではない。時計high-waterはこのオンラインsessionのprocess内検査で、[offline lease](NATIVE_OFFLINE_LEASE.md)の永続clock/7日許可の代用ではない。

## 検証と次工程

[証拠](../../tests/evidence/native-session-20261013/SUMMARY.md)。実SQLite＋OS/provider doubleで復元、rotation、失敗・遅着・別instance・期限・clock・秘密値不在を検査した。HTTPや実Supabaseのrefresh/失効、Windowsの自動ログイン、7日offline、handle/表示のlockを通した証拠ではない。

次はtrusted config固定のnative HTTP providerと署名session検証、provider revokeの確認/未確認を接続する。その後にworkspace admission/ACK・offline lease・通常IPC/UIを接続し、実Windowsで自動復元/refresh/再接続とpending保全を受入する。Android OS保管と既知のMicrosoft IME再変換Failは別の残項目。
