# Account/workspace切替の同期session境界

2026-10-05、v0.13.0。portable WorkspaceSyncSessionを追加。旧PoC engine/DB/画面は変更しない。

追加9条件を含む通常120件Pass/実PG用26件skip、専用PG26件Pass、型/通常frontend/API/Windows buildがPass。byte列保持、生成時のaccount/port捕捉、close/同account復帰、遅着ACK/pull、scope/epoch/protocol、不正cursor進行/重複/順序、同時要求、固定error、開始済み旧store commitを検査する。9条件はdeferred transport/store doubleで、実workspace HTTP/SQLiteの永続化ではない。PG26は既存server境界の回帰検査で、新しいclient永続化の証拠ではない。

[集約](verification.json)、[通常report](vitest.json.gz)、[実PG](postgres-vitest.json.gz)、[source86](source-inventory.json)、[通常Windows build](windows-build.json)、[外部依存監査](version-audit.json)。外部npm315/Cargo不変、selected reportにcompact JWT/private keyなし。生成exeはignoredローカル領域のみ。

未完成：production durable prepared/receipt/cursor adapter、active UIの切替/報告、実Auth/失効、workspace structured HTTP/CRDT、native store/実機。開始済み旧store commitのrollbackは保証しない。[全12判断](../../../docs/decisions/workspace-sync-session.md)。
