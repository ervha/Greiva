# structured同期進捗のsnapshot改善

2026-10-03、v0.6.11。通常ACK後の表示snapshotを100ms間隔へ抑制。ACKは毎回durable保存し、local変更・pull・Conflict/rejected・最終確認は即時refreshする。[判断と範囲](../../../docs/decisions/step-8-structured-progress.md)。

## 回帰

[原full run](full/summary.json)は12検査 **11 Pass／1 Fail**。失敗は追加integration fixtureのPushResult union型のnarrowing不足。実行時試験は成功したが型検査が失敗した。[最初の試験source](first-test-source.txt)を残し、fixtureの通常ACKを確認するguardのみ追加した。製品sourceは変更していない。原runの結果を書き換えず、[最終typecheck log](final/typecheck.log)と[修正後3試験](recheck/vitest.json)のPassを別記する。

- 通常unit/integration48 Pass、実PostgreSQL専用20 skip。別PostgreSQL runは20 Pass。
- Editor／保存／同期54 E2E、structured Conflict UI2、統合crash4境界、性能4ケースPass。
- build、実Rust store build、SQLite init、locked desktop check、通常feature検査Pass。
- 追加3試験は実Rust SQLiteを使用し、ACK保存が次のpushより先、途中進捗表示、final store一致、同期済みの早期表示なし、local編集即時反映、Conflict/rejectedの即時反映を検証。

最終135ファイルのhost／Docker byte一致、npm外部entry不変、Cargo registry entry不変は[照合](final/verification.json)。原full inventoryとは型guardを追加した試験source1件だけが異なる。アプリ所有manifest／lockを0.6.11へ揃えた。

## 1,000 Task操作の比較

同じDocker helper（2 CPU／4GiB）、実React engine、release Rust SQLite、実HTTP/PostgreSQLを使用。[before](before/profile.json)は旧per-ACK engine、[after](after/profile.json)は変更後。両方ともoperation／distinct／head=1,000、local／peer／server本文・structured state・cursor一致を検証。test-only RPC計測を使用し、製品にはloggerを追加していない。

| 指標 | before | after |
| --- | ---: | ---: |
| 表示snapshot回数 | 1,024 | 300 |
| snapshot応答bytes | 375,154,898 | 109,974,939 |
| snapshot累計ms | 17,316.93 | 5,267.15 |
| ACK回数 | 1,000 | 1,000 |
| prepare回数 | 1,001 | 1,001 |
| 同期時間ms | 71,780.69 | 44,935.82 |
| pull累計ms | 16,956.47 | 698.36 |

beforeのpull1回は約16.79秒。原因未確定で、host負荷も固定していない。snapshot回数／bytes削減は観測できたが、同期時間差すべてを変更の効果とはしない。beforeは追加integration試験作成前の134ソース、after/fullは135ソース。比較の対象は同じ1,000操作ケースで、追加試験はこの性能runでは実行しない。

## Windows候補

[Docker build](windows-build/build.json)は全workspaceを通常buildしてからfrontendを埋め込み、snapshot変更を含むこと、診断traceなし、frontend test flags=0、crash-test-hooksなしを確認した。最初のclientのみbuildした候補は依存package distが古かったため採用せず、全workspace build後の候補だけを保存した。既存0.6.5／0.6.9実行物は保持。

[host照合](windows-build/host-artifact.json): ProductVersion 0.6.11、18,558,976 bytes、SHA-256 `cc806e646f8093fe3ee387d0524c68dd4ec3c6808fa794be33e84d0fd74ecf36`。今回の0.6.11 native操作・性能はNot run。Docker Desktop停止後に既存helperを再開し、build.json／成果物を回収した。新しいhost toolchainやVMを導入していない。

通常0.6.9の手動再変換と旧0.6.5診断は[別のnative証拠](../windows-ime-reconfirm-20261003/SUMMARY.md)。Microsoft再変換の受入例外は利用者判断として記録し、性能修正によるIME改善とはしない。Step 8全条件・Gate最終判定は未完了。
