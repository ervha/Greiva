# Step 6: Task／Relationと保存モデル

2026-10-01。`POC_SPEC.md` Section 18 Step 6の最小モデルを実装した。Taskの名前・状態・date-only期限、RelationのPage/Task参照を端末で登録・編集・削除できる。削除はtombstoneを残し、Page本文は引き続きYjs binaryを正本とする。

SQLite schema 2から3への移行は単一transactionで、既存Page metadata・binary update・last-pageを保持する。Task/Relationの変更と`sync_operations`追加も単一transactionで確定する。queue挿入の失敗時はentity変更全体をrollbackする。未知のschemaや移行先の非互換な表は起動失敗として扱い、自動再作成しない。固定のTauri commandから同じRust repositoryを使い、任意SQLや任意DB pathはfrontendへ公開しない。

未同期entityのversionは0、serverでの初回versionは1。端末の更新だけでserver versionを増やさない。UUIDv7のclient IDはSQLiteに保持し、WebView cache変更で置き換わらない。queued operationには元のbase entityと同entityのpending predecessorも保持する。Step 7でACK後の順序やwire準備へ使うもので、未実装のACK/cursor処理を今回の成功には数えない。

PostgreSQLではapplication専用schemaへTask/Relation表を作成する。Drizzle ORM 0.45.3と既存node-postgresを使い、起動時のschema移行をtransactionとadvisory lockで保護する。モデルrepositoryはversionを確認して更新し、競合する2更新の一方を明示的に拒否する。これはStep 6の保存層の保護であり、Step 7のbase/local/remoteによる競合解決の代替ではない。Page参照IDはopaqueに扱い、Page本文をRESTモデルへ追加しない。[Drizzle公式の接続方式](https://orm.drizzle.team/docs/get-started-postgresql)。

NestJS APIは`GET /tasks`と`GET /relations`を提供する。DB未設定時は503で、代わりのin-memoryモデルを使わない。モデルの書き込みはrepository試験で確認し、利用者の送信待ち操作を送る`/sync/push`、pull、ACK、cursor前進、conflict UIはStep 7で実装する。今回の画面はTask/Relationのserver同期を準備中と明示し、本文の同期状態と区別する。

[Dockerの検証](../../tests/evidence/step-6-structured-models-20261001/SUMMARY.md)では実Rust保存層のrollback・migration・再起動・tombstone、実PostgreSQLの同時変更・耐久化・Nest読み取り、全43 E2Eを確認した。保存成功後のfocusはReactのDOM更新後に戻し、失敗時は入力draftを残す。Windows候補0.4.0はDockerでcross buildしたが、[実機入力APIのアクセス拒否](../../tests/evidence/step-6-native-local-20261001/SUMMARY.md)により新しいTask操作とMicrosoft IMEは未検証。最終Gate A/B/Cは判定していない。
