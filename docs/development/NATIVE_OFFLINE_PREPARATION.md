# Native offline許可の準備と期限確認

v0.96.0。[offline lease保存層](NATIVE_OFFLINE_LEASE.md)を新しいnative認証runtimeへ接続した。今回提供する操作はオンライン接続中の許可準備と期限確認。offline起動・編集を許可する画面切替は次工程で、画面にも未提供範囲を表示する。

## 準備経路

- `native_offline_status(handle)` と `native_offline_prepare(handle)` だけを公開。JSへ返すのは `{available, expiresAt}`。grant・nonce・token・context・鍵・時刻・TTLをJSから受けず、JSへ返さない。
- nativeが32 random byteのchallengeを作り、元admissionのclient/epochで固定API `/v1/workspaces/{workspace}/offline-grant` へPOSTする。既存のrequest timeout/redirect拒否/no retryを適用する。
- responseのprotocolと形を厳密に検査し、元session/handle/世代を再確認。署名pin・全scope・challenge・native clock・期限を検証してOS credentialへ保存し、永続化確認後に期限を返す。保管中にオンライン期限をまたぎ、保管後のsession確認に失敗した場合も、そのleaseをlockして準備結果を未確認とする。SQLiteにはgrantを置かない。
- 準備開始で旧leaseを無効化する。失敗は自動再取得せず、画面の「準備結果を再確認」はOS上のleaseを再検査するだけでHTTPを呼ばない。unknown保存をreadyと扱わない。
- 状態確認は毎回署名・scope・期限/high-waterを検証し、より進んだ時刻のOS保存を確認する。JSに表示する期限は前回確認値で、編集権限やofflineのadmissionとして使わない。
- login/restore開始とlogoutで旧leaseを永続lock。lease側のlock失敗はオンラインsessionも閉じ、再認証を進めない。logout時は認証/lease双方の永続結果を集約し、不明を成功扱いしない。本文・pending・元wireは消さない。
- close/logout/再認証/期限切れへの遅着応答を採用しない。並行準備は拒否。HTTP待機中の同じ本文への端末保存を継続し、logout時は遅着結果を表示しない。

## 明示的な公開設定

通常認証3項目に加え、以下の4項目が揃ったnative buildだけで準備を有効化する。未指定なら無効、部分指定はbuild error。鍵や設定の既定生成・ネットワーク鍵取得・平文fallbackはない。

| native build変数 | 内容 |
| --- | --- |
| GREIVA_NATIVE_OFFLINE_ISSUER | server署名claimと一致するHTTPS issuer。credentials/query/fragmentなし |
| GREIVA_NATIVE_OFFLINE_AUDIENCE | server署名claimのaudience |
| GREIVA_NATIVE_OFFLINE_KID | pinするkid |
| GREIVA_NATIVE_OFFLINE_PUBLIC_KEY | Ed25519公開鍵32 byte、小文字hex 64文字 |

秘密鍵は[APIの明示起動設定](PRIVATE_OFFLINE_STARTUP.md)だけに供給し、native/Vite/gitへ入れない。公開鍵pinが不正/weakな場合はruntime構築を拒否する。現在の隔離Windows候補は未設定・準備無効でbuildする。実配備の署名鍵を生成したり、既存APIを再起動したりはしていない。更新時の複数pin/rotation配布は別工程。

[検証記録](../../tests/evidence/native-offline-preparation-20261015/SUMMARY.md)。DockerのOS custody doubleと実Rust/SQLite・実TLS/署名API/PG、画面IPC double、Windows候補の非GUI設定検査を区別する。次は保管済みのcontextのnative復元、offline専用handle・local command gate、起動復帰/期限切れ時の入力保全を接続してからoffline編集を有効にする。
