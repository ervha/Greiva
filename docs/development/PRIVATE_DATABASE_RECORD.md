# 保護されたRecord保存と競合

2026-10-08 / v0.44.0。[Source保存](PRIVATE_DATABASE_SOURCE.md)と[portable比較](BASIC_DATABASE_MUTATION.md)をactual Postgres writerへ接続する。[判断16件](../decisions/private-database-record.md)、[証拠](../../tests/evidence/private-database-record-20261008/SUMMARY.md)。初期範囲は利用者回答Aの6型/Table/Listで、Table/List画面や端末DB同期は次工程。

## AuthとPage binding

`POST /v1/workspaces/:workspaceId/databases/:sourceId/records/write`はprotocol1/clientId/operationId/typed intentを受ける。canonical lowercase UUID、active owner/workspace/device/Page resourceを既存transactionで照合する。SourceをUPDATE lockして初回create、同Source内のoperation/Record/bindingを直列化する。Source definitionと実Page documentを確認し、NameをRecord.valuesへ複製しない。Recordは既存Pageを参照し、本文binary/title/headを変更しない。

bindingはSource内で同Pageに一つのRecord。Pageを別Sourceでも参照することはこの制約で禁止しない。binding替え、Pageの同時新規作成、Source schema編集、削除/Trash、Task/Schedule変換の実装ではない。Record IDは全体で一意、foreign IDの衝突を別データへ上書きしない。

## 原子的なwriterとimmutable結果

明示schema6→7でcurrent Record/history/operations/conflictsを追加する。Source/Page/structured/configを保持し、read-only readinessが4表を検査する。以前のschema1–6も対応し、7でのみRecord portをmountする。native schema8は未変更。自動migration/repair、retention削除は追加しない。

createはversion1のsnapshotとhistoryを保存する。updateはauthoritativeな基底historyと現在snapshotを照合し、portable三値planを使う。異fieldの変更を保持し、local無変更/同じremote値はno-op。unknown baseは現在値を変えずrejected receiptへ記録する。canonical state・history・新候補・解決reference・request/resultを同じtransactionでCOMMITする。

同operation/client/contentの再送は保存時点のexact receiptを返す。現在値や候補が後で変わっても過去の結果を再計算しない。再送にも現在Auth/Page/Source/Recordのactive確認を行い、receipt snapshotをその版のhistory、候補を元operationのimmutable candidateと照合する。別content/operation再利用は409。SQL/COMMIT結果不明を保存成功へ変えず、同IDで確認する。

## 三値候補と解決

同fieldのbase/local/remoteが異なる場合はstable候補を保存し、競合fieldはremoteを保持する。同じpatch内の非競合fieldは適用してhistoryを残す。receiptのstatus conflictを「全patch未適用」へ読み替えない。候補は作成時のbase/remote版と各値のpresent/valueを保持する。

解決は新operationのupdate intent。candidate ID/property/観測remoteVersion/choice、authoritative active状態と現在fieldを照合する。準備後の追越しはresolution_stale、他候補/改変値/解決済み/観測版の改変はresolution_invalidとしてdurable receiptへ残す。無関係なfieldだけが更新された場合は新しい現在snapshotから選び直せる。remote選択は値/versionが変わらなくても新操作とresolved_byを記録する。元candidate JSONと元receiptを消さない。

未設定keyと保存済みnullはsnapshot/historyで区別する。値比較上のunsetは従来通り同じ扱いだが、基底/現在の両方にkeyがない時の明示null patchは保存する。remote選択は欠落状態をそのまま保持する。0/false/blankをnullへcoerceしない。

## boundedな現在値/候補取得

`POST .../records/:recordId/read`はclientIdと既知Page IDを受け、current Recordとactive候補を最大20件返す。UUID keyset/limit+1でlookaheadも検証し、nextAfterを返す。snapshot/historyやcandidateのscope/version/型が壊れていれば空値へ置き換えず503。active候補のremote値が後から変わっても候補を黙って消さず、解決時にstaleを検査する。read完了やresolvedBy nullをworkspace全体の同期完了の保証に使わない。

## 次工程と検証境界

actual PGと署名fixture HTTP、COMMIT前/後SIGKILLを検証する。Record一覧/増分journal/View保存、native replica/queue/同ID再確認、runtime/Table/List画面は次工程。実Supabase login、host Tauri invoke/MS IME、Android/native grant、配備DB/backup暗号化と全DB/native GateはこのDocker証拠へ含めない。
