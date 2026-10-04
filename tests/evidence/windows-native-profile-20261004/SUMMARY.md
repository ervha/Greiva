# Windows 1,000ブロック復元の層別診断

2026-10-04。baseline commit `5ff6c2efc6715b748f77bf3c352d75ad26de116f`、製品0.6.17から生成した**診断専用release**。通常実行物・製品sourceは変更しない。[環境](environment.json)はWindows 11 Home 26300、i7-12700H、RAM16.7GB、実ロードWebView2 **154.0.4258.53**。他desktop appも実行中でCPUを占有していない。

既存Docker Desktopを再起動し、既存Windows cross-build／試験containerを再利用。global host toolchain・VMを追加していない。[build controller](build-profile.mjs)、[v1 metadata](build-v1.json)、[v2 metadata](build-v2.json)、[frontend log](frontend.log)・[cross log](cross.log)。通常のfrontend test flagsは0、SQLiteは実Tauri IPC。観測専用のJS／Rust loggerをDocker内のsourceへ一時挿入し、finallyで全6ファイルを元bytesへ復元して追加moduleを削除した。[復元・元fixture・通常exe照合](source-verification.json)。

識別子 `dev.greiva.poc.profile617`、タイトル「Greiva Restore Profile」、Page `01a10230-0000-7000-8000-000000000001`。初期化時に診断profileのsessionStorageをpausedにし、同期なしで測定した。通常profileの接続設定は変更しない。0.6.16の停止コピー（1,000 paragraph・1,004 update・250 benchmark Task＋既存2 Task）を[別保存先へhash照合してコピー](install.json)。初回は未作成のWebView profile、同じ診断profileでその後3回起動。Windows自体やGPU／disk cacheのcold条件は制御していない。

v1 exe SHA256 `f2a8d2881bc5603b84894c2bff1bdf60b27852fb63a5b66549ab4d420d5f94e6`、v2 `9fb636ba1c5fba1efa6b0a9deb997eb5a1a460d4ec78fa5b2d9ccb36ab42c862`、ともに13,111,808 bytes。通常exe SHA256 `c96b702c2cac920ef639c140f83b5be3d5f55c3277062d3d6455ffa80a1e70a7`を保持。診断artifactを通常製品の性能合格へ昇格しない。

## 復元の観測

[全raw report](reports.jsonl)、[監査script](audit-profile.mjs)、[検証と各phase](verification.json)。単位はms、表示は小数1桁。4回の個別観測でp95／統計保証ではない。

| 起動 | update数 | SQLite初回open | Page query | JS Page IPC | Yjs復元 | 初回Editor render→effect | render→2回rAF | navigation→Editor 2回rAF | navigation→Task 2回rAF |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| v1初回profile | 1004 | 18.2 | 3.7 | 12.7 | 22.8 | 181.2 | 260.8 | 516.8 | 676.6 |
| v2・同profile | 1004 | 114.2 | 2.8 | 12.1 | 24.5 | 165.7 | 295.5 | 652.6 | 875.2 |
| v2・入力後再起動 | 1007 | 18.6 | 2.7 | 10.7 | 23.1 | 190.0 | 388.5 | 665.8 | 1005.6 |
| v2・無編集再起動 | 1007 | 25.6 | 3.2 | 13.1 | 23.9 | 170.9 | 275.0 | 550.2 | 741.5 |

SQLite openはPageStoreの初期openを含むRust呼出し、queryは`store.load`のRust側区間。IPCはJS invokeから解決までで、marshalling／queueを含み、Rust queryとの単純差分を厳密なserialization時間にはしない。Yjs復元はbyte配列化・decode・applyを個別観測し、array0.9–2.0、decode5.4–7.1、apply14.6–16.5。Task snapshotのRust queryは6.1–9.8。

Editor区間は初回component renderからeffectまでで、Tiptapだけのconstructor計測ではない。2回rAFは内部frame境界の指標であり、実画面への最終presentation保証ではない。navigation時刻はWebView navigation開始基準で、process起動／WebView準備を含まない。rawにnative run開始基準の時刻も残すが、異なる時計を無補正で合算しない。長task観測は初回Editor／layout／Task render近辺にあり、画面側の仕事がYjs decodeより大きいことを示す。

以前の通常release3,567.4msはhelper起動・前面化・UIAを含む上限。今回の別artifact・内部区間と同一条件ではなく、性能改善量や「2秒目安達成」を主張しない。今回の4回ではPage query／Yjs復元自体に秒単位の停滞は観測していない。SQLite初回open114msの揺れとEditor／layout、他app負荷を次の調査条件へ残す。

v1のDOM childrenはparagraph1000＋handle1000の計2000を`blocks`と誤命名し、保存状態selectorも不一致だった。rawは保持し、v2で`domChildren`／`paragraphs`／`handles`へ分け、正しいaria labelへ訂正。v1のEditor JSON／Yjs bodyは1000 blockで、画面の保存表示も確認済み。[初回画面](first-launch.jpg)。Rust診断の初回compileはsetup closureのcaptureで失敗し、診断closureへmoveを付けて再build。[原Fail](failed-cross.log)。製品不具合ではない。JSON読取時のPowerShell単行index誤りも訂正し、raw内容は変更しない。

## 実キー入力・保存・復元

v2の1,000 paragraph上で本文へpointer focusし、Computer Useの実キー`a`、`b`、`c`を**別々に**送った。literal Unicode代入ではない。trusted keydown／beforeinput／input、composing=false、insertTextを全3件で記録。実Microsoft IME provider／日本語候補の証拠ではない。各操作の間隔は12–19秒程度で、連続入力workloadではない。

| キー | keydown→2回rAF | append IPC解決 | keydown→append解決 |
| --- | ---: | ---: | ---: |
| a | 55.3 | 187.6 | 227.7 |
| b | 25.2 | 9.8 | 26.0 |
| c | 25.7 | 12.6 | 26.7 |

event listener到達後の内部時間で、OSキー送信からのend-to-end latencyではない。最初のappend IPC187.6msは記録したままで、原因をfsync／IPCのどちらかに断定しない。3サンプルだけで実用性・p95・IME性能を合格としない。

[入力後の保存画面](input-final.jpg)を確認してAlt+F4、process不在後にSQLite／WAL／SHMをコピー。[hash](input-copy-hashes.json)。Node SQLite read-only＋Y.Docで1,007更新の全digestを照合し、先頭段落のindex39へ`abc`が一度だけ入り、残る999段落・別Page・Task／Relation／operation／receipt等のstructured tableが不変。元の停止fixtureはhash不変。

その後2回再起動し、`abc`の[復元画面](restart-restored.jpg)・[最終保存画面](final-restored.jpg)を確認、無編集で終了。[最終停止コピー](final-copy-hashes.json)と入力後の全Page／structured tableが一致。通常Greiva／IME失敗fixtureは開かず、診断Greivaは終了・Computer Use解除済み。

## 追加の実OS可用性

T3 Code device一覧はiOS Simulatorを「macOS with Xcodeが必要」で不可と報告。AndroidはPixel_10／Wear_OS_XL_Round emulatorを表示したが、Pixel_10のdevice_openが `Device Pixel_10 failed to boot: The simulator or emulator could not start. Check its configuration on the environment server.` を返した。CLIの対象引数が得られず実操作へ進めていない。設定変更やglobal SDK追加は行わず、試験Not runとして残す。

Pixel 7は[既存ADBの読み取り再確認](android-availability.json)で未接続。emulatorをPixel 7の実機試験として扱わない。物理drag／最新日本語IME、Android composition中reconnect、macOS／iOS、正式Gateと技術選定は未完了。今回補った内部測定から受入条件を緩和しない。

## 通常版の物理drag・Undoを補完

利用者は手操作可能と回答し、通常0.6.17のWIN611-ALL-OPSでH3をH2の前へ物理mouse drag→Ctrl+Z→保存表示待ちを依頼したところ「できました」と報告。操作中にComputer Useを解除し、報告後に[元順序と保存表示](manual-drag-restored.jpg)をcaptureした。Alt+F4で閉じ、process不在後の[SQLiteコピー](manual-drag-copy.json)を[監査](verify-manual-drag.mjs)した。[結果](manual-drag-verification.json)は8→12更新、元8更新のdigest不変、別Page全履歴不変、最終本文は元と一致。

4追加更新は①H3／空paragraph／H2／空paragraph、②H2／H3／空paragraphへ復元、③H3／H2／空paragraph、④元へ復元。最初の移動で空paragraphが1つ増えており、追加操作の詳細・発生層は未確認。後の移動は余分なparagraphがない。移動・Undo・保存を補完したが、この構造差を隠して全操作Passにしない。UI表示改善の回帰と次の物理確認で再確認する。以前の自動SendInput no-dropのrawは変更しない。

通常／診断Greivaはともに終了、既存IME失敗データは編集していない。利用者の新しいdrag表示改善依頼は次の別実装として扱う。
