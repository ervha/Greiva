# シンプルな配色への変更

2026-10-05 / v0.25.1。利用者の「もう少しシンプルでモダンな感じ」という要望に基づく、既存画面の配色改善。

- 編集画面と接続確認画面で `theme.css` の色・影を共用する。白い本文、ニュートラルなグレーの背景、控えめな緑のアクセントとし、背景のグラデーションを除く。
- 操作、同期状態の文言、フォーカス・選択・composition処理は変更しない。既存の角丸と短い動き、reduced motion/transparency・forced colors対応を維持する。
- 接続確認画面の既存dark表示はチャコール背景に変更する。編集画面のdark対応を新機能として追加する範囲には広げない。
- 既存操作の改善なのでPATCH。アプリ所有manifestと両lockを0.25.1へ揃え、外部依存を維持する。
- Dockerで画面操作を検証し、通常Windows cross-buildは起動・実Microsoft IMEの証拠とは区別する。現在のsource117と既存ビルドの保存先を照合し、同じビルドを再利用した。
- 初回は同じDocker workspaceで通常画面とauth画面の試験を並行実行し、後者も共用packageを再buildした。本文表示・focus・navigation timeoutの失敗が出たため、通常画面試験を中断し、両suiteを順番に1 workerで再確認する。初回結果を残し、原因を負荷や配色と断定しない。ホストでは一度paging file不足によりDocker CLIの起動が失敗し、同じ操作の再実行は成功した。
- コピーした監査ディレクトリの所有権によるEACCESを修正し、版・外部依存監査を再実行した。製品コードは変更していない。
- 専用Docker previewだけを新しいimageへ更新する。既存のAPI serviceは0.25.0で継続し、DB/schemaの変更・ユーザーcredentialの入力は行わない。
- T3 previewでは新しい試験用Pageを使い、desktopの候補メニュー、360pxの編集画面、接続確認画面のlight/darkを確認する。既存利用者Pageは編集しない。
- 利用者の「切りのいいところで止めて」に従い、この配色の確認済みcheckpointを保存して停止する。次のPage編集接続・native認証・metadata変更には着手しない。

結果・再現コマンド・初回失敗は [検証記録](../../tests/evidence/neutral-palette-20261005/SUMMARY.md) にまとめる。
