# 試験証拠の索引

- 2026-10-04 / v0.6.22 / [通常Windows Microsoft IME・遠隔composition](windows-ms-ime-20261004/SUMMARY.md): 利用者がIMEを切替、以後Codexが実キーの通常変換・遠隔3更新中の変換を代行。SQLite30更新・全1,000段落・peer全文／clock一致。自動dragの移動なし、連続入力体感・正式Gateの残条件を明記。

- 2026-10-04 / v0.6.21 / [Windows実キー日本語入力・1,000段落保存照合](windows-ime-preparation-20261004/SUMMARY.md): 製品0.6.20の1変換をCodexが代行、9更新・他999段落・独立peer全文／clock一致、旧WIN619-DRAG全13更新不変。Microsoft provider未同定、入力方式確認だけ回答待ち。実IMEのGate、連続入力／遠隔同時性は未判定。

- 2026-10-04 / v0.6.20 / [1,000 blockのdrag表示更新](block-drag-large-20261004/SUMMARY.md): 移動する行だけにtransformを生成。全行のdrag／Undo・独立peer全文／clock一致、全59 E2E・型・48 unit/integration・通常Windows build。Docker単回診断のLong Task5→0と、実Windows性能／IMEとの区別を記録。

- 2026-10-04 / v0.6.19 / [列に沿うdragプレビュー・丸いUI](block-drag-preview-20261004/SUMMARY.md): 元の列・幅と同じハンドル列でのdrop、周囲が場所を空ける表示。全58 E2E、型・48 unit/integration・Windows通常release build。利用者の修正版操作／見た目確認とonline backup4→13更新で全4 block保持。実際の最終順序・試験直前との差、実IME／Gateの残条件を明記。

- 2026-10-04 / v0.6.18 / [Windows層別性能診断と物理drag監査](windows-native-profile-20261004/SUMMARY.md): 1,000 blockで4起動、SQLite／IPC／Yjs／Editor／Task区間、実ASCII3キー、保存・2回再起動復元。[物理drag→Undoの8→12更新](windows-native-profile-20261004/manual-drag-verification.json)も照合。最初の空段落増加・診断と通常releaseの差・実OS未実施を残す。

- 2026-10-04 / [スキップ再確認](../../docs/plan/SKIPPED_VALIDATION_REVIEW.md): 通常skip20件と旧・新PostgreSQL別実行のテスト名照合、現在20 Pass／skip 0。[再実行・原ログ・JSON](windows-native-editor-20261003/skipped-recheck/run.json)・[監査](windows-native-editor-20261003/skipped-recheck/audit.json)。native／Android／性能の残条件も同表へ統合。

## Step 8: Windows 0.6.17全block・保存照合・drag配送診断（2026-10-04）

[同一Pageの全11種類・59更新・独立peer一致](windows-native-editor-20261003/SUMMARY.md)。Markdown4条件、Slash、入れ子／解除、Todo、Toggle keyboard／pointer開閉、全block削除とUndo/Redo、Mention keyboard移動。元2 Page不変。通常／診断artifactを分け、HTML5対照もdrop未配送のnative dragと、最新Microsoft IMEの未確認を保持。Gate Passやdrag修正完了を主張しない。

## Step 8: Windows通常release大量データ・native性能観測（2026-10-03、記録v0.6.16／製品0.6.11）

[1,000 block／111文字・1,000 native ACK・250 Task・独立照合](windows-native-release-20261003/SUMMARY.md)。空SQLite2.663秒・復元3.567秒の観測上限、server応答間75.973秒。helper／UIA込みの一回と正確なpaint／per-key／実IMEを区別し、復元目安未達と内訳未測定を残す。

## Step 8: Pixel 7 / Android Chrome / Gboard（2026-10-03、記録v0.6.15／製品0.6.11）

[実機26＋4自動操作・実Gboard E/F・遠隔3更新](android-pixel7-20261003/SUMMARY.md)。Android 17 / Chrome 154、normal release frontend、独立peerの全文／state vector一致。P2 browser互換性の証拠で、SQLite・offline終了復旧・composition中reconnect・Windows性能を含めない。

## Step 8: Windows Conflict UI・保持・明示解決（2026-10-03、記録v0.6.14／製品0.6.11）

[native実操作・強制終了復元・独立peer／台帳照合](windows-native-conflict-20261003/SUMMARY.md)。base/local/remote保持、状態／期限merge、draft保持、local pointer採用とremote Tab／Enter採用を検証。open Conflictを保持したconnected再起動、native7操作・receipt9件、台帳9件とpeerの一致。全操作・実IME・offline再起動・性能・Androidをこのrunの結果へ混ぜない。

## Step 8: Windows ACK途中終了・再接続・peer照合（2026-10-03、記録v0.6.13／製品0.6.11）

[通常Tauriの通信境界・停止DB・独立peer・台帳](windows-native-network-20261003/SUMMARY.md)。Relationのserver commit後・ACK保留中に強制終了し、offline再起動とpullによるACK／cursor回復を確認。Page2件のXML／clock、Task／Relation、receipt2件・台帳2件、新規Rust／Hocuspocus peerが一致。元DB一式不変。transaction途中の全境界、native duplicate POST・Conflict UI・性能・Androidと最終Gateを含めない。

## Step 8: 最新Windows操作とoffline native crash（2026-10-03、記録v0.6.12／製品0.6.11）

[利用者の通常IME・Codexのnative UI・実保存層照合](windows-native-ops-20261003/SUMMARY.md)。利用者の問題なし回答と108更新を照合。Codexが他のblock・Mention／移動／Undo/Redo・Task／Relationを操作し、保存完了後offlineの強制終了で本文・pending2件を復元。通信途中・ACK・peer収束のnative境界や全操作・性能・Androidの未実施は別記する。代行可能な試験は今後もCodexが実施する。

## Step 8: structured同期進捗改善・実機再変換再確認（2026-10-03、v0.6.11）

[同期改善とDocker回帰](step-8-structured-progress-20261003/SUMMARY.md)。通常ACKのdurable保存を維持して表示snapshotを100ms間隔へ抑制。通常48件／別PostgreSQL20件、全54 E2E、Conflict UI2、統合crash4、性能4を確認。原型検査Failと試験fixture修正後の再検査Passを別記し、通常0.6.11 Windows候補をbuild。新候補のnative操作・性能はNot run。

[通常0.6.9 A/Bと旧診断0.6.5 C/D](windows-ime-reconfirm-20261003/SUMMARY.md)。window移動なしは保持、ありは `al ` 欠落をSQLite／native eventで照合。他アプリ複数でも同症状との利用者報告を受け、この条件を[受入例外](../../docs/decisions/step-8-ms-ime-exception.md)としてGreiva修正待ちから外す。原Failを保持し、他の未実施条件とGate最終判定は継続する。以下は各版の履歴。

`docs/plan/POC_SPEC.md` Section 18 Step 8の検証記録です。2026-10-03のv0.6.10では利用者の再開指示に従い、保存済み0.6.9証拠の監査と実機再開準備を追加しました。Microsoft IME再変換の本文欠落は未解決、新しいnative回帰・P1/P2実OSとGate A/B/Cの最終判定は未完了です。製品・候補は0.6.9のまま。以下は各版・時点の証拠です。

## Step 8: 証拠監査・受入条件対応・実機再開準備（2026-10-03、v0.6.10）

[実行結果と制約](poc-audit-20261003/SUMMARY.md)・[受入条件対応表](../../docs/plan/POC_VALIDATION_MATRIX.md)。専用Docker、networkなしで監査試験9件と実証拠監査Pass。skipの別run、原Failとfeature再検査、改行差と内容差、候補hashを照合しました。Windowsインストール済み環境と利用者申告のPixel 7／Android 17 QPR1を記録。アプリの試験再実行・native操作・IME成功・Gate合格ではありません。

## Step 8: 遠隔選択保持と再接続の回帰（2026-10-03、v0.6.9）

[修正・原Fail・回帰・Windows候補](step-8-focus-20261003/SUMMARY.md)。文書構造が同じ遠隔文字編集だけYjs相対位置で選択を保持する。追加9 E2Eと全54 E2E、通常45件／実PostgreSQL別run20件、Conflict UI2件、統合crash4境界、性能4ケースを確認。通常機能検査の初回offline cache不足Failと、固定依存取得後のoffline再検査Passを分ける。132ソース一致、Windows候補build／host照合済みで、新しいnative操作・IMEはNot run。[複数の対策案と再開手順](../../docs/plan/DEFERRED_VALIDATION.md)。

## Step 8: 選択後のwindow移動とnative再変換範囲（2026-10-02、文書v0.6.8／診断候補0.6.5）

[native event・素の入力欄・対策候補の比較](step-8-ime-focus-20261002/SUMMARY.md)。選択後のblur／focusを経ると3文字の範囲がnative削除eventで6文字へ広がり、素の入力欄でも直前の文字が欠落した。移動なしの限定比較は本文保持。keydown候補は失敗回にイベント未受領、focus復帰時の方向更新候補は実行されたが防止できず、製品へ採用していない。根本原因未確定・本文保持Failを維持する。

## Step 8: Microsoft再変換の再確認・保存更新解析（2026-10-02、文書v0.6.7／実行物0.6.5）

[今回の結果と原証拠](step-8-ime-recheck-20261002/SUMMARY.md)。遠隔なしの再変換一回は本文保持。実Microsoft入力＋遠隔6更新後の別fixtureでは、再び直前の `al ` 欠落がSQLite／fresh peerへ保存され、全XMLとclockが両者で一致した。実Rust PageStore＋Yjsの順序再生で今回のupdate 19／前回のupdate 95が直前3文字と日本語3文字を削除することを確認した。

前回も欠落は候補確定前、利用者の開始後の最初の観測ですでに存在すると補足。手操作誤りの可能性を保持する。今回の二回目はnative候補操作の完走と終了理由を観測できておらず、保存結果のFailと区別する。原因層は未特定・未修正。製品ソース・依存・実行物は変更せず、Step 9へ進まない。

## Step 8: Windows IME・release起動、再変換Fail（2026-10-01、文書v0.6.6／実行物0.6.5）

[実機結果と選択証拠](step-8-platform-validation-20261001/SUMMARY.md)、[再変換の失敗](../../docs/failures/step-8-ms-ime-reconversion.md)、[停止境界](../../docs/decisions/step-8-validation-boundary.md)。Googleで同一段落遠隔3更新と変換・local Undo/Redo、Microsoftで通常変換中の6更新保持を確認。ただしMicrosoft再変換後に直前の `al ` が欠落し、fresh peer／SQLite監査でも確認した。同期・保存されたことを本文保持成功へ拡張しない。

Windows releaseはidentifier／初期Page URLだけを変更した隔離候補で一回の主要UI確認まで上限1,962ms。正確なfirst paint・cold起動・大量データ性能は未測定。原ログ／画像をhash照合して保持し、アプリコードと実行物の版は変更しない。全受入条件の完了や最終Gate合格ではない。

## Step 8: Todoの配置・限定的な実機操作（2026-10-01、v0.6.5）

[修正と検証](step-8-todo-layout-20261001/SUMMARY.md)、[実装判断](../../docs/decisions/step-8-todo-layout.md)。実DOMに一致しないTodo CSSを修正し、修正前の位置検査Fail／修正後Pass、全E2E45件とbuild・型・通常試験・locked Tauri checkを確認。実機操作とrelease artifactは実際の0.6.4として保持し、Microsoft IME・再変換・同一段落composition重複、最新native全操作／Windows release性能／最終Gateは未検証。

## Step 8: 入力時のDOM再生成改善（2026-10-01、v0.6.4）

[最終Docker検証](step-8-editor-performance-20261001/SUMMARY.md)、[130ファイルの照合](step-8-editor-performance-20261001/checkout-source-match.json)、[測定値](step-8-editor-performance-20261001/performance-metrics.json)、[ハンドルだけの比較](step-8-editor-performance-20261001/handle-comparison.json)。通常45件・実PostgreSQL別run20件、Editor44・structured UI2・統合crash4・性能4ケースと12項目全体がPass。1,000 block／104文字の入力で1,000個すべてのhandle DOMを保持し、本文・構造・clock・保存差分の一致を確認。元の再生成と古いpositionを使う誤修正の退行検出も保持した。

最終runのkeydown→commit ACK p95 106.7ms・最大176.2ms、復元3回の最大417.46ms。別run比較の負荷差を区別し、追加のハンドルだけの比較でも保持0→1,000とp95 294.4→126.3msを観測した。短縮率をWindows IPC／IMEや製品性能の保証にしない。[実装判断](../../docs/decisions/step-8-editor-performance.md)、[Dockerでの0.6.4 Windows候補buildとhost照合](step-8-editor-performance-20261001/windows-build/host-artifact.json)。最新候補のnative全操作・Microsoft IME、Windows release性能、P1/P2実OSと最終Gateは残る。

## Step 8: 性能測定・試験transport修正（2026-10-01、v0.6.3）

[最終Docker検証](step-8-performance-20261001/SUMMARY.md)、[130ファイルのソース照合](step-8-performance-20261001/checkout-source-match.json)、[測定値](step-8-performance-20261001/performance-metrics.json)、[方法と残課題](../../docs/decisions/step-8-performance.md)。12項目Pass、通常45件（PostgreSQL専用20件skip、別runで20件Pass）、Editor43・structured UI2・統合crash4・性能4ケースにskip/flakyなし。production frontend／release Rustで実SQLite journal、実keyboard、実React TaskPanel engine／PostgreSQLを使用した。

1,000 block復元の3 sampleは中央値1.17秒・最大2.47秒で、一回が2秒目安を超過。104文字のkeydown→commit ACKはp95 962ms・最大1.32秒、keydown→次のframe機会はp95 163ms。100回Yjs編集は1.29秒で収束、1,000 Task操作は106.53秒で全内容・queue・cursorと一件性を保持した。回帰成功を性能目安全達成やWindows release／IMEのPassへ拡張しない。初回のEPIPE／Cargo版置換Failと修正前の再現、修正後の復帰は[記録](../../docs/failures/step-8-test-harness.md)に保持した。

[Windows既存0.6.0の限定smoke](step-8-native-smoke-20261001/SUMMARY.md)では新規Page・literal入力・保存／同期表示とTask一件の確定を自動操作で確認。接続するpreviewは0.6.2。最新native候補、Microsoft IME、全native操作、Windows release性能、P1/P2実OSと最終Gateは未完了。

## Step 7: 保存待ち改善・統合crash recovery（2026-10-01、v0.6.2）

[最終Docker検証](step-7-crash-recovery-20261001/SUMMARY.md)、[126ファイルのソース照合](step-7-crash-recovery-20261001/checkout-source-match.json)、[4境界の復元監査](step-7-crash-recovery-20261001/restoration-audit.json)、[プレビュー反映](step-7-crash-recovery-20261001/deployment.json)。11項目Pass、通常44件（PostgreSQL専用20件skip）、実PostgreSQL別run20件、Editor43・structured UI2・統合crash4 E2Eにskip/flakyなし。実APIの確定前／確定後SIGKILL、実Chromium／Rust storeの編集直後・保存完了後・push確定ACK喪失・pull cursor確定前を確認した。ユーザー承認Aにより保存済み全変更を保証し、保存中の未commit入力を区別する。最終runではPage確定直前の試験専用停止により保存中の境界を確実に通し、全commit済みupdate・最後の保存済み本文／構造・Task／Relation／queue保持とpeer収束を検証した。

[初回の無条件復元Fail](step-7-crash-boundary-20261001/SUMMARY.md)と[判断・修正記録](../../docs/failures/step-7-integrated-crash.md)を保持。保存待ち改善後の[初回full run](step-7-crash-recovery-20261001/previous-attempt/first-full-run/SUMMARY.md)も保存し、最新runと区別する。通常Tauriでは停止featureが無効。Windows候補は既存0.6.0のままで実機操作は未検証、性能・最終Gateも未判定。

## Step 7: structured sync端末・競合UI（2026-10-01）

[Docker検証](step-7-structured-client-20261001/SUMMARY.md)、[ソース照合](step-7-structured-client-20261001/checkout-source-match.json)、[修正/未解決記録](../../docs/failures/step-7-structured-client.md)。通常41件・実PostgreSQL別run18件、Editor43 E2E・専用namespaceの競合UI2 E2Eとbuild/型・保存層・locked Cargo checkを確認する区切り。prepared request、ACK/receipt、transactional pull/cursor、pending intent・tombstone・Conflict選択を実Rust/SQLiteへ接続し、ACK喪失・API再作成・store SIGKILL・cursor失敗・遅延・pause/resumeを試験する。

[Windows候補0.6.0](step-7-structured-client-20261001/windows-candidate.json)はDockerでcross build・host hash照合済みで、実機操作はNot run。API再作成をプロセスSIGKILLとして数えず、Rust橋をWindows IPC/IMEの証拠としない。初回Page復元が5秒を超えた一回は原因未確定であり、[元の条件での10回](step-7-structured-client-20261001/mention-repeat/playwright.json)と最終回帰の成功だけで解消扱いにしない。release起動/復元性能は後続検証。

## Step 7: structured syncサーバー（2026-10-01）

[Docker検証](step-7-structured-server-20261001/SUMMARY.md)、[113ファイルのソース照合](step-7-structured-server-20261001/checkout-source-match.json)、[初回assertionの失敗](step-7-structured-server-20261001/previous-attempt/SUMMARY.md)。通常29件・実PostgreSQL別run12件・全43 E2E・build/型・保存層・locked Cargo checkがPass。push/pull、immutable確定結果、transactional順序、cursor、field merge・Conflict解決・tombstone・連続offline intentと移行をサーバー側で確認。端末ACK・pull/cursor適用と競合UI・transport chaos・統合crash recoveryは後続。Windows実行物は0.4.0のままで、Microsoft IMEと最終GateのPassを意味しない。

## Step 6: Task／Relation最小モデル（2026-10-01）

[Docker検証](step-6-structured-models-20261001/SUMMARY.md)、[ソース照合](step-6-structured-models-20261001/checkout-source-match.json)、[Windows候補の起動と操作未検証](step-6-native-local-20261001/SUMMARY.md)。Task/Relationと操作queueの同一transaction、schema移行、pending復元、tombstone、実PostgreSQLモデル・version保護・Nest読み取りを確認。全43 E2E、unit/integration 29件、別runの実PostgreSQL 2件、build/型・SQLite初期化・Linux locked Cargo checkがPass。push/pull・cursor前進・競合解決は次のStep 7。実機入力はアクセス拒否で新規操作未検証、Microsoft IMEと最終GateのPassを意味しない。

## Step 5: Page SQLite永続化（2026-10-01）

[Docker検証](step-5-page-store-20261001/SUMMARY.md)、[Windows実機の自動操作・復元・peer一致](step-5-native-recovery-20261001/SUMMARY.md)、[初期の起動失敗](step-5-native-startup-20261001/SUMMARY.md)。Dockerの41 E2Eと実機のPage保存・強制終了・offline復元・再接続を区別する。Google日本語入力の実キー結果はMicrosoft IMEの結果に含めず、native全件とGate A/B/Cの最終判定は未完了。

## 最新: 遠隔更新中のWindows実機IME（2026-10-01）

[結果・実機画面](windows-remote-ime-20261001/SUMMARY.md)、[利用者の回答](windows-remote-ime-20261001/manual-results.json)。Docker peerから12回送信し、全ACKを確認。利用者は試した変換・再変換・選択・Undo/Redoに問題なし、双方の文字保持と回答しました。Codexは日本語候補と遠隔文字の同時表示を実機で独立観察しました。同一段落composition重複は確立していません。証拠チェックポイント0.2.1、frontend0.2.0、既存native shell0.0.0を区別します。

## 最新: Step 4共同編集（2026-10-01）

[結果・収束スナップショット](step-4-collaboration-20261001/SUMMARY.md)、[metadata](step-4-collaboration-20261001/summary.json)、[ソース照合・Docker条件](step-4-collaboration-20261001/verification-context.json)。build/型、unit/integration 22件、Chromium全37件、SQLite基盤、実PostgreSQL 1件、Linux locked Cargo checkがPass。6つのA/Bケースをraw state vector・clock map・本文JSONで比較し、サーバーSIGKILL後のbinary復元も検証した。今回のfrontend/app sourceは0.2.0、既存Windows shellは0.0.0。この自動runだけで実機IMEの成功は判断しない。上記の追加手動試験を別記録とし、端末耐久化・Gate最終Passは未完了。

## 最新: Windows実機の初回IME試験（2026-10-01）

[結果](windows-host-ime-20261001/SUMMARY.md)・[利用者の明示回答](windows-host-ime-20261001/manual-results.json)・[完了監査](windows-host-ime-20261001/completion-audit.md)。変換・確定・再変換、変換中/確定後の選択・削除・Undo/Redo、Slash/Mention候補中の入力、Todo/Toggle/移動後編集の4群は、すべて問題なしと利用者が回答しました。Step 3の初回手動証拠として記録し、自動試験やCodexの独立観察とは区別します。具体的な入力ログ・画像は未提供で、追加のnativeブロック全件やYjs接続中IMEの成功は推定しません。

既存Windows debug shellの起動、WebView2保存先、Docker/client/shared 36ファイルのhash一致も記録済み。Greiva専用VM・ISOとVirtualBox本体は削除済み。[本体の削除確認](windows-host-ime-20261001/virtualbox-uninstall.json)。

## 最新: Editor UI/UX改善（2026-09-30）

[最終run](editor-ux-20260930/SUMMARY.md)、[ソース・実行環境](editor-ux-20260930/summary.json)、[ソース照合・Docker条件](editor-ux-20260930/verification-context.json)、[画面](editor-ux-20260930/editor-ux.png)。build・strict型チェック、unit/integration 20件、Chromium E2E全30件、SQLite初期化、実PostgreSQL 1件がPass。入れ子トグルの競合修正は[10/10回の再現試験](editor-ux-20260930/toggle-repeat/playwright.json)でも成功した。

[競合修正前の29/30件run](editor-ux-20260930/previous-race/SUMMARY.md)と[初回の型・試験エラー](editor-ux-20260930/previous-attempt/SUMMARY.md)はそのまま保持した。[UX改善](../../docs/decisions/editor-ux.md)、[修正記録](../../docs/failures/step-2-editor.md)。`.git`はimageへ含めないためcontainerのGit commitはnullであり、現在のcheckoutと照合したsource SHA-256を根拠にする。Rust未変更につき今回のCargo checkはNot run、以下の基盤runはPass。Windows VM/IMEとGate A/B/Cは未検証。

## 基盤: Step 2 Docker検証（2026-09-30）

[結果とログ](step-2-docker-20260930/SUMMARY.md)、[環境・固定版・仕様/lockfile/ソースhash](step-2-docker-20260930/summary.json)、[Docker実行条件](step-2-docker-20260930/docker-runtime.json)、[ホストのソースとのhash一致](step-2-docker-20260930/checkout-source-match.json)。ソース81ファイルのSHA-256は`32c7a1bb74c924f81a00bef90a64254b497ee44e2920611999f5a6878544b490`。Gitは未commit、containerはnodeユーザー、非privileged、no-new-privileges、証拠ディレクトリだけのbind mount。

| 検証 | 結果 |
| --- | --- |
| Web/Node build、strict型チェック | Pass |
| unit/integration | 20件Pass、通常runのPostgreSQL 1件skip |
| Chromium E2E | 全23件Pass、skip/flakyなし |
| SQLite初期化/WAL/整合性 | Pass |
| 実PostgreSQL 18.4への接続 | 別runで1件Pass（通常runのskipを代替） |
| Linux locked Cargo check | Pass |

[Vitest JSON](step-2-docker-20260930/vitest.json)、[Playwright JSON](step-2-docker-20260930/playwright.json)、[PostgreSQL専用JSON](step-2-docker-20260930/postgres/vitest.json)。失敗した前回runも[そのまま保持](step-2-docker-20260930/previous-attempt/SUMMARY.md)し、[Editorの修正記録](../../docs/failures/step-2-editor.md)へ経緯を記録した。最終runの終了コードは0。

2026-09-30時点ではWindows VM作成済み・OS ISO取得中だった。[当時のVM準備記録](windows-vm-preparation-20260930/summary.json)。その後実機方式へ切り替え、VM・ISOは削除した。Windows VM内Tauri・Microsoft IMEは未実施のまま。Linux checkや合成compositionのPassをGate AのPassとしない。

## 過去: 隔離環境へ切替時

2026-09-30の指定ではDockerで開発・自動試験、Windows VMでTauri/IMEを検証する予定だった。[当時の環境確認](isolation-20260930/SUMMARY.md)、[現在の実行手順](../../docs/development/isolated-environment.md)、[Step 2の実装・未検証範囲](../../docs/decisions/step-2-scope.md)。

切替時点ではCompose構文のみPassで、Docker engine到達不可のためimage buildとcontainer自動試験はNot runでした。旧ホスト実行のbuild/typecheck/19件のunit・integration、Windows native compile成功を、隔離環境やIMEの成功として扱いません。以下は過去のStep 1証拠です。

## 環境設定後の確認: 2026-09-30 17:32 JST

ユーザーが設定完了を伝えた後、稼働中のセッションで前提条件を確認しました。[今回の結果](step-1-environment-recheck-2026-09-30T08-32-32.197Z/SUMMARY.md)と[metadata](step-1-environment-recheck-2026-09-30T08-32-32.197Z/summary.json)を保存しました。

Docker daemon は応答しましたが、PostgreSQL pull は依然 Forbidden。GLib/GTK/WebKitGTK 開発ライブラリは未導入で、Tauri locked check は同じ GLib 不足で停止しました。稼働セッションの network policy / environment_status には Docker registry の許可追加が確認できませんでした。ユーザーが変更した設定画面・環境と本セッションとの対応、セットアップの実行状況は未確認です。アプリ実装の変更はなく、前回通過した試験は繰り返していません。Step 2 には進んでいません。

## 再検証: 2026-09-30 17:20 JST

ユーザーの指定により、同じ作業環境で Step 1 を再検証しました。実装ソース、仕様書、npm/Cargo lockfile の hash は初回検証と一致しています。

- [再検証の結果と各ログ](step-1-recheck-20260930-1720/SUMMARY.md)
- [環境・日時・コマンド・依存版・ソースhash](step-1-recheck-20260930-1720/summary.json)
- [Vitest JSON](step-1-recheck-20260930-1720/vitest.json) / [Playwright JSON](step-1-recheck-20260930-1720/playwright.json)

ビルド、型チェック、unit/integration 16件、Web E2E 1件、SQLite初期化、Compose構成検査は Pass。PostgreSQL起動は registry の Forbidden、Tauriのlocked checkは GLib開発環境不足で引き続き Fail。実DB試験は未実行（通常Vitestの1件skip）。検証全体の終了コードは1。Step 2、Gate A/B/Cには進んでいません。

## 初回の検証証拠

- [Step 1 の実行結果](step-1/SUMMARY.md)
- [環境・依存版・Git状態・ソース/lockfile/仕様hash・コマンド・日時](step-1/summary.json)
- [検証したソースのファイル一覧](step-1/source-files.json)
- [unit / integration JSON](step-1/vitest.json) / [JUnit](step-1/vitest.xml)
- [Playwright JSON](step-1/playwright.json) / [JUnit](step-1/playwright.xml)
- [PostgreSQL の失敗記録](../../docs/failures/step-1-postgres-registry.md)
- [Tauri CLI 起動ログ](step-1/tauri-dev.log) / [補足metadata](step-1/tauri-dev-metadata.json)
- [Tauri の失敗記録](../../docs/failures/step-1-tauri-prerequisites.md)

2026-09-30 17:11 JST（08:11 UTC）に Linux x86_64 で実行しました。担当: Codex。まだ commit が存在しないリポジトリのため Git commit は null、dirty 状態とソース SHA-256 を記録しています。

| 試験ID | 前提と操作 | 期待結果 | 実結果 |
| --- | --- | --- | --- |
| STEP1-BUILD | npm ci 後、npm run build | 共有パッケージと3アプリのWeb/Nodeビルド成功 | Pass |
| STEP1-TYPES | npm run typecheck | テストを含む strict 型チェック成功 | Pass |
| STEP1-PROTOCOL / STEP1-ID | UUID/date/version/cursor/DTO の境界入力を検証 | 仕様準拠データのみ受理、IDが一意・ソート可能 | Pass: unit 13件 |
| STEP1-API | NestJS/Fastify の実アプリへ inject | health 200、sync push は未実装で404 | Pass: integration 1件 |
| STEP1-COLLAB | Hocuspocus を実ポートで起動しHTTP送信 | health 200 | Pass: integration 1件 |
| STEP1-SQLITE | 一時ファイルDB初期化、試験データ保存、再オープン | WAL/FULL/FK、データ保持、integrity_check=ok | Pass: integration 1件 |
| STEP1-E2E | Playwright が3サービスを起動、ChromiumでReact画面を開く | UI表示と両health成功、同期状態は未検証 | Pass: 1件 |
| STEP1-SQLITE-INIT | npm run db:sqlite | 開発DB初期化と整合性検査成功 | Pass |
| STEP1-POSTGRES-CONFIG | docker compose config --quiet | 開発構成が有効 | Pass |
| STEP1-POSTGRES-START | npm run db:up | PostgreSQL起動とhealthcheck成功 | Fail: registryアクセスForbidden |
| STEP1-POSTGRES | 起動済み実DBへ接続 | DB名/18.4版を確認 | Not run: 起動失敗。通常Vitestでは1件skip |
| STEP1-DESKTOP-CHECK | cargo check --locked | Tauri 2のネイティブコンパイル成功 | Fail: GLib開発環境なし |

条件: API/Hocuspocus/E2E は localhost 接続、network chaos なし、強制終了なし。Chromium の実行パスとバージョンは summary.json を参照してください。clientId 別ログ、cursor、operation ID、Yjs state vector/文書JSON は後工程の機能が未実装のため該当なしです。Tauri build は未成功、Windows/macOS/iOS/Android は未検証です。Gate の Pass は主張しません。

`npm ci` は lockfile からクリーン再インストールして終了コード0でした。Rust の cargo generate-lockfile も成功しました。`npm run evidence -- --postgres --desktop` は、PostgreSQL起動とTauriコンパイル失敗を含むため終了コード1です。失敗を証拠から除外していません。

以後の実行は `npm run evidence` で `runs/<UTC時刻>/` に保存し、レビュー対象を選んで索引に追加してください。
