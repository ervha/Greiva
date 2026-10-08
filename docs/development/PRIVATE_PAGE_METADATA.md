# 個人workspace Pageタイトルのserver基盤

後続v0.36.0で[増分server journal](PRIVATE_PAGE_CHANGES_SERVER.md)をschema5へ追加した。既存schema4のrename/read契約を維持し、title版が変わらない解決も別commit順へ記録する。以下はv0.32.0時点の契約と当時の残条件。

後続v0.33.0で[端末保存/strict IPC基盤](PRIVATE_PAGE_TITLE_DURABILITY.md)を実装した。以下はv0.32.0時点のserver契約/検証境界。title専用transport/runtime/画面は引き続き後続。

2026-10-08 / v0.32.0。[実装順](../plan/IMPLEMENTATION_PLAN.md) P2のmetadata変更を部分実装する。[全判断](../decisions/private-page-metadata.md)、[証拠](../../tests/evidence/private-page-metadata-20261008/SUMMARY.md)。画面のrename、native queue/replica、offline復元やmetadata delta同期は後続。

## APIと保存

専用APIの `POST /v1/workspaces/:workspaceId/pages/:pageId/metadata/rename` と `.../metadata/read` を追加する。通常の署名session検証後、issuer/subject owner・device所属/失効・Page所属/削除を同じtransactionで確認する。schema/share→workspace→device→resource→Page documentの順でlockし、期限をqueryの前後とCOMMIT前にも検査する。タイトル変更と本文appendは同じdocument lockで直列化する。

renameはprotocolVersion1、clientId、operationId、baseVersion、titleと任意のresolutionを受ける。titleは65536 UTF-16 code unit以内、versionは非負のsafe integer。actor/email等の余分なfieldを拒否する。返信はworkspace/epoch/Page、版付きmetadata、operationIdとapplied/conflict/rejected。版は本文headOrderと独立し、実際のtitle変更時だけ増える。既存Page wireへversionを混ぜず、`@greiva/protocol/private-page-metadata` の独立subpathを使う。

server正本の `private_page_documents.metadata` のtitle/updatedAtだけを更新し、creation_request、createdAt、yDocId、本文journal/digest/headは保持する。schema4で新規Pageを作るときはtitle state/historyのversion0も同時に作る。binary read/bootstrap retry/catalogは現在のtitleを返す。本文appendは現在のtitleを引き継ぐ。

operationIdはworkspace内のtitle ledgerでunique。Page/client/正規化requestまで一致する再送には、後からtitleが変わっても保存した同じ返信を返す。これは現在値や「同期済み」の証明ではない。異内容/別Pageでの同IDは409となり、同時nonce衝突も負けたtransactionの全書込みをrollbackする。applied/conflict/rejectedをすべて保存する。COMMIT応答を失った場合は同じID・内容で再確認する。

## 三値と解決

baseTitleはclientから受けず、指定したbaseVersionのserver履歴から読む。履歴なしは `base_unknown` rejection。remoteがbaseから変わり、localがbaseともremoteとも違うときだけ、base/local/remoteと両版・元operationをConflictへ保持し、現在titleを維持する。localがbaseのままならremoteを保つno-op、localとremoteが同じならno-op。時刻や端末IDで勝敗を選ばない。

解決には新operationIdと `{conflictId,choice:'local'|'remote'}` を送る。選択した記録の値とtitleが完全一致し、そのPageの未解決Conflictで、baseVersionが現在版であることを要求する。値/対象/解決済みの不一致は `resolution_invalid`、現在版が進んでいれば `resolution_stale`。rejectionは元Conflictを残す。成功時はresolved_byを新operationへ付け、候補を削除しない。remoteを選んでtitleが同じ場合も解決記録は残るがtitle版は増えない。

readは現在の版付きmetadataと未解決Conflictを返す。limit1–100、UUID keysetのafterConflict/nextAfterで最大101件のlookaheadを検査する。Page pathと認可が範囲を固定するので、keyset自体は権限tokenではない。複数query間のsnapshot/delta、削除通知、ACK、全端末の同期状態を表さない。各queryのmetadata/Conflictはdocument SHARE lock内で整合する。現在state/history/titleの不一致、壊れたreceipt/Conflict/lookaheadは503で拒否する。

## 明示upgrade

Dockerで、既存のDB/schema設定を使い `npm run init:private -w @greiva/api -- --page-metadata` を実行する。前提は明示的に作成済みのprivate schema3。fresh→structured→pagesの既存手順を省略しない。upgradeはversion排他lock下でcanonical Page metadataとresourceの対応を検査し、既存titleをversion0へ写す。部分table、再install、orphan/不正metadataを拒否し、DDLもrollbackする。owner/epoch/structured署名鍵と本文を再生成しない。

startupはschema1–4をread-only検査する。schema4だけで新routesをmountし、必要table不足はlisten前に失敗する。通常起動でupgrade/repairを行わず、既存利用環境のschemaをこの開発作業では変更していない。保持期限・GC・削除/復元・epoch resetは未定のまま追加しない。

固定HTTP errorは不正session401、owner/device/Page deny403、request400、異内容nonce409、DB/破損/結果不明503。本文・title・候補・メール・token・SQL causeを新しいログへ出さない。title/history/Conflict/request/receiptも[保存時暗号化](../plan/ACCOUNT_PRIVACY_ENCRYPTION_SPEC.md)の対象で、local PG試験は配備先DB/backup暗号化の証拠ではない。

次は端末の版付きtitle基底・pending intent・immutable wire/receipt・Conflictを原子的に保存し、古いbinary metadataや再送receiptでlocal renameを上書きしない契約を接続する。その後に画面のdraft/IME/selection保護と明示解決を検証する。実Auth正常系、Windows invoke/IME、Android、native credential/offline grantは別の残条件。
