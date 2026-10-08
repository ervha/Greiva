# Pageタイトル送信・同期の全判断

2026-10-08 / v0.34.0。継続開発・手操作なしの依頼に基づく自主判断。製品回答や本番配備許可の追加ではない。

1. 保存基盤の次に専用portable session/Auth transport/native runtimeを接続し、title画面を別の確認済み区切りへ残す。
2. server schema4/native schema7と本文/structured wireを維持し、新migrationやdelta streamを追加しない。
3. contextと入力をstrictに複製・凍結し、transport/store関数を捕捉する。await後にcurrent画面へ保存先を切り替えない。
4. prepared wireをそのまま送る。Page/client/operation、response scope/epoch/三値/request意味を検査し、native側の基底/順序検証も保持する。
5. portable返却はACK/receive commit後にする。HTTP成功だけでpendingを消費せず、close後の遅着返信を保存しない。
6. 専用metadata routesを固定origin/captured Auth leaseで呼び、既存timeoutとprivate fetch optionsを継承する。tokenを新保存/ログへ出さない。
7. 401/403はconnection全体を閉じる。通信/503ではpendingを残し、固定errorだけ公開する。
8. 同Pageのtitle置換と本文/別Pageの所有を分け、refresh/logoutは全旧世代を取消す。新bootstrap後に同wireを再送する。
9. runtime openをlocal読取だけにする。暗黙create/query/自動retry/タイマーやoffline grantを追加しない。
10. unknown baseのmutateをadmission前に拒否し、明示queryで基底を得られるよう結果不明retryで塞がない。bootstrap確定は本文側の責務を保つ。
11. local enqueue/読取の結果不明では同じintentを捕捉し、次のmutation/syncを止めて同ID再試行する。
12. 一cycleの送信を開始時pendingかつ最大100件、queryを一頁100件へ限定する。残件を次cycleへ明示する。
13. query cursorはcommit＋local read成功後だけ進める。mutation/reopen/最終頁後のcycleは先頭へ戻し、queryをsnapshotと称しない。
14. stateにsyncedを作らず、queryComplete/remote続頁/local省略/pendingを区別する。欠落candidateやresolvedBy nullから外部解決状態を推定しない。
15. observer例外を隔離し、admission前closeを検査する。開始済みnative保存は元Pageで完了し得るが、closed stateへprivate dataを戻さない。
16. portable/unitとactual native runtime、signed fixture HTTP/PGを検証し、失効後のraw保存検査を権限grantと区別する。実Auth正常系やWindows invoke/IMEは代用しない。
17. owned版/locksを揃え、全回帰/型/Rust/frontend/Windows build、source/外部依存・証拠を確認し、commit/annotated tag/指定remote pushまで完了する。

[契約と次工程](../development/PRIVATE_PAGE_TITLE_RUNTIME.md)、[証拠](../../tests/evidence/private-title-runtime-20261008/SUMMARY.md)、[判断索引](../plan/AUTONOMOUS_DECISIONS.md)。
