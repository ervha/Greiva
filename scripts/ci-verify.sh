#!/usr/bin/env bash
set -euo pipefail
cd /workspace
mkdir -p /evidence/logs
npm run typecheck 2>&1 | tee /evidence/logs/typecheck.log
GREIVA_EVIDENCE_DIR=/evidence/unit npx vitest run tests/unit 2>&1 | tee /evidence/logs/unit.log
# Finish package builds/typechecking before Vite starts; avoid HMR interference.
GREIVA_EVIDENCE_DIR=/evidence/native-auth npx playwright test -c playwright.native-auth.config.ts 2>&1 | tee /evidence/logs/native-auth.log
