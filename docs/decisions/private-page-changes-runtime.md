# Pageタイトル増分接続の全判断

2026-10-08 / v0.38.0。継続開発の委任に基づく自主判断。native Auth grant・本番配備の許可追加ではない。

1. 原子native保存の確認済みcommit後にAuth transport/portable/native runtimeを接続する。
2. server5/native8・本文/structured wireと通常rootを維持し、画面変更は次の区切りへ分ける。
3. 固定API origin/専用POST、Bearer、omit/no-store/errorとtimeoutを既存connection経路へ接続する。
4. current UI storeをawait後に再解決せず、immutable context/元callback/Auth leaseを捕捉する。
5. request/replyをclone/strict/freezeし、scope/after/client/件数/進捗を保存前に照合する。
6. native saved cursor/orderを毎cycle読み、exact bigintの取得基底をportableへ渡す。
7. unknown native commitはexact pairを保持し、新pullを禁止する。
8. 再確認はnetworkなしで同pairをnative receiptへ再適用する。
9. transport/protocol失敗とpost-commit read失敗を区別し、未入庫pairや新responseを混ぜない。
10. Auth更新/close/同workspace session置換で古いruntimeを閉じ、snapshotとprivate pairを消す。
11. admitted旧store commitが取消後に終わり得ることを認め、rollback/成功/新store反映を主張しない。
12. local open/catalogはnetwork-free、明示cycleは一回/最大100件で自動pollを追加しない。
13. received/観測head末尾/remote続頁/local続頁とerror/retryを分け、syncedと呼ばない。
14. actual native/署名HTTP/PG二端末でpending・cache・競合/同値解決・restart/応答喪失・filtered/失効を検証する。
15. 署名fixture/Dockerを実Auth・Windows invoke/IME・配備暗号化の証拠へ広げない。
16. owned版/外部依存/source/証拠を確認しcommit/tag/pushして、最小メモを更新後も画面接続へ続ける。

[契約](../development/PRIVATE_PAGE_CHANGES_RUNTIME.md)、[証拠](../../tests/evidence/private-page-changes-runtime-20261008/SUMMARY.md)、[判断索引](../plan/AUTONOMOUS_DECISIONS.md)。
