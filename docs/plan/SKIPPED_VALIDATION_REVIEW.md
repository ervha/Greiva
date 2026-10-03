# スキップ・未実施事項の再確認

2026-10-04、v0.6.17の区切り。過去のNot run／skip／失敗を現在の証拠へ対応付ける。過去の原結果は書き換えず、補完済みの範囲と残る条件を分ける。[PoC仕様](POC_SPEC.md) §12–18、[受入条件の履歴](POC_VALIDATION_MATRIX.md)、[Gate資料案](GATE_REVIEW_DRAFT.md)。

## 今回再確認した項目

| 項目 | 今回の確認 | 現在の扱い |
| --- | --- | --- |
| 通常VitestでskipされたPostgreSQL 20件 | 0.6.11の通常48 Pass／20 skipの各テスト名を、旧PostgreSQL別実行20 Passと今回のDocker別実行20 Passへ照合。20件すべて一致、今回skip／Fail 0 | 補完済み。通常runのskipを消さず、実DB条件での別実行を示す。[run／原ログ／JSON](../../tests/evidence/windows-native-editor-20261003/skipped-recheck/run.json)・[照合](../../tests/evidence/windows-native-editor-20261003/skipped-recheck/audit.json) |
| 最新Windows必須block・操作 | 通常0.6.17で同一Pageの11種類、Markdown4条件、Slash、リスト入れ子／解除、Todo、入れ子Toggle、全block削除とUndo/Redo、Mention keyboard移動。保存後のSQLite59更新・独立peer全文／clock一致。先行4種類は再起動復元も確認 | この範囲は補完済み。literal入力を実IMEと数えない。[実機証拠](../../tests/evidence/windows-native-editor-20261003/SUMMARY.md) |
| 画面消灯後のComputer Use前面化 | 再試行で前面化・通常編集が成功 | activation不能は今回解消。後述のdrop未配送は別件 |
| Windows pointer drag | 通常0.6.17で3回とも移動なし。隔離診断のEditor2回・独立HTML5対照1回でtrusted dragstart／dragover等が届くがdrop 0 | 移動成功は未確認。製品／WebView2／自動操作の原因を断定しない。物理mouseでdrag→Undoが必要。[失敗と追加診断](../failures/step-8-windows-native-drag.md) |
| 最新Microsoft IME操作へのアクセス | 別Pageでモード切替キーを試したがASCII `Ni`のみ、provider／日本語候補を確認できない | 実IME試験は未実施。実入力による同一段落遠隔compositionと1,000 block入力を残す。ASCII試行を製品Fail／Passとしない |
| Pixel 7の接続 | 既存ADBの `devices -l` を読み取りで再確認。Pixel 7の接続なし。新しい接続・前面化要求は送っていない | 今回の追加実機試験は不可。再接続時にGboard composition中reconnectを確認する。[接続状況と通常exe hash](../../tests/evidence/windows-native-editor-20261003/skipped-recheck/audit.json) |
| 通常実行物・診断source復元 | hostと試験containerのプログラム／設定135ファイルが通常build inventoryと一致。通常exeの既存SHA256も一致。診断用frontend／Rust sourceを製品へ混入していない | 照合済み。変更された文書を別記。通常Greiva／診断Greivaは終了、Computer Use解除済み |

PostgreSQL再実行は既存Docker／実Rust SQLite driverで行い、試験固有schemaを使う。通常native検証用の台帳・fixtureを消去しない。照合scriptの初回はVitest assertionのstatusを`pending`だけで検索し0件となったため、実際の`skipped`値に対応して再実行した。試験結果は変更していない。

## 過去の未実施を補完した証拠

| 過去の項目 | 後続証拠と限界 |
| --- | --- |
| Windows native編集・通常Microsoft IME・offline保存後の強制終了が未実施 | [0.6.12](../../tests/evidence/windows-native-ops-20261003/SUMMARY.md)の利用者実IME・置換Undo/Redo・H1／Todo／入れ子Toggle、Codexの追加block／Mention／pending復元で補完。実置換文字は小文字`abc`だったことも原記録に残る。0.6.17の最新実IME全条件へ流用しない |
| native通信境界・Conflictが未実施 | [0.6.13](../../tests/evidence/windows-native-network-20261003/SUMMARY.md)のserver commit後ACK前終了・offline再起動・pull回復、[0.6.14](../../tests/evidence/windows-native-conflict-20261003/SUMMARY.md)の3値保持・field merge・明示解決・未解決Conflict再起動で補完。通常WindowsのSQLite transaction途中全4境界への注入やnative duplicate POSTの完全検証とはしない |
| Android機種／OS／実ブラウザ試験が未実施 | [0.6.15](../../tests/evidence/android-pixel7-20261003/SUMMARY.md)でPixel 7／Android 17／Chrome 154、自動26＋接続・復元4操作、利用者実Gboard E/Fとcomposition中遠隔3更新を補完。QPR1は利用者申告。browserにSQLite保存はなく、composition中reconnectは残る |
| Windows release大量データ・structured 1,000操作が未実施 | [0.6.16](../../tests/evidence/windows-native-release-20261003/SUMMARY.md)で1,000 blockのliteral編集、native ACK1,000・250 Task・台帳／receipt1009と独立peer一致を補完。実IME・per-key測定・cold起動ではない |
| offline Cargo feature検査のcache不足Fail | [0.6.9](../../tests/evidence/step-8-focus-20261003/SUMMARY.md)で固定依存をDocker内取得後、同じoffline検査がPass。今回の通常0.6.17もoffline／locked feature graphとrelease cross-buildがPass。原Failは保持し、製品crash hooks無効を確認 |
| 初期環境のPostgreSQL image取得・Linux GLib不足、旧VM準備 | 現在の既存PostgreSQL containerはhealthy、実DB20件を再確認。Windows releaseはDocker cross-build＋実Windows操作へ移行し、VM準備は利用者指定で停止。初期の環境FailをPassに変更せず、後続のbuild／実機証拠で実行可能範囲を示す |
| 初回typecheck等の準備失敗 | [0.6.11](../../tests/evidence/step-8-structured-progress-20261003/SUMMARY.md)の修正後再検査、0.6.17の通常buildを別結果として記録。診断logger型エラー／cache待ち／copy先nested、監査期待値のtrailing paragraph訂正は診断・準備履歴であり、通常製品の成功に混ぜない |

## 残る事項と再開条件

| 項目 | 現在確認できない理由・次の扱い |
| --- | --- |
| Microsoft IMEの選択後Alt+Tab再変換で`al `欠落 | [受入例外](../decisions/step-8-ms-ime-exception.md)として利用者が無視して進めると指示済み。0.6.9 A/B・旧0.6.5 textarea C/Dの原Fail／保存内容を保持。再試験を繰り返さず、上流原因の独立証明や一般IME免除とはしない |
| 通常0.6.17の物理drag・最新実Microsoft IME | 自動操作でdropと日本語providerを確認できない。利用者が応答可能になった時に[確認セットA/B](GATE_REVIEW_DRAFT.md)を実施する。既存Pageは保存した状態で保持 |
| nativeの厳密なtransaction全4中間点 | [Docker統合crash4境界](../../tests/evidence/step-8-structured-progress-20261003/SUMMARY.md)は実Rust／SQLiteでPass。通常nativeには停止用hookがなく、既存Windows保存／ACK／Conflict証拠と区別する。追加注入は診断buildと通常版再検証を要し、完了扱いにしない |
| Windows cold起動・復元内訳・per-key／frame／実IME性能 | nativeの空DB上限2.663秒、restore上限3.567秒はhelper／UIA込みの観測。restore2秒目安超過の内訳は未測定。過去のPage初期復元5秒超観測も、後続成功だけで原因解消としない。層別計測を次の調査候補としてGate Bの判断資料に残す |
| Android composition中reconnect | 実Gboardの入力中に切断・再接続する条件は未実施。現在ADB接続なし。端末が利用可能になってから実入力で確認し、合成composition eventで代替しない |
| macOS P1・iOS WebKit P2 | 利用可能な実機／OS環境が確認できない。VM準備は停止済み。Docker browserやAndroidの結果を該当OSのPassにしない。未検証条件としてGate Bへ提出 |
| 正式Gate A/B/C・技術選定 | Aの上記実操作が残り、BのP1/P2・性能条件は判断が必要。[判定資料案](GATE_REVIEW_DRAFT.md)を準備済み。正式Pass／採用は未決定。production設計の追加実装へ広げない |

利用者は応答不能時、独立して可能な作業を先に終え、その後必要事項を記録して待つよう指定している。今回の再確認・整理・checkpointを終えたところで、残るGate Aの実入力・物理操作とGate Bの判断を待つ。時間経過を回答・承認の代わりにしない。
