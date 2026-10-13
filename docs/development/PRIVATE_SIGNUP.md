# 個人workspaceの新規登録

v0.82.0。利用者のB回答により、Supabase管理画面でのユーザー作成に代えて、Greivaの認証確認画面と個人workspaceプレビューへ新規登録を追加した。

## 動作

「アカウントを新規登録」でフォームを切り替え、メール・8文字以上のパスワードを端末から設定済みSupabaseの `/auth/v1/signup` へ直接送る。Greiva APIへ転送せず、DB/ログ/SQLite/IPCへ保管しない。public設定だけを使用し、管理APIやservice roleを追加しない。

登録依頼の受付を、メール配信完了・アカウント作成完了・認証成功として扱わない。providerが既存account用の仮responseやauto-confirm tokenを返しても、user/profile/tokenを解析・公開・保存しない。確認メールのリンクを開いた後、Greivaへ戻って通常のログインを行い、既存の署名session・owner/device確認を通す。[Supabase登録仕様](https://supabase.com/docs/reference/javascript/auth-signup)、[Password Auth](https://supabase.com/docs/guides/auth/passwords)。

フォーム切替・送信・接続閉鎖・pagehideでパスワードを消す。メールはフォーム入力中だけ保持する。busy中の二重送信を拒否し、composition中の送信/切替は入力を保持して拒否する。閉鎖はrequestをabortし、遅い成功応答で画面状態を復元しない。自動再送なし。providerの私的error文面や登録済みaccountの有無を表示せず、429は固定の受付制限表示、応答不明は確認メール確認と明示再試行を案内する。

## 検証と未整備

unit494、認証画面18、workspace画面98、型/buildと実Windows0.82.0候補の版・SHAを確認。[証拠](../../tests/evidence/private-signup-20261013/SUMMARY.md)。利用者が実登録・確認メール・正常ログインを実施し、Computer Useでnative認証済み表示・workspace開通を確認した。架空Pageの端末保存→強制終了→手動再認証→pending復元→実サーバー同期を独立SQLite/Yjs/PGで照合した。

確認メールの戻り先はproviderの既存Site URLを使用し、設定を自動変更しない。今回、メール確認後にlocalhostへ移動して接続できない事象が発生した。Greivaへ戻るとログインできたが、確認完了のlanding/callback導線は未整備。[失敗・未整備記録](../failures/private-signup-confirmation-redirect.md)。メール確認設定・URL許可・SMTPを自動で緩めない。

通常アプリの本番入口、自動ログイン復元、native refresh/資格情報/7日offline許可のUI接続、password回復、独自SMTP/CAPTCHA、公開配備の運用はこの追加で完成しない。基本の配色/レスポンシブ/keyboardはあるが、画面構成と登録導線の完成版デザインは別工程。
