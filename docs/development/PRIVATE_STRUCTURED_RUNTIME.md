# 個人workspaceのTask・Relation runtime

v0.30.0。`PrivateStructuredSession` を認証済みconnectionとcaptured native storeへ固定し、既存Applicationのmutation port、workspace専用HTTP、atomic SQLite ACK/pullへ接続する。旧PoCのunscoped engine/routeへfallbackしない。v0.30.0時点では再利用基盤。v0.31.0で[workspace画面](PRIVATE_STRUCTURED_SCREEN.md)へmountした。

## 保存と再試行

操作のID/client/payloadをawait前に捕捉・型検査する。nativeは現在のlocal baseと端末所属を検査し、entityとoperationを一緒にcommitする。保存応答またはcommit後のsnapshot読取が失敗すると、同じID/contentを保持する。新しい変更と同期を止め、明示 `retryMutation()` で同じ操作を再確認する。結果不明を別nonceの自動保存へ変えない。閉じた世代で完了した書込みは元storeだけに残り、新しい主体へ移さない。

strict snapshotはcontext/clientを照合し、Task/Relation、operation、三値Conflict、cursor、rejectionを深くimmutableにする。エラーは固定categoryだけを公開する。email/token、DB path、本文をログやerror causeへ持ち出さない。

## 明示同期と状態

各cycleは開始時pending件数以内の正確なprepared wireを順番に送り、取得時cursorから最大100件のpullを一回行う。hasMoreがある場合は次の明示cycleへ進む。timer、自動retry、無制限追従は追加しない。ACK喪失時のwireは保存済みのものを再使用する。

restore直後は同期済みとしない。成功cycleで観測したheadまで進み、pending/open Conflict/rejected/error/結果不明がなく、同じrevisionなら同期確認を表示できる。この確認はそのcycleで観測したheadに対するもので、未来のremote変更がないことを保証しない。拒否されたoperationと元情報は保持し、黙ってqueueから消したりLWWしたりしない。Conflictはbase/local/remoteとresolvedByを保存し、解決は別operationとして記録する。

Auth refresh/期限/close、403、同じconnectionのstream置換で即座にdata表示と新規操作を閉じる。read-only AbortSignalはsessionのcloseを通知するために公開し、storeを開き直す権限にはしない。未完了処理のcleanupを待ってからstoreを閉じる。offline grant、logout後閲覧、native JWT custodyをこのruntimeから新たに許可しない。

## 判断と証拠

自主判断13件：1) 旧unscoped経路を使用しない、2) captured owner/store/port、3) await前typed intent捕捉、4) atomic Application/native commit、5) 結果不明の同ID再確認、6) strict/deep immutable snapshot、7) 開始時pendingと100件pullの上限、8) restoreと同期確認を区別、9) Conflict/rejectionの保全、10) 認証/stream置換時の即時非表示、11) safe category/credential非保存、12) Docker DB証拠とnative実機条件の分離、13) Rust試験bridgeの途中JSONをpending拒否として処理。

実Rust SQLiteでCRUD、kill/reopen exact wire、保存応答喪失、読取失敗、refresh中の遅着、101件pagination、同世代stream置換を検証する。signed fixture HTTP＋実PG＋二つのRust SQLiteでは同fieldの三値、別operationの解決、Relation、ACK喪失/restart、rejection、device失効後pendingを確認する。provider正常Auth、Windows invoke/IME、Android、画面mount、本番CSP/credential/grant/暗号化配備は未完成。

[証拠](../../tests/evidence/private-structured-runtime-20261008/SUMMARY.md)、[専用画面](PRIVATE_WORKSPACE_SCREEN.md)、[外部条件](../plan/PENDING_PRODUCTION_CONFIGURATION.md)。
