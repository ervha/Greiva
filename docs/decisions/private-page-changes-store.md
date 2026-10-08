# Pageタイトル増分端末保存の全判断

2026-10-08 / v0.37.0。継続開発の委任に基づく自主判断。native権限grantや本番配備許可の追加ではない。

1. server増分の次にnative耐久保存/strict IPCを接続し、network/session/UIは次の区切りで検証する。
2. bound schema7→8を追加し、server5と本文/structured wire・通常rootを維持する。
3. metadata-only catalogを本文保存済みPageと分け、受信だけで本文を作成しない。
4. 本文受信またはbootstrap確認の同transactionでcache基底/候補を採用し、確認前の基底unknownと作成identityを保つ。local候補は100件batchで検査する。
5. event/catalog/候補・投影/cursor/receipt digestを原子的に保存する。
6. exact request/reply digestの再適用を許可し、古い基底の別内容やcursor巻戻しを拒否する。
7. cursor namespace/scope/order/canonical envelopeをnativeでも検査し、HMAC鍵やAuth grantをnativeへ渡さない。
8. filtered空頁は取得位置だけを進め、削除/同期済みと解釈しない。
9. exact bigint文字列とSQLite i64を使い、JS Numberへ丸めない。
10. loadを100件/keyset/101lookaheadに限定し、queue非消費とsource event照合を行う。
11. remote基底を反映してもpending localtitle/immutable wireを保持し、同版の別titleやcreatedAt変更を拒否する。
12. resolved_byのlocal operation FKだけを外し、remote UUID/immutable候補/既知解決の整合を検査する。
13. 受信nullで既知解決を消さず、pending local解決を保持する。queue確定前の新解決禁止は緩めない。
14. bound migration/partial DDL/legacy分離を検証し、破損を暗黙repairしない。
15. actual Rust/SQLiteとSIGKILL、旧回帰、型/buildを検証し、元fixture失敗と後のPassを分ける。実IME/native invoke/実Authに代用しない。
16. owned版/依存/source/証拠を確認してcommit/tag/pushし、短いメモを更新してAuth/session接続へ続ける。

[契約](../development/PRIVATE_PAGE_CHANGES_STORE.md)、[証拠](../../tests/evidence/private-page-changes-store-20261008/SUMMARY.md)、[判断索引](../plan/AUTONOMOUS_DECISIONS.md)。
