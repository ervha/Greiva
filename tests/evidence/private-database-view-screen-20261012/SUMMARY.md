# 基本DBのView作成・設定・競合解決画面 checkpoint

2026-10-12 / v0.72.0 / native16 / server11。[契約](../../../docs/development/PRIVATE_DATABASE_VIEW_SCREEN.md)。

## 実装

確認済みSourceからView設定のruntimeをlazy openし、新規の未保存設定と、端末で確認した既存Viewの版を分ける。名前/Table/List/表示列順/型付きAND/OR条件/単一sortを保存する。名前だけのpartial更新では既存の多段条件・複数sortと列順をそのまま保持する。Nameは表示を保ち、null/空文字/0/falseと選択肢ID/日付をvalidatorへ渡す。Page本文とRecordは複製しない。

unknown enqueueはcopy可能なreadonly入力/元intent、HTTP unknownは同wire、ACK unknownは元pairのnetworkless retryで確認する。known busyは新入力を保持し、known ACK後の一覧失敗と原結果も分ける。候補/履歴を1件ずつ置換して読み、base/local/remoteを比較して新operationで解決する。元設定の変更・原拒否を反映済みにしない。確認済みViewはheader windowの外からもnative cacheを通じて開ける。

## 検証

| 対象 | 結果 | 証拠 |
| --- | --- | --- |
| View設定helpers3/runtime30/browser-owner11 | 44 Pass（新6） | [report](focused.json.gz)、[log](focused.log) |
| actual signed HTTP/PG/Rust SQLite | 10 Pass（新1） | [report](view-write-pg.json.gz)、[log](view-write-pg.log) |
| 番号の明示後・View専用画面 desktop/360px dark reduced-motion | 12 Pass | [report](workspace-ui-focused.json.gz)、[log](workspace-ui-focused.log) |
| 通常全体回帰 | 775 Pass / 223 PG条件skip | [report](normal.json.gz)、[log](normal.log) |
| 実PG全35files | 223 Pass / 0 Fail | [report](postgres.json.gz)、[log](postgres.log) |
| 番号の明示前・全workspace画面 | 94 Pass / 0 flaky | [report](workspace-ui.json.gz)、[log](workspace-ui.log) |
| 型・native/crash/server・features・frontend hooks0 | Pass | [型](typecheck-final.log)、[native](native-build.log)、[crash](crash-build.log)、[server](servers-initial.log)、[features](native-features.log)、[frontend](frontend-build.log) |
| Docker Windows custom-protocol候補 | build Pass・host未起動 | [build](windows-build.log)、[metadata](windows-build.json)、[PE/SHA照合](host-exe-inspection.json) |
| Host/Docker source照合 | 369：raw359、LF10、意図的excluded5 | [inventory](source-inventory.json)、[集計](verification.json) |
| npm/Cargo外部依存 | 315 / 501 / 118 unchanged | [audit](version-audit.json) |

追加unitはtyped設定と元構造保持、queue5/global count/cursor、candidate1のnetworkless読取/unknown guard/busy/late close、lazy ownerの失敗時Page保持・自分のretry可能/他操作guard、header外の確認済みView openを検証する。actual追加条件は複合設定に対する名前だけの変更、2候補の個別window、新operation解決と再起動後の履歴/値を実保存層で確認し、端末読取がHTTPしないことを確認した。

新画面は明示端末保存/Enter、typed Number0/列移動/List/sort、confirmed open/本文不変、unknown元intent/wire/pair/pending0保持、三値/new-op/履歴、2候補windowとstale原拒否、known busy/変換継続/known ACK-list失敗/詳細失敗保持、120emoji名と複合filter/multisort保持を確認する。最終全画面では一覧範囲外Viewのoptionを重複しないことも確認する。

## 元の失敗と修正

追加unit importの拡張子とmock snapshotのwidened typeによる型Failを[typecheck-tests.log](typecheck-tests.log)に保持する。その修正後、TSX内helperをtestsからimportするとtests設定にjsxがないためFailした[typecheck-tests2.log](typecheck-tests2.log)を保持する。値/設定のpure helperを独立TS moduleへ抽出し、appとunitで同じvalidatorを使う。[修正後型](typecheck-tests3.log)、[画面追加後型](typecheck-ui.log)と全体型はPass。外部依存やtest設定を変更しない。

初回画面10 FailはRootへView panelを2箇所mountしていた実装不具合。既存Page layoutの前にある重複を削除し、専用12/全画面で再確認する。原[report](initial-workspace-ui.json.gz)・[log](workspace-ui-initial.log)を保持する。レビューでも既存の一覧範囲外optionとの重複を除き、最終画面でoption件数を確認する。失敗をfixture問題へ読み替えない。

目視確認では、列の移動・入力reset後に番号が2から始まる表示を確認した。列順/保存値は変わっておらず、liのvalueを明示して番号を1から指定する。原[desktop画像](view-settings-before-number-desktop.png)・[mobile画像](view-settings-before-number-mobile-dark-reduced-motion.png)・[専用12 report](workspace-ui-before-number.json.gz)を保持し、最終専用12で番号/元保存/競合を確認する。全94を番号明示後の再実行とはしない。frontend hooks0とWindows候補は最終sourceで再生成する。

[desktop設定](workspace-view-settings-desktop.png)・[mobile設定](workspace-view-settings-mobile-dark-reduced-motion.png)・[desktop候補](workspace-view-conflict-desktop.png)・[mobile候補](workspace-view-conflict-mobile-dark-reduced-motion.png)を保存し、desktop設定/mobile候補の表示を確認した。

## 境界と次工程

P3初期のDB/行/View作成・更新・候補解決を接続した。次は基本DBの使い方・未取得状態・再確認・競合のヘルプを接続し、既存P4の提供/復旧準備へ進む。削除/追加型/高度なDB機能を実装済みとしない。

UI fixtureのmock Auth/IPC/HTTP、actual署名HTTP/PG/Rust SQLite、Windows cross-buildは別の証拠である。実Supabase正常系・最新Windows invoke/実Microsoft IME・Android native、credential/offline grant、配備暗号化/backup/restore・配布/最終Gateは未確認。Git checkpointはinstaller公開ではない。