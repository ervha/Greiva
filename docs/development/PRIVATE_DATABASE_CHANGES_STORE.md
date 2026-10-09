# DB差分の端末保存

2026-10-09 / v0.56.0。[server journal](PRIVATE_DATABASE_CHANGES.md)のRecord/View windowを既存[read cache](PRIVATE_DATABASE_CONTENT_SESSION.md)へ原子保存する。[判断16件](../decisions/private-database-changes-store.md)、[証拠](../../tests/evidence/private-database-changes-store-20261009/SUMMARY.md)。native11→12、server11保持。差分HTTP/session/runtime、Source/Record/View作成・更新queue、Table/List画面は後続。

## 原子受信と再開

database_changes_receiveは保存済みSource、strict request/reply、protocol/workspace/epoch/device/Source/schema/journalEpoch、event種類/順序/型/候補、max100/raw位置差を照合する。native側のcompact JSON event合計を64MiB以下に制限する。serverのPostgres JSON text予算64MiBとは別の端末guardで、test-only size overrideは設けない。値をcoerceせず、NameやPage bodyを生成しない。

gdb1 cursorのnamespace/canonical base64url/32byte署名envelope/Source・device・journal世代/十進orderをnativeでも照合する。server鍵をnativeへ渡さず、HMACやJWT/native Auth grantを検証したとはしない。orderはi64/JSではexact decimal stringとし、safe integerへ丸めない。

Source別receipt/event/progressの3表と、Record/View候補のresolved_by/resolution_receipt_idを追加する。receiptはcanonical request/reply hashで、event/current/history/候補・解決/progressと同transactionで保存する。保存済みcursor/orderからのみ前進し、journal世代を暗黙に置換しない。filtered空windowは位置だけを進め、local entityや候補を削除しない。query windowのreceived/head/hasMoreは観測状態で、全DB同期済み/送信ACKではない。

## read cacheとの統合と証拠

Record/Viewの既存保存処理を共通transaction helperへ分け、readとdeltaが同じhistory/current/候補を使う。新しいreadで得た版が先行している場合、古いdeltaは履歴を補ってcurrentを戻さない。同版内容違い/候補IDのcore変更/known・後着baselineの矛盾はwindow全体をrollbackする。

read観測のreceiptとdelta eventのreceiptを区別する。delta receiptは元windowとevent位置へ参照し、scope/hash/保存event/保存progressを照合する。snapshotや候補を架空のserver read responseとして保存しない。current最大保存版/history/receiptとcandidate/lookahead/known baselineを従来どおり検査する。

候補coreはresolvedBy:nullの元三値として不変に保存し、解決IDを別columnと、その値を観測したdelta receiptへ紐づける。最初から解決済みのseedも受け付け、旧null/readで解決を消さない。異なる解決IDは拒否する。local Record/View loadは既知候補をresolvedBy付きで返すよう拡張する。server read/writeのactive候補制約は保持する。解決受信はlocal操作queueの消去やACKではない。

正確replayでは元window・event・history/current・候補・解決proofを検査し、最新cursorを巻き戻さない。失われたevent/history/候補を再構築する補修ではなく拒否する。local progressも元receipt/eventと最大保存read位置へ照合し、空fallbackや修復で不整合を隠さない。

## 移行・IPC・検証

bound contextを先に照合し、native0/5/6/7/8/9/10/11から12へ同transactionで移行する。Source/Record/View/Page/title/Task/Relation/旧queueを保持し、DB progressは未受信order0/cursor nullから始める。foreign binding/partial DDL/未知schemaはrollbackし、通常PoC DBの帰属を変更しない。旧binaryへ戻すdowngradeは提供しない。

Registry strict IPC/captured native storeはSource/context/型/件数と世代を照合し、path/SQL/profile/token注入を拒否する。Auth refresh/closeで旧instanceを拒否する。actual Rust/SQLiteの25条件＋旧native101、COMMIT前後の実SIGKILL2でmixed window・解決・receipt/event/cursorが同じ境界で回復することを確認する。高位order試験は長期journal状態のSQL fixture seedを区別し、その後のnative増分を実際に保存する。

HTTP差分の接続は次工程である。今回はnative driver証拠で、実Supabase正常login/Windows actual invoke/MS IME/Android/native credential・offline grant/配備暗号化/Gateと分離する。
