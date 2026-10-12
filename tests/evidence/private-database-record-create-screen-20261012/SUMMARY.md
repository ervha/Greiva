# 基本DBの行作成画面 checkpoint

2026-10-12 / v0.70.0 / native16 / server11。[契約](../../../docs/development/PRIVATE_DATABASE_RECORD_CREATE_SCREEN.md)。

## 実装

確認済みSourceに既存の端末保存Pageを関連付け、Text/Number/Checkbox/Select/Dateの未設定/null/値を明示してcreate intentを保存する。NameはPageタイトル参照で、本文を複製しない。型validation、draft/IME/navigation、copy可能なunknown入力と元intent/pairの再確認、FIFO送信とPage/Source待ちを扱う。確認済みRecordと保存操作を別表示する。

索引のPage binding読取は見えているRecord20件・queue5件の外も対象にし、nativeのcurrent/history/receiptと原create proofを検証する。known busyは書込なしで入力を保持し、初回preflight読取失敗はunknown保存にしない。元操作と一致したdurable bindingには元intentで再確認する。新しいschema/dependencyは追加しない。

## 検証

| 対象 | 結果 | 証拠 |
| --- | --- | --- |
| runtime22/native15/controller15 | 52 Pass（新5） | [report](focused.json.gz)、[log](focused.log) |
| actual Record signed HTTP/PG/SQLite | 10 Pass（新1） | [report](record-write-pg.json.gz)、[log](record-write-pg.log) |
| 新行作成画面・Enter保存含む | 8 Pass / 0 flaky | [report](workspace-ui-focused.json.gz)、[log](workspace-ui-focused.log) |
| 最終通常回帰 | 766 Pass / 221 PG条件skip | [report](normal.json.gz)、[log](normal.log) |
| 実PG全35files | 221 Pass / 0 Fail | [report](postgres.json.gz)、[log](postgres.log) |
| 全workspace画面・pointer回帰 | 72 Pass / 0 flaky | [report](workspace-ui.json.gz)、[log](workspace-ui.log) |
| 型・native/crash/server・feature・frontend hooks0 | Pass | [型](typecheck-final.log)、[native](native-build.log)、[crash](crash-build.log)、[server](servers-initial.log)、[features](native-features.log)、[frontend](frontend-build.log) |
| Docker Windows custom-protocol候補 | Pass・host未起動 | [build](windows-build.log)、[SHA metadata](windows-build.json)、[PE inspection](host-exe-inspection.json) |
| Host/Docker source照合 | 361：raw351、HTML/CSS等LF10、意図的excluded5 | [inventory](source-inventory.json)、[集計](verification.json) |
| npm/Cargo外部依存 | 315 / 501 / 118 unchanged | [audit](version-audit.json) |

新unitはwindow外のpending/confirmed binding、preflight失敗と競合後retry、元intentのidempotency、UI5件/limit、foreign/矛盾するIPC proofを扱う。actual追加条件は6件目のpending bindingを索引で読むこと、保存なしのbusy、原確認・restart後のACK/cache proof、未関連Pageと異scope拒否を実SQLite/HTTP/PGで確認する。新画面条件はtyped空文字/null/0/false/date、Page本文不変、保存だけではHTTP/confirmed rowなし、unknown入力/同wire/元pair/networkless retry、compositionとPage待ち、known ACK/一覧失敗、表示20件外のbindingと取消を確認する。

初回画面は6 Pass/2 Fail。window外Recordをseedするfixtureがv4 UUIDを使い、既存プロトコルのv7規則に拒否された。fixtureをv7へ修正し8 Passを確認した。原[report](initial-workspace-ui.json.gz)・[log](workspace-ui-initial.log)を保持し、native/runtimeの故障へ読み替えない。全72 Pass後、行作成の単独8条件だけをEnter保存を含めて再確認した。実装は変更していない。

[T3限定fixture確認](live-preview-inspection.json)でも端末保存時pending1/HTTP0/confirmed3、送信後pending0/原appliedを観測し、横はみ出しがないことを確認した。mock Auth/IPC/HTTPであり、actual native proofとは別のUI観測である。

[desktop](workspace-record-create-desktop.png)・[mobile dark](workspace-record-create-mobile-dark-reduced-motion.png)を目視確認した。

## 境界と次工程

行更新・既知Conflict解決とView設定保存へ続行する。未取得の別端末bindingを端末観測で否定できず、そのサーバー拒否の解消・Record削除/Page付替えは別工程。実Supabase正常系・最新Windows invoke/実MS IME・Android native、credential/offline grant、配備暗号化・復旧/配布・最終Gateは未確認のまま。Docker synthetic composition/cross-buildは実MS IME合格ではない。Git checkpointはinstaller公開ではない。
