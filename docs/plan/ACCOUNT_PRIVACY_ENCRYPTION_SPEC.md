# ユーザー定義・個人情報の最小化・暗号化設計

2026-10-07。利用者回答「GreivaのDB・ログには保存しない。Supabase Authでのメール保管は許容する」を反映した製品設計。本文の保護は追加回答によりA「通信・DB・バックアップを暗号化し、本文をログに残さない。サーバーでの復号は許容する」で確定した。端末内検索と明示範囲だけのAI等への本文送信も合意済み。厳格なE2EEは今回の必須条件にせず、通常の同期・復旧を維持する。

[PoC仕様](POC_SPEC.md)の範囲・順序・Gateを変更しない。設計を実装済みと扱わない。[判断記録](../decisions/account-privacy-encryption.md)。

## 1. ユーザーの定義とアカウント情報（合意済み）

Greivaのユーザーは「認証済みの主体として、個人workspaceへのアクセス権を持つ者」。氏名・メールを必須属性とするプロフィールを作らない。現owner識別は署名検証後の `issuer + subject`。workspace/端末/resource IDを本人確認として扱わず、メールを所有権照合・アカウント統合のキーにしない。

| 保管先 | 情報と制約 |
| --- | --- |
| Supabase Auth | メール、認証credential、認証に必要な情報。保管を許容する。不要なプロフィール属性を追加収集しない |
| GreivaのDB | 認証元＋opaque subject、workspace/端末/resource所属、失効、順序、冪等性等の必要な参照。メール、氏名、電話、住所、誕生日、Authプロフィール、パスワードのコピーを作らない |
| Greivaのログ・監視・診断 | 固定error/component code等のallowlist。メール、Auth claims/response、Authorization、cookie、token、本文、タイトル、秘密鍵を記録しない。例外causeや拒否requestも同じ扱い |
| 利用者端末 | 編集に必要な内容。将来の表示名等は任意・端末内を基本案とし、今回プロフィール同期を追加しない |

Supabase user objectはAuthのschema内に存在する。[公式資料](https://supabase.com/docs/guides/auth/users)。「Greivaにコピーしない」は「どの事業者にも保存されない」ではない。メールhashをGreiva属性として新設する迂回もしない。

現login adapterは端末からSupabaseへメール/パスワードを直接送る。Greiva APIはBearer JWTを検証するため、tokenのメール等を一時受信し得る。「受信しない」とは保証せず、保存・ログ出力・プロフィールへの展開を禁止する。[JWT資料](https://supabase.com/docs/guides/auth/jwts)。Supabase Authを置換せず、自前パスワード管理も追加しない。

利用者がPageに書いたメール等はアカウント属性へ抽出しない。内容の保管は次節の対象であり、アカウント属性をコピーしない方針と区別する。内部ID/IP等も残るため完全匿名と説明しない。

## 2. 本文の暗号化方式（Aで合意済み）

採用Aは通信・保存先・backupの暗号化と、内容をログに残さない運用。必要な処理ではserverが本文を読める。既存Yjs差分生成、Task/Relationの意味検査・三値Conflictと通常のアカウント復旧を維持できる。運営者が絶対に復号できない保証は付けない。具体的な配備先・鍵管理・保持等は提供前に確定する。

| 案 | 保護と影響 |
| --- | --- |
| A：通常の同期を保つ暗号化（採用） | TLS、DB/storage・backupの保存時暗号化、鍵管理、権限とログ制限。serverは必要な処理時に復号可能。同期wire全体をE2EEへ作り替えない |
| B：Page本文だけE2EE（不採用） | serverに本文鍵を置かず端末で復号する。title/Task等の露出は残る。PageのYjs server差分、snapshot、鍵復旧を再設計する |
| C：E2EE採用を保留（不採用） | 比較を保持する方式。今回Aを選択済みで、初期提供のE2EE選択待ちは残さない |

本文保護の緩和は、認証・workspace認可、メールをコピーしない方針、三値Conflict、未送信保存の保証を弱めるものではない。

## 3. A案の具体的な保護境界

- 通信：native/Web→API、API→DB、backup転送等の非local境界でTLSと証明書検証。開発用loopback/Docker内部接続を本番のTLS証拠にしない。
- 保存：PostgreSQLのdata/WAL/temp、storage、snapshot/replica/backupを保存時暗号化の対象とする。disk/managed storage等の方式は配備先に合わせて確定し、binary/Base64/digestだけを暗号化と呼ばない。
- 内容：Page本文/title/metadata、Task/Relation値、operation/履歴、Conflictのbase/local/remote、後続の添付/録音/AI履歴も保管先の保護対象。特定本文fieldの独自暗号化を既存queryへ黙って追加しない。
- 鍵：DBのdumpや同じbackupに平文鍵を同梱せず、配備先のKMS等の管理機構を候補にする。管理権限、鍵rotation、backup復旧、鍵喪失、監査を運用契約にする。具体サービス・鍵管理方式は未確定。
- 権限：APIのworkspace/device認可を全経路に適用。運営者のDB閲覧も必要な担当と目的に制限し、通常のサポートで本文を提出させない。backup・管理consoleも同じ運用範囲。
- ログ：CDN/proxy/APMのbody/header capture、SQL parameter/query log、error cause、crash dumpも点検する。任意telemetryの停止を「全server logなし」と説明しない。必要な運用情報は項目・保持期間・アクセスを別に定義する。
- 端末：現SQLiteの暗号化は未確認/未実装。OS disk保護とOS credential storeを基本案として棚卸しし、端末DB独自暗号化やWeb永続鍵を実装済みと保証しない。WAL/temp/export/検索索引も対象に含めて提供前に方式を確定する。

保管時暗号化は稼働中serverや権限を持つ管理者から内容を隠すE2EEではない。端末上の表示・server処理では平文が必要になる。利用者向け表記は「通信/保存時に暗号化」と実際の方式を説明する。[OWASP保管暗号化の一次資料](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)。この方針だけで配備先や既存backupが暗号化済みと主張しない。

## 4. 復旧・検索・外部送信

前の回答で選択した端末内検索と明示範囲だけのAI等への本文送信は維持し、本文保護の緩和だけを根拠にserver全文検索や無断AI送信を追加しない。新端末の索引準備、索引/cache保護、送信先/項目/目的/保持の表示を設計する。[AI仕様](AI_ACTION_SPEC.md)の既存同意・保持・録音の選択も維持する。AI有効化だけで全workspaceを送らず、暗号鍵を送らない。今回実データの外部送信は行わない。

採用Aではserver側の保管鍵で内容を復元できるため、利用者の復旧コードを本文復旧の必須条件にしない。Supabaseで本人確認を回復した後も署名session、同じissuer＋subject、workspace/端末認可を再照合する。別アカウントや同じメールだけで旧workspaceを渡さない。device失効の適用は引き続き必要。具体的なアカウント回復/再登録の操作契約は別に確定する。

当初の「復旧コード＋既存端末承認、運営者は本文を復号できない」という回答は、本文の最終回答Aによって初期提供の必須条件から外す。端末追加のセキュリティ手順は別途定義し、現device登録を暗号鍵承認の実装としない。将来E2EEを検討する場合だけ、Auth resetと本文鍵復旧、全端末/コード喪失時の結果を再度合意する。

## 5. E2EEを将来採用する場合の境界

現serverはPageのYjs binaryを適用しstate-vector差分を生成する。[Yjs資料](https://docs.yjs.dev/api/document-updates)。暗号文を通常のYjs/Hocuspocus serverへそのまま渡せない。B等を採用する場合は不透明updateの配送/保存と端末の復号・適用・snapshot検証へ分離し、新wire/versionと明示migrationを設計する。

Task/RelationもE2EEへ拡大する場合はserverの意味検査・三値Conflictを端末へ移す新契約が必要。base/local/remoteと因果関係を維持し、LWWで代替しない。標準AEAD、nonce再利用防止、workspace/resource/operationを束縛するAAD、耐久化した同一暗号wireの再送、復号・検証後のcursor原子commit、鍵rotation/旧世代/offline pendingを詳細化する。具体暗号方式/依存は今回採用しない。

E2EEでもID/所属/時刻/通信量は残り得る。端末侵害/XSS、悪意ある更新、serverの可用性や履歴隠蔽を暗号化だけで解決したと説明しない。既存の平文backupの保持/削除反映も別に確認する。

## 6. 公開前の受入と実装順序

| 受入 | 必要な確認 |
| --- | --- |
| アカウント最小化 | synthetic email/profile sentinelを使い、Greiva schema/trigger/error/ログ・APM/proxy/backupにコピーがないことを検査。JWTの受信と保存を区別 |
| 通信 | 配備先ごとのTLS/証明書/DB接続を確認。認可拒否・他workspace/端末失効を維持 |
| 保存・復旧 | data/WAL/temp/replica/backupの暗号化設定・鍵境界を確認。実backup restoreと鍵rotation/鍵喪失時の運用を検証。dumpで本文が読めることと物理保存先暗号化の証拠を混同しない |
| 内容とログ | title/body/Task/Relation/三値Conflictにsentinelを入れ、正常・拒否・例外・診断でログへ混入しないことを検査。IP等の必要ログの目的・保持を確定 |
| 既存機能 | 並行編集、offline/kill/restart、同一wire再送、保存/cursor原子性、Conflict解決の回帰。保存済みpendingを消さない |
| 検索/AI/実機 | 端末内検索、索引保護、明示送信範囲・同意撤回。Docker E2Eと実Windows/Androidのcredential/IME証拠を分離 |

実装順序は、(1)配備/保持/鍵管理の詳細契約、(2)アカウントschema・ログ最小化の監査、(3)TLS/保存先/backup/鍵管理、(4)復旧と端末認可・索引保護、(5)既存同期/Conflict/IME回帰と公開表記を案とする。将来E2EEを採用する場合は新crypto protocol/鍵/暗号同期/migrationの検証工程を追加する。既存PoCの順序を設計だけで差し替えない。

既存DBを自動削除・自動変換しない。配備や保管方式の変更にはbackup/restoreと明示した切替条件を用いる。旧backupの扱いと未送信保存も保持する。現実装で未確認の暗号化・復旧・ログ設定を提供済みと表示しない。
