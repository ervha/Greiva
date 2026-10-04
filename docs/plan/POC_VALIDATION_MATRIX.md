# PoC受入条件・証拠・再開順序

2026-10-04、v0.6.18追記: [物理mouse移動／Undoの保存履歴と復元](../../tests/evidence/windows-native-profile-20261004/manual-drag-verification.json)で§14-1を補完。最初の移動の余分な空段落は原因未確認として保持。後の移動と最終復元は正しい構造。§13の[診断内訳・実ASCII3キー](../../tests/evidence/windows-native-profile-20261004/SUMMARY.md)は通常releaseのcold／連続入力／日本語IMEや2秒目安の合格ではない。

現在のスキップ／未実施／受入例外の対応は[2026-10-04再確認表](SKIPPED_VALIDATION_REVIEW.md)を参照。PostgreSQL20件の再実行は全Pass。以下の各版は原時点の履歴として保持する。

2026-10-04、0.6.17追記: [通常Windows全blockと59更新／peer照合](../../tests/evidence/windows-native-editor-20261003/SUMMARY.md)。§14-1/3/5を補完し、同一Pageの必須11種類、Markdown4条件、Slash、入れ子／解除、Todo、Toggle開閉、全block削除とUndo/Redo、Mention keyboard移動を確認。旧2 PageのXML／clock不変。native pointer dragは独立HTML5対照もdrop未配送で未確認。最新実IMEはprovider／候補を確認できず未実施のまま。これらをDockerのPassや0.6.17の限定native Passで置き換えない。[Gate資料案](GATE_REVIEW_DRAFT.md)に操作・判断をまとめる。

2026-10-03、v0.6.16追記: [Windows通常release大量データ・native同期](../../tests/evidence/windows-native-release-20261003/SUMMARY.md)を§13および§14-5/6の補完証拠として追加。1,000 block／111文字、native1,000 ACK・250 Task、台帳／receipt1009件と独立peer一致。空SQLite2.663秒・復元3.567秒はhelper／起動／UIA込みの一回の観測上限。復元2秒目安を超えるが内訳未測定。cold paint、per-key frame、1,000 block実IME、Gate判定へ読み替えない。

2026-10-03、v0.6.15追記: [Android P2実機証拠](../../tests/evidence/android-pixel7-20261003/SUMMARY.md)。Pixel 7 / Android 17 / Chrome 154で26自動操作＋4接続／復元操作、実Gboardのlocal変換と同一段落遠隔3更新中の変換を確認。全文／clock一致、文字欠落・二重入力・候補異常なしの利用者報告を記録。§12のAndroid browser互換性を補完し、SQLite／offline終了復旧・composition中reconnect・macOS／iOS・Windows性能・最終Gateへ読み替えない。

2026-10-03、v0.6.14追記: §14-7の[通常Windows Conflict UI・実保存層照合](../../tests/evidence/windows-native-conflict-20261003/SUMMARY.md)を補完。3値保持・別field merge・draft保持、local／remoteの新operationによる明示解決、open Conflictの強制終了・connected再起動保持を確認。native7操作・receipt9件と台帳・独立peerが一致。実IME／offline再起動／性能／Androidの合格へ読み替えない。最終Gateは未判定。

2026-10-03、v0.6.13追記: 通常0.6.11 WindowsでRelationのserver commit後・ACK到着前の強制終了、offline再起動、再接続のpullによるreceipt／cursor復旧を確認。[通信境界・独立peer／台帳の一致](../../tests/evidence/windows-native-network-20261003/SUMMARY.md)。§14-3/4/5/6のnative証拠を補完。Page2件のXML／clock、Task／Relation、台帳2件と独立peerが一致し、元DB一式はhash不変。native duplicate POST・SQLite transaction途中の全境界・Conflict UI・性能・Androidの証拠にはしない。最終Gateは未判定。以下の各版は履歴で、対応表は0.6.10監査baselineを保持する。

2026-10-03、v0.6.12追記: 製品0.6.11の[最新Windows証拠](../../tests/evidence/windows-native-ops-20261003/SUMMARY.md)を追加。§14-1/2に通常IME・選択置換／Undo/Redo・block操作の限定native証拠、§14-4/5にPage／Task／Relationのoffline保存完了後の強制終了・再起動とpending保持の1境界を補った。全操作・通信途中／ACK境界・peer収束・実OS性能／Androidと最終Gateを全Passにはしない。代行可能な試験はCodexが実施し、UI操作そのものを手操作待ちにしない。

2026-10-03、v0.6.11追記: structured同期snapshot改善と[新しいDocker回帰](../../tests/evidence/step-8-structured-progress-20261003/SUMMARY.md)を確認し、通常Windows候補0.6.11を作成。native操作・性能はNot run。通常0.6.9と旧診断0.6.5の[再変換比較](../../tests/evidence/windows-ime-reconfirm-20261003/SUMMARY.md)では移動ありだけで欠落を再現した。利用者は他アプリ複数でも同症状と報告し、無視して先へ進むよう指示。この条件は[受入例外](../decisions/step-8-ms-ime-exception.md)として扱い、下記の「未解決のままPass/Conditionalにしない」は従来判断として保持する。再変換対策を最終判断の前提から外すが、原FailをPassへ変更せず、Gate最終資料に例外を明記する。他の条件・native不足は免除しない。以下は0.6.10時点の監査baseline。

2026-10-03、検証準備checkpoint **v0.6.10**。製品・Windows候補は **0.6.9**。参照セッション `01a0f17f-74f8-71e1-9c31-65689f9c11da` の「手操作は記録して後回し」「対応案を複数残す」「検証済み区切りでcommit」を引き継ぐ。今回の再開指示は前回0.6.9の停止を解除する。PoCの範囲と受入条件は変更しない。

これは[POC_SPEC §14](POC_SPEC.md)に対する証拠の対応表であり、Step 9の最終Gate判定ではない。Dockerでの検証、Windows実機、利用者の回答、未実施を分ける。

## 受入条件の対応

| §14 | 対象 | 保存済みの証拠 | 残る確認 |
| --- | --- | --- | --- |
| 1 | Windowsで必須block・操作 | Docker Editor／保存／同期54 E2E。[0.6.9証拠](../../tests/evidence/step-8-focus-20261003/SUMMARY.md)。0.6.5までの限定native操作は[実機記録](../../tests/evidence/step-8-platform-validation-20261001/SUMMARY.md) | 0.6.9で全block、前後方向の選択、focus復帰、削除・移動・Undo/Redo。Docker結果でWindows合格にしない |
| 2 | 日本語IMEで欠落・二重確定・破綻なし | 通常変換の限定native保持証拠あり。一方[Microsoft再変換](../../tests/evidence/step-8-ime-focus-20261002/SUMMARY.md)は本文保持Fail | NI-01の原因切り分け、対策、通常製品で再検証。遠隔選択保持修正はこのFailの修正証拠ではない |
| 3 | 同時／offline編集後のYjs収束 | 0.6.9 Dockerのcollaboration・focus/reconnect・performanceケース。全文・構造・clockを比較 | 最新Windows IPC／IMEを含む回帰。Dockerのliteral日本語はcompositionではない |
| 4 | 保存済み変更・pendingのoffline強制終了復元 | Dockerの実Rust/SQLite＋Chromiumによる統合crash4境界、全commit済み更新の復元 | 最新Windows Tauri IPCで同じ境界を検証。保存中の未commit入力と保存済み保証を分ける |
| 5 | Page／Task／Relationの再接続・peer反映 | Docker統合crash・structured UI・実PostgreSQLで収束確認 | 最新Windowsで三種類を合わせた復元・peer監査 |
| 6 | 重複送信・途中終了の冪等性 | 通常45件＋実PostgreSQL20件。API SIGKILL before/after commit、ACK喪失・cursor失敗等 | Dockerの実API／保存層証拠は保持。Windows全操作の不足を別記する |
| 7 | 異field merge／同field Conflictの保持・解決 | 実PostgreSQL20件、Conflict UI2 E2E、SQLite復元・明示local/remote選択 | 最新Windowsで入力・focus保持を含めたConflict UI回帰 |
| 8 | 必須試験・ログ・Gate判定の提出 | [証拠監査](../../tests/evidence/poc-audit-20261003/SUMMARY.md)、原試験ログ、失敗記録あり | 手操作待ちの結果を補い、Step 9でGate A/B/Cと技術選定を正式判断 |

## Gateへの影響

| Gate | 現在の証拠の状態 | 最終判断の前提 |
| --- | --- | --- |
| A：Editor | Microsoft再変換の本文保持Failが残る。最終未判定 | 選択後のwindow移動に伴うnative削除範囲拡大を切り分け、通常製品で必須IMEと全操作を再検証。未解決のままPass/Conditionalにしない |
| B：保存・収束 | Dockerの保存・再接続・crash証拠あり。native検証は一部のみ。最終未判定 | P0のWindows保存済み保証・統合crash・peer収束を確認。P1/P2未実施は明記 |
| C：structured sync | Dockerの冪等性・cursor・Conflict・API crash証拠あり。最終未判定 | 最終資料で正確性、native不足、1,000操作の所要時間と改善課題を評価 |

原0.6.9 full runは **11 Pass／1 Fail**。Failはoffline依存cache不足で、固定依存取得後に同じoffline feature検査が別runでPass。原runを全Passへ書き換えない。監査成功は保存済み証拠の整合を示し、製品試験の再実行やGate Passではない。

## ソースと候補の対応

原Docker runの132ファイルを、このWindows worktreeで照合した。最初の確認時点では6件がbyte一致、126件はCRLF→LFだけの違いで、その他の内容差はなかった。これはGitの`core.autocrlf=true`によるcheckout差で、現在のbyte hashが原Dockerソースと同一とは表記しない。v0.6.10では`VERSION`だけが原inventoryから変わり、新しい監査ツール2ファイルを別記する。新しいアプリ／試験ソースの追加、既存ソースの内容変更があれば監査は失敗し、製品の再検証が必要になる。

0.6.9 Windows候補の実ファイルは親checkoutからコピーしてhash照合した。SHA-256 `65edd5c8f629f3acfc7ba3b8ff381938f6bd27a0712532af5726782194d14aca`、18,558,464 bytes。今回は起動していない。以前の0.6.5と失敗fixtureを保持する。

## 手操作再開時の条件

### Windows／NI-01・NI-02

1. [環境記録](../../tests/evidence/poc-audit-20261003/windows-environment.json)は**インストール済み**OS／WebView2／IME部品の情報。次の起動で実際に読み込まれたWebView2、選択したIME、互換モード等を別途確認する。現在の版を過去の失敗時の版として扱わない。
2. 通常0.6.9候補を、新しいSQLite／WebView保存先と新規専用Page IDで試す。候補hash、保存先、Page ID、peer IDを開始前に記録する。既存失敗DBを上書きしない。
3. 固定fixtureは `MS65 local 日本語`。末尾3文字だけを選択し、window移動なし／あり × 遠隔更新なし／ありを比較する。最初に通常製品の本文を試し、診断候補の素のtextarea/contenteditableと比較する。診断logger・overrideを通常製品の合格へ混ぜない。
4. 操作指示を先にまとめ、変換開始・候補選択・確定が終わってからチャットへ返信する。移動ありの条件では意図的に移動し、途中返信による移動と混同しない。実際のMicrosoft切替・物理変換キーをliteral入力やsynthetic eventで代用しない。
5. 変換開始の前後で選択の両端・方向、native target range、PM transaction、Yjs updateを記録し、保存されたSQLiteとfresh peerの全文・構造・clockを照合する。初回の欠落を、その後の修復や一回の成功で取り消さない。

対策案A/B/C/Dと推奨順序は[NI-01](DEFERRED_VALIDATION.md)を維持する。方向反転・keydown対策は過去の不成功実験であり、今回再採用していない。独立した最小Tauri比較、入力層診断、Googleとの補助比較は候補で、根本原因は未確定。

### Android／PL-01

- 利用者申告の対象：**Google Pixel 7／Android 17 QPR1**。この会話で回答を受領。実機での版確認・Chrome版・接続方法は未確認、試験はNot run。
- 最小の確認順：到達可能なURLで起動 → 基本block・選択・software keyboard／IME → composition中の遅延peer更新 → offline/reconnect・全文とclockの比較。別client更新のために編集中の端末focusを移さない。
- ブラウザ補助版はnative SQLite保存・Task編集を提供しない。Android Chrome試験をdesktop SQLiteやnative IPCの代替にしない。
- Chrome版、実OS build、接続経路、操作者、時刻、Page ID、入力前後の本文を実施時に記録。外部公開・新しい接続方法・OS設定変更は今回行わない。

## 監査の再実行

[audit-poc-evidence.mjs](../../scripts/audit-poc-evidence.mjs)はbaseline 0.6.9を固定し、Playwright/Vitestの個々の結果、skipの別run、12検査とfeature再検査、132ソース、任意の候補exeを確認する。全Gateは常に「最終判定未完了」として出力し、このツールだけでは合格へ昇格できない。

Docker内へcheckoutソースと`tests/evidence/step-8-focus-20261003/`をコピーした `/audit` で実行する。既存開発imageのNodeを再利用し、host toolchain・network・開発サービスは不要。

```sh
GREIVA_AUDIT_FIXTURE=/audit node --test scripts/audit-poc-evidence.test.mjs
node scripts/audit-poc-evidence.mjs --root /audit --output /tmp/audit.json
# 候補をコピーした場合だけ、--artifact /tmp/greiva-poc.exe を追加
```

出力先はGit対象外の`tests/evidence/runs/`またはcheckoutの外側とする。ソースや元の証拠を上書きしない。成功・改ざん・欠落・source変更の監査試験もDockerで実行し、最終結果を選別して保存する。
