# 個人APIバックアップの暗号化と復元リハーサル

v0.76.0 / P4。既存 `pg_dump -Fc` アーカイブを暗号化し、認証付き復号後に別の空DBへ復元するためのoperator用Docker CLIを追加した。アプリ画面、自動backup schedule、既存DBへのrestore、鍵生成/配布/KMSは追加しない。実データの配備保護が完成したとはしない。

## CLIと形式

Dockerのrepo root、既存Node24と依存を使用する。

```sh
node scripts/private-backup.mjs encrypt /private/source.dump /private/encrypted/new-backup.jwe /run/secrets/greiva-backup-key
node scripts/private-backup.mjs decrypt /private/encrypted/new-backup.jwe /private/restore/new-restore.dump /run/secrets/greiva-backup-key
```

入力はPostgreSQL custom形式のmagicを持つ20 byte–64 MiBのarchive。magicはSQL内容の安全性/完全性の検査ではない。大容量streaming対応は後続とし、上限を超えた入力を切り詰めない。

固定したcompact JWE、`alg=dir` / `enc=A256GCM` / `typ=greiva-pg-backup-v1+jwe` を使う。既存joseが新しいnonceと認証tagを生成する。algorithm/nonce/compressionのcaller overrideは受け付けず、未知header/型/改ざん/途中切れ/誤keyを拒否する。鍵は外部から渡す32 byteのランダム鍵で、passwordを直接鍵にしない。外部依存の追加はない。[Node crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html)、[jose](https://github.com/panva/jose/tree/v6.2.12) を参照。

key fileはgroup/other権限なし、出力directoryもgroup/other権限なしとし、keyを出力directory内に置く要求を拒否する。入力/keyのsymlink、同一input/output、既存output、symlinkを介する出力親を拒否する。通常fileだけを上限付きで読み取り、読み取り中の長さ/mtime変更も失敗とする。

復号内容は認証成功までファイルへ書かない。認証後、同じprivate directoryに0600の一時fileを作り、fsync→hard linkによる非上書き公開→一時file除去→directory fsyncを行う。途中失敗は固定eventだけを出力し、既存fileを削除/置換しない。成功の確認前に落ちた場合は、完全なoutputまたはprivate temporaryが残る可能性がある。元archiveを保持し、勝手に既存outputを消して再実行しない。

stdout/stderrは固定service/eventとformat/byte数だけで、path/SQL/本文/key/例外causeを出力しない。使用後の直接参照bufferはzero化するが、runtime内部の全コピーやmemory dumpの消去保証ではない。CLIはoperator用で、remote要求に対して復号サービスとして公開しない。

## Docker試験の再現

1. Dockerで `npm run build:packages` と `npm run build:servers` を実行する。`npx vitest run tests/unit/private-backup.test.ts` は暗号化/復号と実CLIの境界を確認する。
2. ランダムな12桁hexをrun識別子にし、専用Postgresへ `greiva_backup_source_<run>`、`greiva_backup_restored_<run>` の空DBを新規作成する。既存DBを再利用しない。source DSNと `GREIVA_BACKUP_FIXTURE_RUN=<run>` をDocker内の非公開環境へ設定する。
3. `node tests/support/private-backup-fixture.mjs seed <ignored-control.json> <seed-report.json>` を実行する。指定runに一致するsource名以外は拒否する。schema11、架空Page/Yjs本文、Task、DB Source/Record/View、三値競合、immutable receipt、差分cursorを作る。control fileはfixture専用でgitへ含めない。
4. PostgreSQL 18の `pg_dump -Fc --no-owner --no-acl --schema=greiva_private_backup_fixture --file=<private-fixture.dump> <source-db>` を実行する。dump/control/key/復号物はprivateなignored領域に置く。上記CLIで暗号化→復号し、元dumpとのbyte一致を確認する。
5. `pg_restore --no-owner --no-acl --exit-on-error --single-transaction --dbname <restored-db> <decrypted.dump>` を実行する。restored DSNへ切り替え、`node tests/support/private-backup-fixture.mjs verify <ignored-control.json> <restore-report.json>` で全33 tableのhash/件数、6操作の元結果再送、復元前cursorの継続、schema11 readinessを確認する。
6. 別の新規failed用DBへ、末尾を切った架空dumpを同じsingle-transaction指定で復元する。失敗し、fixture schemaが0件であることを確認する。対象がこのrunで新規作成した3DBであることを照合して片付ける。

[pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html) と [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html) の方式を使用する。復元SQLは入力元を信頼できる場合に限り、権限を制限した隔離先で検証してから扱う。暗号化済みであることだけを理由に任意archiveのSQLを実行しない。このCLI自体はDBへ接続しない。

## 確認した範囲と残条件

実PostgreSQL18.4の架空DBで成功/失敗復元を確認した。table digestには本文binary・競合・履歴・署名cursor設定も含め、replay後もtable内容が変わらないことを確認する。復元先は別の空DBで、既存の開発DBや利用者データを置換していない。

本番のKMS/鍵rotation・別保管、暗号化storage、原dumpと復号一時領域の保護、backup保持/廃棄、schedule/監視、RPO/RTO、全cluster roles/権限/extension、native SQLite/device metadataのbackup/復旧UIは後続。鍵を失ったarchiveを本文ログ等から復元するfallbackは作らない。E2EE要件への変更ではなく、server処理時の復号を許容する採用済み方針に沿う。

[検証証拠](../../tests/evidence/private-backup-20261013/SUMMARY.md)、[個人情報・暗号化](../plan/ACCOUNT_PRIVACY_ENCRYPTION_SPEC.md)。
