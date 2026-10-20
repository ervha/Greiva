# Native title persistence and explicit metadata sync — v0.99.0

Docker verification on 2026-10-20. Source belongs to PR #4 (`codex/native-title-metadata`). `source-hashes.json` identifies the changed source files; `artifact.json` identifies the Windows candidate. This is a development checkpoint, not final PoC or native IME acceptance.

Historical source revision: `b889718`. The manifest was corrected during review from this revision's Git blobs (UTF-8/LF), because the original working-copy hashes included CRLF/mixed line endings. The old Docker input was not archived byte-for-byte. The [follow-up evidence](../native-title-review2-20261020/SUMMARY.md) reruns the relevant checks with changed sources normalized to LF before Docker copy/build; this historical evidence is not used to accept the newer head.

## Scope

- Native-owned title prepare → fixed metadata rename endpoint → validated receipt → transactional ACK. Metadata reads use a native-generated request and transactional receive. Caller-owned wire/ACK/response/context are not admitted through the online or offline local command whitelist.
- Original admission/generation fences late responses after close, logout, expiry and reauthentication. Unknown delivery retains the exact prepared operation. Known receipts with uncertain local commit are retried from native memory without another HTTP request, including a response lost after commit.
- Local titles count as saving. Missing bootstrap/versioned bases produce an explicit memory-only draft until an explicit metadata read. Genuine storage errors stay failures; intentionally empty titles survive recovery. Composition can finish after an authentication lock and its final value remains scoped to that Page/context.
- Body and title have separate explicit controls and results. Conflict candidates are retained and displayed; native conflict resolution controls and complete history pagination remain deferred. No background network retry was added.

## Results

| Check | Result | Evidence |
| --- | --- | --- |
| Typecheck | Pass | `type-final.log.gz` |
| Unit | 589 passed, 66 files, no skips | `unit-final.log.gz`, `unit-summary.json` |
| Report validator | 12 passed | `validator.log.gz` |
| Desktop/mobile UI | 68 passed, no retries/skips/flaky | `ui-final.log.gz`, `ui-summary.json` |
| Exact CI report totals | unit 589 / UI 68 / skipped 0 | `report.log.gz` |
| Rust library | 65 passed; 6 separately gated HTTP tests ignored in this command | `rust-final.log.gz` |
| Actual TLS/native/API/PostgreSQL | 3 passed using `scripts/test-native-http-provider.mjs --pages`; title wrong-epoch refusal, original-wire lost-response retry, durable receipt and projection included | `http-final.log.gz` |
| Windows cross-build | Pass, isolated fixture, no host launch | `build-composition.log.gz`, `artifact.json` |

`--pages` runs the auth, workspace and Page/title HTTP fixtures. The read/catalog/offline HTTP fixtures require their own flags and were not newly accepted by this command. All accounts and TLS keys in the fixture are synthetic and temporary; no real account or deployment key was used.

## Earlier runs retained separately

- `rust2.log.gz`: the added late-response test initially tried to move the fixture clock backwards after expiry, so its subsequent login correctly failed. The harness now advances the provider expiry instead; the repaired run is `rust-final.log.gz`. The original failure remains recorded.
- `ui-expiry-fail.log.gz`: 66 passed and 2 failed. The expiry regression advanced the browser clock by 301 seconds but kept issuing login responses with the fixture process's unadvanced expiry, so re-login correctly refused an already expired response. The fixture now advances the synthetic issuer's expiry as well. `ui-expiry-recheck.log.gz` records the repaired two-case regression; `ui-final.log.gz` records the subsequent full run.
- `unit-all.log.gz`: earlier broad unit/integration run, 899 passed and 229 configuration-gated skips. This was before the final title-port/composition regression additions; it is supplemental evidence and is not an all-tests pass. Current required unit totals are recorded separately above.

## Remaining acceptance

The candidate has not been launched on the Windows host, and actual Microsoft IME keys, Windows offline restart, signing-configured offline acceptance, Android and the final PoC Gate remain separate. The existing IME reconversion exception is unchanged. Memory-only drafts do not survive process termination. PR-head Actions, blocking review resolution, merge and post-merge main verification must finish before an annotated v0.99.0 tag is published.
