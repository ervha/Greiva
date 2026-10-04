# 個人版の認証・認可契約候補

2026-10-05、設計案。利用者の回答により、初期版は個人利用/自分の端末間同期を先行する。共有・招待・public linkは初期提供へ含めない。Supabase Authは[統合要件](GREIVA_REQUIREMENTS.md)の候補で、instance/鍵/認証UIは未設定・未実装。

## 主体とworkspace

認証済userと所有workspace、device/client identityを区別する。初期のprivate workspaceへ他userを書き込ませない。role名称/将来のresource sharingは拡張案として残し、未提供のinvite画面を作らない。workspaceのIDやdoc名を知るだけではアクセスを許可しない。

APIはtokenのissuer/audience/署名/有効性を検査し、操作対象の所属をserverで照合する。pull/list/history/Conflict/CRDT/projection/exportの全経路で同じworkspace境界を通す。client bodyのactor/clientIdをAuth主体と誤認しない。

## serverとRLS

clientのDB直通を提供する場合はRLS/権限契約が必要。API経由の場合もservice credentialによるRLS bypassを理由にapplication認可を省略しない。collaborationでのJWT/session・document権限とHTTP sync認可は同じ契約にする。個人間でoperationId/doc名/cursorを入れ替える試験を行う。

初期版のaccess policyは「所有者だけ」。RLSの具体SQL、JWKS更新/失効、device失効、account/workspace初期作成の冪等性は実装時の詳細契約へ落とす。test tokenを本番の認証実装として提供しない。

## 端末とoffline

tokenをCRDT、sync operation、本文projection、logへ入れない。native token保管とWeb session保管はplatformごとに設計し、平文local settingsへrefresh tokenを保存しない。account切替後に前accountのpending/draftを新accountへ送らない。

offlineで既存端末データを読む/編集する権利、logout/device失効時の保持/消去/再ログイン、期限切れtokenと端末保存の関係は未決定。権限再確認中に「同期済み」を表示せず、保存済みpendingを勝手に削除しない。これらは[提供前の確認](PRODUCTION_READINESS.md)として扱う。

## 受入

別user/workspaceのlist/load/push/pull/CRDT/Conflict/export拒否、未認証/期限切れ/不正署名token拒否、所属偽装、account切替中の遅着response、logoutと未送信保存の保持契約、ログへの秘密情報混入なしを検査する。実Auth providerを使った正常login/refresh/失効を別に検証し、fixture署名検査だけで本番合格にしない。
