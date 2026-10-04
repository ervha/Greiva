# 描画・native選択・drag受入・Windows保存層の補強と全自律判断

2026-10-05、製品/checkpoint v0.6.25。利用者の「可能な限り進める」「判断はすべて記録する」「commit/区切りごとの停止は当面気にしなくてよい」に従う。[検証全体](../../tests/evidence/render-isolation-20261005/SUMMARY.md)、[Windows保存層4条件](../../tests/evidence/windows-store-boundaries-20261005/SUMMARY.md)、[今後の計画](../plan/NEXT_DEVELOPMENT_PLAN.md)。

## 今回の判断すべて

1. **追加開発を既存PoCの品質/性能/復旧へ限定する。** Step 9の条件付き採用を継承し、Calendar/AI/認証等の新機能を自動追加しない。利用者の「先の記事」はURLのない先行説明/判断資料の参照として扱い、外部記事を推測しない。
2. **同じpropsの描画だけを隔離する。** PageEditor/TaskPanelにReactの標準memoを使い、独自比較は入れない。所有Hook状態・title/pages/paused/storage-errorの変更は生かす。配列のin-place変更や保存/同期方式の変更は行わない。[Reactの公式説明](https://react.dev/reference/react/memo)を参照した。
3. **初回の回帰失敗を隠さず切り分ける。** full59の58/1を2回、focusedのRedo失敗、memoを外したbaselineのHome/drop失敗を記録。同一期待/timeoutを維持し、単なるrerunや基盤置換で済ませない。比較用counter/event logは一時sourceへ限定し、通常buildに含めない。
4. **移動キー後のDOM選択をkeyupで同期する。** DOMがHomeで0へ動いた後に古い3へ戻る観測に対し、public ProseMirror APIでselection-only transactionを作る。Home/End/Arrow以外、composition、IME key229、blur、NodeSelection、DOM外/不正範囲は従来処理へ任せる。preventDefaultをせず、文書を書き換えない。最初の戻しを起こした上流処理の完全特定は未達と明記する。
5. **gutterの新しいtargetをdragenterでも受け入れる。** 所有payloadの既存受入/preview処理だけを登録し、本文外drop、Escape、remote変更時の取消と実move/Undoを維持。dragover範囲内でもdropなしの観測と6回試験を根拠に採用する。[WHATWG](https://html.spec.whatwg.org/dev/dnd.html)のtarget受入説明を参照し、OS/ブラウザ自体の不具合を独立証明したとは言わない。
6. **再現可能な診断を用意する。** 描画比較は別config/testDirと復元hash/原本を残すcontrollerへ整理。Windows repository境界は既存Nodeとcross-built診断driverで4条件を実行し、PID/marker、read-only未commit可視性、再試行/冪等性、digest、DockerでのYjs全文再構成を確認する。
7. **driver/UI/実サーバーの証拠を分ける。** Windows診断driverは実source0.6.24、Rust実装は今回変更なし。診断hooksはCLIだけ。制御したpull結果を実POST/ACKや通常Tauri内部全fault条件の合格へ換算しない。通常0.6.25 frontend flags0/store hooksなしを別buildで検査する。
8. **試験準備のWAL欠落を訂正する。** 初回seedは250 Taskのうち131件を含んだmain-only copyだった。既存user DBには触れず、試験appを保存/終了して119 synthetic Taskだけを補完し、元Pageを保持。以後はonline backupを採用する。初回backup/途中candidateと最終candidateを区別し、snapshot field名の誤った期待、Docker copy後のowner権限、native画面外clickなどの準備/操作失敗も製品Failと混同しない。
9. **描画回数とend-to-end性能を分ける。** 最終比較は各78→0追加呼出（初回別runは80→0）。production bundle/実Rust/104実ASCII文字で正確性も確認するが、frame/復元が前の別runより悪い結果を記録し、速度保証/Windows2秒達成にはしない。ACKはinput event起点で、旧v0.6.24の誤表記も原数値を変えず訂正する。
10. **Windows確認を利用者に代わって実施する。** 新identifier/保存先のsynthetic Pageだけで、1,000段落/250 Task、下書き保持、title連動、最終Home/Shift+End/z/Undo/Redo/Undo、保存→終了→再起動を確認。全7 updateと全table、独立peer全文/clockを照合する。API503のfixtureではpending250のままと記録し、server同期済みに読み替えない。実IME/provider・物理mouse・native latencyは未追加検証とする。
11. **版・公開資料・cleanupを守る。** 互換性能/正確性修正のPATCH0.6.25。app所有manifest/lockを揃え、外部npm314/Cargo依存は不変。exe/SQLite/旧自由入力は.dataのまま、synthetic証拠だけを選ぶ。自分で起動した試験app/driverを終了し、Computer Useをresetする。旧IME69/WIN620のuserデータを編集しない。
12. **残る実環境を一度再確認する。** 現在iOS simulatorはmacOS/Xcode不足、Pixel_10はdevice_openが起動Fail、ADBは接続0台。OS/SDK/global toolchainの導入や設定変更を行わず、macOS/iOS、Pixel 7接続、最新版実MS IME/物理drag、native性能の残事項をまとめる。既存Gate結論は実行版0.6.20の歴史的判断として保持し、最新全OS無条件Passを主張しない。
13. **今後の計画を実施範囲と提案に分ける。** 品質補強→本番契約/初期提供範囲→基本画面→DB/Calendar/Automation→配布運用/AIの案を記録する。更新/ヘルプをAI完成まで待たせず、認可が必要な提供形態では先行する。未決定のMVP/共有/Provider/保持/費用を恒久実装へ仮定しない。区切りだけでは止まらず、今回独立して実行できる確認・修正・証拠整理を終えてから、必要な実環境/次の製品範囲を引き継ぐ。

## 残る応答・環境・操作をまとめた記録

| 項目 | 必要なもの |
| --- | --- |
| 最新0.6.25実Microsoft IMEと物理drag | providerを確認できる実Windows入力条件/実mouse。今回はASCII/native controlとcomposition guardを確認、0.6.20/0.6.19の旧実機証拠は保持 |
| Windows性能 | 通常releaseの編集可能時刻/連続入力/実paintを分離した測定。Dockerの555.8–565.5msをnative復元目安へ転用しない |
| Android再確認 | Pixel 7のADB接続/表示中の実ブラウザ、または起動可能なemulator環境。現在追加検証不可 |
| macOS/iOS | 対応OSの実行環境。Windows上でiOS simulatorを構築しない |
| 通常Tauri内部fault全条件 | 診断CLIと別の通常GUI/IPC境界の検証。保存実装変更/提供前に追跡する |
| 製品化の実装順 | 初期利用対象、個人/共有、Home/Inbox/検索/DB/Calendarの最初の範囲。既存仕様の確定部分で本番設計を整理できるが、未合意の恒久実装はしない |

利用者に今回追加の手操作を要求していない。新機能/OS設定/Provider課金へ進む承認を推定せず、上記を次の判断材料として残す。
