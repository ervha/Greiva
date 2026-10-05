# 署名sessionと発行元別owner — 自律判断全件

2026-10-05、v0.10.0。Supabase未作成・local実装/自動試験先行という利用者回答に従う。[証拠](../../tests/evidence/signed-session-20261005/SUMMARY.md)。以前の判断: [提供順9](production-foundation-plan.md)、[command13](production-command-foundation.md)、[読取12](private-workspace-access.md)、[wire/cursor12](workspace-sync-boundary.md)。

1. JWT暗号を独自実装せず、APIだけへjose6.2.12をexact pinで追加する。Docker registryで版を確認し、[joseの一次資料](https://github.com/panva/jose/tree/v6.2.12)と[Supabase JWT資料](https://supabase.com/docs/guides/auth/jwts)を参照する。
2. HTTPSのissuer/JWKS URL、audience、ES256/RS256の明示allowlistを必須にする。tokenのjku/jwkやbodyから取得先/algorithmを選ばず、HS256/noneへのfallbackを作らない。
3. issuer/audience/署名/expとsubを検査する。nbfがある場合もlibraryで検査、clock tolerance0。期限を独自に延長しない。expをsafe integerのepoch secondsとして返す。
4. Bearer schemeはcase-insensitive、compact tokenはASCII base64url/3segment/最大8KiB、余分な空白/改行や複数headerを拒否する。JWT/鍵取得前に不正形式を止める。
5. 設定値を非同期処理前にcaptureする。結果は検証済issuer/subject/expiryだけのimmutable objectで、token/role/email/任意claimsを返さない。
6. 不正sessionと鍵取得/設定元不通を別error codeにする。いずれもgrantしない。library causeにはclaimsが含まれ得るため、安全なcategory/messageだけを返しlogにtokenを入れない。
7. defaultはjoseのHTTPS remote JWKS、redirect manual/cache10分/cooldown30秒/timeout5秒という固定版の実装を使う。試験ではserver-owned fetch portへ公開fixture JWKSを渡す。requestからfetch portやcacheを書き換えさせない。
8. 署名検証だけでlogout/session失効/device失効/鍵rotationが即時に反映されたとはしない。cache/rotation/refresh/失効の運用と実providerは別gate。
9. 検証済session→private owner/resource→PG snapshotを共通adapterで接続する。session不成立時にresource metadataを読まず、targetをJWT待機前にcaptureする。旧PoC routerはまだ配線しない。
10. 異なるissuerの同じsubを同一ownerとしない。Domain/read-modelへownerIssuerを必須追加し、認可結果にも検証済issuerを含める。認可factoryは明示issuerを要求し、旧metadataへ暗黙の既定issuerを補わない。
11. このread-model契約変更はMINOR checkpointに含め、既存PoC DBや公開済artifactを移行しない。将来のproduction ownershipはissuer＋subjectで作成/移行する。
12. local試験は実EC/RSA署名とremote-JWKS処理＋fixture transport。秘密鍵はprocess内だけ、JWT/鍵をgit/evidenceへ保存しない。実Supabase login/refresh/networkとは区別する。
13. Auth14条件/owner11を含む通常105、専用PG22、型/通常Windows buildとsource/lock照合を行う。初回103後、issuer owner条件を追加して最終を再実行する。初回は製品の失敗ではなく途中結果。
14. 外部npmはjose1record追加だけ、既存314/Cargo外部を保持する。Dockerの別build cacheへ固定joseを追加し、host global toolchainを入れない。
15. current UI/IME/旧試験DB/通常PoCのwire/routesを変えない。新provider/Native合格や初期製品完成とはしない。Computer Use解除、利用者追加操作不要。
16. 次は署名session/owner照合を通す独立HTTP経路とlocal回帰を進める。Supabase未作成を待機理由にせず、production endpoint/配布/保持/importの必要事項を保持する。
