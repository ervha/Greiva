# Step 2: 最小Editorと隔離環境

実装範囲は`docs/plan/POC_SPEC.md` Section 5、Section 18 Step 2。要件・デザイン文書の本番機能は追加していない。

## 実装

- Tiptap StarterKit、Todo、Toggle、固定候補Mention、Slash Command、Undo/Redo、Markdown shortcut。
- ProseMirror transactionによるtop-level blockのDrag & Drop、上下移動、list itemのindent/outdent、Toggle入れ子と解除。
- native起動に必要なWindows iconを追加。Viteは`src-tauri/`を監視せず、Rust出力のEBUSYを避ける。
- 保存・同期は未実装と表示する。Yjs接続、SQLiteへのアプリ保存、Task/Relation APIは後工程。
- 自動試験はunit 4件とEditor E2E 22件を追加。合成compositionの検査はMicrosoft IMEの証拠にしない。

## 2026-09-30の実行環境変更

ユーザーの「実機を汚したくない」という指定により、Dockerで開発・自動試験、Windows VMでTauri/IMEを検証する。[実行手順](../development/isolated-environment.md)。ホスト上のアプリ実行を継続しない。

過去のStep 1失敗記録には「Step 2には進まない」と記載されていたが、ユーザーが計画に基づく続行を指示した後、Windows環境で基盤を確認し、Editorを実装した。未検証を完了扱いにはしていない。現在はPostgreSQLもDocker内で起動し、隔離環境の自動試験を実施している。

## 現在の検証状況

- 切替前のホスト: Web build、型チェック、unit/integration 19件成功、PostgreSQL 1件skip。Windows locked Cargo checkとdebug build成功。native UIは起動していない。
- 切替前のE2E: サーバー起動権限の問題を切り分けた後、4件成功したが、ViteがRust出力をwatchしてEBUSYで停止した。watch除外を修正し、全23件の再試験をDockerへ移した。
- Docker: engine正常応答、image build成功。最終Editorのbuild、型チェック、unit/integration 20件、E2E全23件、SQLite初期化、実PostgreSQL接続、Linux locked Cargo checkが成功。[最終証拠](../../tests/evidence/step-2-docker-20260930/SUMMARY.md)。
- Dockerで見つかったdrag開始抑止、composition Enter消費、移動Undoが直前入力まで戻す不具合を修正。移動を独立したhistory eventとして扱う回帰試験を追加した。
- 追加UX改善: Slash候補のポインター/キーボード選択・検索・画面端表示、ToggleのEnter移動・開閉フォーカス・Undoを改善。全30件E2Eが成功し、入れ子トグルの初期表示競合を修正して10回の再現試験も成功した。[改善内容](editor-ux.md)、[最新証拠](../../tests/evidence/editor-ux-20260930/SUMMARY.md)。
- Windows VM: ユーザーの追加許可によりVirtualBoxと空のVMを作成済み。OS ISO取得中。native UI・Microsoft IME、Gate A/B/Cは未検証。Step 4以降へ進む前にStep 3の初回IME証拠を作る。

次: Windows VMへ検証済みISOからOSとguest用開発ツールを用意し、初回IME試験の結果を記録する。保存・同期機能へ進む条件は変更していない。
