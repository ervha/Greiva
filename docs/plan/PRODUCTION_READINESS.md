# 初期提供範囲・PoCとの差・残る判断

v0.34.0で[title送信・同期基盤](../development/PRIVATE_PAGE_TITLE_RUNTIME.md)を実装・検証した。production session/Auth transportとnative runtimeで再送・競合・取消を接続した段階で、title画面/IMEと全端末のmetadata deltaは未完成。実Auth正常系・Windows invoke/IME・配備暗号化/削除/保持/復元・native grantの残条件を継続する。

v0.33.0で[title端末保存基盤](../development/PRIVATE_PAGE_TITLE_DURABILITY.md)を実装・検証した。signed fixture HTTP/実PGと2 native SQLiteで再送・競合・本文保持を確認したが、専用transport/runtime/画面、実Supabase正常系・Windows invoke/IME・配備暗号化は未完成。削除/保持/復元とnative grantの残条件を継続する。

v0.32.0で[title server基盤](../development/PRIVATE_PAGE_METADATA.md)を実装・検証した。private schema4の認証付きrename/read、履歴/immutable結果/Conflict解決を追加した段階で、端末title queue/replica/画面・metadata delta同期は未完成。削除/保持/復元とnative grant・配備暗号化の残条件を継続する。

2026-10-07追記：[個人情報・暗号化仕様](ACCOUNT_PRIVACY_ENCRYPTION_SPEC.md)のアカウント最小化、TLS、DB/backup保存時暗号化・鍵管理、ログ/監視監査、restore/端末認可・索引保護を提供前の受入として管理する。server復号は許容しE2EEを必須にしない。配備先/保持/鍵管理詳細は未確定で、現同期試験を保管暗号化の証拠にしない。

2026-10-05。利用者は機能優先を「おまかせ」、利用形態を「個人利用と自分の端末間同期を先行」と回答した。Codexは最初の案を**Windows/Android、Page/Task/Relation、基本DB Table/List、個人workspace同期**に選ぶ。基本DBの後に他view/Calendar/Automationを段階追加する。Android browser試験をTauri Androidアプリの完成へ換算しない。

共有/招待/public link、外部Calendar、AI、通知/添付、DB全機能の同時提供は初期受入に加えない。これらの製品要求を削除したという意味ではなく、後続提供の対象として保持する。Home/Inboxの詳細を仮定して実装しない。

## 設計と実装の差

| 項目 | 現PoC | 初期版へ進む前の仕事 |
| --- | --- | --- |
| Domain/Application | v0.7.0: Domain intent＋portable認可/durable command。既存UIは近接コード | production adapter接続/依存方向/実workspace原子性 |
| 個人workspace/認可 | v0.8.0のowner/resource読取policy＋PG snapshot adapter。旧PoC経路未接続 | 実session/user/device分離、正本view/migration、全HTTP/CRDT認可、write内再検査 |
| Page metadata | 端末title、本文だけ同期 | metadataのstructured契約、offline作成/削除と本文整合 |
| Native store | Rust/sqlx独自IPC、SQL plugin依存あり | verified atomicityを維持する本番adapterの選定 |
| Web local store | 非永続preview、test-only bridge | 製品Webを提供する時点でOPFS/fallback/CRDT正本を決定 |
| operation ID | client UUID v7、server order | 要件§5.3のserver操作ID採番表記と整合させる。stable client key＋server sequenceを案とする |
| schema/wire | SQLite2、server3、単一stream | workspace/protocol versionと移行/import、旧cursor扱い |
| 基本DB | なし | typed propertyの初期subset、Table/List、Record本文Page参照、bindingと同期 |
| Android Native | browser26＋4/実Gboardの旧証拠 | Tauri build/実SQLite/keyboard/lifecycle/復旧、実機接続 |
| 提供・復旧 | Docker/private試験exe | endpoint、署名、配布、backup/restore、migration、ヘルプ |

## 後続で決める契約

1. **Native保存adapter:** 委任に基づき検証済Rust/sqlx repositoryをportの背後へ残す方針にした。SQL plugin依存の除去や具体adapter/migrationは別検証。語句だけを理由にtransaction実装を置換しない。
2. **operation ID:** client冪等IDとserver sequenceを分け、要件v0.8へ責務を明記。wireのworkspace/version追加と旧データのmigrationは別実装。
3. **Web保存:** SQLite/OPFSのstructured storeとy-indexeddbのCRDT耐久化を分けるか、binaryも同じstoreへ入れるか。初期Windows/Android実装をWeb方針未確定で止めず、portを共通にする。
4. **本番接続:** Auth/API/collaborationの提供先、Supabase等のproject、token保管、署名/配布。credentialをchatやgitへ記録しない。未設定のendpointへ本番deployしない。
5. **保持・失効:** logout/失効時のofflineデータ、history/snapshot/compaction、backup保持、cursor期限。期限を仮定して削除処理を追加しない。
6. **PoC import:** 初期版で既存試験データを取り込むか。元DBを保持し、workspace所属/旧pending/端末titleを明示的に移す。
7. **基本DB subset:** Name/Text/Number/Checkbox/Select/Date等の型、Record本文、Table/Listの編集・filter/sortを最初の候補として詳細契約に落とす。既存Task/Scheduleのbindingは先に確定し、全EAV化を自動採用しない。

機能優先の委任は上記の初期提供順の選択へ使う。role詳細、Provider費用/秘密情報、既存データの移行/削除、保持期間を無断で確定する根拠にはしない。必要な判断をまとめ、依存しないコード・fixture・設計は先に進める。
