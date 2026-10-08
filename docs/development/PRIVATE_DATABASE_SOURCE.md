# 保護されたDataSource保存

2026-10-08 / v0.43.0。[初期型/query](BASIC_DATABASE_FOUNDATION.md)、[変更比較](BASIC_DATABASE_MUTATION.md)に続き、personal workspaceのDataSourceを実Postgresへ保存する。[判断16件](../decisions/private-database-source.md)、[証拠](../../tests/evidence/private-database-source-20261008/SUMMARY.md)。利用者は同日、初期範囲A（Name/Text/Number/Checkbox/Select/Date、Table/List）を回答した。これは実装順の確定で、全型/全ビューの完成を意味しない。

## 保存と再送

署名済みsession、owner workspace、登録済みactive deviceを既存transactionで照合する。`POST /v1/workspaces/:workspaceId/databases/create`はprotocol1/clientId/operationIdとschemaVersion1のSourceを受け、definition/version1/creationOrderとimmutable request/result ledgerを一つのtransactionで保存する。Name正本はPage titleのままで、この保存はRecord/Page bindingを作らない。property/option IDはstableなUUIDv7で、PGによるcanonical化とreceiptの相違を避けるため全IDにlowercaseを要求する。

workspace headをFOR UPDATEで取得してから採番/保存する。creationOrderはcommit順に並び、allocationだけのidentity順を使わない。同operation/client/contentの再送は元receiptを返す。contentの違うoperation再利用と同Source IDの別createは409、他workspaceのSource ID衝突は403でrollbackする。replayにも現在のAuth/device/active Sourceを確認する。期限切れ、SQL失敗、COMMIT失敗を成功へ変換しない。sourceやproperty名、定義、tokenをloggerへ送らない。

`POST .../databases/:sourceId/read`だけが完全なdefinitionを返す。現在definitionは作成後immutableであり、schema変更/rename/deleteのAPIはまだない。scope/definition/version/orderの壊れた保存値を空Sourceへ置き換えない。

## boundedな一覧

`POST .../databases/catalog`は最大100件の小さいheader（ID、name、schemaVersion、version、creationOrder、propertyCount）を返す。大きいproperty/option設定を各行へ複製しない。raw limit+1をnumeric column順で読み、lookaheadも検査する。deleted行をfilterしてもraw範囲は進む。空のfiltered windowを「続きなし」と誤認しない。deleted試験は将来の境界確認であり、削除/Trash/端末purgeの実装ではない。

`gds1` cursorは既存のdurable secretからpurposeを分けたHMACを使い、workspace/epoch/client/after/observedHeadへ束縛する。exact decimal bigint、canonical encodingと署名を検査する。一覧開始時のheadを後続pageでも固定し、後から作られたSourceは次の新規一覧で取得する。creation catalogの観測をRecord同期、本文ACK、最新状態の保証へ使わない。

## 明示的なschema6

`installPrivateDatabaseSourceSchema`だけがschema5から6へtransactionalに進める。heads/sources/operationsと既存workspaceのhead0を追加し、既存Auth/Page/structured/config/namespaceを保持する。既に6、別version、失敗したDDLを自動修復しない。runtime readinessはread-onlyで構造を検査し、6でのみSource portをmountする。従来1–5の動作を維持し、6でもPage metadata journal/Task同期を検証する。native schema8は変えない。

## 次の工程

Recordのactual writer/history/三値候補/解決ledger、Page binding、bounded Record read、端末保存/同ID再確認、View保存、Table/List画面が次工程。SourceのAuthはworkspace ownerとSQL scopeであり、granular Source permissionの完成ではない。実Supabase login、Windows host invoke/MS IME、Android、配備のDB/backup暗号化、全DB/HELP受入は別に残す。
