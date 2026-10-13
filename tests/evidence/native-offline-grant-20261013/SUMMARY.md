# v0.79.0 署名付きoffline grant

2026-10-13。[契約](../../../docs/development/NATIVE_OFFLINE_GRANT.md)。factoryへ専用signerを明示した場合のHTTP発行とnative検証で、通常runtime/UIにはまだ接続しない。

| 検証 | 結果 |
| --- | --- |
| Rust | 全8 Pass（credential5＋grant3）。Ed25519 strict signature、未知/重複field、scope全項目、TTL/nonce、7日直前/期限ちょうど、high-water逆行 |
| 新HTTP/実PG/native相互運用 | 3 Pass。署名session→実認可transaction→Node発行→Rust検証。auth/body/epoch/失効device/不正key/時計拒否、最終no-store header確認 |
| 全unit | 484 Pass |
| 全PostgreSQL | 36 files / 228 Pass、Fail/skip 0。test-postgres.mjsの固定一覧に漏れていた5群33件を含む |
| 型/build | 最終型/servers、frontend test hooks0、通常Windows0.79.0 custom-protocol build Pass。host PE/SHA一致、GUI未起動 |
| Source | Host/Docker390件一致（raw380、改行のみ10）、対象外5件をverification.jsonへ保存 |
| 依存 | npm315 unchanged。Cargo main501→506/page-store119→135。既存版/checksum不変、新規はEd25519検証のため。全追加entryをdependency-audit.jsonへ記録 |

初回typecheckはHTTP fixtureのunknown payload型で失敗し、JSON serializationへ修正した。initial-typecheck.logを保持する。grant-postgresは初回3 Pass、grant-finalはno-store追加後の3 Pass。先の固定一覧195 Passはall-postgres.log、全群228 Passはfull-postgres.logとall-postgres.json.gzで区別する。通常Windows linker warningは元ログに保持。

秘密鍵/発行token/credentialを証拠へ保存しない。native単体check_timeはtrusted high_water入力を検査するが、永続clockのOS保管やlogout/store/UI lockの接続は後続。実Auth・Windows IME・Android・本番署名鍵配置・最終Gateは未完了。画面E2Eは変更がないため今回は再実行しない。
