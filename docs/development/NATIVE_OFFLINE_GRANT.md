# 7日offline許可の署名契約

v0.79.0。[Native session方針](../plan/NATIVE_SESSION_POLICY.md)に沿うserver発行・native署名検証を追加した。許可はlocal閲覧/編集専用で、API bearer tokenとして受理しない。永続clock・logoutとstore/表示への接続は後続で、現行previewを7日offline対応と表示しない。

## 発行と認可

明示的な `PrivateOfflineGrants` をprivate app factoryへ渡した場合だけ `POST /v1/workspaces/:workspaceId/offline-grant` を登録する。bodyは `clientId, epoch, nonce` のみ。nonceはnative生成の32 random byteを小文字hexにしたchallenge。callerのowner/時刻/TTL/署名鍵を受け付けない。

既存SessionVerifierの署名検証後、PostgresPrivateTransactionsで現在のowner/workspace/deviceをSHARE lockし、epoch一致とsession期限を検査して署名する。署名後も時刻/認証期限、commit前の認可leaseを確認してから応答する。device失効/別owner・issuer/epoch違いは拒否する。返却は `protocolVersion:1, grant` と `Cache-Control:no-store`。schema変更、DBへのgrant保存、本文/profileログはない。

署名鍵はtrusted server compositionへ渡す専用Ed25519 private CryptoKeyで、生成や既定値へのfallbackはしない。現行 `private-runtime` はkey設定をまだ接続していないため、通常起動ではこのrouteを提供しない。配備用秘密鍵・native公開鍵pinの配布は別工程。

## 形式とnative検証

compact JWS headerは `alg:EdDSA, typ:greiva-offline-v1+jwt, kid` の3項目だけ。claimsは `iss, aud, sub, authIssuer, workspaceId, clientId, streamEpoch, iat, exp, nonce` だけ。`exp=iat+604800` を固定し、延長/短縮/未知field/重複field/任意JWK/URLを拒否する。subjectにはopaque IDだけを用いる。

Native verifierは信頼したissuer/audienceと最大8個のkid/32-byte public keyをpinする。tokenから鍵を取得しない。8 KiB上限、canonical base64url、Ed25519 strict verification、全scope一致、UUIDv7、nonce/時刻範囲を検査する。型を混用せず、通常JWT・別alg・別typeを拒否する。[ed25519-dalek 2.2.0](https://docs.rs/ed25519-dalek/2.2.0/ed25519_dalek/struct.VerifyingKey.html)の `verify_strict` を使用し、weak keyを拒否する。

`VerifiedOfflineGrant` は外から構築/deserializeできない。オンライン受領はnativeが保持したchallengeと照合し、期限判定は `iat <= now < exp` と `now >= high_water`。期限ちょうどは拒否する。high_waterは今後nativeの保護された永続状態から渡し、UI時刻や接続復帰だけで更新しない。単体の検証関数だけではclock rollback・再起動・logoutを全体として防げないため、実装完了範囲を区別する。

署名が正しくてもSQL/本文操作を直接許可するIPCは追加しない。grantをOS保管・native session世代へ束縛し、期限/失効時のhandle閉鎖・draft/確定pending保全を接続してから画面を有効化する。完全offlineでremote失効を即検知できない最長7日の境界は採用方針どおり。

## 検証

Rustは署名/全scope/未知header/重複claims/期限/nonce/時刻逆行を検査する。Docker実PG＋署名sessionのHTTPで発行したgrantをRust driverへstdinで渡し、7日直前/ちょうど期限・別device・改ざん・別nonceを確認する。private key/発行grantを証拠へ保存せず、結果だけを記録する。[検証証拠](../../tests/evidence/native-offline-grant-20261013/SUMMARY.md)。
