# v0.76.0 暗号化バックアップと別DB復元

2026-10-13。実ユーザーの認証操作を保留したまま、P4の独立したbackup準備を実装した。[契約/再現手順](../../../docs/development/PRIVATE_BACKUP_REHEARSAL.md)。

| 検証 | 結果 |
| --- | --- |
| 暗号化/復号・実CLI | 5 Pass。wrong key/header/IV/ciphertext/tag改ざん、切断/追加、非archive/サイズ、既存file/symlink/公開権限/鍵同居拒否 |
| 全unit | 482 Pass。初回fixture build時点。最後のtemporary所有権cleanup guardとkey権限拒否追加後、対象5件を再確認（backup-final） |
| 型/servers/frontend/通常Windows | Pass。app-owned版0.76.0、test hooks/SQLite bridge 0。通常PoC候補のPE/SHAをhost照合。private実接続候補0.75.0は別に保持 |
| 実PostgreSQL 18.4 | schema11の33 tableをpg_dump→JWE→復号→別空DBへrestore。全row hash/件数一致、6 immutable結果replay、復元前cursor継続・再送後のhash不変 |
| 壊れたdump | pg_restoreのsingle transactionが失敗し、対象fixture schemaは0件。途中tableを残さない |
| Host/Docker source | 382件: raw372、改行のみ10、意図的対象外5。source inventoryを保存 |
| 外部依存 | npm315/Cargo501・118 unchanged |

core cryptoは初回からPass。fixture作成の初回はschema名prefix不足で書込み前に拒否された。復元コマンドの初回はPowerShell引数組立てでparse失敗した。元失敗の内容と訂正をinitial-fixture-errors.jsonへ残し、復旧後のseed/restoreを別reportとして保存する。

seed/restoreは架空データだけのtable名・件数・hashを証拠へ保存する。dump/JWE/key/control/復号物はgitへ含めない。単なるPGDMP magicの検査はSQL検証ではなく、信頼したarchiveを隔離先へ復元した証拠である。

今回API/保存schema/UIを変更しておらず、全PG225/画面98は直前v0.75.0の証拠として保持し、再実行したとはしない。最新通常WindowsのGUI/IME、実Auth、本番KMS/backup運用、native端末backup/復旧、Android/署名/最終Gateは未確認。
