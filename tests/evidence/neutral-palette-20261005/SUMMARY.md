# 配色変更の検証

2026-10-05 / v0.25.1。白・ニュートラルグレー・控えめな緑の共通themeへ整理し、背景グラデーションを除去。接続確認画面のdark表示をチャコールへ変更した。

- 通常224件Pass / PostgreSQL専用69件Skip。型検査、frontend、通常Windows cross-buildがPass。今回はCSS変更のため、専用PostgreSQL試験は再実行していない。
- Docker Chromiumの通常画面61件、接続確認画面8件がPass。最終は両suiteを順番に1 worker / 自動retry0で実行した。実drag、候補menu、keyboard、remote選択保持、Undo/Redo、合成composition、Task/Relationの既存操作を確認した。
- 初回の通常画面は6 Pass / 4 Fail / 2 interrupted / 49未実行。auth画面は6 Pass / 2 Fail。共用workspaceで両suiteとpackage再buildが並行していた。本文表示・focus・navigation timeoutの初回失敗を保持し、通常画面を中断して単独再確認した。製品/試験コードは変更せず、原因を負荷や配色と断定しない。
- source117のSHA-256がホスト、Docker試験workspace、Windows build workspaceで一致。引継ぎ前の型/通常/frontend/build結果を再利用した。外部npm315件と両Cargo lockの依存は不変、所有manifest/lockは0.25.1に一致する。
- 専用previewは新imageの0.25.1。独立API serviceは0.25.0のまま保持。DB/schemaを変更せず、実利用者のcredentialを入力していない。
- T3 previewでdesktopのslash menu、360pxの編集画面、authのdesktop lightと360px darkを確認。狭い画面で横overflowなし。専用試験Page `01a10530-0000-7000-8000-000000000251` のみ操作し、既存Pageを編集していない。

Docker内の最終コマンド：

```sh
npm exec -- playwright test --workers=1
npm exec -- playwright test -c playwright.private-login.config.ts --workers=1
```

既存結果はDocker内 `npm run typecheck` / `npm test` / `npm run build` と、通常frontendのtest flagsを0にした `cargo xwin build --release --offline --locked --manifest-path apps/client/src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --features custom-protocol --target-dir .data/windows-target`。Windows実行物には診断・crash hooksを含まない。

[集約](verification.json)、[通常試験](vitest.json.gz)、[通常画面](root-ui.json.gz)、[接続確認](auth-ui.json.gz)、[初回通常画面](initial-root-ui.json.gz)、[初回接続確認](initial-auth-ui.json.gz)、[Windows build](windows-build.json)、[版/外部依存](version-audit.json)、[source](source-inventory.json)、[判断](../../../docs/decisions/neutral-palette.md)。画面reportは環境変数を含むconfigを除いてgzip保存し、結果を保持した。選択JSONのJWT/private key/公開キーpattern検査はPass。

[編集desktop/menu](editor-desktop-menu.png)、[編集mobile](editor-mobile-light.png)、[auth desktop](auth-desktop-light.png)、[auth mobile/dark](auth-mobile-dark.png)。

Windows実Microsoft IME・実Tauri操作・実Supabase login/refreshの新しい証拠ではない。編集画面のdark機能追加、Page通常編集接続・metadata変更・native Auth/offline保持契約は対象外。

利用者の「切りのいいところで止めて」に従い、この検証済み配色checkpointで停止する。次回はPage編集接続から再開できる。追加の手操作・回答待ちはない。
