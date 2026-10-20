# Native title review corrections — v0.99.0

Follow-up to PR #4 head `b889718`, responding to the six findings in review 5582807451. This checkpoint remains on `codex/native-title-metadata` until latest-head CI/review and post-merge verification finish.

- Provisional IME title candidates update the display but create no journal entries. Composition commit creates one intent; cancelling back to the original value creates none. Authentication-lock recovery still retains the final input.
- Drafts explicitly record `titleChanged`. Merging a later body-only failure preserves an older unsaved title, including the empty string. A newer actual title edit supersedes it.
- Page initialization loads local title pending/conflict state before activation, including offline reopen. It does not perform a network read.
- Each title-read attempt clears its previous result before invoking native code, so a failed attempt cannot inherit an earlier `received` status.
- Metadata reads accept up to 64 MiB: 50 conflicts × three titles × 65,536 UTF-16 units × six JSON bytes per unit, plus metadata/IDs. Other transport bounds remain unchanged. The actual HTTP fixture receives and durably stores 50 schema-valid conflicts with a body exceeding the previous 8 MiB bound.

## Verification

| Check | Result | Evidence |
| --- | --- | --- |
| Typecheck | Pass | `type.log.gz` |
| Unit | 592 passed, 66 files, no skips | `unit.log.gz`, `unit-summary.json` |
| Desktop/mobile UI | 72 passed, no retries/skips/flaky | `ui.log.gz`, `ui-summary.json` |
| Exact CI report totals | 592 unit / 72 UI / skipped 0 | `report.log.gz` |
| Rust library | 65 passed, 6 separately gated HTTP tests ignored | `rust.log.gz` |
| Actual TLS/native/API/PostgreSQL | 3 passed with `--pages`, including the large title response | `http.log.gz` |
| Windows cross-build | Pass, isolated fixture, not host-launched | `build.log.gz`, `artifact.json` |

The initial target run (`target-initial.log.gz`) had 67 passes and one failure because its expected reconnect command sequence omitted the new local `title_load`. The expectation now includes that read; the complete repaired unit run is separate above. Original failures in the preceding evidence directory are retained.

## Source binding

`source-hashes.json` covers the changed text sources relative to base `7a12afa`, including app-owned version/lock files. These files were converted to LF **before** copying into Docker and running the checks above. Hashes are SHA-256 of those exact UTF-8/LF bytes. No source changes are made after generation; after committing, export the manifest paths with `git -c core.autocrlf=false archive HEAD` and compare every file hash to the manifest. This checks the actual Git blobs, rather than a CRLF working copy.

The preceding directory's manifest was repaired from `git -c core.autocrlf=false archive b889718` and remains bound to that historical checkpoint. It is not relabeled as evidence for this revision. Its old Docker inputs included CRLF text; this follow-up reruns the relevant checks with LF-normalized changed sources and records a new Windows artifact.

Windows GUI/actual Microsoft IME, signing-configured offline restart, Android and final PoC Gate acceptance remain unverified by these Docker/fixture results. Native conflict resolution controls and complete title history pagination remain deferred.
