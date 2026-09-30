# Step 1 verification

2026-09-30T08:11:52.396Z / linux x64 / Git: unborn repository

Source SHA-256: 10a3af0175dbced08b1c5288e6386a538b066db2318ef05c108f08553e6df301

| Test | Result | Evidence |
| --- | --- | --- |
| STEP1-BUILD | Pass | [log](STEP1-BUILD.log) |
| STEP1-TYPES | Pass | [log](STEP1-TYPES.log) |
| STEP1-UNIT-INTEGRATION | Pass | [log](STEP1-UNIT-INTEGRATION.log) |
| STEP1-E2E | Pass | [log](STEP1-E2E.log) |
| STEP1-SQLITE-INIT | Pass | [log](STEP1-SQLITE-INIT.log) |
| STEP1-POSTGRES-CONFIG | Pass | [log](STEP1-POSTGRES-CONFIG.log) |
| STEP1-POSTGRES-START | Fail | [log](STEP1-POSTGRES-START.log) |
| STEP1-POSTGRES | Not run | Database startup failed |
| STEP1-DESKTOP-CHECK | Fail | [log](STEP1-DESKTOP-CHECK.log) |

Scope: Section 18 Step 1 only. No IME, editing, sync, crash recovery or Gate verdict.

See [summary.json](summary.json) for environment, commands, timestamps, versions and result details.
