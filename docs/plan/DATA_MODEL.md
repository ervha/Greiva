# 本番データモデル候補と移行条件

v0.27.0：native fixed rootの独立 `devices.sqlite` schema1へissuer/subject_id/client_idを保存する。issuer＋subjectが主キー、clientIdはunique/immutable、メール・profile・tokenなし。workspace SQLite schema6は保持し、missing device metadataや旧rootを推定取り込みしない。[実装契約](../development/PRIVATE_DEVICE_IDENTITY.md)。

2026-10-07追記：[個人情報・暗号化設計](ACCOUNT_PRIVACY_ENCRYPTION_SPEC.md)はメール等のAuth限定保管、本文/title/履歴/Conflictを含むDB・backupの保存時暗号化を要求する。server復号を許容し、既存Yjs差分/structured意味検査を維持する。独自暗号wireやE2EEへの自動migrationは追加せず、具体保管方式/鍵管理/保持を提供前に確定する。

2026-10-05、設計案。[統合要件](GREIVA_REQUIREMENTS.md) §5–7を具体化する。物理migration/新operation schemaは未実装。現protocolは[packages/protocol](../../packages/protocol/src/index.ts)、native schemaはRust page-store、serverはStructuredRepositoryが所有する。要件と実装の差を黙って正規化しない。

## 正本と論理識別

| 対象 | 正本/識別 | 保持する契約 |
| --- | --- | --- |
| Workspace | structured entityの分離境界 | member/role/resource権限。role種類は未決定 |
| Page metadata | workspaceId＋Page ID＋document参照 | title等は本文binaryと別。現PoC titleは端末内のみ |
| Page body | Y.Doc binary、doc IDとschema version | JSON/textはprojection。Record本文からも同じPage参照 |
| Task | workspaceId、ID、title/status/due/version/tombstone | dueはdate-only。現在statusはtodo/in_progress/done |
| Relation | workspaceId、ID、from/to typeとID、version/tombstone | endpointのworkspace/権限と削除整合を検査 |
| Operation | 安定operationId、client/device、対象、payload、base/causality | immutable prepared wire、ACK/receipt、retry状態 |
| Conflict | ID、対象/field、base/local/remote、status、解決operation ID | 選択は新操作。候補を失わず履歴追跡 |
| CRDT projection | document/schema/source clock等の再生成識別 | 本文の正本へ昇格しない。workspace認可に従う |

内部entity/operation IDは現UUID v7契約を基準にする。Auth user IDは外部identityの形式で、全IDを現entity schemaへ無理に当てはめない。client/device IDもユーザー認証の証明ではない。端末時計は表示/監査用で、競合の勝敗やcursor順序へ使わない。

**ID採番の仕様差の整理:** 旧統合要件§5.3はserverが操作IDを採番と記したが、§7.1のoffline enqueue/operationId再送と現PoCはclient生成IDを使う。委任に基づき、client生成operationIdを冪等キー、serverはserverOrder/entity version/cursor発行とし、要件v0.8へ明記した。server receipt IDが別途必要なら別fieldとする。[判断記録](../decisions/production-foundation-plan.md)。

## ローカル保存案

v0.12.0で新規namespace用のprivate schema1と正本metadata/read view/bootstrapを実装。private_workspacesのowner pair（issuer＋subject）はunique（初期ownerごと1workspace）、epochはserver採番して耐久化。private_devicesはworkspace所属とrevoked、private_resourcesはtyped ID/所属/tombstoneを保持する。resource payload、Page metadata title/本文、structured streamは別の未実装契約。既存namespaceはinstallせず、旧PoC移行/upgradeは未提供。[受入/制約](../../tests/evidence/private-bootstrap-20261005/SUMMARY.md)。以下のnative workspace保存案へは未接続。

- entity replica、pending operation/prepared wire、ACK receipt、Conflict、workspace単位のcursorを持つ。端末物理schemaとPostgreSQLの完全一致は要求しない。
- entityの即時表示用projectionと、ACK済み基底・pending intentを区別する。pullで未送信intentを消したり、Conflict候補を現在値だけへ縮約しない。
- Pageはmetadata＋binary journal/snapshot。digest、順序、document identityを検査し、破損を空Pageへ置き換えて続行しない。
- account/workspace切替ではstoreの参照先を明示し、前workspaceのqueue/draftを新workspaceへ送らない。単一streamのPoC cursorを新workspaceへ流用しない。

現native SQLite user_versionは4、server schema_versionは3。これは別schemaの番号で、同期wire/Editor schema/app versionとの一致を要求しない。将来のprotocol/storage/editor版は各責務で互換判定する。

v0.10.0以降のprivate ownerはAuth issuer＋opaque subjectの組で識別する。同じsubの別issuerへ所有権を渡さず、read viewはowner_issuerを必須とする。v0.11.0の独立HTTP試験でもこの境界を使い、v0.12.0で上記のfresh metadata schema/bootstrapへ進んだ。旧DBからのmigrationは未実装。

## サーバー保存案

entity、version付き基底履歴、immutable operation request/result、Conflict、cursor/stream metadataを同じworkspaceへ所属させる。operation冪等キーの一意性と他workspace再利用時の拒否規則を定める。serverOrderはwireでdecimal string、cursorはopaqueとし、clientが時計や数値へ変換して進行を推定しない。

CRDTはdocument所属・schema・binary正本を保存し、structured Page metadataから参照する。collaboration接続時のworkspace認可も同じ所属へ照合する。PoCのfile journalはこの本番物理schemaの実装済み証拠ではない。

## 後続モデルの接続

- DB定義/Record/型付きProperty/Viewは[DB仕様](DATABASE_SPEC.md)に従う。Task/Scheduleを早期にEAVへ置換せず、binding/型変更/索引を別契約にする。
- Schedule/Rule/Exception/Additionsは[Calendar仕様](CALENDAR_TIMETABLE_SPEC.md)。Task dueの日付と予定のtimezone付き開催時刻を混同しない。各回の表示は再生成する。
- Button/Automation/Executionは[action仕様](BUTTON_AUTOMATION_SPEC.md)。同期operationのACKと外部actionの実行成功は別状態。二重配信防止と部分完了を追跡する。
- AI会話/録音/生成Page/監査の保持期間は[AI仕様](AI_ACTION_SPEC.md)で分ける。会話や録音削除で作成済みPage/Taskを削除しない。

## 移行の受入条件

1. 元DB/versionと対象版を検査し、online backupを取得。backupを別保存先へ復元して全文・digest・操作を検査できる。
2. workspace未所属のPoCデータの帰属、未送信/ACK済みoperation、旧server cursor、端末内titleの移行規則を選ぶ。IDを保持するかmappingを作るかも記録する。PoC取り込みを初期版で提供するかは未決定。
3. migrationは所有transactionで確定し、途中killでは旧形式または完全新形式へ復元する。失敗後に元DBを消したり成功ラベルを表示しない。
4. 未知の新schemaを旧appで開いたら書込みを止め、更新/復旧の導線を示す。down-migration可能とは仮定しない。
5. 他workspace/端末へ旧pendingを誤送信せず、本文・metadata・Task・Relation・Conflictの数/内容、ID/clock、queue/receiptを照合する。

snapshot compaction、tombstone/operation/historyの削除時期、offline端末のrebase/再bootstrapは保持契約とセットで決める。期間や件数をこの案で仮定して削除しない。
