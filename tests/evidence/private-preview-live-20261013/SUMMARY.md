# 実公開設定のWindows候補とnative起動確認

2026-10-13 / 記録checkpoint v0.75.1 / 実行物 v0.75.0。ソース機能は変更せず、実公開設定で新しい専用候補を生成した。

- Docker frontend/Windows app/config CLI build: Pass。専用identifier・workspace.html・native Origin・限定CSP、test hooks/SQLite bridge 0、非installer/未署名。
- app/CLI両方のSHAと主app PE 0.75.0、Windows CLIのcompiled configを照合。CLIにはPE version resourceがないため、最初の検査スクリプトの共通PE要求で停止した。app PE、両SHA、CLI compiled configを別々に確認して訂正。CLI icon resource warningはstderrへ保持する。
- source-check: host/Dockerのraw368/LFのみ10、意図的excluded5。最新v0.75.0のcodeを検査し、新しい全回帰は実行していない。v0.75.0の通常781/PG225/画面98の証拠を維持する。
- 実provider JWKS200/ES256一致、sessionなし401、不正署名401・workspace0。host loopback1443でnative Origin GET401/OPTIONS204、未知Origin403。正常実ログインの証拠ではない。
- Windows実画面で専用workspaceの未ログイン表示、ヘルプ12記事、pointerで開く/Escapeで閉じる動作を確認。初回はComputer Use app approval timeout、利用者が再試行を承認して起動成功。native-smoke.jsonと画面/要素treeを保持する。
- 利用者が今は認証操作できないため、正常login/workspace invoke/保存操作は未実施。実MS IME、credential custody/offline grant、Android、暗号化配備/backup/署名/最終GateのPassにはしない。

artifact.jsonのhostLaunched:falseはbuild時点のmetadata。後続host実行はnative-smoke.jsonを正本とする。候補exe/public key/DSN/token/passwordはgit/evidenceへ含めない。実行物はignored `.data/autonomous-20261013/windows-private-live75` に保存。

[Native sessionの採用方針](../../../docs/plan/NATIVE_SESSION_POLICY.md)、[起動手順](../../../docs/development/PRIVATE_API_NATIVE_STARTUP.md)。
