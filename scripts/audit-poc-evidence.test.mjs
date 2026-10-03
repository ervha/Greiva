import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { audit, baseline, playwrightCases, vitestCases, compareSource } from './audit-poc-evidence.mjs';

const pw = () => ({ errors: [], stats: { expected: 1, skipped: 0, unexpected: 0, flaky: 0 },
  suites: [{ title: 'suite', specs: [{ title: 'test', ok: true, tests: [{ projectName: 'chromium',
    expectedStatus: 'passed', status: 'expected', results: [{ status: 'passed', retry: 0, errors: [] }] }] }] }] });
const item = r => r.suites[0].specs[0].tests[0];

test('Playwright: reject failures even if aggregate stats claim success', () => {
  const report = pw(); item(report).results[0].status = 'failed';
  assert.throws(() => playwrightCases(report, 1));
});
test('Playwright: reject skipped and expected-failure cases', () => {
  for (const status of ['skipped', 'failed']) {
    const report = pw(); item(report).expectedStatus = status;
    assert.throws(() => playwrightCases(report, 1));
  }
});
test('Playwright: reject retries, missing cases and runner errors', () => {
  const retry = pw(); item(retry).results.push({ status: 'passed', retry: 1, errors: [] });
  assert.throws(() => playwrightCases(retry, 1));
  const missing = pw(); missing.suites = [];
  assert.throws(() => playwrightCases(missing, 1));
  const error = pw(); error.errors.push({ message: 'runner crashed' });
  assert.throws(() => playwrightCases(error, 1));
});
test('Playwright: traverse nested suites and reject duplicates', () => {
  const report = pw(); const suite = report.suites[0];
  report.suites = [{ title: 'outer', suites: [suite] }];
  assert.equal(playwrightCases(report, 1)[0].name, 'outer > suite > test');
  suite.specs.push(structuredClone(suite.specs[0])); report.stats.expected = 2;
  assert.throws(() => playwrightCases(report, 2), /Duplicate/);
});
const vitest = () => ({ success: true, numTotalTests: 2, numPassedTests: 1,
  numFailedTests: 0, numPendingTests: 1, testResults: [{ assertionResults: [
    { fullName: 'executed', status: 'passed' }, { fullName: 'database', status: 'skipped' },
  ] }] });
test('Vitest: preserve skips and reject false aggregate success', () => {
  assert.equal(vitestCases(vitest(), 1, 1)[1].status, 'skipped');
  const failed = vitest(); failed.testResults[0].assertionResults[0].status = 'failed';
  assert.throws(() => vitestCases(failed, 1, 1));
  const missing = vitest(); missing.testResults[0].assertionResults.pop();
  assert.throws(() => vitestCases(missing, 1, 1));
});
test('Vitest: reject duplicate case identities', () => {
  const report = vitest(); report.testResults[0].assertionResults[1].fullName = 'executed';
  assert.throws(() => vitestCases(report, 1, 1), /Duplicate/);
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
test('Source: distinguish byte identity, newline-only changes and content changes', () => {
  const lf = Buffer.from('日本語\nline\n');
  assert.equal(compareSource(lf, hash(lf), 'app.ts'), 'byte-identical');
  assert.equal(compareSource(Buffer.from('日本語\r\nline\r\n'), hash(lf), 'app.ts'), 'CRLF-to-LF-only');
  assert.equal(compareSource(Buffer.from('日本語\r\nchanged\r\n'), hash(lf), 'app.ts'), 'changed');
});
test('Source: never normalize binary or strip BOM', () => {
  const lf = Buffer.from('content\n');
  assert.equal(compareSource(Buffer.from('content\r\n'), hash(lf), 'icon.png'), 'changed');
  assert.equal(compareSource(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), lf]), hash(lf), 'app.ts'), 'changed');
});

// These checks use copies of the actual pinned reports, not fabricated successful
// fixtures. They run only when the baseline is explicitly supplied in Docker.
if (process.env.GREIVA_AUDIT_FIXTURE) {
  test('Full audit: reject stale source, unexecuted DB cases, cache failures and wrong artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'greiva-audit-negative-'));
    try {
      cpSync(process.env.GREIVA_AUDIT_FIXTURE, root, { recursive: true });
      const output = audit(root);
      assert.equal(output.readyForFinalGate, false);
      assert.equal(output.candidate.nativeUi, 'Not run');
      assert.equal(output.originalRun.failed[0].status, 'Fail');
      for (const path of [`${baseline}/full/summary.json`, 'apps/client/src/main.tsx']) {
        const target = join(root, path); const original = readFileSync(target);
        const cli = spawnSync(process.execPath, [fileURLToPath(new URL('./audit-poc-evidence.mjs', import.meta.url)),
          '--root', root, '--output', target], { encoding: 'utf8' });
        assert.equal(cli.status, 1); assert.match(cli.stderr, /never overwrite/);
        assert.deepEqual(readFileSync(target), original);
      }
      function mutate(path, update, expected) {
        const file = join(root, path); const original = readFileSync(file);
        try { writeFileSync(file, update(original)); assert.throws(() => audit(root), expected); }
        finally { writeFileSync(file, original); }
      }
      mutate('apps/client/src/main.tsx', bytes => Buffer.concat([bytes, Buffer.from('\n// changed\n')]), /Baseline source/);
      const extra = join(root, 'apps/client/src/extra.ts'); writeFileSync(extra, 'export const injected = true;');
      assert.throws(() => audit(root), /Additional application/); rmSync(extra);
      mutate(`${baseline}/full/postgres/vitest.json`, bytes => {
        const report = JSON.parse(bytes); report.testResults[0].assertionResults[0].fullName += ' renamed';
        return JSON.stringify(report);
      }, /Skipped cases/);
      mutate(`${baseline}/feature-cache-recheck.log`, bytes => {
        const report = JSON.parse(bytes); report.crashBarrierEnabled = true; return JSON.stringify(report);
      });
      mutate(`${baseline}/feature-cache-recheck.json`, bytes => {
        const report = JSON.parse(bytes); report.status = 'Fail'; return JSON.stringify(report);
      });
      mutate(`${baseline}/full/summary.json`, bytes => {
        const report = JSON.parse(bytes); report.results[0].exitCode = 1; return JSON.stringify(report);
      });
      const artifact = join(root, 'wrong.exe'); writeFileSync(artifact, 'wrong build');
      assert.throws(() => audit(root, artifact), /Candidate artifact mismatch/);
      // Missing evidence must fail, even if its summary still says Pass.
      rmSync(join(root, `${baseline}/full/STEP8-E2E.log`));
      assert.throws(() => audit(root), /ENOENT/);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
}
