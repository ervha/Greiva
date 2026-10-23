# Native Task/Relation transport — v0.101.0

First M2-② unit, based on main `bebb780efddc8f71cc4616c895788fb9a571824c`. This connects authenticated native push/pull and the typed client port; it does not integrate the Task/Relation screen or claim M2-② completion.

- WebView supplies only the captured handle. Native prepares one immutable SQLite operation or a pull request from the stored cursor (`limit=1`). No token, caller-owned ACK, response or cursor is exposed/reintroduced.
- Native admission and generation fence HTTP delivery and local adoption. Close/logout/expiry/reauthentication/account changes prevent late writes.
- The same SQLite ACK/Pull logic validates replies in a rolled-back transaction before caching them. Unknown delivery retains the original durable wire/cursor. Known replies with an uncertain local commit are explicitly rechecked without another HTTP request. Cross-direction operations wait until that known reply is settled.
- Conflict and permanent rejection are distinct persisted outcomes. The existing local command whitelist continues to refuse ACK/Pull and all new internal validation/request commands, including offline mode.

## Docker results

| Check | Result | Evidence |
| --- | --- | --- |
| Typecheck | Pass | `type.log.gz` |
| Unit | 598 passed, 66 files, no skips | `unit.log.gz`, `unit-summary.json` |
| Existing native UI regression | 74 passed, no retries/skips/flaky | `ui.log.gz`, `ui-summary.json` |
| Exact report validation | unit 598 / UI 74 / skipped 0 | `report.log.gz` |
| Rust library | 70 passed; 7 HTTP tests separately gated | `rust-final.log.gz` |
| Actual TLS/native/API/PostgreSQL | 3 passed with `scripts/test-native-http-provider.mjs --structured` | `http.log.gz` |
| Windows cross-build | Pass, isolated fixture, not host-launched | `build.log.gz`, `artifact.json` |
| App version alignment | 0.101.0; external npm/Cargo dependency entries unchanged | `version-audit.json` |

The actual HTTP fixture sends two Tasks and one Relation. It rejects a wrong epoch, retries a lost push reply using identical wire, retains the same cursor after a lost pull reply, and adopts three one-operation pages with native continuation state. Conflict/rejection, before/after-commit receipt uncertainty, restart and cross-context late delivery are additionally covered by Rust unit fixtures. The remaining HTTP suites need their own flags and are not counted as passes here.

`rust-first.log.gz` preserves the initial compile failure caused by an inherited stray backslash in `NativeSession::new`. The uncommitted starting diff also removed existing auth/TLS regression tests. Those original tests were restored before the successful full run; no security regression test was removed from this checkpoint.

## Source binding and limits

`source-hashes.json` records SHA-256 of each changed source in canonical UTF-8/LF representation. The Docker inputs are checked for the same representation after testing; raw working-tree line endings may differ. After commit, export the listed paths using `git -c core.autocrlf=false archive HEAD` and check all hashes against the actual Git blobs. Build artifacts have separate binary hashes in `artifact.json`.

GUI interaction for Task/Relation, native conflict-resolution UX and real Windows/Microsoft IME acceptance remain for the next integration unit. Browser regressions and Windows cross-build are separate from actual native acceptance. This PR boundary does not publish a tag: latest-head Actions/review, merge, main synchronization and post-merge checks must precede the annotated v0.101.0 tag.
