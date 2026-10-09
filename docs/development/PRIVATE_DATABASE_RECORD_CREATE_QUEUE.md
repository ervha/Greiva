# Record作成の端末queue

2026-10-09 / v0.61.0。[Source作成送信](PRIVATE_DATABASE_SOURCE_WRITE.md)に続き、本文Pageに紐付く新規Recordの端末保存を追加する。[判断20件](../decisions/private-database-record-create-queue.md)、[証拠](../../tests/evidence/private-database-record-create-queue-20261009/SUMMARY.md)。native13→14/server11保持。今回はcreateだけで、既存行のupdate/競合解決queue、Record送信session/runtime、View queue、Table/List画面は後続。

## pendingと依存確認

database_record_create_enqueueはoperationId/Source定義/create intentを非同期処理前に捕捉する。canonical UUID/所属/schema/6型を検査し、Name値を保存しない。未送信Recordはversion付きconfirmed cacheと別表へ保存し、架空Record snapshotやversionを作らない。同operationと同内容だけを再保存でき、operation/Record/Source内Pageの衝突を拒否する。

Source定義はchecked confirmed cacheまたはchecked Source作成操作に一致する必要がある。local Page documentも要求する。SourceもPageも未送信の状態からRecordを保持できる。操作/定義/index/contextのSHA256と元wire文字列SHA256を検査する。局所破損検知でAuth grantや悪意あるDB全体改変への署名ではない。UTF8の元requestが8MiBを超えるintentはenqueueのtransaction前に拒否する。

prepareは最古未ACK1件を選び、Sourceの確認前はsource待ち、Pageの作成確認前はpage待ちを返す。この結果にwireや架空server versionを与えない。後続の準備済み行を先に送るために順序を変えない。Sourceはcache receipt、local Page bootstrapは元wire/binary/digest/ACK scope/creation identityを照合する。受信済みremote Pageは既存のserver head/binaryを使い、local bootstrapを捏造しない。Page bootstrap確認後の未送信本文frameはRecord作成を妨げない。

確認後にprotocol/client/operation/create intentの元wireを同transactionで固定する。再prepareは保存bytesを意味/checksumと照合し、key順やformatを再生成しない。Sourceのname等metadata更新はRecord操作を書き換えず、schema/property定義の変更は旧操作を自動変換せず拒否する。queueはmax100＋lookahead/正確sequence keyset/pending-onlyで、global pending数をwindow件数と区別する。

## 原ACKと確認済みcache

ACKは元sequence/wire/client/workspace/epoch/operation/Source/schema/Record/Page/version1/applied/typed valuesを照合する。原ACK、元write receipt、Record history/currentを同transactionで保存する。create結果を架空read responseへ変換せず、receiptは対応する元create操作・wire・定義・原ACK proofを検査する。内部のcache適用用にrecord/conflictsを抽出するが元envelopeは保持する。

先行するread/DB deltaが同じversionを観測しても未ACK操作は残り、最初のhistory receiptを保持する。新しいread版を古いcreate ACKで戻さず、原version1の履歴も保持する。delta cursorを作成ACKで変更しない。同version内容違いやSQLite statement failureはACK/cacheをともにrollbackする。exact replayはqueue/cache/原version1 historyのproofを検査し、欠損history/projectionを補修しない。

## 移行と証拠境界

bound context照合後にnative0/5〜13から14へ移行する。Source queue/cache、Record/View/delta、Page binary/本文queue/title、Task/Relationを保持する。foreign binding/partial DDL/unknown schemaはrollbackし、旧PoC DBを取り込まない。Registryはstrict IPC、portable/native adapterは型/scope/件数を検査する。Auth refresh/close後の旧storeを拒否する。

新native23条件と旧回帰を確認する。enqueue/prepare/ACK各COMMIT前後の実SIGKILL6 trials、型/null/zero/false/absence、remote Page、Source/Page依存、read/delta先行/late ACK、元format/正確bigint、実trigger failure、破損/非補修replay、移行/並行書込み/認証更新を含む。初回test syntax checkのmissing braceを修正したlogと、重点20→22の成功を分ける。追加canonical UUID試験で初回通常回帰613 Pass/1 Failとなったため、raw native create IDを小文字に限定した。修正後の重点23/最終回帰を元Failと別reportへ保持する。

server Record writerは既存実装だが、今回のnative queueから実HTTPを送るsession/runtimeは未接続である。actual Supabase正常login、Windows actual invoke/MS IME/Android/native credential・offline grant/配備暗号化/native Gateは別条件。
