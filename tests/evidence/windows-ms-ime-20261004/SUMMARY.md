# 通常Windows 0.6.20のMicrosoft IME・遠隔composition

2026-10-04、検証checkpoint v0.6.22。製品コード／manifest／実行物は0.6.20のまま。利用者は新しいGreivaの入力方式について「切替済み」と回答し、Microsoft IMEへ切替。以後のキー入力・遠隔更新・保存照合はCodexが代行した。

## 実キー入力の2条件

通常Windows releaseは[0.6.20 build](../block-drag-large-20261004/build.json)、SHA256 `8dc52aa61302777a41b927de599cbd4239592894e16e61ca68329b1ad5b8d115`。test frontend flags=0、SQLite crash hooksなし。専用Page WIN620-IME1000、ID `01a10400-0000-7000-8000-000000000001`。1,000 paragraphを保持したまま、Computer Useで正しいwindowを選択し操作。

| 条件 | 操作と最終本文 | 結果 |
| --- | --- | --- |
| A: 通常変換 | 1行目末尾で実キー `n,i,h,o,n,g,o`→Space→Return。最終 `WIN620 local 日本語日本語` | 今回のMicrosoft入力は後ろの「日本語」1個だけ。前の1個は[provider未同定の準備試行](../windows-ime-preparation-20261004/SUMMARY.md)から存在し、二重確定ではない |
| B: 同一段落へ遠隔3更新 | 2行目末尾で同じ実キー入力、Spaceで「日本語」を未確定のまま保持。別Hocuspocus peerから1秒間隔で同じ段落先頭へ3更新。画面で未確定文字の保持を確認してReturn。最終 `［遠隔3］［遠隔2］［遠隔1］WIN620 remote 日本語` | 文字欠落・二重入力・composition中断・カーソル逸脱・クラッシュを観測せず、変換文字と3更新を保持 |

[遠隔前](before-remote.jpg)・[3更新後／確定前](after-remote-before-commit.jpg)・[確定後](final.jpg)。未確定の下線付き「日本語」が遠隔3更新後も残り、Enterで下線が消え、余分な改行なし。[peer ACK時刻](remote-events.json)は14:00:21.527／22.581／23.634 UTC。fixtureだけの更新で、旧Pageは操作しない。

最初の`n`は入力方式切替後の英数モードで確定したため、Ctrl+Zで試験文字だけを戻した。その後Alt+graveで日本語モードへ切替、Microsoft候補UIと「にほんご」compositionを実画面で確認してからA/Bを実施。literal Unicode投入・synthetic compositionは使用しない。候補の外見だけでproviderを決めず、利用者の切替確認と対応付ける。nativeのtrusted event loggerは追加していない。

## SQLiteと独立peer

[監査script](audit.mjs)・[結果](audit.json)・[独立peer最終XML／clock](peer-final.json)。SQLite online backupでWALを含めて取得、read-only／Dockerで検査。今回の実保存先は通常Roamingの `dev.greiva.poc.validation620/greiva.sqlite`、**30更新**。前のpackaged Roamingは9更新の旧状態のまま。最初にコピーしたpackaged側が今回の更新を含まないことを検出し、両候補を読み取り確認して現行peerと一致する通常Roamingのコピーを採用した。保存先変化の原因は断定しない。

- integrity_check=ok、30更新のdigest全件一致。
- 全1,000 paragraph、上の2本文を正確に保存、残る998 paragraphはseedと完全一致。
- title／Page IDを保持、独立peerの全文XML・state vectorと完全一致。
- A/B終了時の「端末に保存済み」「サーバーと同期済み」を画面で確認。以後の人による追加入力はこの30更新の試行とは別記録にする。

## 自動dragの追加試行と限界

同じ通常Windows 0.6.20／1,000 blockで、2行目handleを同じ列のまま1行目の上へComputer Useのdragで移動する試行を1回実施したが、順序は変わらなかった。[原画面](automated-drag-no-move.jpg)。保存更新数は30のまま。移動していない状態でCtrl+Zを押すと直前のIME入力をUndoするため、追加Undoは実施しない。実物理mouseの[0.6.19確認](../block-drag-preview-20261004/SUMMARY.md)は保持し、今回の自動操作成功へ置き換えない。製品／helper原因の断定や別の手操作依頼は行わない。

今回は2変換の正確性確認であり、連続入力の体感・native per-key／frame SLOではない。[POC_SPEC](../../../docs/plan/POC_SPEC.md) §13の残る連続入力について、同じPageの1行目末尾へ利用者がMicrosoft IMEで2〜3文続けて入力し、実用上の遅延・候補乱れ・欠落を確認する最小依頼を出した。自動操作は1キーごとの画面確認を伴い、人的な連続入力の体感を代替できない。保存・peer照合はCodexが引き続き行う。

両Greivaは開いたまま、Computer Use解除済み。structured APIはこのPage専用実験で503のままで、Task／Relation同期の合否には使用しない。P1 macOS／P2 iOS、Windows復元目安の扱いと正式Gate判断は残る。

[機能source照合](functional-source-audit.json)でAPI／collaboration／protocol／sync／native command／Rust storeのtracked sourceはv0.6.11と製品v0.6.20で同じGit blobと確認。旧保存・structured証拠の実行版を0.6.20へ書き換えず、変更なしの範囲と現在の59 E2Eを併記して最終レビューする。
