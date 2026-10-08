# Pageタイトルの端末保存基盤

2026-10-08 / v0.33.0。[server契約](PRIVATE_PAGE_METADATA.md)を端末SQLiteとstrict IPCへ接続する。[全判断](../decisions/private-page-title-durability.md)、[証拠](../../tests/evidence/private-title-store-20261008/SUMMARY.md)。タイトル専用HTTP transport・runtime・画面rename/解決は後続で、今回のHTTP試験はfixtureによる手順の合成である。

## 保存と移行

既存の主体/workspace/device/epochに束縛されたnative workspace storeをschema6から7へ原子的に更新する。fresh0と既存5も従来の移行経路を通す。title base、operations、receipts、conflictsの4表とPage別sequence indexを追加する。Page本文binary/journal、Task/Relation、bindingを保持し、部分schemaや異なる主体は拒否する。旧版のversionless titleをversion0と推測しない。初期のbaseはnullで、版付きmetadata queryを受けるまで変更できない。

title operationsはoperationId・title・任意resolution、観測したbaseVersion/baseTitle、先行pending operation、任意のprepared wireを保存する。receiptはoperation別immutable response、conflictsは候補と確認できたresolvedByを保持する。保持期限やGCを追加していない。title/history/候補も保存時暗号化設計の対象だが、SQLite/配備DB/backup暗号化の導入は今回の成果に含めない。

## 編集と再送

`NativeWorkspaceStore.title(pageId)` の捕捉されたportはenqueue、prepare、acknowledge、receive、loadを提供する。既存workspace_execute registryがpath・主体・device・epoch・handle世代を固定し、TypeScriptでもscope/strict wireを検証する。Auth refresh後の古いportは使えない。新portは同じ保存済みwireを再利用できる。native Tauri invokeをWindowsで実行した証拠ではなく、同一Rust registryをDockerのdriverから検証している。

enqueueには既知の版付きbaseと、該当Pageの未確認bootstrapがないことを要求する。operationIdと内容が同じ再試行は重複を作らず、異内容や別Pageでの同IDは拒否する。localTitleは最新pending intentのtitle、それがなければ確認済みbaseを投影する。canonical baseとこの投影は分離し、queryや古いACKがpending編集を消さない。

複数pendingがあるとき、新しいintentは先行pendingの観測基底を引き継ぐ。途中のremote queryがcanonical baseを更新しても、新しい入力を未確認remoteへ自動rebaseしない。prepareは最古pending一件だけのwireを保存する。未preparedの子intentだけは、先行する自分のimmutable receiptがappliedで、そのtitleが先行intentの要求値と一致する場合に基底を進める。Conflict/rejectionや、remoteを維持した異値no-opでは進めない。一度preparedになったwireはquery・再起動・再送でも変わらない。

acknowledgeはsequence/wire/operation/Page/epoch/候補を検証し、receipt・base・投影・候補・解決記録を同じtransactionへ保存する。現在の最古pendingを飛ばさず、別内容の重複ACKを拒否する。古いACKは新しいbaseを戻さず、新しいpending投影も消さない。receiptが表すのはそのoperationの結果で、現在server状態や全端末の同期完了ではない。

## 読み取りと競合

版付きread responseはrequestのclient/keyset/limitとscopeを照合する。同版の異title/異createdAtは拒否し、旧版では基底を戻さない。表示用updatedAtは後退させず、時刻で候補の勝敗を決めない。候補はimmutable upsertで保存し、queryから欠落しても削除したり解決済みと推定したりしない。resolvedBy=nullは「この端末で成功した解決を未確認」で、serverの現在open状態の証明ではない。

明示解決は新operation、保存済み候補、厳密なlocal/remote選択値、settled title queueを要求する。serverがstale/invalidを返しても元intent/receipt/候補を残す。成功した解決だけresolvedByを記録し、候補/historyを削除しない。

loadはoperation sequenceとConflict UUIDを独立keysetにし、limit1–100と各一件のlookaheadでbounded snapshotを返す。sequenceはSQLite i64の正規十進文字列で、JavaScript safe integerへ丸めない。base/投影/保存wire/receipt/候補とlookaheadも検証し、壊れた状態を空へ置き換えない。返されたsnapshotは凍結する。既存catalogのpendingは本文binary件数のままで、title pendingを含めた同期表示はまだ接続していない。

## 本文との互換性と再開順

管理されたtitle baseまたはintentがあるPageでは、旧本文readのversionless metadataでtitleを置き換えない。本文binary/headは引き続き保存する。別端末の改名後、元のPage creation再送が返す現在titleは初期titleと一致する必要がない。PageSyncSessionとRust ACKは初期digest・scope・creation identityを検証し、タイトル一致に依存しない。bootstrap再送で管理済みtitleを上書きしない。

Dockerでlocked normal/crash examplesをbuildしてから、`npm run typecheck`、`npm test`、DB設定済み`npm run test:postgres`を実行する。SIGKILLはenqueue/prepare/ack/receiveのCOMMIT前後8条件。signed fixture HTTP・実PG・2 native registryでlost ACK/reopen、連続編集、三値/新解決、古い本文metadata、Auth refresh/失効時pending保持を検証する。実Supabase正常ログインやWindows IMEと区別する。

次はこのportへ専用HTTP transport/runtimeを接続し、query pagination・再送・世代取消と同期表示を検証する。その確認後にtitle draft/IME/focus保護と明示解決画面を実装する。metadata delta・削除/復元・保持/GC・native credential/offline grant・実Auth/Windows invoke/IME/Android・配備暗号化は残条件である。
