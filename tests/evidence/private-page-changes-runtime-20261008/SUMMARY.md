# Pageタイトル増分接続の検証

2026-10-08 / v0.38.0。[契約](../../../docs/development/PRIVATE_PAGE_CHANGES_RUNTIME.md)、[全16判断](../../../docs/decisions/private-page-changes-runtime.md)。captured Auth transport/portable/native runtimeを接続する。server5/native8・本文/structured wireと通常rootを維持し、workspace画面は次工程。実Auth/Windows invoke・実IME/Android/native grant/配備暗号化は未検証。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 重点portable/native | 13 Pass | immutable元port/入力、protocol・bigint・filtered空頁、busy/close、unknown commit exact retry、fresh cursor、local-only open、catalog101、Auth更新/置換・admitted保存 |
| 専用署名HTTP/PG | 1 Pass | ES256/JWKS、二端末実SQLite、本文未取得catalog、restart、pending/wire、競合/同値解決、lost pull、deleted空window、失効後pending保持 |
| 通常全回帰 | 341 Pass / 94 Skip | 新portable8/runtime5＋既存328。PGは別run |
| PostgreSQL全回帰 | 94 Pass | 新二端末1＋既存93。通常PG runnerへ登録 |
| 型/servers/frontend | Pass | 最終型と通常test flags0 build |
| Rust/native features | Pass | locked normal/crash examples、default crash hooks無効 |
| Windows cross-build | Pass | Docker debug/custom-protocol。host PE版/SHA照合のみ、未起動 |
| host/Docker source | 265一致 | raw255、CRLF/LFのみ10、既存診断5を除外 |
| 外部依存 | 不変 | npm315 / app Cargo501 / page-store Cargo118。owned版/locksのみ更新 |

native receiveのCOMMIT済み応答をfixtureが失わせると、表示は旧snapshot・storage error・retryReceiveになり、DBだけは新orderを保持する。新pullを拒否し、同pair再確認がnetworkなしでreceiptへ再適用される。再確認後はその応答の観測末尾だけを表示し、その間の新server更新は次cycleで取得する。post-commit loadだけの失敗ではretry pairを作らず、次cycleがfresh native cursorから始まることを照合する。

Auth refresh中のlate fetchはnativeへ入庫しない。既に始まったold-store commitはclose後に完了し得るが、success表示や新store書込みを返さず、replacementはdurable resultを読み直す。runtime置換はold snapshot/private pairを消す。local openとcatalog続頁はnetworkを始めず、一回100件のcycleを自動drainしない。

実署名HTTP/PGではremote metadataを本文Docなしで保存し、再起動後の本文取得でcacheを採用する。offline pending titleは受信中も残り、準備済みwireを変更しない。remote choiceでtitle版が変わらない解決eventも両端末へ伝わる。deleted resourceの後続eventはpayloadを返さずsaved raw orderだけを進め、既存cacheを削除しない。失効後のpendingは直接captured旧DBを照合し、Auth grantを実装したとはしない。

固定専用URL・Bearer・credentials omit/redirect error/cache no-storeをHTTP fixtureで確認する。fixtureのJWT/Auth、native driverは実Supabase正常login/Tauri invoke/実IMEの代用ではない。画面変更がないためroot/workspace/Auth E2Eは再実行しない。cursor HMAC鍵はserverだけが持ち、nativeのscope/envelope/基底検査と原子receiptを使う。

[集約](verification.json)、[重点](focused.json.gz)、[専用PG](changes-pg.json.gz)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[型](typecheck-final.log)、[frontend](frontend-build.log)、[Rust](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[Docker exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理する。binary/BOMを正規化せず、credentials/DB/依存/cache/exeをGitへ含めない。

次はworkspace previewへ受信状態/catalog/再確認を接続し、dirty/composition/focusと別pending状態を保護したDocker操作回帰を検証する。
