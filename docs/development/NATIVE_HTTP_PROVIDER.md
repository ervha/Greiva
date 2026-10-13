# 固定設定のnative HTTP認証

v0.84.0。[session coordinator](NATIVE_SESSION_COORDINATOR.md)へ、実HTTPのSupabase password/refresh、Greivaの署名session照合、local-first logoutのprovider確認を接続した。通常previewのmemory-only認証や画面はまだ置換しない。

## 送信境界

`NativeHttpProvider::new`はnative deployment設定からproject/API/public keyを受ける。projectはcanonical HTTPS origin、APIはcanonical HTTPSまたは明示loopback HTTPだけ。userinfo/path/query/fragmentや`sb_secret_`を拒否する。scopeはapp ID＋issuer＋APIから作る。URL/token claim/WebView入力で送信先を変更しない。

password/refreshは固定`/auth/v1/token`へpublic key付きで送る。token responseのbearer型/JWT形状/subjectを検査し、refreshはOS上限2560 byte、accessは8192 byte。JWT payloadを本人確認に使わず、固定APIの`GET /v1/session`をBearerのみで呼ぶ。APIは既存の署名・issuer/audience/期限検証を行い、nativeはexact session schemaとissuer/subject/期限をさらに照合する。providerから返るemail/profileは参照・保管しない。

[reqwest 0.13.5の設定](https://docs.rs/reqwest/0.13.5/reqwest/struct.ClientBuilder.html)でredirect/retryを無効化し、cookie機能を有効にせず、環境proxyとRefererを使わない。各HTTP requestのtimeout15秒、接続5秒、成功JSON response最大64KiB。非2xx/巨大/非JSON/不正schema/重複既知fieldを固定errorへ変え、remote error本文やURL/causeをログへ返さない。Authorization headerはsensitiveとして扱う。

直接管理するrequest/response bufferはzeroizeするが、HTTP/TLS/allocator内部の複製bufferすべての消去を保証しない。secretをDebug/Serialize/IPCへ公開しない契約は維持する。実TLSはnative-tls（WindowsはSchannel）で通常の証明書/hostname検証を使い、CA追加やclient差替えは`cfg(test)`内部だけ。製品入口にTLS検証を無効化する設定を追加していない。

## logoutと確認結果

`logout_with_revoke`は先にmemoryを閉じ、SQLite永続lock/OS cleanupを試みてから、旧accessでproviderのlocal logoutを一度だけ送る。local lock、永続lock、cleanup結果、providerの2xx確認を別々に返す。応答不明/非2xx/新しいloginによるcancelでもlocal lockを取り消さない。永続commit失敗はconfirmedにしない。2xxはproviderへの要求確認で、既発行JWTの即時無効化をnative/API全経路で実証した意味ではない。

[証拠](../../tests/evidence/native-http-provider-20261013/SUMMARY.md)。実TLS fixture provider→Rust→実Greiva署名APIで正常login/rotation/logoutと失敗を検証。公開fixture JWKSをtrusted server test portから供給し、実ユーザーSupabase credentialや本番鍵は使わない。通常Windows buildは確認したが実起動/refresh/失効の実機受入ではない。

次はverified sessionのowner/generationをworkspace admissionへ固定し、raw contextだけで新しいnative入口を開けない構成へ進む。HTTP sync結果の原子的ACK/receipt適用、offline leaseとlogoutの同時lock、通常IPC/UI・公開鍵pin供給は後続。
