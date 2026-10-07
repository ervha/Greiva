# アカウント最小化・暗号化設計の判断記録

2026-10-07。設計のみのv0.26.1 checkpoint。[仕様](../plan/ACCOUNT_PRIVACY_ENCRYPTION_SPEC.md)。既存データ/認証/同期は変更しない。

1. **利用者回答**：メールのSupabase Auth保管は許容し、GreivaのDB・ログへのコピーを禁止する。Supabase Authを置換しない。
2. **利用者最終回答**：厳格な本文保護を見直し、A「通信・DB・バックアップを暗号化し、本文をログに残さない。サーバーでの復号は許容する」を採用。E2EEは初期提供の必須条件にしない。
3. **設計整理**：ユーザーは検証済みissuer＋subjectで識別する権限主体。プロフィールtable/メールhashを新設せず、workspace/端末と区別する。JWTの一時受信を「取得なし」と偽らない。
4. **設計候補**：本文/title/履歴/Conflictを含む保管先の暗号化、backup/鍵管理、TLS、ログ・権限制限を具体化。現server差分/意味検査を維持できる方式とし、E2EEとは説明しない。配備先の保護を実装済みとしない。
5. **利用者回答と条件**：端末内検索と明示範囲だけのAI等への本文送信は維持。以前のE2EE前提の復旧コード＋既存端末承認は最終回答Aに合わせ、本文復旧の必須条件から外す。本文保護の緩和を無断外部送信の許可へ拡大しない。
6. **実装差**：現Yjs/structured serverは平文を読む。将来E2EEを採用するなら新wire/鍵/端末処理が必要で、Task/Relationのbase/local/remoteをLWWへ縮約しない。現SQLite/署名cursor/通信保護をE2EE証拠にしない。
7. **導入条件**：実配備先のTLS/保管暗号化/restore/鍵/ログ監査を受入へ追加。本文/認証sentinel、既存同期/Conflict/未送信保存回帰、旧backup、保持/復旧の契約を確認し、既存データを自動削除・変換しない。
8. **今回の範囲**：仕様・関連文書・リンク/差分の確認のみ。新crypto依存、鍵作成、データ変換、server設定変更、Docker/native試験を行わない。PATCHとしてVERSION/CHANGELOG、annotated tag、指定remoteへのpushを行う。既存実行物はv0.26.0のまま。
