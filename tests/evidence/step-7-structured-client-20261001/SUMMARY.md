# Step 7 verification

2026-10-01T07:01:24.792Z / linux x64 / Git: unavailable in execution environment; source fingerprint recorded

Source SHA-256: 49a2d250c9f76cc44bc840528079f70aed533a052cc0824c10da6287ab3f0189

| Test | Result | Evidence |
| --- | --- | --- |
| STEP7-CLIENT-STORE-DRIVER | Pass | [log](STEP7-CLIENT-STORE-DRIVER.log) |
| STEP7-CLIENT-BUILD | Pass | [log](STEP7-CLIENT-BUILD.log) |
| STEP7-CLIENT-TYPES | Pass | [log](STEP7-CLIENT-TYPES.log) |
| STEP7-CLIENT-UNIT-INTEGRATION | Pass | [log](STEP7-CLIENT-UNIT-INTEGRATION.log) |
| STEP7-CLIENT-E2E | Pass | [log](STEP7-CLIENT-E2E.log) |
| STEP7-CLIENT-SQLITE-INIT | Pass | [log](STEP7-CLIENT-SQLITE-INIT.log) |
| STEP7-CLIENT-POSTGRES | Pass | [log](STEP7-CLIENT-POSTGRES.log) |
| STEP7-CLIENT-STRUCTURED-E2E | Pass | [log](STEP7-CLIENT-STRUCTURED-E2E.log) |
| STEP7-CLIENT-DESKTOP-CHECK | Pass | [log](STEP7-CLIENT-DESKTOP-CHECK.log) |

Scope: Section 18 Step 7 client checkpoint: actual Rust SQLite prepared requests, ACK/receipt persistence, transactional pull/cursor, pending-intent projection, migrations, conflict UI and restore/pull/push/pull engine. Real PostgreSQL/HTTP tests cover ACK loss, API recreation, store SIGKILL, cursor write failure, 500ms/2s/5s latency and repeated pause/resume. Separate Chromium structured E2E uses a fresh PostgreSQL namespace. Windows native IPC/IME, remaining integrated four-boundary crash scenarios, performance and final Gates require separate evidence. No Gate verdict.

See [summary.json](summary.json) for environment, commands, timestamps, versions and result details.

## チェックポイント v0.6.0と試験の内訳

通常unit/integrationは41件Pass・18件skip。skipした実DB用18件は専用PostgreSQL runですべてPass。Editor全43 E2Eと別namespaceのstructured UI全2 E2EもPass、skip/flaky/retryなし。Rust repository driverとlocked Tauri check、build/型/SQLite初期化を含む9チェックすべて終了コード0。

[123ファイルのcheckout照合](checkout-source-match.json)はsource inventoryと全bytesのhash一致を確認した。[Docker条件](docker-runtime.json)は新しいinit付きcontainer、node user、4GB/2 CPU、非privileged・no-new-privileges、証拠だけのbind mount。ソース/dependency/host toolchainやDocker socketのmountなし。

[競合UIの画面](structured-e2e/structured-conflict.png)、[PostgreSQL JSON](postgres/vitest.json)、[通常JSON](vitest.json)、[Editor JSON](playwright.json)、[structured UI JSON](structured-e2e/playwright.json)。UIは実Rust/SQLiteを試験専用のJSON-lines橋で使う。Windows WebViewのIPC/実Microsoft IMEの代わりにはしない。

[HTTP競合試験の修正後10回](conflict-repeat/1/vitest.json)と[元の5秒条件でのMention10回](mention-repeat/playwright.json)は最終全runとは別の再現確認。終了待ち、locator、peerの未受信比較、依存rejectionのprojection、Page初期復元/再接続待ちの各失敗は[修正記録](../../../docs/failures/step-7-structured-client.md)とprevious-attemptへ残す。最終操作runの表示待ちを15秒としたことをrelease起動/復元性能のPassとして扱わない。

[Windows候補](windows-candidate.json)は0.6.0をDockerでcross buildしhost hash照合済み。実機操作はNot run、既存0.4.0とは別のpath。MSVC PDB不足のlinker warningも[build log](windows-cross-build.log)へ残す。ホストtoolchainの追加なし。

APIのclose/recreateはOSプロセスSIGKILLではなく、driver SIGKILLはfull Tauri app強制終了ではない。残るPage/Task/Relation統合の4境界crash、APIプロセスSIGKILL、性能/P1/P2、native/IMEとGate A/B/Cは未完了。一回のPage初期復元待機の原因も未確定として残す。Calendar・汎用DB・Button/automation・AI・updaterは設計のみ。

Windowsでcheckoutできる長さにするため、artifactの保存名を短縮しました。各artifacts/artifact-index.jsonに元のpath・保存path・SHA-256の対応を記録し、trace/画像/JSONの内容は変更していません。raw reportの元pathはこの対応表から辿ります。
