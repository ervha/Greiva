# 個人workspaceの読取認可 — 自律判断全件

2026-10-05、v0.8.0。[初期範囲9判断](production-foundation-plan.md)、[command基盤13判断](production-command-foundation.md)に続くP1の部分実装。[証拠](../../tests/evidence/private-access-20261005/SUMMARY.md)。

1. 最初のpolicyは所有者だけ。共有role/inviteを作らず、session adapterで検証済みのsubjectを受ける。API body/clientId/doc名の自己申告をidentityにしない。
2. workspaceとtyped resource IDを両方照合する。両workspaceの所有者でも、別workspaceのresourceを現在scopeで読み込めない。
3. workspace rootはlist/pull/export用、resourcesは空配列拒否として区別する。後続handlerは必ず結果のworkspace/検証済targetsへqueryを束縛する。
4. CRDT文書は正規のpage:UUID v7だけを受ける。suffix/path/encoding/別typeのaliasを暗黙変換しない。接続handlerへの配線は後続。
5. 不明/削除済み/型違い/duplicate/余分なmetadataは拒否。sync tombstoneはowner認可済workspace rootで読む設計とし、削除Pageを開く権利と分ける。
6. 非同期read前にtargetsをclone/freezeし、結果も不変context/targetsで返す。呼出側は元のmutable requestを再利用して別対象をloadしない。
7. PostgreSQL adapterはworkspaceと対象metadataを一つのSQL snapshotで読む。typed IDでforeign workspaceのresourceも返し、policyで拒否する。parameter bindingとapplication-owned schema名検査を行う。
8. adapterはread-onlyでDDL/migrationを実行しない。workspace_access/resource_accessは将来の正本由来view契約。fixture tableを本番の別正本やキャッシュに転用しない。view不在/不正/不通でPoCへfallbackしない。
9. 認可結果を永続leaseにしない。次のrequestで再照合し、writeはcommit transaction内で権限/対象を再確認、長時間CRDT接続の失効は別受入。
10. 10 contract条件と実PG1を検証する。実PGはfresh owned schemaだけを清掃、既存DBを変更しない。JWT/refresh/provider/RLS/production view実装の合格とはしない。
11. 未接続のpolicy/SQL読取adapterをMINOR0.8.0として所有版整合、通常Windows buildを確認。外部npm/Cargo依存不変。画面/IMEを変えないため0.7.0の画面59件を再実行したと呼ばない。
12. Supabase検証projectの有無/公開設定をまとめて質問し、利用者の未作成・local実装/自動試験先行の回答を受けた。秘密鍵/tokenをchat/gitへ求めず、workspace wire/cursor等の独立実装を続ける。

実Auth接続、正本view/migration、writeのtransaction内認可、HTTP/CRDT全経路、offline/logout/失効時保持は未完了。旧PoCの未認可経路を公開serviceへdeployしない。Computer Use解除、利用者操作不要、旧DB/試験Page保持。
