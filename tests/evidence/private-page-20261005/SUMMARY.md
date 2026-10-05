# 個人workspace Page本文保存の検証

2026-10-05 / v0.21.0。追加3 unit＋実PG11、通常180 Pass/65 PG Skip、専用PG65 Pass/0 Skip、型/frontend/通常Windows cross-build Pass。source108をbuild前後で照合し、外部npm315/両Cargo依存不変。

- 明示schema2→3 upgrade、structured key/epoch/metadata保持、orphan/partial/reinstall拒否、起動時repairなし。
- 初期title/安定Page ID、変更したbootstrap409/foreign403、同binary再送の元orderと最新head/vector。
- 正確なV1 update/canonical vector、末尾garbage/壊れたbytes拒否。未知XML/attrs、未到着依存、delete setをgc:falseで復元。
- 六つの独立peer＋重複frameの並行保存でjournal7/全文/vector収束。600k合成diffを入力上限で取得不能にしない。
- 欠落/破損/orphanは503で空Docへresetしない。失効/削除でread/write拒否、実document lock待機後の期限切れrollback。
- 実worker SIGKILLをCOMMIT直前/直後に行い、再送後journal/head2に一度だけ保存、binary/vector復元。
- signed fixture JWT＋実HTTP/CLI、schema2のPage404、schema3の401/200/400/403/409、restart復元、structured経路保持、missing tableで起動拒否。
- 専用Docker API/previewをv0.21/schema3へ更新。metadata0行は不変、cursor key保持、API/proxy Page401/auth.html200を確認。

[verification.json](verification.json)、[通常report](vitest.json.gz)、[実PG report](postgres-vitest.json.gz)、[版監査](version-audit.json)、[source](source-inventory.json)、[Windows build](windows-build.json)、[Compose](compose-check.json)、[全22判断](../../../docs/decisions/private-page-binary.md)。

初回期限切れ試験のFailはcaptured Date.nowへ後付けspyが届かない試験側原因。構築前のmutable clockでlock待機とrollbackを再確認した。Windows npm初回EACCESとnon-root chown失敗はroot-ownedコピーの所有権を修正し、通常non-root buildを完了。失敗記録はverificationとignored raw reportへ保持する。

HTTP保存基盤で、Hocuspocus/継続room認可、端末Page queue、通常UI/IPC、metadata rename/delete/Conflict、snapshot/compaction/retention、実Supabase正常login/新native IME/Androidの完成証拠ではない。UI不変なのでv0.18回帰を保持。旧PoC/DB/実機データは変更せず、telemetry未実装/未収集。
