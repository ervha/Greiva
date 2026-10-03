# Windows 0.6.11のConflict保持・明示解決・再起動

2026-10-03、記録checkpoint v0.6.14。通常0.6.11 embedded Tauriを使用。[起動記録](launch.json)。製品コード・manifest・候補は変更していない。[前回停止DB](../windows-native-network-20261003/SUMMARY.md)の別コピーで実施し、[前回DB一式のhash不変](previous-fixture-hashes.json)を確認。元WIN611-OPS／AUTO611-BLOCKSの本文は編集しない。

## 実際のWindows操作

通常native UIで専用Task WIN611-CONFLICTを作り、保存・同期済みを確認。接続を停止して名前を `local contender` へ変更。Dockerの別Rust SQLite＋通常structured engine／HTTP clientが同じTaskの名前を `remote contender`、状態を完了へ変更した。[別clientの操作と保存結果](remote-first.json)。

再接続後、native画面でbase=`WIN611-CONFLICT`／local=`local contender`／remote=`remote contender` の3値と競合1件を確認した。[実画面](first-conflict.jpg)。別fieldの状態は完了へmerge。Task新規入力欄に `keep unsaved draft` を入れて通常pollを経ても保持し、「この端末の値を採用」をpointerで実行。名前local contender・完了・競合0件・送信待ち0件へ復旧し、draftも保持された。[原UI観測](native-observations.json)・[別clientの収束](peer-after-local.json)。

2回目はnative offlineで名前を `local second`、別clientで名前を `remote second`・期限を2026-12-24へ変更した。[別client記録](remote-second.json)。再接続後、base=`local contender`／local=`local second`／remote=`remote second` を保持し、期限はmergeされた。接続を停止してから通常Tauriを[強制終了](open-conflict-crash.json)。停止コピーを別の書込み可能コピーで実Rust repositoryへ読み込み、[未解決Conflict・3値・期限の保持](open-conflict-snapshot.json)を確認した。

同じDB／WebViewで[再起動](open-conflict-restart.json)し、[同じConflictの復元](restored-conflict.jpg)を観察。接続停止はsessionStorageの設定で、新しいrendererでは接続が再開するため、**今回はconnected再起動**。offline再起動の証拠にはしない。offline再起動の別境界は前回記録に保持する。

復元後のremote値テキストをクリックし、Tabでlocal採用→Tabでremote採用へ移動。[remote採用buttonのフォーカス](remote-choice-keyboard-focus.jpg)を画面で確認してEnterで確定した。最終は名前remote second・完了・期限2026-12-24、競合0件・送信待ち0件・同期済み。[復元後UI観測](recovery-observations.json)・[最終画面](final-native.jpg)・[別clientの最終値](peer-after-remote.json)。UI Automationのfocused_elementはRootWebAreaを返すため、正確なDOM focusはそのfieldだけから推定せず、button／競合sectionの可視フォーカスとEnterによる実動作を証拠にする。

保存完了後Alt+F4で閉じ、[プロセス不在・SQLiteコピーhash一致](final-copy-hashes.json)を確認。Computer Useは解除した。IME69-A/Bなど別のDBへ触れていない。

## 独立した保存層・サーバー照合

[監査script](verify-conflict.mjs)をDockerで実行し、[結果](verification.json)を保存。

- read-only integrity_check=ok、全Yjs update digest一致。Page2件の全文XML／clock／全update hashは前回から不変。
- 実Rust repositoryのnative snapshotは7 operationすべてacknowledged、errorなし、cursor=head。最終Taskはversion5、remote second／done／2026-12-24。
- 2つのConflictはともにresolved。base/local/remoteを保持し、local／remote採用はそれぞれ別の新operationとして記録され、resolvedByが一致。
- 独立peerのTask／Relation／Conflict／cursorとnativeが一致。PostgreSQL台帳9件とnative receipt9件・local resultが一致。
- [別client script](conflict-peer.mjs)は通常engine・実Rust保存層を使用。native UIをSQLや試験専用commandで代用していない。

今回のnative入力はliteral fixtureであり、実Microsoft IMEではない。前回の実IME証拠と分ける。全Windows操作組合せ、release大量データ性能、Android実IME・offline/reconnect、P2と最終Gateは別の検証として続ける。製品変更がないためDockerの全product suiteは再実行していない。
