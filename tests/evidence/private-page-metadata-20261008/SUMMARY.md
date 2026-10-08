# Pageタイトルserver基盤の検証

2026-10-08 / v0.32.0。タイトルの版・三値Conflict・immutable operation結果を、明示private schema4と保護されたHTTP routesへ実装。[契約](../../../docs/development/PRIVATE_PAGE_METADATA.md)、[全16判断](../../../docs/decisions/private-page-metadata.md)。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 新規focused | 15 Pass | wire3 / PG10 / SIGKILL2。最終signed HTTP拡張は後の全PGへ含める |
| 通常 | 272 Pass / 82 Skip | 既存native/保存/同期回帰、新wire3。PGは専用runで実施 |
| 実PostgreSQL | 82 Pass / exit0 | metadata12＋既存70。explicit/partial/orphan/reinstall、本文/署名鍵/epoch保持、same-ID/reopen、三値/解決/rejection、query pagination、6並行rename、cross-Page nonce rollback、破損/失効/期限、COMMIT前後SIGKILL、schema4の実HTTP/JWT owner隔離とstartup |
| 型/servers/frontend | Pass | 最終test sourceの型、通常flags0 frontend/servers。画面変更なし |
| Rust/Windows | Pass | locked normal/crash examples、default featureにcrash hooksなし、Windows debug/custom-protocol build。host FileVersion/ProductVersion0.32.0とSHAを確認 |
| source/依存 | Pass | 242一致：raw230、LFだけ12、既存診断5を除外。外部npm315/両Cargo118・501 entry不変 |

初回focusedは12 Pass/1 Fail。追加HTTP互換試験のstructured pull payloadに既存必須workspaceIdが抜け、400を返した。payloadを正しい既存契約へ修正し、新SIGKILL2条件を含む15 Passを確認した。元のreport/logを保持する。実装の意味検査を緩めていない。

全回帰272/82の後、runtime試験へfixture JOSE署名・実HTTPのtitle read/renameと別subjectの403を追加した。固定portをOS割当へ変更し、最終型/frontend/全PG82を再確認した。前の全PG82も別reportとして保持する。正常Supabaseユーザーログインを実施した結果ではない。

title操作で本文journalのbytes/digest/headが不変なことをDBで照合し、binary bootstrap再送/readと後の本文appendが新titleを保持することを検証した。no-op時は版が進まず、remote選択のConflict解決記録は残る。SIGKILLではtitle/history/receipt/resolved_byのCOMMIT前rollback・COMMIT後保持・同ID一件を確認する。

Windows buildにSDK library PDB不足のLNK4099 warningがあるがexit0。exeはDocker出力とのSHA一致・host PE版確認だけで、起動やMicrosoft IME試験は実施していない。既存root/workspace/Auth E2Eは画面変更がないため今回は再実行していない。

Docker再現：`npm run typecheck`、`npm test`、DB設定済みの `npm run test:postgres`、`VITE_GREIVA_TEST_HOOKS=0 VITE_GREIVA_TEST_SQLITE=0 npm run build`、default native feature確認、locked Rust examples（normal/crash）、通常Windows debug/custom-protocol cross-build。新APIは明示schema3→4 installer後だけ利用でき、開発時に既存利用schemaへ自動適用していない。

[集約](verification.json)、[通常](normal.json.gz)、[最終PG](postgres.json.gz)、[PG拡張前](postgres-before-signed.json.gz)、[focused](focused.json.gz)、[初回失敗](initial-postgres.json.gz)、[初回log](focused.log)、[型](typecheck.log)、[server](server-build.log)、[frontend](frontend-build.log)、[Rust](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows log](windows-build.log)、[Docker exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfigを除外してgzip、logは行末空白のみ整理。相対リンク/secret・JWT pattern/diffを確認し、DB/credentials/依存/実行物をGitへ含めない。

画面rename/native title queue/replica/metadata delta、削除/復元/GC/保持契約、実Auth正常系、Windows invoke/IME、Android、native credential/offline grantと配備DB/backup暗号化は後続。今回追加の利用者手操作を要求していない。
