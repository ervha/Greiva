# 個人workspace structured同期の全判断

2026-10-05、v0.20.0。追加手操作を求めずP1のserver同期を先行する自主判断。

1. 旧PoCのschema/store/routerを転用せず、private metadata version1を明示的にversion2へ拡張する。owner/device/Page metadataを保持し、既存Task/Relation metadataがあれば未帰属entityを創作せず拒否する。
2. cursor署名鍵は明示upgrade時のCSPRNG32bytesをDBへtransaction保存する。startup/reinstallで再生成しない。keyをHTTP/log/evidenceへ返さず、workspace epochを保持する。
3. schema版行をpermission/bootstrap transactionの最初にFOR SHAREでlockする。upgradeは版行FOR UPDATEとmetadata排他で既存処理の終了を待ち、新処理を待機させる。明示maintenance/restart手順で実行する。
4. trusted query portの制約をworkspace/device/schema認可へ明確化する。resource作成/tombstoneは新scoped repository内の所属/lock検査でのみ実装し、任意callbackから認可変更を許す設計にしない。
5. push batchを同一認可transactionで原子化する。後続operationのforeign/reuse/DB不備でも先行分を部分commitせず、元のprepared wireを再送できるようにする。
6. workspace別のtransactional bigint counterをFOR UPDATEで直列化する。PG sequenceを先取りせず、commit順序をcursorが飛び越えないようにする。上限到達時は新操作をcommitしない。
7. strict version/workspace/client envelopeを検査後、unknown payloadを含むJSONをpool待機前に分離する。待機中にcallerがpayload/client/entityを変更しても保存内容を変えない。
8. operation IDをschema内で一意にする。同じparsed JSON再送は元のimmutable result、違う内容は409/whole batch rollback、別workspaceのIDは403で内容非公開。JSON field順/空白の違いだけを別intentとしない。
9. invalid payload/base/predecessor/entity collision/not found/resolution/endpoint等の業務拒否を元operationとともに耐久保存する。transport/COMMIT結果不明を永久拒否へ作り替えず、自動再実行しない。
10. Task/Relationの異field merge、同field base/local/remote、causal local-afterをprivate historyへ実装する。旧PoC engineは変更しない。同じ意味の回帰を新storeで確認し、将来共通化のために未認可storeをmountしない。
11. Conflict解決は新operationにし、同workspace/entity/open/選択値を照合する。upsertもworkspace/type/entityを限定し、別scopeのrecordを上書きしない。過去ledger resultは解決後も変更しない。
12. deleteはtombstone/historyを保持し、同workspaceの遅着updateをtombstoneへACKする。open Conflictをdelete operationで解決する。破棄/自動復活/未決定保持期間を追加しない。
13. Relationはtyped/live/same workspaceの両endpointを確認する。片方missingでも他方foreignを見逃さず、削除済みRelationの遅着causal frameにもforeign endpointを入れない。missing/deletedな自workspace端点はtombstoneの無視を継続する。
14. pullはheadをFOR SHAREで固定し、workspace/structured/epoch/HMACを確認、orderをdecimal string/bigintで扱う。contiguous ledger/gap/head整合を検査する。epoch reset/compaction/key rotationを勝手に導入しない。
15. schema2確認済みruntimeだけに新push/pull POSTをmountする。署名検証が先行し、body workspaceとpathを照合、safe401/403/400/409/503を返す。旧aliases/通常PoC/公開CORS/CRDTへ広げない。
16. CLI --structuredを明示upgrade入口とする。reinstall/partial schema/orphan metadataをrollbackし、unknown版試験は999へ変更する。read-only readinessはschema2の表/鍵を検査し、missing keyを自動修復しない。
17. fixture Supabase/JWT＋実HTTPと2つのRust/SQLite storeでACK喪失、driver SIGKILL/再起動、同wire再送、pagination/収束、refresh/失効pending保持を確認する。実ユーザーAuth/native Windows IME/Android proofとは区別する。
18. 実workerのDB COMMIT直前/直後をtest driver portだけで待機させ、SIGKILLする。再起動後に同operationを一度だけ保存、order1/history1/key/epoch保持を確認する。製品へ新crash hooksを組み込まない。
19. 新2 unit＋実PG13、通常177/PG54/型/frontend/Windows buildを確認し、所有版/両Rust lockを0.20.0、source104/外部依存不変を照合する。初回TS2532は行数確認後のdriver row参照を明示して解消、compiler設定は緩めない。UI変更がないためv0.18画面回帰は既存証拠を保持する。
20. 専用local API/previewのみstop→明示schema upgrade→v0.20 restartする。変更前後の全metadata（今回は0行）を照合し、DB鍵保持、双方のsync経路401/auth.html200/実container版を確認する。通常Greiva/旧Page/SQLiteは触らず、実Auth/IPC/CRDT/公開運用/telemetryを未完成として記録する。

[手順](../development/PRIVATE_STRUCTURED_SYNC.md)、[証拠](../../tests/evidence/private-stream-20261005/SUMMARY.md)。[全判断索引](../plan/AUTONOMOUS_DECISIONS.md)と[必要事項](../plan/PENDING_PRODUCTION_CONFIGURATION.md)へ反映。次はPage metadata/本文同期の保護された契約へ進む。
