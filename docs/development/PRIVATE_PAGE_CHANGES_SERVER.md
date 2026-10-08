# Pageタイトル増分server

2026-10-08 / v0.36.0。[title画面](PRIVATE_PAGE_TITLE_SCREEN.md)の後、別端末のtitleとConflict解決結果を取得するserver journalを追加する。端末への受信保存/session/画面は次の工程。[全16判断](../decisions/private-page-changes-server.md)、[証拠](../../tests/evidence/private-page-changes-server-20261008/SUMMARY.md)。本文/structured wire、native schema7、通常root入口を維持する。

## Journalとtransaction

private server schema5はworkspace別metadata headとimmutable eventsを追加する。順序は正のPostgreSQL bigintで、JS Numberへ変換せず十進文字列を使う。Page作成、title変更、Conflict作成、解決のmetadata/版と任意のConflict record/resolvedByを同じtransactionへ保存する。値の変わらないremote選択も解決eventを残す。単純no-op/rejection/同ID・同内容再送はeventを増やさない。operation/Conflict/title/history/本文初期化がrollbackすればhead/eventもrollbackする。

writerはschema SHARE→workspace/device認可→metadata head UPDATE→resource→documentの順でlockする。bootstrap retryもhead予約を先行し、renameとの逆順deadlockを避ける。headと最大journal orderを確認してから保存し、不整合headを修復しない。新workspaceだけは最初のwriterがhead0を初期化する。workspace内のmetadata writerは直列化され、採番後commit前に他writerが後続番号を公開しない。本文append/structured操作の全体をmetadata writerとして直列化しない。

eventは取得当時のmetadata/title版で、本文更新だけのupdatedAt変化はこのtitle streamの対象外。receipt再送や古いeventを現在の全metadataへ置き換える指示ではない。Conflict nullは「候補の変更を含まない」であり、既存候補を削除する命令ではない。解決recordは元の三値と新resolvedByを保持する。

## 増分API

schema5だけで `POST /v1/workspaces/:workspaceId/pages/metadata/pull` をmountする。strict requestはprotocolVersion1/clientId/cursor/limit1–100。署名session、issuer/subject owner、device所属・失効と期限を同一transactionで検査する。scopeはworkspace/epoch。durable structured署名鍵を再生成せず使い、cursorは専用 `gpm1`/`page-metadata` namespaceでworkspace/epoch/orderにHMACを付ける。別workspace/epoch/key/stream、noncanonical base64url、不正署名、headより先の位置を拒否する。cursor自体は認証・native grantではない。

head SHARE内でbounded order windowを取得する。最大101件のlookaheadと関連resource最大101件を検証する。最大orderはindexから一件だけ読み、全journalのcount/scanを毎回実行しない。raw event順がafter+1から連続しない、event/order/Pageが不整合、headと末尾が違う、lookahead破損、resource欠落はpartial payload/新cursorを返さず503で拒否する。

responseはafterOrder/readOrder/headOrder、events/hasMoreとreadOrderのsigned cursorを持つ。eventsは最大100件。deleted resourceをSHARE lock下で除外し、そのtitleや候補を返さずraw取得位置を進める。全て除外された頁はevents空/hasMore trueでもreadOrderが進む。これは削除通知やlocal tombstone ACKではない。最終頁はreadOrder=headOrder/hasMore falseで、そのrequestで観測したheadまでの終了だけを示す。複数requestの固定snapshot、本文/全端末の同期完了、将来変更がないことを示さない。

## 明示upgradeと検証境界

schema4を用意したDocker環境で `npm run init:private -w @greiva/api -- --page-changes` を明示実行する。version排他lock内で現在のcanonical metadata/title state/history/resource所属を照合し、既存Pageごとのcurrent titleと全Conflict（解決済みを含む）をjournalへseedする。解決recordは対応するapplied操作・Page/workspace/request choiceを検査する。無関係なowner/epoch/key/本文・structured dataを再生成しない。不正seed/部分DDL/reinstallを拒否し、DDLごとrollbackする。startupはread-only readinessでschema1–5を検査し、必要table不足はlisten前に失敗する。自動upgrade/repairは行わない。

Dockerでstrict protocol/cursor、実PGのatomic events/同nonce/no-op・解決、移行/rollback、並行create/rename、bounded filtered頁、腐敗拒否、期限中断、保護HTTP/CLI、COMMIT前後SIGKILLと全回帰を確認する。正常provider認証はfixtureで代用済みとはしない。title/candidate/event/cursor/token/メール/SQL causeをログへ追加しない。journalもDB/backup暗号化の対象だが配備暗号化は未検証。

次はnative schemaで受信eventとcursorを同一commitへ保存し、旧event/重複/入力pendingを保護する。取得しただけのmetadataでPage本文を暗黙作成・置換せず、captured Auth/世代取消を接続する。削除/復元/保持/GC、実Auth正常系、Windows invoke/実IME、Android、native credential/offline grantは残条件。
