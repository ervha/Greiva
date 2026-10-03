# Windows 0.6.11の操作・保存・offline crash復元

2026-10-03。通常0.6.11 embedded候補（SHA-256 `cc806e646f8093fe3ee387d0524c68dd4ec3c6808fa794be33e84d0fd74ecf36`）を使用。[起動条件](launch.json)。製品コードの変更なし。利用者の実IME操作、CodexのWindows UI操作、Dockerでの停止後DB監査を分ける。

## 利用者の操作

利用者はWIN611-OPSで、Microsoft IMEによる「にほんご」→「日本語」の確定、選択置換→Undo→Redo→Undo、見出し1・Todo・Toggleと入れ子Toggleの作成／日本語入力、Todoのチェック、Toggle開閉、保存完了後の終了について「問題ありませんでした」と回答した。実キー・候補画面の独立記録はない。Greivaのプロセスが終了していることを確認してDB一式をコピーし、[hash照合](manual-copy-hashes.json)後、Dockerでread-only SQLite／Yjsの[順序再生](manual-saved-inspection.json)を実施した。

WIN611-OPSは108更新。seq18日本語→seq21 `abc` →seq22日本語→seq23 `abc` →seq24日本語を確認。依頼文の置換文字はABCだったが、実保存文字は小文字abcで、そのまま記録する。seq75のTodo checked=true、その後false、見出し1、日本語本文、開いた入れ子Toggleも保存されている。保存データは手操作の全キー列や候補画面を証明するものではない。

## Codexのnative操作

computer-useのWindows実行環境が利用できることを確認し、以後の代行可能なUI試験をCodexが実施した。元Pageを編集せず、同じ隔離DB内のAUTO611-BLOCKSでSlash候補を開いてEnter選択し、箇条書き／番号付きリスト／引用／Code／Dividerを作成・編集。Mention候補からサンプルPageを挿入し、Ctrl+Shift+Upで移動→Ctrl+Z→Ctrl+Yの順序変化を観察した。本文はliteral fixtureで、IME composition証拠ではない。[UI観測記録](native-ui-observations.json)。

TaskフォームでAUTO611-TASK、Page→TaskのRelationを登録。通常UIで端末に保存済み・送信待ち2件、オフライン、Task／Relation一覧を確認。[保存画面](task-relation-offline.jpg)。最初のTask fieldクリックは画面外で拒否されたため、再観測・scroll後に実施した。product入力失敗とはしない。

## Windows強制終了と復元

端末に保存済みを観測後、通常Windows TauriをStop-Process -Forceで終了。[crash記録](native-crash.json)。終了後にSQLite／WAL／SHMをコピーし、[hash一致](after-crash-copy-hashes.json)を確認した。[実Rust保存層との照合](crash-verification.json)ではintegrity_check=ok、全Yjs update digest一致、SQLite順序再生とRust loadのXML／clock一致。WIN611-OPSは108更新のhash・clock・本文すべて不変。AUTO611-BLOCKSは22更新で作成ブロック・Mention移動後の順序を保持。Task1／Relation1とpending operation2件、ID・endpointを保持した。

同じDBで[再起動](crash-restart.json)し、Codexが[復元された本文](after-crash-restored.jpg)と送信待ち2件をnative UIで観察。WIN611-OPSも選択して[復元画面](manual-page-restored.jpg)を確認し、編集せず保存完了表示を確認してAlt+F4で閉じた。IME69-A/Bの別DBには触れていない。

監査の初回Rust openはroot所有コピーへの書込みが拒否された。原コピーのread-only監査を保持し、/tmp内の別の書込み可能コピーでRust repositoryのmigration/open/loadを再実施した。原DBと監査原コピーを変更していない。[手動fixture解析script](inspect-manual-fixture.mjs)・[crash照合script](verify-crash-copy.mjs)。

## 範囲と残項目

今回のnative crashは**保存完了後・offlineの1境界**。通信途中・ACK境界・native peer収束、Conflict UI、全操作組合せ、見出し2/3の最新native個別確認、release性能、Android実OSはこの証拠に含めない。既存Dockerの全54 E2E／統合crash4境界／性能4ケースは[0.6.11証拠](../step-8-structured-progress-20261003/SUMMARY.md)として保持し、nativeへ読み替えない。

利用者は「そっちでテストできる分は全部そっちでテストしてほしい」と指示した。自動化できる試験はCodexが実施し、実キー・端末接続など環境上代行できない条件だけを手操作待ちにする。Microsoft再変換の[受入例外](../../../docs/decisions/step-8-ms-ime-exception.md)は保持する。Gate最終判定は未完了。
