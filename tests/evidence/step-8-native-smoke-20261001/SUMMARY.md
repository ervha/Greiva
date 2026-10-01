# Windows native 0.6.0: 操作APIの再確認

2026-10-01、担当Codex。Windowsホスト（OS API表示 `Microsoft Windows NT 10.0.26300.0`）で、既存のDocker cross-build済み0.6.0実行物を起動した。exe SHA-256は`343c5ca13d5baed61b8f5dc186357a6d64746ed4bfed615931f121b4ac9a1abf`、18,557,952 bytes。[元のビルド証拠](../step-7-structured-client-20261001/windows-candidate.json)。ホストにtoolchainを追加していない。接続するDocker preview／API／collaborationは0.6.2で、0.6.3の測定containerとは別環境。

computer-useの`@oai/sky` APIで実ウィンドウを返却結果から選び、観察→一操作→再観察を行った。実際の新規Page `01a0f6ad-249f-75a8-89a1-8f04e71cc637` を作成し、タイトル`Native 0.6.0 smoke 2026-10-01`、本文`Native editor smoke: saved and synchronized.`をliteral入力した。実機のSQLite保存表示と本文の同期表示を確認し、Task `Native IPC smoke 2026-10-01 0.6.0`も作成した。送信待ち1件・同期中から、送信待ち0件・サーバーと同期済みへ遷移し、実APIで同じTask一件とversion=1を確認した。

- [時刻・操作・window・accessibility記録](actions.json)
- [本文入力](native-page-0.png)
- [Task確定・同期表示](native-task-0.png)
- [Docker側から読み取った実APIのTask](server-task.json)

この新しいwindowでは以前の`failed to activate captured window`／GetCursorPos access deniedは再現しなかった。過去のエラーの原因を解決したとは断定しない。accessibilityのfocus表示と一部のvalueが遅れていたため、実画面のcaret／focus枠と入力結果も確認した。Task一件性と表示の確認は限定的なnative smokeであり、全状態のpeer比較や終了復元ではない。

Microsoft IMEのcomposition入力、候補選択・再変換、全block、native offline/crash/reconnect、最新候補のnative IPC、Windows release起動・性能はNot run。literal文字入力をIMEのPassに数えない。0.6.0での結果を0.6.3や最終GateのPassに流用しない。
