# 一時停止チェックポイント — 2026-10-20

利用者の「キリの良いところで停めて」に従い、PR #4のレビュー修正を検証・コミット・pushした区切りで停止する。次の機能統合へ進まない。T3のPR監視は解除し、自動継続しない。

- 作業ブランチ: `codex/native-title-metadata`。対象: [PR #4](https://github.com/ervha/Greiva/pull/4)、開発版 `0.99.0`。
- タイトルのnative送受信、保存状態、空タイトル復元、composition中の失効保護を接続。追加レビューの6件には、候補の確定時保存、応答上限、Gitソースハッシュ、下書き統合、起動時の競合読込、取得結果の初期化で対応した。
- 関連Docker検証は[今回の証拠](../../tests/evidence/native-title-review2-20261020/SUMMARY.md)を参照。最新PR headのGitHub Actionsとレビューが確定するまでは、マージ完了・開発単位完了としない。
- 停止時点ではPR未マージ、local main未同期、`v0.99.0`タグ未公開。旧head `b889718`のCI成功を新headの成功へ流用しない。

## 再開時

1. 作業ツリーとremote `main`のURLを確認。PR #4の最新head、Actions、未解決レビュー、競合を確認する。
2. 追加指摘や失敗があれば修正し、関連Docker試験、commit/push、最新headの確認を行う。
3. 問題がなければPRをマージし、local mainをfast-forward同期する。実際のmerge SHAのActionsと関連試験を確認する。
4. 同じ検証済みmain SHAにannotated `v0.99.0`タグを作り、そのタグだけをpushする。公開済みタグを移動しない。
5. その後、タイトル競合解決UI・履歴paginationとM2の次の統合単位を計画に従って進める。最新Windows/実IMEの受入はDocker検証と分ける。

パスワード等の提出や即時の手動操作は不要。メモリ下書きの強制終了耐性、実機受入、Android、最終Gateが完了したとは扱わない。
