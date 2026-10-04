# 入力時の移動ボタン判定の軽量化と自律判断記録

2026-10-05（JST）、v0.6.24。利用者の継続指示と判断委任に従い、PoC §13の大量Page入力の残課題を改善する。新機能・保存方式・同期契約・本番範囲は追加しない。

## 観測・実装

PageEditorのtoolbar selectorは各transactionで上／下へ移動できるかを調べるため、`adjacentBlockMove`で実際のdelete／insert transactionを2個作って捨てていた。1,000 blockでは全行のoffset走査とdocumentの組み替えを伴う。今回の`canMoveAdjacentBlock`はselectionの祖先と隣接indexの境界だけを参照する。Toggle内では従来どおり最も近いdetailsContentの兄弟を判定する。実際の移動transaction／Undo／composition guardを変更しない。

[証拠](../../tests/evidence/toolbar-availability-20261005/SUMMARY.md)で、top-levelと入れ子Toggleの先頭／末尾／単独子は旧移動の可否と一致。可否だけの判定がtransaction生成や全文走査へ戻ればFailする回帰を追加。Dockerの限定microbenchmarkは同じ1,000 blockの中間位置で旧判定と新判定を交互6回、各1,000組計測した。旧901–1,982ms、新0.066–1.003ms。実UI全体の高速化率やnative SLOと解釈しない。

## 検証

型、50 unit/integration（実DB専用20 skip）、全59 E2E（skip／Fail／flaky 0）、通常frontendとWindows release buildがPass。API／同期／保存層source変更なしで、過去の別PostgreSQL20 Passを保持し再実行とは呼ばない。

production bundle＋release Rust試験bridgeの1,000 block／1,001履歴復元と実キー104文字の保存照合がPass。復元3 sample 372.2–381.1ms、keydown→frame機会p95 17.0ms、keydown→commit ACK p95 291.5ms。以前の別runよりACKが悪い観測も隠さず、入力全体の改善やWindows復元2秒の達成を主張しない。

通常Windowsの別保存先で1,000 blockを復元し、2行目の「上へ移動」→Ctrl+Z、実キーxを代行。「端末に保存済み」を観測後Alt+F4、process不在を確認。SQLite backupの1→4更新で移動・元の全文復元・2行目末尾xを履歴順に照合。他998段落とTask／Relation／queue／receipt／cursor不変。初回structured client ID生成だけを明示して許容する。実日本語IMEやnative性能の追加合格ではない。

## 今回の自律判断すべて

1. 再開対象を既存PoCの大量Page入力負荷へ限定し、Calendar／AI／認証や本番機能を追加しない。
2. toolbarの可否判定だけを変更し、実移動・Undo・focus・IME・永続化の実装を維持する。
3. 位置境界とallocation退行のunitを追加し、全E2Eおよび関連するproduction-bundle Page性能だけを再検証する。無変更のstructured性能1,000操作・PostgreSQLは重複実行しない。
4. microbenchmarkは限定処理の差として記録する。native latency／frame・Gate B性能残条件をPassへ上げない。
5. 新exeはDockerで作り、既存fixtureとは別identifier／Page／SQLiteでこちらがWindows基本操作を確認する。利用者への入力依頼を追加しない。既存Greivaウィンドウは今回の初期一覧になく、その状態を勝手に変更しない。
6. SQLite本体だけのコピーはWAL内3更新を含まなかったため不採用とし、read-only接続からのbackupへ切り替える。structured client初回生成を明記し、他table変化を隠さない。新試験appを終了しComputer Useを解除する。
7. 互換性を保つ性能修正としてPATCH v0.6.24。app所有manifest／lockを合わせ、外部npm314 entry／Cargo依存不変を照合。既存0.6.20以前のartifactの版は変えない。
8. [v0.6.23のGate結論](poc-autonomous-review.md)を維持し、この新試験を未実施OS・最新日本語IME・内部crash全4点の代替にしない。実OS環境と本番／新機能の対象決定は残す。現在の回答／手操作待ちはない。

この改善の実装・検証・記録・commitを今回の区切りとする。追加開発へ進む際は既存のConditional残検証を優先し、本番範囲の追加は対象が決まってから行う。
