// Read-only audit of the pinned v0.6.9 Docker evidence. This does not run app tests
// or decide a Gate. Native results remain in the acceptance matrix.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const baseline = 'tests/evidence/step-8-focus-20261003';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

function additionalSource(root, inventory) {
  const ignored = new Set(['node_modules', 'dist', 'dist-performance', 'target', 'gen']);
  const found = [];
  function visit(path) {
    for (const entry of readdirSync(resolve(root, path), { withFileTypes: true })) {
      const file = `${path}/${entry.name}`;
      if (ignored.has(entry.name) || file === 'tests/evidence' || entry.name.endsWith('.tsbuildinfo')) continue;
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && !inventory.includes(file)) found.push(file);
    }
  }
  for (const directory of ['apps', 'packages', 'infrastructure', 'tests', 'scripts']) visit(directory);
  return found.sort();
}

export function playwrightCases(report, expected) {
  const cases = [];
  function visit(suites, parents = []) {
    for (const suite of suites) {
      const names = [...parents, suite.title];
      for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
        assert.equal(spec.ok, true, spec.title);
        assert.equal(test.expectedStatus, 'passed', spec.title);
        assert.equal(test.status, 'expected', spec.title);
        assert.equal(test.results.length, 1, `Retry or missing result: ${spec.title}`);
        assert.equal(test.results[0].status, 'passed', spec.title);
        assert.equal(test.results[0].retry, 0, spec.title);
        assert.equal(test.results[0].errors.length, 0, spec.title);
        cases.push({ name: [...names, spec.title].join(' > '), project: test.projectName });
      }
      visit(suite.suites ?? [], names);
    }
  }
  assert.deepEqual(report.errors, [], 'Runner errors');
  visit(report.suites);
  assert.equal(cases.length, expected, 'Missing or extra test cases');
  assert.equal(new Set(cases.map(c => `${c.project}:${c.name}`)).size, expected, 'Duplicate test cases');
  assert.deepEqual([report.stats.expected, report.stats.skipped, report.stats.unexpected, report.stats.flaky],
    [expected, 0, 0, 0], 'Summary differs from actual cases');
  return cases;
}

export function vitestCases(report, passed, skipped) {
  const cases = report.testResults.flatMap(suite => suite.assertionResults.map(test => ({
    name: test.fullName, status: test.status,
  })));
  assert.equal(report.success, true);
  assert.equal(cases.length, passed + skipped);
  assert.equal(new Set(cases.map(c => c.name)).size, cases.length, 'Duplicate test cases');
  assert.equal(cases.filter(c => c.status === 'passed').length, passed);
  assert.equal(cases.filter(c => c.status === 'skipped').length, skipped);
  assert.equal(cases.filter(c => !['passed', 'skipped'].includes(c.status)).length, 0);
  assert.deepEqual([report.numTotalTests, report.numPassedTests, report.numFailedTests, report.numPendingTests],
    [passed + skipped, passed, 0, skipped]);
  return cases;
}

export function compareSource(bytes, expectedHash, path) {
  if (digest(bytes) === expectedHash) return 'byte-identical';
  // Normalize only valid UTF-8 source text. Never normalize images or executables.
  if (/\.(?:ts|tsx|js|mjs|json|toml|lock|yaml|sql|rs|ps1|md|svg|html|css)$/.test(path) ||
      /(?:^|\/)(?:Dockerfile|VERSION|\.dockerignore|\.env.example|\.gitignore|\.node-version|\.npmrc|\.nvmrc)$/.test(path)) {
    try {
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      if (digest(Buffer.from(text.replace(/\r\n/g, '\n'))) === expectedHash) return 'CRLF-to-LF-only';
    } catch { /* Invalid UTF-8 cannot establish text equivalence. */ }
  }
  return 'changed';
}

export function audit(root, artifact) {
  const inputs = [];
  const read = path => {
    const bytes = readFileSync(resolve(root, path));
    inputs.push({ path, sha256: digest(bytes), bytes: bytes.length });
    return bytes;
  };
  const json = path => JSON.parse(read(path).toString('utf8'));
  const report = json(`${baseline}/full/summary.json`);
  const source = json(`${baseline}/source-verification.json`);
  assert.equal(source.version, '0.6.9');
  assert.equal(source.hostSourceSha256, report.sourceSha256);
  assert.equal(source.dockerSourceSha256, report.sourceSha256);
  const inventory = json(`${baseline}/full/source-files.json`);
  assert.deepEqual(source.files.map(f => f.path), inventory);
  assert.equal(inventory.length, 132);
  assert.equal(new Set(inventory).size, inventory.length);
  const additions = additionalSource(root, inventory);
  assert.deepEqual(additions.filter(path => !['scripts/audit-poc-evidence.mjs', 'scripts/audit-poc-evidence.test.mjs'].includes(path)),
    [], 'Additional application/test source needs new verification');
  const files = source.files.map(file => {
    const bytes = readFileSync(resolve(root, file.path));
    return { path: file.path, expectedSha256: file.sha256, currentSha256: digest(bytes),
      comparison: compareSource(bytes, file.sha256, file.path) };
  });
  // VERSION changes at documentation/tooling checkpoints; record rather than hide it.
  const unacceptable = files.filter(f => f.comparison === 'changed' && f.path !== 'VERSION');
  assert.deepEqual(unacceptable, [], 'Baseline source content changed; use a new app verification run');

  assert.equal(report.results.length, 12);
  assert.equal(new Set(report.results.map(r => r.id)).size, 12);
  const failure = report.results.filter(r => r.status !== 'Pass');
  assert.deepEqual(failure.map(r => [r.id, r.status, r.exitCode]), [['STEP8-DEFAULT-FEATURES', 'Fail', 101]]);
  for (const result of report.results) {
    assert.equal(result.exitCode, result.status === 'Pass' ? 0 : 101, result.id);
    read(`${baseline}/full/${result.log}`);
  }
  const recheck = json(`${baseline}/feature-cache-recheck.json`);
  assert.equal(recheck.status, 'Pass');
  assert.equal(recheck.exitCode, 0);
  assert.deepEqual(recheck.command, ['node', 'scripts/verify-native-features.mjs']);
  assert.equal(recheck.environment.CARGO_NET_OFFLINE, 'true');
  assert.ok(Date.parse(recheck.startedAt) > Date.parse(report.finishedAt));
  const features = json(`${baseline}/feature-cache-recheck.log`);
  assert.deepEqual([features.rootVersion, features.storeVersion, features.storeFeatures, features.crashBarrierEnabled],
    ['0.6.9', '0.6.9', ['default'], false]);

  const suites = [
    ['focused/playwright.json', 'Selection/reconnect focused', 9],
    ['full/playwright.json', 'Editor/persistence/collaboration', 54],
    ['full/structured-e2e/playwright.json', 'Conflict UI', 2],
    ['full/combined-crash/playwright.json', 'Combined crash boundaries', 4],
    ['full/performance/playwright.json', 'Performance correctness workloads', 4],
  ].map(([path, name, count]) => ({ name, scope: 'Docker Chromium + Rust bridge; not native IPC/IME',
    path: `${baseline}/${path}`, cases: playwrightCases(json(`${baseline}/${path}`), count) }));
  const unit = vitestCases(json(`${baseline}/full/vitest.json`), 45, 20);
  const postgres = vitestCases(json(`${baseline}/full/postgres/vitest.json`), 20, 0);
  assert.deepEqual(unit.filter(c => c.status === 'skipped').map(c => c.name).sort(),
    postgres.map(c => c.name).sort(), 'Skipped cases must all be executed in the real PostgreSQL run');
  const metrics = json(`${baseline}/performance-metrics.json`);
  const build = json(`${baseline}/windows-build/build.json`);
  const host = json(`${baseline}/windows-build/host-artifact.json`);
  assert.equal(build.sourceSha256, report.sourceSha256);
  assert.deepEqual([build.version, host.version, host.launched, host.nativeUi, host.microsoftIme],
    ['0.6.9', '0.6.9', false, 'Not run', 'Not run']);
  assert.deepEqual([build.artifact.sha256, build.artifact.bytes], [host.sha256, host.bytes]);
  assert.ok(build.results.length > 0 && build.results.every(r => r.exitCode === 0));
  let candidate = { status: 'Not available in this checkout; historical build/hash record only', ...host };
  if (artifact) {
    const bytes = readFileSync(artifact);
    assert.deepEqual([digest(bytes), bytes.length], [host.sha256, host.bytes], 'Candidate artifact mismatch');
    candidate = { ...candidate, status: 'Hash verified; not launched', path: host.path, sha256: digest(bytes) };
  }
  return {
    auditedAt: new Date().toISOString(), auditExecution: process.platform,
    checkpoint: readFileSync(resolve(root, 'VERSION'), 'utf8').trim(),
    baselineVersion: '0.6.9', baselineRunId: report.id, originalRun: { passed: 11, failed: failure },
    featureRecheck: recheck, evidenceIntegrity: 'Pass',
    meaning: 'Saved evidence consistency only. No app test rerun, native Pass, or Gate verdict.',
    source: { inventoryScope: '132 baseline files; new audit tooling listed separately', additions,
      byteIdentical: files.filter(f => f.comparison === 'byte-identical').length,
      newlineOnly: files.filter(f => f.comparison === 'CRLF-to-LF-only').length,
      changed: files.filter(f => f.comparison === 'changed'), files },
    suites, unit: { passed: 45, skipped: 20, cases: unit }, postgres: { passed: 20, cases: postgres },
    performanceObservations: metrics, candidate, inputs,
    remaining: ['Microsoft IME reconversion loss unresolved', 'v0.6.9 Windows regression not run',
      'Native integrated crash and large-data performance incomplete',
      'Pixel 7 / Android 17 QPR1: user-reported target; actual OS test not run',
      'macOS/iOS actual OS tests not run', 'Gate A/B/C final adjudication not completed'],
    readyForFinalGate: false,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const option = name => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
    const root = resolve(option('--root') ?? '.');
    const output = resolve(option('--output') ?? 'tests/evidence/runs/poc-audit/audit.json');
    const fromRoot = relative(root, output).replaceAll('\\', '/');
    assert.ok(fromRoot.startsWith('../') || isAbsolute(fromRoot) || fromRoot.startsWith('tests/evidence/runs/'),
      'Write to ignored tests/evidence/runs or outside the checkout; never overwrite source or selected evidence');
    const result = audit(root, option('--artifact'));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ output, evidenceIntegrity: result.evidenceIntegrity,
      sourceByteIdentical: result.source.byteIdentical, sourceNewlineOnly: result.source.newlineOnly,
      originalRun: '11 Pass / 1 Fail; separate offline feature recheck Pass',
      readyForFinalGate: result.readyForFinalGate, appTestsRerun: false }, null, 2));
  } catch (error) {
    console.error(`Evidence audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}
