# Step 5 Windows native起動診断（初期の失敗）

2026-10-01、Docker内のcargo-xwinで作成した0.3.0候補をWindows hostで起動した。これは未公開・未commitの開発候補で、配布installerではない。ホストに開発toolchainを追加していない。

**結果: 操作可能なnative windowを取得できず、native SQLite復元・Microsoft IME試験はNot run。** プロセス起動やcross buildの成功をStep 5またはGateのPassと扱わない。

[起動記録](launch.json)、[debug startup log](startup.log)、[結果・候補source hash](result.json)を保存した。WebView2 cacheを新規にし、起動表示モード、未使用SQL plugin登録の有無を切り分けたが、対象windowは得られなかった。plugin登録の除去は解消を裏付けなかったため元に戻した。したがって、この診断実行物のnative lib hashと次の候補sourceは区別する。

通常のruntime自動検出ではapplication buildとevent loop進入までログに出るが、利用者setupには到達しない。Tauriの実際の初期化コードは設定されたWebView windowを利用者setupより先に生成する。停止原因そのものは確定していない。

既存WebView2 runtimeを子プロセスに明示する切り分けでは、[forward slashのpath](explicit-runtime-forward-slashes.log)はruntime未発見エラーで終了し、[backslashのpath](explicit-runtime-backslashes.log)では同じ起動段階で止まった。OS設定、security設定、runtimeのinstallは変更していない。停止していた試験プロセスだけを実行path一致を確認して終了した。

Docker内のRust SQLite repository試験とChromiumの強制終了・復元・収束試験は別の証拠である。今回、画面への文字入力、IME composition、native IPCへの保存、nativeの強制終了復元は実行できていない。

後続で、制限付きの起動から通常のWindows権限の起動へ変えたところ、同じ候補でwindowとSQLite保存を確認できた。host toolchain・OS/security設定は変更していない。初期結果はこのまま失敗として保持し、解消後の[実機試験](../step-5-native-recovery-20261001/SUMMARY.md)と区別する。
