# 個人workspace Page本文の保存基盤

v0.21.0。独立保護APIのschema3にPage binary bootstrap/append/readを追加する。HTTPは耐久保存・認可の検証経路で、通常Editor/Hocuspocus/端末queueへ未接続。実Supabase正常ログイン/通常native IMEの証拠ではない。

## 明示upgrade

既存schema2のPage metadataは0件である必要がある。本文のないresourceを推定初期化しない。既存structured ledger/署名key/workspace epochを保持する。API/previewを停止し、backupと対象namespaceを確認してDocker内で実行する。startupではupgradeしない。

```powershell
docker compose -f infrastructure/private-api/compose.yaml stop api preview
docker compose -f infrastructure/private-api/compose.yaml --profile setup run --rm schema node apps/api/dist/init-private.js --pages
docker compose -f infrastructure/private-api/compose.yaml --profile preview up -d api preview
```

初期設定は[保護API起動](PRIVATE_API_STARTUP.md)、schema1→2は[structured同期](PRIVATE_STRUCTURED_SYNC.md)。再install/partial schema/unknown版/orphanは失敗してrollback。volume削除・旧PoC DB取り込みは行わない。

## HTTP契約

すべてPOST、Bearer署名JWTと登録済みclientIdが必要。pathは `/v1/workspaces/:workspaceId/pages/:pageId/document/`。strict JSON commonはprotocolVersion:1、clientId、editorSchemaVersion:1。

| 末尾 | 追加request | 応答 |
| --- | --- | --- |
| bootstrap | title、initialUpdate（canonical base64url V1） | metadata、initialDigest |
| append | update（canonical base64url V1） | digest、serverOrder、headOrder、stateVector |
| read | stateVector（空clockはAA） | metadata、headOrder、update、digest、stateVector |

応答にはprotocol/workspace/Page/doc名/schemaのbindingがある。状態vectorを権限・端末保存・同期完了と扱わない。再送は同ID/同parsed bootstrap requestまたは同binary frameを使う。append再送は元order、最新head/vectorであり応答全体の不変性ではない。bootstrap metadataのupdatedAtも本文frameに応じて変わる。

署名不正401、所属/失効/削除403、不正bytes/vector400、bootstrap IDの内容変更/未知Editor版409、保存基盤不備503。private内容/SQL/tokenはエラーへ返さない。schema2ではPage document routes自体をmountしない。旧aliases/CORS/PoC WebSocketへ認可済み扱いでfallbackしない。

## 保存と制約

Page単位append-only bytea journal＋decimal head。digest/連続orderを検査してgc:falseで復元し、未知XML/attrsや未到着依存を残す。readはstate-vector diffを返す。本文はJSONからrebuildせず、破損を空Docへresetしない。COMMIT前後SIGKILL/同frame retry、実HTTP再起動/失効、並行6peer、600k合成diffを試験する。

入力update512KiB/title65,536文字/vector65,536 base64文字は診断transport上限。合成応答へ入力上限を流用しない。Doc最大規模/SLO/retention、compaction/snapshot、metadata rename/delete/Conflict、WebSocketの継続認可・room cache、端末SQLite/Page queue、通常UI/IPCは後続。

[全22判断](../decisions/private-page-binary.md)、[証拠](../../tests/evidence/private-page-20261005/SUMMARY.md)。
