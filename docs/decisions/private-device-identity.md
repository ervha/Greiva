# アカウント別端末IDの判断

2026-10-08 / v0.27.0。利用者の開発継続指示に基づく自主判断。先行する本文保護方針は変更しない。

| # | 判断 | 理由・確認範囲 |
| --- | --- | --- |
| 1 | 通常画面compositionより先に安定clientIdを実装 | fresh IDで保存先が変わる問題を先に解消 |
| 2 | issuer＋subjectで分離 | 同subでも別issuerは別アカウント |
| 3 | fixed rootの独立devices.sqlite/schema1 | workspace schema6と旧PoC DBを保持 |
| 4 | メール/profile/token/passwordを保存しない | 検証済み主体と端末登録IDだけが必要 |
| 5 | UUIDv7候補とstrict owner入力 | 任意path/SQL/追加private fieldを受け取らない |
| 6 | BEGIN IMMEDIATE＋unique＋immutable | 並行初回登録を直列化、他ownerへ再割当しない |
| 7 | COMMIT前後SIGKILLを試験 | rollbackと応答喪失後の同ID復帰を確認 |
| 8 | missing metadata/foreign DB/未知版では停止 | 空の代替保存先や推定取り込みを避ける |
| 9 | lookupでactive workspace handleを失効させない | 既存pending/処理の保存先を保持 |
| 10 | Auth検証後のauthorized世代内で解決 | 取消/期限/遅着でconnectionを復活させない |
| 11 | preparing_device状態と安全なエラー | 登録前の待機と失敗を操作上も明示 |
| 12 | nativeエラー時random fallbackなし | 別DBを新規選択しない |
| 13 | browser診断はmemory-onlyを継続 | Web durable実装やnative grantへ転用しない |
| 14 | 実HTTP/PG/Rust SQLiteで再ログインpending保持 | exact wireと登録件数まで照合 |
| 15 | Docker画面のinvoke doubleと実libraryを区別 | 実Windows/IME/正常Supabaseの証拠ではない |
| 16 | v0.27.0の検証済みcheckpointを保存 | 外部依存不変、通常composition/native認証は次工程 |

[実装契約](../development/PRIVATE_DEVICE_IDENTITY.md)、[証拠](../../tests/evidence/private-device-20261008/SUMMARY.md)。
