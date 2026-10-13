# v0.77.0 バックアップ検査・鍵更新

2026-10-13。[CLIと再現手順](../../../docs/development/PRIVATE_BACKUP_REHEARSAL.md)。利用者の実Auth操作を保留して進めたP4の独立工程。

| 検証 | 結果 |
| --- | --- |
| 対象unit/実CLI | 7 Pass。既存5件に読取専用verify、非破壊rotate、改ざん/旧key/同一key byte/不正key/path/上書き拒否を追加。平文一時fileなし・元archive不変・固定diagnosticsを確認 |
| 全unit | 484 Pass、Fail/skip 0 |
| 型/servers/frontend/Windows build | Pass。owned版0.77.0、frontend test hooks/SQLite bridge 0。通常候補のPE/SHAをhost照合。Windows GUIは起動しない |
| 旧版互換・実復元 | v0.76.0で生成した架空PG18.4 archiveをverify→rotate→verify→decrypt。元暗号文不変、新nonce、旧key拒否、元dump byte一致 |
| PostgreSQL | 新規の空DBへ単一transactionでrestore。33 tableのhash/件数、6操作の元結果replay、差分cursor継続、schema11 readinessを確認し、専用DBを削除 |
| Source | Host/Docker 382件一致（raw372・改行のみ10）、意図的対象外5はverification.jsonに記録 |
| 外部依存 | npm315/Cargo501・118 unchanged |

元archiveの生成・seedは[v0.76.0証拠](../private-backup-20261013/SUMMARY.md)を使用する。今回のcrypto-rehearsal.jsonは旧archiveの暗号文hashと新旧関係を保持する。dump/control/key/JWE/復号物をgitへ含めない。

復元準備では最初の2回、root所有0700の親directoryをpostgres OS userで読めず、pg_restoreが入力open時点で拒否された。2回目のfile所有者だけの修正では解消せず、親権限を確認後、0600のfileを同じ所有者で読む方式に修正した。DB接続は開発用greivaロール。両試行とも作成したDBをfinallyで削除し、残存0件を確認した。initial-restore-errors.jsonに保持し、成功とは集計しない。Windows buildの既存linker warningはログに保持。

全PG/画面E2Eと切断dump rollbackは今回再実行していない（API/schema/UIに変更なし）。Windows IME・実Auth・本番KMS/自動rotation/保持廃棄・native端末backup・最終Gateは別条件。private実接続候補は引き続きv0.75.0。
