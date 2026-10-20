#!/usr/bin/env bash
set -euo pipefail
cd /workspace
mkdir -p /evidence
# A bind mount belongs to the host runner. Restore ownership even on test failure.
evidence_owner="$(stat -c '%u:%g' /evidence)"
restore_evidence_owner() {
  result=$?
  trap - EXIT
  chown -R "$evidence_owner" /evidence || exit 1
  exit "$result"
}
trap restore_evidence_owner EXIT
mkdir -p /evidence/logs
# The test typecheck imports API dist declarations. A clean checkout has none.
npm run build:packages 2>&1 | tee /evidence/logs/packages.log
npm run build:servers 2>&1 | tee /evidence/logs/servers.log
npm run typecheck 2>&1 | tee /evidence/logs/typecheck.log
node --test scripts/assert-ci-reports.test.mjs 2>&1 | tee /evidence/logs/report-validator.log
GREIVA_EVIDENCE_DIR=/evidence/unit npx vitest run tests/unit 2>&1 | tee /evidence/logs/unit.log
# Finish package builds/typechecking before Vite starts; avoid HMR interference.
GREIVA_EVIDENCE_DIR=/evidence/native-auth npx playwright test -c playwright.native-auth.config.ts 2>&1 | tee /evidence/logs/native-auth.log
node scripts/assert-ci-reports.mjs /evidence/unit/vitest.json /evidence/native-auth/playwright.json scripts/ci-test-baseline.json 2>&1 | tee /evidence/logs/report-validation.log
