# Pageタイトル送信・同期基盤の検証

2026-10-08 / v0.34.0。production portable session・captured Auth transport・native明示runtimeを接続。[契約](../../../docs/development/PRIVATE_PAGE_TITLE_RUNTIME.md)、[全17判断](../../../docs/decisions/private-page-title-runtime.md)。title画面、実Auth/Windows invoke/IMEと配備暗号化は未完成。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 初回focused | 35 Pass | portable8 / connection19（新3）/ native runtime8 |
| 単独HTTP/実PG | 1 Pass | production openTitleとnative runtime、signed fixture HTTP＋2 actual Rust registry/SQLite |
| 最終通常全回帰 | 313 Pass / 83 Skip | 最終runtime9（追加observer取消含む）とportable/connection、既存保存/8 SIGKILL/本文/structured/Auth回帰。PGは専用run |
| 最終PostgreSQL | 83 Pass / exit0 | production title送受信/失効＋既存metadata/本文/structured/期限/transaction crash回帰 |
| 型/servers/frontend | Pass | 最終source全型、通常test flags0 build。新画面mountなし |
| Rust/native features | Pass | locked normal/crash examples、defaultでcrash hooks無効 |
| Windows cross-build | Pass | Docker debug/custom-protocol。FileVersion/ProductVersion0.34.0・Docker/host SHA照合、host未起動 |
| 外部依存 | 不変 | npm315 / page-store Cargo118 / app Cargo501。owned版/locksのみ更新 |
| host/Docker source | 250一致 | raw239、CRLF/LFのみ11、既存診断5を除外。binary/BOMを改変正規化しない |

初回focusedとHTTP単独の後、observerがbusy通知中にcloseした場合のadmission前checkと、unknown baseのmutateを保存前に拒否する条件を追加した。前者はclosed stateへ結果不明intentを戻さず書込みを始めないこと、後者は明示queryへの復旧経路を結果不明retryで塞がないことを検証する。最終型と313/83の全回帰で再確認した。今回の検証runに失敗はない。

portableはexact wire・context・store捕捉、caller変更/foreign Page・client・operation・epoch・不整合候補の拒否、commit前返却の禁止、busy/close、admitted commit完了後のclosed、固定errorを確認する。connectionは固定routes/private fetch options/native fetch receiver、同Page置換と別Pageの独立、refresh/close中のignored-abort遅着返信、401/403/503/malformed HTTPを確認する。

native runtimeはlocal openの無network/無create、unknown baseからの明示query、offline chain、lost HTTP ACK＋registry SIGKILL/reopen/同wire、同IDの結果不明保存再確認、101候補のkeyset/省略保持、query commit後read失敗の同cursor再試行、close/置換/refresh時の遅着拒否、admitted原保存先へのenqueue、observer例外/close、101 pendingの100件制限を検証する。queryCompleteがtrueでもpending/候補の存在を消さず、synced fieldを作らない。

HTTP/PG試験は前版の手製metadata POSTをproduction `PrivateWorkspaceConnection.openTitle` に移し、native runtimeの明示sync/mutateも通す。fixture provider JWTで、実Supabase正常ログインではない。server commit後にresponseを捨てるlost ACK、同wire再送一件、連続編集/Conflict/new resolution、古い本文metadataとcreation retry、本文bytes/digest/head・Task/Relation保持を照合する。Auth refresh後は旧portを拒否し、新bootstrap/portがpendingを再送する。失効403でruntime/connectionがclosedとなりprivate stateを消す。残pending/wireはraw registry test driverで耐久性を検査し、失効した利用者へのnative grantと扱わない。

Windowsビルドはcompiler-family検出とSDK library PDB不足のwarningを保持するが終了コード0。hostでは版とSHAを検査するだけで、Tauri invoke/Microsoft IMEを実行していない。画面変更がないためroot/workspace/Auth E2Eは再実行していない。

Docker再現：locked normal/crash examples、`npm run typecheck`、`npm test`、DB設定済み`npm run test:postgres`、`VITE_GREIVA_TEST_HOOKS=0 VITE_GREIVA_TEST_SQLITE=0 npm run build`、default native feature確認、通常Windows debug/custom-protocol cross-build。server schema4/native schema7を維持し、既存利用serverの配備/upgradeは行っていない。

[集約](verification.json)、[通常](normal.json.gz)、[PG](postgres.json.gz)、[初回focused](focused.json.gz)、[HTTP単独](title-http.json.gz)、[focused log](focused.log)、[HTTP log](title-http.log)、[最終型](typecheck-final.log)、[初回型](typecheck.log)、[servers](server-build.log)、[frontend](frontend-build.log)、[Rust](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows log](windows-build.log)、[Docker exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportsはconfigを除外しgzip、logsは行末空白のみ整理。DB/credentials/依存/cache/実行物をGitへ含めない。

次はtitle draft/保存・同期・明示解決画面をworkspace previewへ接続し、IME/focus/selectionと結果不明draftをDocker E2Eで検証する。metadata delta、削除/復元/GC/保持、実Auth正常系、Windows invoke/IME、Android/native credential/offline grantと配備DB/backup暗号化は残条件。追加の利用者手操作を求めていない。
