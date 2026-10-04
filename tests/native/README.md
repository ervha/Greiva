# Windows保存層のtransaction境界試験

通常Tauriと同じRust/SQLite repositoryをWindowsで動かす診断用CLIの試験。通常Tauri UI／IPC、実MS IME、API/network fault injectionの証拠とは区別する。実行物はDockerでcross buildし、Windowsへ新しいtoolchainをinstallしない。crash hooksは診断driverだけに有効化し、通常Tauriへ入れない。

Dockerで依存lockを維持してpage-storeの`store-driver` exampleを `--target x86_64-pc-windows-msvc --release --features crash-test-hooks` でbuildする。Windows hostの既存Nodeで以下を実行する。

```powershell
node scripts/test-windows-store-boundaries.mjs .data/path/to/store-driver.exe tests/native/windows-store-fixture.json .data/new-native-boundary-run
```

出力directoryは未作成のものを指定。各ケースは自分でspawnしたprocessのPIDとmarkerを照合してから強制終了する。WindowsではNodeのSIGKILL指定がprocess終了として処理される。consoleは非表示、stdin/stdoutのみで通信。既存Greiva・user SQLiteを指定しない。

1. Page appendのtransaction commit直前: 保存中のupdateがreaderへ漏れず、終了後に元のPage・Task／Relation pendingを復元。再試行でupdateを保存できる。
2. pull受信適用後・cursor更新直前: 受信entity／receiptが未commitで外へ漏れず、終了後はcursorとpendingを保持。再受信で適用し、同じcursor再受信で重複しない。
3. 保存完了後の終了: 保存されたPage、Task／Relation、pendingを保持。
4. prepared wire保存後の終了: pendingと同一operation ID／wireを復元。

SQLite integrity/digest、read-only reader、再起動snapshot、Page binaryの保持を確認し、`report.json`へ記録。pull responseは制御したfixtureで、実server通信の成功を主張しない。reportのPage updateはDocker側Yjsで独立再構成して検証する。データ・exeはGitへ含めず、選んだreportと証拠をtests/evidenceへ保存する。
