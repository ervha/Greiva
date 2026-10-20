#!/usr/bin/env bash
set -euo pipefail
cd /workspace
mkdir -p /evidence/logs
# The test typecheck imports API dist declarations. A clean checkout has none.
npm run build:packages 2>&1 | tee /evidence/logs/packages.log
npm run build:servers 2>&1 | tee /evidence/logs/servers.log
npm run typecheck 2>&1 | tee /evidence/logs/typecheck.log
GREIVA_EVIDENCE_DIR=/evidence/unit npx vitest run tests/unit 2>&1 | tee /evidence/logs/unit.log
# Finish package builds/typechecking before Vite starts; avoid HMR interference.
GREIVA_EVIDENCE_DIR=/evidence/native-auth npx playwright test -c playwright.native-auth.config.ts 2>&1 | tee /evidence/logs/native-auth.log
