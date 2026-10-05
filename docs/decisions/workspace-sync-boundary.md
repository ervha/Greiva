# Workspace wire/cursor境界 — 自律判断全件

2026-10-05、v0.9.0。[初期範囲9件](production-foundation-plan.md)/[基盤13件](production-command-foundation.md)/[認可12件](private-workspace-access.md)に続くP1部分実装。[証拠](../../tests/evidence/workspace-sync-boundary-20261005/SUMMARY.md)。

1. Supabase未作成・local実装/自動試験先行という利用者回答に従い、外部deploy/課金/鍵設定をせずwire/cursorを先行する。
2. 本番候補wireをprotocol/workspaceの別exportへ定義し、旧PoC wire/routes/DBへ混ぜない。protocolVersion1、workspace/client scope、responseのstreamEpochを必須にする。未知versionを推測しない。
3. 初期batch100/pull500の既存上限を境界の安全上限として継続する。production throughput/SLOとはしない。新batch内のclient混在/同ID重複を拒否し、request間の同ID再送は引き続き安定ID/内容を使う。
4. invalid domain intentはoperation envelopeとして残し、serverでpermanent rejectionを返せる契約を保持する。wire parseで勝手に内容を正規化/破棄しない。
5. ACKはworkspace/epochに加えoperationId/client/entity type/ID、件数と重複を照合する。関係ないACKでpendingを消さない。response順はIDで対応し、元wireを変更しない。
6. pullのworkspace/epoch不一致を拒否する。旧cursorを新workspaceへ流用しない。epoch変更時にpendingを消す/空storeへ置換するbootstrapは作らない。
7. 新server cursorはgw1 formatでworkspace、structured stream、epoch、decimal orderをHMAC-SHA256へ束縛する。PoCのHMAC方式を基準にNode cryptoを使用。token所持はuser認証/認可ではない。
8. PostgreSQL bigint最大値までstring/BigIntで検査し、JS Numberへ変換しない。future order、悪署名、別workspace/epoch/stream、非canonical base64url、過大/不正tokenを拒否する。
9. keyは明示した32bytes以上のserver-owned値をcaptureする。live利用にはCSPRNGによる鍵とepochの耐久保存が必要。起動ごとの新鍵/default secret、保持期限の仮定を導入しない。
10. 新16条件を含む通常90/実DB専用21skip、型/通常Windows buildを確認。実DB専用21は0.8.0の実行で、新cursor/wireはまだproduction SQL/routerへ未接続。
11. 所有版MINOR0.9.0整合、外部npm314/Cargo依存不変。画面/IME/旧DBを変えないため、過去59画面/実Nativeを今回の再実行と呼ばない。
12. 次はローカル署名JWTの検証adapterを進める。暗号/JWTの独自実装へ広げず、一次資料とDocker内の固定libraryを調査する。実providerのlogin/refresh/失効とは証拠を分ける。

wire/cursorは型と検証境界のみ。新server table/view、client prepared queue/ACK/cursor transaction、account切替、migration/bootstrap、全HTTP/CRDTへの配線は未完了。旧DB/試験Pageを保持、Computer Use解除、利用者手操作不要。
