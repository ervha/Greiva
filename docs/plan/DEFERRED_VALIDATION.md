# 手操作待ちの検証と解決案

2026-10-03、v0.6.15更新: [Android実機](../../tests/evidence/android-pixel7-20261003/SUMMARY.md)の自動26項目・接続停止／再接続4項目はCodexが代行。実Gboard E/Fは利用者が問題なしと回答し、原イベント・遠隔3更新・独立peerを照合した。Android browserはP2でSQLite保存なし。macOS P1／iOS P2は利用可能な実機未確認、Windows release性能・残る必須操作・最終Gate資料を続ける。

2026-10-03、v0.6.14更新: Codexが[通常Windows Conflict UI](../../tests/evidence/windows-native-conflict-20261003/SUMMARY.md)を検証。3値保持・別field merge・draft保持、local pointer採用／remote Tab・Enter採用、open Conflictの強制終了・connected再起動保持を確認した。native Conflict UIを未実施項目から外し、残る全操作・release性能、Android実IME・再接続、P2・最終Gateへ進む。利用者指定により継続開発し、代行できない実入力・端末状態など必要な情報だけを依頼する。

2026-10-03、v0.6.13更新: Codexが通常0.6.11のACK到着前強制終了、offline再起動、再接続・独立peer収束を実施。[native通信証拠](../../tests/evidence/windows-native-network-20261003/SUMMARY.md)。Relation pending1件からpullでACK／receipt／cursorを復旧し、本文・clockとTask／Relationが一致。NT-01の一部を補完したが、SQLite transaction途中の全境界・native Conflict UI・全操作・release性能は残る。UI操作後にComputer Useを解除済み。以下の保留・手操作待ち表現は過去判断で、自動化可能な残試験はCodexが実施する。

2026-10-03、v0.6.12更新: Windows UI代行環境が利用可能。利用者の「そっちでテストできる分は全部そっちで」指示を採用し、NI-02の代行可能なUI確認を手操作待ちから外す。[native block／Task／Relation／offline保存完了後crashの証拠](../../tests/evidence/windows-native-ops-20261003/SUMMARY.md)。保存・再起動確認もCodexが実施した。通信途中／ACK／peer収束と残る最新native全操作は自動化対象として継続し、実端末接続や代行できない実キー条件だけを手操作待ちにする。NI-01の受入例外は継続する。

2026-10-03、v0.6.11更新: 利用者は手動操作可能と回答し、通常0.6.9と素のtextareaで再変換A/B・C/Dを実施した。[照合結果](../../tests/evidence/windows-ime-reconfirm-20261003/SUMMARY.md)。さらに他アプリ複数でも同じ症状との報告と「無視してよさそう」との指示を受け、NI-01を[この環境の受入例外](../decisions/step-8-ms-ime-exception.md)として修正待ちから外す。下記の原因診断案は将来の参考として保持するが、再変換対策を他の検証の前提にしない。通常0.6.11候補はbuild済み、最新Windowsの他の操作・保存／復旧とAndroid実OSは引き続き未実施。

2026-10-03、v0.6.10。参照セッションでの0.6.9停止後、利用者が「セッションも参考にしつつ次に進めて」と再開を指示した。手操作は引き続き後回しとし、判断が必要なら通知し、回答に依存しない作業を続ける。保存済み証拠の監査と[受入条件・再開順序](POC_VALIDATION_MATRIX.md)を追加した。監査はGate判定ではなく、未確認事項をPassへ読み替えない。前回の「キリの良いところで止めて」は0.6.9 checkpointで履行済みの履歴として保持する。

問題ごとに発生条件、証拠、複数の候補、制約、推奨する次の確認を残す。承認済みのDocker開発・自動試験・検証済みcheckpointのcommit/tag/pushを継続する。Windows試験は既存実行物またはDockerで作った候補を使い、ホストのglobal toolchainやVMを追加しない。

## NI-01: Microsoft IMEの再変換時の範囲拡大

**状態: 未解決。利用者の物理「変換」キー操作が必要。** [native診断と原証拠](../../tests/evidence/step-8-ime-focus-20261002/SUMMARY.md)、[失敗記録](../failures/step-8-ms-ime-reconversion.md)。選択した「日本語」3文字が、選択後のウィンドウ移動を経た再変換のnative削除eventでは直前の `al ` を含む6文字になった。素のtextarea/contenteditableでも発生し、遠隔更新がない条件でも再現した。移動なしの比較は本文を保持したが、OS／IME／WebView2内の原因は未確定。

| 候補 | 利点・狙い | 制約・判断 |
| --- | --- | --- |
| A: 通常製品と素の入力欄で、window移動あり／なし、遠隔更新あり／なしを同じ操作列で比較する | 最小再現と発生層を確認し、Greivaの遠隔選択不具合との混同を防ぐ | 原因確認であり解決済みにはしない。途中のチャット返信を避け、操作をまとめて終えてから結果を回答する。過去のまとめ操作でもFailしており、返信方法だけで解消するとは考えない |
| B: WebView2／IMEの実際の版を記録し、独立した最小Tauri入力欄でinput context・focus・native target rangeを診断する | 入力層の互換性対策を試す根拠を作れる。上流への再現資料も用意できる | APIの可否と効果は未確認。候補は試験用buildへ限定し、OS設定・runtime更新は自動で行わない。外部への報告送信は利用者の指示が必要 |
| C: Google日本語入力との同じ比較を行い、Provider固有の差を調べる | 発生範囲を狭められる。既に通常入力の限定証拠がある | Googleで成功してもMicrosoft必須条件の代替にはしない。入力方式の変更・変換開始は手操作待ち |
| D: A/Bで入力層の対策が成立しない場合、入力処理または技術選定の変更を具体案として比較する | 必須条件を維持した選択肢を判断できる | 最終技術選定は未実施。変更範囲、データ互換性、選択・Undo/Redo・共同編集への影響を提示し、POC_SPEC §1.3に沿って判断を求める |

**推奨順序: A → B、Cを補助比較。Dは証拠が揃ってから質問する。** 既存のkeydown候補と選択方向更新候補は防止策として成立せず、製品へ採用していない。欠落を後から本文復元で隠す、Microsoft条件を免除する、composition中の同期を永久に停止する案は採用しない。

再開時はfixtureを新しい専用Pageに作り、①IME切替、②「MS65 local 」末尾への「日本語」入力・確定、③3文字だけの選択、④指定したwindow移動、⑤変換・候補選択・確定を一度の依頼にまとめる。最初の変換開始前後のnative event、選択の両端と方向、PM transaction、Yjs binary、SQLite、fresh peerを対応付ける。チャットへ返信するためのwindow移動を実験途中に入れない。操作API未対応のキーをliteral Unicodeやsynthetic eventで代替しない。

## NI-02: 新しい製品候補のWindows回帰

**状態: 候補準備・Docker検証は自動で進められる。native IME部分は手操作待ち。** 本文・見出し・Todo・Toggleで前後両方向の選択、フォーカス移動、遠隔挿入／削除、local Undo/Redoを確認する。今回Dockerで見つけた遠隔更新時の選択位置の問題とNI-01を分ける。新しいbuild成功をnative試験成功として数えない。

- A（推奨）: Docker回帰済み候補を新しいSQLite／WebView保存先で試す。既存失敗fixtureと通常0.6.5実行物は残し、artifact hashと実際の版を照合する。
- B: 既存0.6.5と候補を同じ操作列で比較する。診断範囲を明確にできるが、両条件に手操作時間が必要。
- C: 診断source overrideで観測を増やす。原因調査には使えるが、通常製品の合否と分け、通常buildで再確認する。

受入条件は本文・選択範囲と方向の保持、composition未取消、local操作だけのUndo/Redo、peer／SQLiteの全文・構造・clock一致。NI-01が残ればStep 8全体の完了やGate AのPassを宣言しない。

## NT-01: native IPCの統合crash／大量データ性能

**状態: Docker版の試験は継続可能。Windowsでの観測・IME関連操作は保留。** 保存完了前／後、push確定ACK喪失、pull cursor確定前の境界と、release起動・1,000 block復元・入力待ちを確認する。DockerのRust bridgeとWindows Tauri IPCを同一結果にしない。

- A（推奨）: 隔離した新規DB、通常製品候補、専用peerで実機の四境界と復元監査を行う。保存済みの全変更と保存中の未commit入力を区別する。
- B: 観測用buildで停止境界やfirst paintを測定する。境界が明確になるが、通常製品候補の回帰を別に要する。
- C: Docker負荷条件・journalを先に固定し、実機再開時に同じworkloadを使う。準備は自動化できるが、実機性能の代用にはならない。

正確性と時間の目安を別々に報告する。benchmark用DBの消去・退避は対象pathとbackup hashを確認し、利用者の既存データを変更しない。

## PL-01: P1／P2の実OS検証

**状態: 2026-10-03、利用者申告はWindows PCとGoogle Pixel 7／Android 17 QPR1。** Androidの接続方法・Chrome版と実機でのOS確認は未実施、端末操作は当面できない。macOS／iOSの試験端末は確認できていない。端末操作が必要な試験は回答だけで完了しない。

- A（推奨）: 利用可能な端末・OS版・接続方法を回答してもらい、最小起動から対象操作へ順に検証する。
- B: 承認された別の試験環境を使う。費用・アカウント・署名・データ扱いを具体化してから判断を求める。
- C: 現在利用できない対象をNot runとして最終資料へ残す。未検証を合格へ変えない。

## GD-01: 最終Gateと技術選定

再開後、手操作待ちの間も受入条件と既存証拠の対応、失敗原因・候補・再開手順、未実施項目の整理は進められる。v0.6.10で対応表・監査を追加したが、最終判定は未完了。全Gateが確定していない状態で本番Calendar／DBビュー／AI等をPoCへ追加しない。修正にアーキテクチャ変更が必要になれば、複数案・影響・推奨案を示して質問を通知し、それに依存しない作業を続ける。手操作待ちをGate合格や全作業の完了としない。
