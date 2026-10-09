# 開発進捗と再開計画 — 2026-10-09

利用者の「キリの良いところで止めて」に従い、v0.67.0の検証済みcheckpointで一旦停止する。次のTable/List操作画面には着手していない。Gitタグはソースのcheckpointであり、本番提供・インストーラ公開・全Gate合格ではない。

## これまでの進捗

| 項目 | 実装・確認できた範囲 | 残る工程 |
| --- | --- | --- |
| 個人workspace | 認証adapter、owner/device/workspaceの分離、認証付きHTTP、端末ごとのSQLiteと世代切替・遅着応答の拒否 | 実Supabaseアカウントの正常login/refresh、native credential・offline認可、通常入口への昇格 |
| 日常編集 | Page一覧・本文編集・タイトル変更、Task/Relation画面、未送信表示、競合の明示解決、metadata差分の取得・端末保存 | Page/DBの削除・復元と保持運用、最新private経路の実端末での総合確認 |
| 画面・ヘルプ | 白/グレー中心のシンプルな配色、基本記事と端末内ヘルプ検索、編集中のfocus/selectionを守る接続 | 新しいDB操作の案内、提供範囲に合わせた記事の仕上げ |
| 基本DB | Name/Text/Number/Checkbox/Select/Dateの型とPage binding。Source/Record/Viewのserver保存・一覧・履歴・差分、SQLite cache・永続queue、再送・競合解決、画面用runtime | Table/Listの利用者向け操作画面への接続。現在は保存・同期の基盤が中心 |
| DB検索 | Table/List設定のfilter/sort、読み込み済み行の検索。v0.67.0で未取得Nameと空タイトル、条件未判定の行を区別 | UIで未判定行を表示し、取得後に再評価。全件検索とは表示しない |
| 障害対応 | ACK喪失、通信結果不明、再起動、原子保存、移行、三値競合、古い応答・不整合の拒否をDockerで検証 | 最新Windows/AndroidアプリでIME・強制終了・通信切替・復旧を確認 |

v0.44.0で停止した地点からは、Record/View一覧・View保存、DB差分同期、端末cache/queue、実HTTP送信と画面用runtimeを進めた。v0.66.0では、変更のないremote選択でも選択値と元ACKを照合する不具合修正を加え、修正前の失敗を残した。[証拠](../../tests/evidence/private-database-view-write-20261009/SUMMARY.md)。v0.67.0の追加は[未取得Nameのquery](../development/BASIC_DATABASE_LOADED_QUERY.md)。

## 次の開発順

1. **基本DBのTable/List操作画面**：端末にある定義・行・保存済みViewを件数/容量を制限して表示する。6型の入力、既存Pageとのbinding、filter/sort・表示列・レイアウト保存へ接続する。Name未取得、未送信、通信結果不明、競合を表示し、dirty入力・focus・選択・IMEを取得や切替で失わないようにする。
2. **DBの日常操作と復旧**：実HTTP/native保存を通した統合試験とDocker画面操作を揃える。異なるViewで行を複製しないこと、offline保存→終了→復元→再送→収束と競合解決を確認する。同Record/Viewに未ACKがある間の新しい編集は、現在のbusy契約を保持して扱いを別途整理する。
3. **実認証・端末接続**：実Supabaseの正常系、Windows Tauriのinvoke/IME、Android native保存・Gboard・lifecycle、端末credentialとoffline認可を検証する。旧PoCの限定native/browser証拠を、最新private経路の合格へ読み替えない。
4. **初期提供の準備**：通信・DB・backupの暗号化、鍵/ログ/保持の監査、backup/restore・移行、署名/配布/更新、規約/プライバシーポリシー、最終Gateの証拠を揃える。

Calendar、他のDB view/property、Automation、AI/音声、共有・Web・Apple OSは後続範囲。[実装順](IMPLEMENTATION_PLAN.md)を維持し、設計した機能を実装済みと扱わない。

## 個人情報の方針と必要な対応

メール/認証情報の保管はSupabase Authに限定し、GreivaのDB・ログへメール/プロフィールをコピーしない。本文は通信・DB・backupの暗号化とログ除外を基本とし、server復号を許容する。厳格なE2EEは必須にしない。検索は端末内、AI等への本文送信は利用者が明示した範囲だけ。[合意済み仕様](ACCOUNT_PRIVACY_ENCRYPTION_SPEC.md)。配備暗号化・鍵管理を実装済みとはしない。

次のDB操作画面は追加の利用者回答なく進められる。実認証/配備の段階では、必要に応じてアカウント確認・配備先/鍵管理/保持期間の決定をまとめる。実端末での確認が必要な条件もその時点で整理する。

検証結果と再実施しなかった試験の境界は[v0.67.0証拠](../../tests/evidence/basic-database-loaded-query-20261009/SUMMARY.md)へ記録する。
