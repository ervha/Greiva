# Pageタイトル端末保存基盤の検証

2026-10-08 / v0.33.0。native schema7、観測title基底/intent、immutable wire/receipt/Conflictと投影をstrict IPCへ実装。[契約](../../../docs/development/PRIVATE_PAGE_TITLE_DURABILITY.md)、[全20判断](../../../docs/decisions/private-page-title-durability.md)。title専用HTTP transport/runtime/画面は未実装で、HTTP試験は実装済みportとfixture requestを組み合わせたもの。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 初回focused | 67 Pass | native保存/本文/Page session/workspace/TypeScript port |
| 最終focused | 68 Pass | title15（8 SIGKILLを含む）/registry9/local wire4/native port14/本文13/Page session13 |
| 新HTTP/PG | 1 Pass | signed fixture HTTP＋2 actual Rust registry/SQLite。lost ACK/kill/reopen、offline chain、三値/新解決、古い本文metadata、Auth refresh/失効時pending保持 |
| 通常全回帰 | 293 Pass / 83 Skip | 保存/同期/strict wire/世代回帰。PGは別runで実施 |
| 実PostgreSQL全回帰 | 83 Pass / exit0 | 新title端末試験1＋既存82。既存server metadata/本文/structured/署名/失効/transaction crashを含む |
| 型/Rust/frontend | Pass | 最終sourceの全型、locked normal/crash examples、servers、通常flags0 frontend、defaultにcrash hooksなし |
| Windows cross-build | Pass | Dockerのdebug/custom-protocol。FileVersion/ProductVersion0.33.0とDocker/host SHAを照合。host未起動 |
| 外部依存 | 不変 | npm315 / page-store Cargo118 / app Cargo501。owned versionだけ更新 |
| host/Docker source | 246一致 | raw235、CRLF/LFだけ11、既存診断5を除外。binary/BOMは改変正規化しない |

初回67 Passの後、pending中のbackground queryで最新canonical baseが進んだ場合、新しい子intentがそのremoteへ自動rebaseする余地をコードレビューで見つけた。先行pendingの観測baseを引き継ぐよう修正し、Conflictと異値no-opの両試験を拡張した。新しいregistry/wire/HTTP試験と最終全回帰を確認した。初回と最終focusedは対象集合が異なるため件数の差を単純な追加数として扱わない。今回の検証runに失敗はない。

enqueue/prepare/ack/receiveのCOMMIT前後8 SIGKILLで、intent/投影、wire、receipt/base、remote base/候補の原子性を確認する。再起動後の同操作再試行は一件で、quick_checkがok、本文journalが保持される。壊れたbase/wire/lookaheadとforeign epoch/ACKは拒否し、失敗transactionではpendingを消費しない。schema6と既存5からの移行・部分schema rollback・foreign bindingの無書込みも検証する。

HTTP試験はfixture JOSE署名/認可と実PG/SQLiteを使う。正常な実Supabaseユーザーログインの証拠ではない。改名後の元Page creation再送をPageSyncSessionから通し、古いversionless本文metadataでtitleが戻らないこと、本文bytes/digest/headとTask/Relationが不変なことを照合した。refresh後の古いportはclosedで、新portがpending wireを保持し、device失効403後もpendingを残す。

Windowsビルドのcompiler-family検出とSDK libraryのPDB不足はwarningとしてlogを保持する。終了コードは0で、実行物の版/SHAを照合する。host Tauri invoke・Microsoft IMEを実行した結果ではない。画面の変更がないためroot/workspace/Auth E2Eは今回再実行していない。

Docker再現：locked normal/crash examples、`npm run typecheck`、`npm test`、DB設定済み`npm run test:postgres`、`VITE_GREIVA_TEST_HOOKS=0 VITE_GREIVA_TEST_SQLITE=0 npm run build`、default native feature確認、通常Windows debug/custom-protocol cross-build。新title端末HTTP試験をPG runnerに登録した。既存利用server schemaのupgrade/配備は行っていない。

[集約](verification.json)、[通常](normal.json.gz)、[PG](postgres.json.gz)、[初回focused](focused.json.gz)、[最終focused](focused-final.json.gz)、[HTTP単独](title-http.json.gz)、[最終focused log](focused-final.log)、[HTTP log](title-http.log)、[型](typecheck-final.log)、[servers](servers-final.log)、[frontend](frontend-build.log)、[Rust](native-build-final.log)、[crash](crash-build-final.log)、[features](native-features.log)、[Windows log](windows-build.log)、[Docker exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportsはconfigを除外してgzip、logsは行末空白だけ整理。DB/credentials/依存/cache/実行物はGitへ含めない。

次はtitle専用HTTP transport/runtime、その後にdraft/IME/focus保護と明示解決画面。metadata delta、削除/復元/GC/保持契約、実Auth正常系、Windows invoke/IME、Android、native credential/offline grantと配備DB/backup暗号化は残条件。追加の利用者手操作を要求していない。
