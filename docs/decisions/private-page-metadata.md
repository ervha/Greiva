# Pageタイトルserver基盤の全判断

2026-10-08 / v0.32.0。利用者の継続開発・手操作なしで進める依頼に基づく。新しい製品回答・配備許可として扱わない。

1. P2のPage metadataを先行し、title renameのserver基盤を一つの区切りにする。削除/本文保持/復元やnative画面まで完成したとはしない。
2. Task/Relation streamとPage本文wireを維持し、title専用protocol subpath・scoped routesを追加する。新global cursor streamをこの区切りで創作しない。
3. explicit schema3→4でtitle state/history/operation/Conflictを追加する。既存canonical titleをversion0として保持する。
4. startupのread-only確認とschema1–3互換を継続する。自動migration/repairや既存利用環境のupgradeは行わない。
5. owner/device/Pageを既存transaction leaseで認可し、本文と同じdocument lockでtitle変更を直列化する。期限切れは途中でもrollbackする。
6. canonical title/updatedAtだけを変え、creation request・本文binary/head/digestを保持する。schema4の新規Pageではtitle0も原子作成する。
7. title版はsafe integer、title上限は既存作成契約の65536。本文headOrder、schema版、app版から分離し、実変更だけでtitle版を進める。
8. client申告baseTitleを信用せず、server履歴で三値比較する。未変更localや一致候補はno-op、異なる両候補は現在値を上書きせずConflictへ残す。
9. workspace内title operationIdと完全request/Page/clientを冪等キーにする。immutable過去返信を返し、現在値の証明として使わない。
10. cross-Page nonceの同時衝突はunique INSERTとtransaction rollbackで処理する。負けた書込み/候補を残さない。
11. 解決は新operationで、open Conflict・厳密な選択値・現在base版を要求する。stale/invalid rejectionと解決済み候補を保持する。
12. readを100件以内のUUID keyset queryに限定する。101件目も検査し、snapshot/delta/ACKや署名権限cursorと誤表示しない。
13. current state/history/title、receipt binding、Conflict/lookaheadを検査し、壊れた保存内容を空データへ置き換えない。
14. fixed HTTP errorsとlogger無効を継承する。title/履歴/候補/ledgerも保存時暗号化の対象とし、配備暗号化をlocal試験で合格へ変更しない。
15. 実PG・signed fixture JWT/実HTTP・6並行rename・nonce競合・期限/失効・COMMIT前後SIGKILLで検証する。最初のHTTP試験payload不足の失敗を保持し、実Auth正常系やnative IMEと区別する。
16. owned versionだけを揃えて通常/PG/型/Rust/frontend/Windows buildを確認し、証拠・commit・annotated tag・指定remote pushを完了してから次の端末保存工程へ進む。

[契約/再開順](../development/PRIVATE_PAGE_METADATA.md)、[証拠](../../tests/evidence/private-page-metadata-20261008/SUMMARY.md)、[全判断索引](../plan/AUTONOMOUS_DECISIONS.md)。保持期限/GC/削除、epoch reset、offline grant、native credentialを未回答のまま決定しない。
