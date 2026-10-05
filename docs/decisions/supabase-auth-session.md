# Supabase認証sessionの全判断

2026-10-05、v0.15.0。P1のclient認証と保護APIの接続を進める自主判断。公開設定の提供は利用者回答に基づく。

1. project originとES256/RS256を明示設定し、issuer/audience/JWKSを導出する。tokenのclaims/jkuやlogin bodyから接続先を選ばない。通常PoC mainの既定providerは作らない。
2. 固定した[Supabase REST契約](https://github.com/supabase/auth/blob/master/openapi.yaml)のpassword/refresh/local logoutを薄いfetch adapterで実装する。新SDK依存を追加せず、全面Auth SDK互換は主張しない。
3. 初期adapterはEmail/passwordだけ。signup、OAuth/PKCE、callback、password recovery、CAPTCHA UI、メール配送の運用は別工程にする。検証用実ユーザーを勝手に作成しない。
4. providerのuser IDやclient側JWT decodeだけで認証済みとしない。Greivaの保護GET v1/sessionで実署名を検証し、設定issuer/provider user ID/subject/expiryが一致してからclient identityを公開する。
5. tokenはJavaScript private fieldのメモリだけで保持する。localStorage/SQLite/平文設定へ保存せず、public identityはissuer/subject/expiryだけ。OS credential adapterと再起動後ログイン復元は未実装。GCで暗号学的zeroizationを保証したとはしない。
6. 最初に検証済みになったownerをinstanceへ固定し、refreshや再ログインで別ownerへ付け替えない。account切替には旧instance closeと新instanceを使い、close後は復活しない。
7. port関数/配置設定とprovider responseの必要なprimitiveをawait前に捕捉する。待機中の呼出側設定変更や古いcallbackで別provider/storeへ付け替えない。
8. login/refreshを直列化し、refresh中の保護要求を拒否する。token rotationとserver verificationが完了するまで新tokenを公開しない。失敗時は未認証へ戻し、結果不明のrefreshを自動反復しない。保存済みpendingは削除しない。
9. tokenの期限はserver検証結果を使い、保護要求の前と結果返却時に期限を確認する。まだ自動timer/refresh schedulerやoffline権限を決めず、必要な明示refreshを実装する。
10. refresh/closeは旧generationの保護要求をabortし、transportがabortを無視しても遅着結果を返さない。新instanceの認証状態を旧requestで復活させない。
11. logoutはlocal状態を即closeした後、providerのscope=localを明示する。返却値providerLogoutConfirmedはHTTP成功確認で、既発行access JWTの即時失効や他端末のlogoutを意味しない。[公式session資料](https://supabase.com/docs/guides/auth/sessions)。DB消去/offline権利は推定しない。
12. credentialsはproviderのHTTPS POST bodyだけへ、accessは必要なAuthorization headerだけへ渡す。cookieをomit、redirectをerror、cacheをno-storeにし、15秒timeoutを付ける。Greiva APIのHTTPは開発用loopbackだけ許可する。
13. errorは固定stage/messageへ作り直し、provider body/HTTP error cause/tokenを公開しない。portが同じerror classへ秘密message/causeを入れてもそのinstanceを再throwしない。
14. serverのcreateSupabasePrivateAppで設定→実sessionVerifier→保護factoryを明示合成する。自動listen/migrationや旧PoC aliasのmountは行わない。
15. client14条件＋署名JWT/実HTTP2＋実PG/native SQLite1を追加する。provider login/refreshはfixtureで、実Supabaseへの公開HTTPS/JWKSと不正署名拒否は別証拠にする。通常GUI/OS credential/実ユーザーログインは未検証のままにする。
16. tracked standalone Cargo.lockに残っていたapp 0.6.11を0.15.0へ修正し、yoke-deriveだけを0.8.4から既存parent lockの0.8.3へ合わせる。parent外部Cargo/npmは維持し、driver全依存のname/version/checksumがparentに含まれることを監査する。版更新はowner blockに限定する。

v0.14記録の「ignored standalone lock」は誤りだった。実際にはtrackedで、Docker内で更新したlockをhost側のcheckpointへ戻していなかった。通常Windows appは正しいparent lockを使い、v0.14のdriver最終buildもparentと照合済みだったが、tracked試験用lockの版は古かった。今回追記で訂正し、両lockのowner整合と意図したdriver依存差を記録する。途中のhelperの一括version置換が外部synstructureにも触れた失敗はDocker内で修正し、hostへは最終監査済みlockだけをコピーした。

[検証証拠](../../tests/evidence/auth-session-20261005/SUMMARY.md)。通常UI、新workspace同期HTTP/CRDT、OS credential、実Supabaseの正常login/refresh/失効は別工程。個人データや既存試験Pageは変更せず、改善送信も未実装/未収集のまま。
