# Step 8: Windows IME・release起動の検証記録

2026-10-01、文書チェックポイントv0.6.6。**Microsoft IMEの再変換後に、選択範囲の直前の `al ` が欠落した（Fail、未修正）。** 同期先と端末SQLiteにも同じ欠落があり、表示だけの問題ではない。Step 8全受入条件の完了を宣言せず、利用者の指定に従い記録の区切りで停止する。Step 9の最終Gate判定・技術選定は未実施。

## 対象・方法

実行物・Dockerサービスは0.6.5、検証ソースはcommit `c6b1c8bde39996cd7b5bcbca5f737b6106789680`。130ファイルのSHA-256は `c0f39a8a19274ef4150c4c770189fce4b927e21befb9c542bb24402975846205`。[ソース識別](tested-source.json)、[対象一覧](tested-source-files.json)、[host環境](host-platform.json)。Windows 11 Home build 26300、Core i7-12700H、メモリ約15.58GiB。ホスト負荷は固定していない。

IMEはWindows native Tauriで実キーを使用し、Dockerの独立Hocuspocus providerから同じ段落へ更新した。literal入力は段落の接頭辞の準備だけで、日本語入力の代用にしていない。Microsoft IMEへの切替と、操作APIが扱えない「変換」キーによる再変換開始だけ利用者が実施。その後の候補選択・確定と観測はCodexが実施した。Microsoftのprovider名は利用者申告とnative候補UIに基づく。Googleは今回の候補画面のGoogle表示も確認した。

debug native exeのSHA-256は `b3f09fbaad951d76f657550bdeec017cca474fd939fdc701700d2e8cfe655863`。[起動記録](native-launch.json)。この起動記録は0.6.5公開commit前の時点のHEADと未検証scopeを保持する。今回の最終結果・ソースは後続の観測と `tested-source.json` に記録した。Page `01a0f723-8015-71d9-9445-0579cfef41a3` のfixtureを再利用したため、タイトル中の0.6.4は今回の実行物の版を示さない。過去のnative結果と今回の操作範囲を区別する。

## IMEの結果

| 範囲 | 結果・限界 | 証拠 |
| --- | --- | --- |
| Google: preedit中の同一段落遠隔更新 | 3つの接頭辞と未確定文字が共存。変換・候補選択・確定で文字を保持 | [操作](google/operations.json)、[preedit](google/during-0.png)、[候補](google/candidates-0.png) |
| Google: local Undo/Redo | Undoで前のカタカナ候補へ戻り、Redoで日本語へ復帰。遠隔3更新を保持、fresh peerの全本文が期待値と一致 | [Redo画像](google/after-redo.png)、[最終peer](google/peer-after-redo.json) |
| Microsoft: preedit／候補中の同一段落遠隔更新 | 2段階で計6更新を受け、通常変換確定時の本文・遠隔接頭辞を保持 | [操作](microsoft/operations.json)、[通常確定](microsoft/committed.png) |
| Microsoft: 候補一覧 | 第2段階の更新後にpopupが隠れた。下線付きpreeditは継続し、Upで一覧を再表示した。一覧の連続表示成功とは扱わない | [更新後](microsoft/during-candidates-0.png)、[再表示](microsoft/candidates-reopened-0.png) |
| Microsoft: 再変換 | **Fail**。選択した「日本語」の候補をDown→Up→Returnで確定すると、直前の `al ` が欠落 | [選択範囲](microsoft/selected-for-reconvert.png)、[再変換](microsoft/reconvert-0.png)、[確定後](microsoft/reconvert-committed.png) |

再変換前の期待段落:

```text
[ms65-6][ms65-5][ms65-4][ms65-3][ms65-2][ms65-1]MS65 local 日本語
```

実結果:

```text
[ms65-6][ms65-5][ms65-4][ms65-3][ms65-2][ms65-1]MS65 loc日本語
```

[fresh peer](microsoft/peer-after-reconvert.json)の期待全XML比較はfalse。通常終了後にSQLite・WAL・SHMをコピーし、Docker内の実Rust PageStoreで監査した。[監査](microsoft/sqlite-audit.json)は98 update／2,821 bytes、実際の欠落後の全XMLと5 client clockすべてがpeerと一致した。これは欠落した状態の保存・収束を確認した結果で、編集意図の保持成功ではない。今回の系列で強制終了は試していない。[ファイルhash](microsoft/closed-sqlite-files.json)のみ公開し、DB本体はGitへ含めない。

一回の失敗観測であり、遠隔更新が必須条件か、単独再変換でも起きるかは未確認。[最小手順・切り分け候補](../../../docs/failures/step-8-ms-ime-reconversion.md)。要件緩和・同期停止の回避実装・製品修正は行っていない。

raw操作記録には結果確認前の意図を表すaction名が残る。Microsoftの候補popupと再変換については後続の訂正レコードを追記している。即時UIAの表示遅延も含めて原記録を保持する。Google／Microsoftのsender終了時 `peer-final-state.json` は確定前の時点を含むため、最終結果にはそれぞれfresh observerの `peer-after-redo.json`／`peer-after-reconvert.json` を使用する。

## Windows release起動

Dockerで既存cross-build環境を使用し、normal production frontend／release Rustをlocked・offlineでbuildした。アプリ所有版は0.6.5、test frontend flagsは0、store featuresはdefault。通常コードを維持し、`TAURI_CONFIG`でidentifierと初期Page URLだけを変更した隔離用候補であり、配布用identifierそのものの測定ではない。各候補のfrontend build・feature確認・cross-buildは3項目ともexit 0。raw Cargo warningも保持する。

| 試行 | 観測 | 判定の範囲 |
| --- | --- | --- |
| A | 起動後1,409msでwindow存在を確認。その画像はCodexに遮られ、主要UIを確認できなかった。主要UIの確認は84,019ms後 | 観測間隔を含むため起動性能のPass／Fail sampleに数えない |
| B | 起動UTC14:27:59.2902670、主要UI画像確認UTC14:28:01.252、上限1,962ms。4枚の観測画像すべてに主要UI | 一回の新規DB／WebView保存先で3秒目安内。4枚は同じ起動の観測であり4 sampleではない |

[A build](release-a/build.json)、[A初回観測](release-a/first-observation.json)、[A主要UI観測](release-a/main-observation.json)、[B build](release-b/build.json)、[B観測](release-b/observations.json)、[B画像判読](release-b/visual-review.json)、[B最初の画像](release-b/observation-0-0.png)。exeは各13,092,864 bytes、A SHA-256 `70e7f7298bda60abce5a5844a60f92fcac07361e1b37dbf92cc304f5fc53ea92`、B `10899e1617740480a669d65f9504d1e904cb9d3fca5546bce40b7191163b2e0b`。host照合は各 `host-artifact.json` に記録し、そのscopeは起動前の照合時点のものとして保持する。

1,962msは起動から画像取得完了までの上限で、cross-tool呼出し・前面化を含む。正確なfirst paintではなく、OS／build cacheはwarm、再起動後のcold測定ではない。空Pageのみで、native 1,000 block復元／入力／大量Task同期は未測定。

両候補を通常終了し、作成前に存在しなかった専用保存先のSQLite関連3ファイルをコピー・hash照合後に削除した。[cleanup](benchmark-cleanup.json)。通常製品保存先とdebug fixtureは変更せず、project内のignored backupを保持する。ホストtoolchainを追加していない。

## 残課題と以前の証拠

Microsoft再変換の修正・再検証、native全block／selection・削除・Undo/Redoの組合せ、最新native統合crash、大量データ性能は未完了。P1 macOS／P2 iOS・Androidの実OS試験は未実施。現在利用可能な実機を確認できず、Windows＋Linux Dockerの結果を代用しない。

既存の[0.6.5 Todo関連5項目・全E2E45件](../step-8-todo-layout-20261001/SUMMARY.md)、[0.6.4の12項目・Docker性能改善](../step-8-editor-performance-20261001/SUMMARY.md)、[0.6.2統合crash](../step-7-crash-recovery-20261001/SUMMARY.md)はそれぞれ実際の版・範囲の証拠として保持する。この文書更新で新たに全回帰・PostgreSQL・crash・Docker性能試験を実行したとは扱わない。

[raw-files.json](raw-files.json)の68選択ファイルはコピー元とbyte hashを照合済み。raw log・画像・観測JSONを保持する。`reproduce/`は今回の固定ID・marker・exe hashを含む実施スクリプトであり、無条件の再実行用手順ではない。次回は内容と前提を確認し、新しい隔離IDと保存先を選ぶ。[停止境界](../../../docs/decisions/step-8-validation-boundary.md)。
