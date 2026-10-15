# Native Page一覧・明示取得 — v0.94.0

[実装契約](../../../docs/development/NATIVE_PAGE_CATALOG.md)。実account credentialや実利用本文を使わず、Dockerの合成fixtureで検証。Windowsは候補exeの非GUI検査まで。

- native固定API query、20件ずつ、8 MiB応答上限。元admissionへ固定し、workspace/epoch・metadata・文書名・昇順・cursor/hasMoreを検査する。cursorは画面へ渡さずnative memoryに保持。
- more失敗は同じcursorで明示再試行。先頭取得は旧progressを無効化し、失敗時も旧cursorの続行を拒否。並行query、close/logout/expiry/account切替への遅着を拒否する。一覧queryだけで本文のjournalを作らない。
- 画面は自動queryしない。表示済みmetadataと一覧エラーを保持し、本文の受信・保存・表示状態と分離。一覧からの選択はnative read→保存確認→journal/Yjs検査→Editorの順。read_unknown/store_pendingでlocal createへfallbackしない。取得失敗時もnative権限を再確認し、失効なら一覧を消去する。
- 実TLS provider→Rust native→署名検証済み実API→Postgresの専用5件がPass。21件のseedを20件ずつ取得し、wrong epochを拒否、失われたmore応答を同じcursor/bodyで明示再試行。全21件を重複なく取得し、local一覧は空のままであることを照合した。既存send/readの本文/vector照合も同じrunで再実施。
- 最終unit538（62 files）、通常Rust45（専用fixture5件は通常runではignoreし、上記で別実行）、型検査Pass。追加の権限確認前の広い通常回帰は848 Pass/229 skip（92 files Pass/37 skipped）。外部PG/専用環境等のskipを合格へ換算しない。最終権限確認の差分はunit538と最終画面runで検証した。
- desktop/mobile-dark-reduced-motionの画面38 Pass/Fail0。pointer/keyboard、合成composition中の操作抑止、取得/保存不明→明示再確認、本文表示、local一覧更新、待機中logoutと遅着の非表示を検証。PNGを視覚確認し、横overflowなし。既存選択/focus・Undo・送受信回帰を含む。

初回失敗を保持する。

1. `rust-first.log.gz` は44 Pass/1 Fail。fixtureが空の最終ページを不正と扱った。空でもhasMore=falseなら許容されるため、hasMore=trueなのに空の不正fixtureへ修正。実装の検証条件は緩和していない。
2. `ui-first.log.gz` は35 Pass/3 Fail。2件は一覧と本文の2つのalertを曖昧に指定した試験を修正。1件は入力末尾の保存確認が失敗した。
3. `ui-interfered.log.gz` も35 Pass/3 Fail。同じworkspaceでbuild/typecheckが共通package/distを書き直す間にVite E2Eを実行した干渉run。最初のtraceでは入力が始まった53258msの直後、53940/55244/57532msにVite接続が繰り返され、GET moduleの更新も記録された。画面snapshotには末尾の入力が存在し、fixture journalは途中までだった。[時系列](first-read-interference.json)を保持。build/typecheck完了後は同じ入力手順6/6、さらに全画面38/38を確認。buildと画面試験を直列化し、試験期待や保存条件は緩和していない。任意の開発HMR中断を製品の保存保証に含めた証拠ではない。

最終Windows候補はDockerでbuildし、hostの非GUI inspectorで版0.94.0・SHA・native-only設定/legacy command遮断/SQL plugin無効を照合。native/auth/Editor/build script/manifestsのhostとbuildソース一致（CRLF/LFだけの差を区別）、外部依存の版不変を確認。SDK PDB/chunk-size、非GUI inspectorの既知icon警告はraw logに保持。gzipは元byteと展開後SHAを照合した。

実Windows GUIからのcatalog/read IPC、実Microsoft IME、Android、変更feed/再接続、自動同期、offline leaseの画面接続・性能・最終Gateは未受入。remote一覧は固定multi-request snapshotや同期cursorではない。次は再接続の整合性→offline lease→Windows実機受入の順に進める。
