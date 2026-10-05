# 個人workspaceのstructured同期

v0.20.0。schema2の専用保護APIにTask/Relation push/pullを追加。通常PoCやPage本文/CRDTへは未接続で、ブラウザのログイン画面は引き続き登録確認のみを行う。

## 明示的な導入

[保護APIの初期手順](PRIVATE_API_STARTUP.md)で専用metadata schema1を作成する。既存schemaにTask/Relation resource metadataがある場合は対応entity/historyが不明なのでupgradeを拒否する。旧PoC DB/操作を自動取り込まない。運用環境ではbackup/maintenanceを確保し、同じschemaへ接続するAPI/previewを止めてから実施する。

```powershell
docker compose -f infrastructure/private-api/compose.yaml stop api preview
docker compose -f infrastructure/private-api/compose.yaml --profile setup run --rm schema node apps/api/dist/init-private.js --structured
docker compose -f infrastructure/private-api/compose.yaml --profile preview up -d api preview
```

imageのbuildは先に済ませる。metadata/版lockにより稼働中transactionとも排他するが、online upgradeの常時運用を保証する手順ではない。再起動はupで行い、upgradeを繰り返さない。readinessはversion1/2を認識し、version2の鍵/table不足を修復せず起動拒否する。署名鍵はDBへ一度保存し、dump/backupは秘密情報として扱う。キーをチャット/ログ/gitへ記載しない。

## wireと保存

POST /v1/workspaces/:workspaceId/sync/push と /sync/pull はprotocol/workspaceのstrict schemaを使う。JWT検証、path/body workspace一致、owner issuer/subject、登録client/失効を照合し、同一transactionの業務queryで処理する。client IDは登録参照で、物理端末の秘密証明ではない。

push batchは原子的で、同parsed JSONのoperation ID再送は元resultを返す。異内容の再使用409/operation_id_reusedは全batch rollback、別workspaceのID/対象/参照先は403。invalid payload/base等はimmutable rejected resultとしてledgerへ保存し、同wire再送でも変化させない。HTTP成功の後に端末ACK receiptを保存する必要がある。

Task/Relationのhistory/local-afterとConflict三値を保持し、異fieldはmerge、同fieldはConflict、新operationで解決する。delete/tombstoneを優先し、既存Conflictを解決する。Relationのlive endpointはtyped/same workspaceを確認し、tombstoneの遅着更新でもforeign frameを取り込まない。

workspace別counterはcommit順で採番し、bigintをNumberへ変換しない。pullはhead lockとsigned gw1 cursorでpage分割する。別workspace/epoch/不正署名/head超過/ledger gapは拒否。DB再起動後も鍵/epoch/orderを再利用する。compaction、epoch reset、key rotation、保持期限は別契約である。

## 現在の検証範囲

専用ComposeのAPI/previewはv0.20/schema2へ更新済み。元metadata0行を保持し、両loopbackの新sync経路は認証なし401、auth.html200。実ユーザーloginは未確認。[実PG/HTTP/2つのRust SQLite/プロセス停止の証拠](../../tests/evidence/private-stream-20261005/SUMMARY.md)、[全20判断](../decisions/private-structured-stream.md)。この検証をWindows/Android実IME、通常UI/IPCやPage CRDTの完成としない。
