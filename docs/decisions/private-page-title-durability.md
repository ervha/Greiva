# Pageタイトル端末保存の全判断

2026-10-08 / v0.33.0。継続開発と手操作なしで進める依頼に基づく自主判断。新しい製品回答や配備許可として扱わない。

1. P2 title server契約の次に端末durability/strict IPCを一つの区切りにする。専用transport/runtime/画面の完成と混同しない。
2. native workspace schema6→7をbinding検証後のtransactionで追加し、fresh0/既存5経路も保つ。本文/structuredを再生成しない。
3. base/operations/receipts/conflictsを独立保存し、versionless旧titleは既知version0に変換しない。
4. enqueueは版付きbaseとbootstrapの確定を要求する。unknown時に勝手なbaseを送らない。
5. intentのoperationId・title・resolutionと観測baseを保存し、同ID同内容を冪等にする。異内容/別Pageを拒否する。
6. canonical baseとlocal projectionを分離し、最新pendingの値を維持する。title pendingはbinary pendingと区別する。
7. pending中の子intentは先行intentの観測基底を引き継ぐ。background queryで未確認remoteへ自動rebaseしない。
8. 最古pendingだけprepareし、保存wireをimmutableにする。再起動/query/retryでIDやbaseを作り直さない。
9. 未preparedの子だけ、自分の先行applied receiptかつ要求title一致で基底を進める。Conflict/rejection/異値no-opでは進めない。
10. ACKのwire/sequence/operation/Page/epoch/候補を検証し、receipt/base/projection/conflict/resolutionを原子的に保存する。
11. 古いACKを現在値の証明とせず、新版や後続pendingを戻さない。異内容duplicateとpendingの飛ばしを拒否する。
12. readはclient/keyset/limit/scopeを検証し、同版異title/creation identityを拒否する。時刻は表示だけで候補の勝敗に使わない。
13. omitted Conflictを消したり解決済みと推定したりしない。resolvedBy=nullの限界を記録する。
14. 解決はsettled queue・保存候補・厳密な選択値と新operationで行う。stale/invalidも保存し、成功時だけ解決記録を付ける。
15. local loadは独立したsequence/UUID keyset、最大100件とlookaheadを検証する。i64 sequenceを正規文字列で扱う。
16. missing retained base/保存wire/receipt/候補破損は空データへ修復せず拒否する。strict IPCとAuth/handle世代境界を継承する。
17. versionless本文metadataでmanaged titleを置き換えない。本文binary/headは保存し、本文/structuredの不変性も検証する。
18. creation retryは現在mutable titleを返せるため、初期title一致の旧条件を外す。digest/scope/creation identity条件を維持し、実HTTPの改名後再送を検証する。
19. COMMIT前後8 SIGKILL条件、actual Rust registry、2端末SQLiteとsigned fixture HTTP/PGで検証する。fixture loginを実Auth正常系、DockerをWindows invoke/IMEに代用しない。
20. owned版とlocksだけを揃え、全回帰/型/build/依存source照合と証拠を保存し、commit・annotated tag・指定remote pushまで完了する。保持/GC/native grant/暗号化配備は未決定のまま追加しない。

[契約と再開順](../development/PRIVATE_PAGE_TITLE_DURABILITY.md)、[証拠](../../tests/evidence/private-title-store-20261008/SUMMARY.md)、[全判断索引](../plan/AUTONOMOUS_DECISIONS.md)。
