# 保存済みPage一覧の検証

2026-10-08 / v0.28.0。bound workspaceの端末Page metadataと未ACK更新数を、本文やprepared wireを返さず列挙する。schema6を保持。

- 通常251 Pass / 69 Skip。新unit2＋実Rust/SQLite3：pagination/restart、pending exact wire非消費、別主体/旧handle、invalid入力、corrupt metadata、応答binding/Auth遅着拒否。
- 型、locked Rust examples、通常frontend、Docker Windows debug/custom-protocol cross-buildがPass。通常native依存にcrash hooksなし。実Windows起動/IMEは未実施。
- source221：raw208一致/CRLF・LFのみ13一致。cacheにない診断/performance/Windows fixture5ファイルを一覧へ記録し対象外とした。外部npm323と両Cargo lockの118/501 entryは不変。
- 今回UIを変更せず、PG専用69や画面suiteは再実行していない。前版の結果を今回の追加検証へ数えない。通常suiteとbuildは最終実装で失敗なし。

Docker再現：`cargo build --locked --manifest-path apps/client/src-tauri/crates/page-store/Cargo.toml --examples --target-dir .data/native-target`、`npm run typecheck`、`npm test`、test hooks/SQLite flags=0の `npm run build`、`cargo xwin build --locked --manifest-path apps/client/src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --features custom-protocol --target-dir .data/windows-target`。

[集約](verification.json)、[通常](normal.json.gz)、[型](types.log)、[Rust](native.log)、[frontend](frontend.log)、[Windows](windows.log)、[exe hash](windows-build.json)、[feature](native-features.json)、[source](source-inventory.json)、[外部依存](version-audit.json)。reportはconfig除外/gzip、logは行末空白/末尾空行のみ整理し、secret/JWT patternを検査した。trace/DB/実行物はGitへ含めない。

[契約・自主判断6件](../../../docs/development/LOCAL_PAGE_CATALOG.md)。認証なしのoffline閲覧、実Auth/native grant、旧DB取り込みは未実装。通常画面compositionを次に進める。
