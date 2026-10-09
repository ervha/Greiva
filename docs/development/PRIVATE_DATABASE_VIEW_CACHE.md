# DB Viewの端末保存

2026-10-09 / v0.54.0。[Record cache](PRIVATE_DATABASE_RECORD_CACHE.md)に続き、Table/ListのView read snapshotと既知候補を保存する。[判断16件](../decisions/private-database-view-cache.md)、[証拠](../../tests/evidence/private-database-view-cache-20261009/SUMMARY.md)。native10→11、server11保持。DB差分cursor、Source/Record/View作成・更新queue、HTTP runtimeと画面は後続。

## 保存と型

bound workspaceの初期化transactionでread receipt/history/current/候補の4表を追加する。native0/5/6/7/8/9/10から11へ移行し、bindingを先に検査する。Source/Record/Page/title/Task/Relation/pendingを保持する。foreign identity/partial DDL/未知schemaはrollbackし、旧通常PoC DBの帰属を変更しない。

受信には保存済みSourceが必要である。strict protocol/workspace/epoch/client/Source/schema/View ID・安全な版と全設定をportable/native双方で検査する。nameはcodepoint120/ECMAScript空白、layoutはtable/list、visiblePropertyIdsは1〜64/既知unique/Name必須、sortsは8以下/既知unique/ascまたはdesc。配列順を保持する。filterは既存Domainと同じgroup深さ3、children20、predicate100以下とし、6型のeq/not_eq/set/unset/text contains/number・date rangeを照合する。型をcoerceせず、filter textは65536 codepoint/Dateは有効暦/Selectは既知optionを要求する。

canonical hash付きimmutable read receiptとsnapshot history/current/既知三値候補を同transactionでcommitする。同版divergence/候補ID変更を拒否し、古いreplyは履歴だけを追加して最新版を戻さない。currentが最大保存版を指し、scope/history/receiptが一致することを読取でも確認する。View設定をPage/RecordやSourceへ複製しない。

## 候補と読取

候補のname/layout/visiblePropertyIds/filter/sortsはwhole-field値として型・三値の差異・版を検査する。readで観測できるresolvedBy:nullだけを保存する。visible/filter/sortsの順序を変更・正規化しない。binary layoutに三つの異なる値は成立しないためinvalid triadを拒否する。

base/remoteの履歴が既知なら設定値へ照合する。未観測旧版を生成しない。後着baseline/remote版が既知候補と矛盾すれば新receipt/historyを含む受信全体をrollbackする。影響候補は100件ずつ確認する。stale候補のremoteは観測時の版のまま保持し、新しい空readで候補を解決・削除しない。

database_view_loadは未受信Viewならnull、候補はdefault/max20＋1lookahead。database_view_listはUUID keyset default50/max100＋1lookahead、現在id/name/layout/versionだけを返す。lookaheadもreceipt/history/known baselineへ検査し、不整合を空fallbackや修復で隠さない。

Registry strict IPC/captured storeでscope・対象・件数・continuationを照合する。path/SQL/profile/tokenをcommandへ注入できない。Auth refresh/close後の旧instanceを拒否する。これはread観測cacheで、JWT/native Auth grant、operation ACK、全active候補/削除ACK/全DB同期を表さない。HTTP factory/sessionへの接続は次工程。

## 検証境界

実Rust/SQLiteの22条件で設定順・型/filter境界、whole-field候補4field、late baseline/stale候補、21候補/101headers、scope/raw IPC/provenance破損、schema10移行、並行再送/世代取消を確認する。COMMIT前後の実native SIGKILL2試行を含む。既存Record17/Source13/旧native49を合わせ101条件を再確認する。Docker証拠とWindows actual invoke/MS IME/Android/native Gate/配備暗号化を分離する。
