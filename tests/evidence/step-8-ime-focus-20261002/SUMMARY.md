# Step 8: 選択後のウィンドウ移動とMicrosoft IME再変換

2026-10-02 JST、文書・診断証拠チェックポイントv0.6.8。**選択後にウィンドウを離れて戻る条件で、再変換開始時に日本語3文字の対象範囲が直前の `al ` を含む6文字へ広がる記録を得た。Greiva以外の素のtextarea／contenteditableでも同じ欠落を観測した。** ウィンドウ移動を挟まない手動比較では本文を保持した。製品修正は未実施、OS・IME・WebView2内の根本原因は未確定。Step 9の最終Gate判定へ進まない。

## 実行物と観測範囲

製品baselineは0.6.5、commit `c6b1c8bde39996cd7b5bcbca5f737b6106789680`、130ソースSHA-256 `c0f39a8a19274ef4150c4c770189fce4b927e21befb9c542bb24402975846205`。今回の3実行物はDockerで作った**診断専用のsource override付き候補**であり、通常の製品0.6.5のnative Passとは数えない。アプリ管理下のmanifest／lockfileは変更していない。各buildのfrontend型・build、offline／locked Windows cross-buildは成功した。

| 診断候補 | exe SHA-256 | sourceとbuild |
| --- | --- | --- |
| 読み取り用イベント記録・比較欄 | `c13d60548cdf4b2e473b717279f6aea136dccf0eeedde07d09320447baac91f7` | [build](passive/build/build.json)・[overrides](passive/build/overrides.json) |
| Convert keydownで選択方向を更新する実験 | `ab4b2217b4bc81f94da3c8b19e029ccbb16a29f6c33a3b7f04801648220046e4` | [build](keyguard/build/build.json)・[overrides](keyguard/build/overrides.json) |
| focus復帰で選択方向を更新する実験 | `b9143ddfb6da3c3c997a53606ae9df95cd226061acb5f5a55a71ccd13278247b` | [build](focusguard/build/build.json)・[overrides](focusguard/build/overrides.json) |

[起動1](passive/launch.json)・[起動2](keyguard/launch.json)・[起動3](focusguard/launch.json)でartifactとのhash一致を確認し、別々のSQLite／WebView保存先を使用した。baseline製品と過去の失敗fixtureは変更しない。イベント・DOM／ProseMirror選択・input target range・transaction・Yjs updateをTauri経由でローカルstderrへ記録。素のtextarea／contenteditableにはProseMirror／Yjsの編集処理を付けない。観測コードの追加自体によるtiming変化は除外できない。

Codexがliteral英字fixtureと一部実キー・候補操作を準備し、Microsoftへの切替と物理変換キーは利用者が実施した。比較欄の連続操作と後の二つの実験は手動である。[操作1](passive/operations.json)・[操作2](keyguard/operations.json)・[操作3](focusguard/operations.json)はCodexの操作・観測記録。すべての物理操作を記録するものではない。[stderr1](passive/stderr.log)・[stderr2](keyguard/stderr.log)・[stderr3](focusguard/stderr.log)も観測対象外のキーを保証しない。

## 同じ診断環境での比較

[自動照合した比較・保存更新](ime-focus-report.json)は対象eventの順序・範囲・本文をassertし、実Rust PageStoreで読み込んだコピーをYjsで順序再生した結果である。解析スクリプトの成功は、本文保持試験のFailをPassに変えない。

| 系列 | native記録 | 結果 |
| --- | --- | --- |
| 読み取り候補のGreiva、選択→blur→focus→Convert | seq145 blur、147 focus時は日本語3文字。149 trusted Convert、150 `beforeinput deleteContentBackward`で `al 日本語` 6文字が対象。152 PM replace、155 compositionstartの順 | `MS65 loc日本語`。遠隔更新なしでも欠落 |
| 素のtextarea、選択後にblur／focus | seq274／275はstart11・end14・backward。276削除時はstart8・end14で6文字。278 compositionstartは削除後 | 同じ欠落。開始Convert keydownは観測できず、利用者の変換キー操作の申告と区別する |
| 素のcontenteditable、選択後の移動なし2回 | seq404／433 trusted Convert、405／434 compositionstartのdataは日本語。選択後から開始までblur／focus・削除eventなし | 各compositionendで `MS65 local 日本語` を保持 |
| 同じ素のcontenteditable、選択後に移動 | seq462 blur、463 focusは日本語3文字。464 Convert、465削除対象はnode offset8..14の6文字。468 compositionstartは空文字 | 同じ欠落 |
| focus実験候補のGreiva、移動なし | seq130 Convert、131 compositionstartのdataは日本語、143 compositionend | 全文を保持した手動比較1回 |
| 同じ候補のGreiva、選択後に移動 | seq160 blur、162 focus、163診断処理、167 Convert、168削除、173 compositionstart、187 compositionend | 診断処理が働いても欠落 |

前の比較でのfocus移動は**新たな選択を作る前**にも存在する。今回絞った違いは「選択後から再変換開始前」の移動であり、移動があれば常に失敗するという結論ではない。比較は利用者の探索操作で、無作為化・多数回・別OS／WebView2版の試験ではない。素のcontenteditableでは末尾spaceが表示上畳まれ、利用者がspaceを追加してから日本語を入力した。素のProseMirror比較欄は用意したが再変換は実施しておらず、初期HTMLの末尾spaceもparseで除かれるため同条件のPassに数えない。

利用者から、確認質問への返信のためウィンドウを切り替えた時に消え、移動せず操作した時は消えなかったと報告があった。以後は操作指示を先にまとめ、**候補確定まで終えてから返信**する方法へ変更した。移動条件の実験では移動を明示的に指示した。前回の手操作誤りという仮説を無条件に排除せず、今回Convert keydownが取れた系列では開始前にBackspace／Delete keydownがないことと、native `beforeinput` の範囲拡大を証拠にする。

## 防止策候補と保存結果

Convert keydown実験はチェックを有効にしたが、失敗系列seq132..153にはConvert keydownが届かず、診断処理も実行されなかった。**この回の本文保持はFailだが、方向更新自体の効果を評価した結果ではない。** [操作後](keyguard/completed.png)。利用者がその後に本文を修復する操作を続けたため、最終SQLiteは全文に戻っている。journal update11に6文字削除が残り、後の修復で先のFailを消さない。

focus実験はseq163で、同じ日本語3文字のboundsを維持してanchor14→focus11をanchor11→focus14へ変えた。PMの範囲も12..15を維持したが、次のnative削除は依然8..14へ広がった。[操作後](focusguard/completed.png)。選択方向変更には通常のShift操作への影響があるため、成功した場合でも製品採用には選択保持・keyboard／pointer・composition回帰が必要だった。今回は失敗したので製品へ導入していない。`preventDefault`、composition取消、同期停止による回避も導入しない。

各候補を意図的にAlt+F4で通常終了し、process不在後にSQLiteをコピーしてhashを確認。[backup1](passive/sqlite-backup.json)・[backup2](keyguard/sqlite-backup.json)・[backup3](focusguard/sqlite-backup.json)。元DBへ実PageStoreを接続せず、Dockerコピーだけを監査した。

| 候補 | 保存journal | 欠落を作る更新 | 最終XML |
| --- | --- | --- | --- |
| 読み取り | 16 updates／409 bytes | update13: 6文字削除、次の更新が日本語を再挿入 | `<paragraph>MS65 loc日本語</paragraph>` |
| keydown実験 | 16 updates／470 bytes | update11: 同じ6文字削除。後に手操作の修復更新あり | `<paragraph>MS65 local 日本語</paragraph>` |
| focus実験 | 10 updates／290 bytes | update9: 同じ6文字削除、update10で日本語を再挿入 | `<paragraph>MS65 loc日本語</paragraph>` |

今回のfixtureは接続を一時停止し、遠隔senderを使っていない。再接続・peer収束の追加試験は未実施。保存済み表示と正しい本文、保存と同期を区別する。前回の通常製品でのpeer伝播証拠は[別記録](../step-8-ime-recheck-20261002/SUMMARY.md)として保持する。

## 検証・再現と次の範囲

全traceは[解析1](ime-passive-analysis.json)562件・[解析2](ime-keyguard-analysis.json)232件・[解析3](ime-focusguard-analysis.json)202件。JSON parse errorとPageごとのsequence gapは0。これは観測logger内の連番整合で、OSの全入力やlogger外のイベントの捕捉保証ではない。[raw hash](raw-files.json)にコピー元との一致を残した。Codexで覆われた画像、学習予測、exe・DB・WebView cacheは公開証拠から除いた。

[build補助](reproduce/build-native-ime-trace.mjs)は各候補の `build/native-ime-trace.ts` をDocker helper内の `.data/native-ime-trace.ts` に置いて実行する。130 baseline source list、既存Cargo/xwin cacheと `/evidence` mountを前提にし、3製品ファイルをfinallyで元byteへ戻す。試験コードは製品ソースにimportしない。[解析](reproduce/analyze-ime-trace.mjs)はstderr・出力JSONを引数に取る。[比較・保存監査](reproduce/report-ime-focus.mjs)はpassive log、keyguard log、両DBコピー、出力JSON、focus log、focus DBコピーの順。fixture IDは今回固定で、再試験では新規Page IDへ合わせる。Rust driverは既存Dockerの `.data/native-target/debug/examples/store-driver` を使用する。

最初のfrontend試行の型エラーを直して再buildした記録と、sandbox起動のAccess Deniedも[attempts](attempts/first-frontend-build.json)へ保持。後者を製品のcrashや強制終了試験として扱わない。SQLiteコピーのDocker所有者不一致による監査失敗はコピーだけを作業ユーザーへ揃えて再実行した。[helper復元](ime-source-restored-helper.json)・[稼働サービス一致](ime-source-restored-dev.json)で130 baseline source bytesを確認。[checkpoint確認](checkpoint-verification.json)はraw hash、JSON整合、文書リンク、各build／起動hashと製品非変更を確認する。製品変更がないため全E2Eや通常製品の新規buildは繰り返していない。

次は、表示上のDOM selectionとnative IMEの内部選択状態が復帰時にずれる境界を、選択方向を維持する復帰処理や再選択との比較で調べる。単なる方向反転は防止策にならなかった。根拠ある修正が得られたらDocker E2Eと通常製品のWindows／Microsoft IMEで同系列を再検証する。native全組合せ・統合crash・性能・P1/P2実OSと最終Gateは未完了。[失敗記録](../../../docs/failures/step-8-ms-ime-reconversion.md)・[区切り](../../../docs/decisions/step-8-validation-boundary.md)。
