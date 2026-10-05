# Page一覧取得の全判断

2026-10-05 / v0.25.0。継続開発と判断委任に基づく。

1. Page一覧は認証付きPOST queryとしてPage保存基盤へ追加する。既存normal UIや旧PoC APIを置換せず、個人/自端末の必要境界を先行する。

2. wire1/server3/local6を保持し、追加DDLを行わない。既存structured署名鍵を再利用し、gq1/kind page-listでstructured cursorと用途を分離する。

3. カーソルはHMAC-SHA256でworkspace/epoch/afterを固定する。canonical base64url、長さ、署名、strict claimsを検査し、改変/別workspace/epochを400で拒否する。カーソルは認可証明ではない。

4. JWT検証後、同じPostgres transactionのowner/device/期限leaseで一覧を読む。live resourceをSHARE lockして削除競合を保護し、入力からSQL/pathを受け取らない。

5. UUID順keyset、limit1〜100/既定50、limit+1のlookaheadで次ページを判定する。境界の変更はfresh queryで再取得し、複数request一貫snapshotやdelta同期と表示しない。

6. 一覧はmetadataだけを返し、本文binary/projectionを返さない。lookaheadも含めschema/id/doc bindingを照合し、破損を部分成功/空Pageへ置換しない。

7. clientは登録済みcontext/client/epochをcaptureし、strict requestをawait前に固定する。応答件数/並び/進捗/bindingを検査してfreezeし、storeへ自動書込しない。

8. Auth refresh/connection close/403で遅着queryの成功を拒否する。独立したread queryは並行可とし、metadata durable cache/rename/delete/Conflictの責務を創作しない。

9. connection.closeでnative cleanupが始まらない不具合を先に回帰で再現（6 Pass/1 Fail）。Authとconnectionのcombined generation signalへ変更し、shared Authを閉じず旧handle cleanupを開始する。同Authの再bootstrapではsignalを替えない。

10. v0.24でtrailing blank EOF警告後もPowerShellが進みcommitされた事実を保持し、v0.25でEOFを修正する。published tagを動かさず、依存するshell mutationは非zeroで明示停止する。

11. 新unit5/実PG3とsigned HTTP caseを追加し、通常224/PG69/browser2/型/frontend/通常Windows source116を確認する。既存browser2はportable/native adapter regressionであり、新catalog画面/実Tauri invokeの証拠ではない。

12. 専用Docker API/previewをv0.25へ更新し、server3・既存登録/epoch/鍵を保持、queryのdirect/proxy401を確認する。旧DB/IME失敗Pageを変更しない。

13. 所有版0.25.0とnpm/Cargo両lockを整合し、外部npm315/Cargo依存不変を監査する。選択ログをscanし、browser reportのenvを除外、exe/秘密/生成物はcommitしない。

14. 実Auth/native credential/offline保持契約/Hocuspocus/metadata同期は残す。telemetryは未実装/未収集。利用者の配色要望を次の独立UI変更として扱い、直ちに手操作を求めず進める。

[契約](../development/PRIVATE_PAGE_CATALOG.md)、[証拠](../../tests/evidence/page-catalog-20261005/SUMMARY.md)、[索引](../plan/AUTONOMOUS_DECISIONS.md)。
