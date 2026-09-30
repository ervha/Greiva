# 変更履歴

番号は確認済みのリポジトリ開発チェックポイントを示す。[運用方針](docs/development/versioning.md)。将来機能の設計と実装は区別して記載する。

## 0.1.0 — 2026-09-30

初回のバージョン付き開発チェックポイント。これまでの実装・検証と現在の製品設計を基準として記録する。

- 実装済み: 隔離したPoC基盤、基本Editor、Slash候補・Toggleの操作改善。
- 既存の検証: [Docker証拠](tests/evidence/editor-ux-20260930/SUMMARY.md)でbuild、型検査、unit/integration 20件、E2E 30件、SQLite初期化、実PostgreSQL接続が成功。今回の文書更新では再実行していない。
- 設計: 汎用Calendar/時間割と変更範囲・例外の引き継ぎ、ヘルプ、将来の文章/音声によるAI操作。
- 今回の決定: 長い録音から抽出したTask・予定は候補一覧から選んで一括登録。短い直接指示の新規作成は直接実行を維持。
- 運用追加: `VERSION`、変更規模に応じたannotated Gitタグ、コミット/タグのGitHub反映。
- 今回の確認: 文書の整合性・リンク・diff check、採用したPoC仕様のSHA-256が不変であること。
- 未完了: Windows VMのnative起動・Microsoft IME試験、アプリの永続化・同期。Calendar・ヘルプ・AIは設計段階で、Gate A/B/Cは未判定。
