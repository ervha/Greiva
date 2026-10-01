import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { arch, cpus, platform, release } from 'node:os';
import { createHash } from 'node:crypto';
import { versions } from './versions.mjs';
import { chromium } from '@playwright/test';

const stamp = new Date().toISOString().replaceAll(':', '-');
const directory = resolve(process.env.GREIVA_EVIDENCE_ROOT ?? 'tests/evidence/runs', stamp);
mkdirSync(directory, { recursive: true });
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const serverSync = process.argv.includes('--step=7-server');
const performanceTests = process.argv.includes('--step=8');
const crashRecovery = performanceTests || process.argv.includes('--step=7-recovery');
const clientSync = crashRecovery || process.argv.includes('--step=7-client');
const step = performanceTests ? 8 : clientSync || serverSync ? 7 : process.argv.includes('--step=6') ? 6 : process.argv.includes('--step=5') ? 5 : process.argv.includes('--step=4') ? 4 : process.argv.includes('--step=1') ? 1 : 2;
const prefix = performanceTests ? 'STEP8' : crashRecovery ? 'STEP7-RECOVERY' : clientSync ? 'STEP7-CLIENT' : serverSync ? 'STEP7-SERVER' : `STEP${step}`;
const container = process.argv.includes('--container');
const browserExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? chromium.executablePath();
const browserVersionResult = spawnSync(browserExecutable, ['--version'], { encoding: 'utf8' });
const environment = { ...process.env, GREIVA_EVIDENCE_DIR: directory };
const gitCommitResult = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' });
const gitStatusResult = spawnSync('git', ['status', '--short'], { encoding: 'utf8' });
const report = {
  id: `${prefix}-${stamp}`, startedAt: new Date().toISOString(), operator: 'Codex',
  gitCommit: gitCommitResult.status === 0 ? gitCommitResult.stdout.trim() : null,
  gitStatus: gitStatusResult.status === 0 ? gitStatusResult.stdout : null,
  gitAvailability: gitStatusResult.status === 0 ? 'repository available' : 'unavailable in execution environment',
  environment: { os: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model, node: process.version,
    execution: container ? 'Docker container; source copied into image; no Docker socket mount' : 'local process',
    browserExecutable,
    browserVersion: browserVersionResult.status === 0 ? browserVersionResult.stdout?.trim() : null,
    build: 'web production build + Node server builds; desktop check optional',
    network: 'loopback for smoke tests; package/registry access uses the execution environment policy' },
  versions: versions(), results: [],
  // Images exclude .git. Use the source fingerprint when Git metadata is unavailable.
  sourceSha256: '',
  scope: clientSync ? 'Section 18 Step 7 client checkpoint: actual Rust SQLite prepared requests, ACK/receipt persistence, transactional pull/cursor, pending-intent projection, migrations, conflict UI and restore/pull/push/pull engine. Real PostgreSQL/HTTP tests cover ACK loss, API recreation, store SIGKILL, cursor write failure, 500ms/2s/5s latency and repeated pause/resume. Separate Chromium structured E2E uses a fresh PostgreSQL namespace. Windows native IPC/IME, remaining integrated four-boundary crash scenarios, performance and final Gates require separate evidence. No Gate verdict.' : serverSync ? 'Section 18 Step 7 server checkpoint only: durable immutable operation ledger, transactional server ordering, cursor pagination, Task/Relation field merge, preserved conflicts and explicit resolution, tombstone priority, migration and database rollback. Local ACK/pull/cursor integration, conflict UI, transport interruption and native checks remain pending. No Gate verdict.' : step === 6 ? 'Section 18 Step 6: native Task/Relation SQLite CRUD with atomic durable queues, safe schema migration, stable client identity, real PostgreSQL models and Nest read API. Push/pull, ACKs, cursor advancement and conflict resolution are Step 7; Windows native/IME evidence stays separate. No Gate verdict.' : step === 5 ? 'Section 18 Step 5: actual Rust SQLite repository used by Tauri; Page metadata and Yjs durability, offline creation, renderer/store SIGKILL and offline restoration, reconnect convergence and fail-closed errors. Browser uses a test-only transport to Rust; Windows native IPC and actual IME require separate evidence. No Gate verdict.' : step === 4 ? 'Section 18 Step 4: Page Yjs/Hocuspocus collaboration, binary journal restart, A/B vectors and full JSON convergence. Client SQLite and actual Microsoft IME require separate evidence. No Gate verdict.' : step === 1 ? 'Section 18 Step 1 foundation checks; current client may include the Step 2 editor. No Gate verdict.' :
    'Section 18 Steps 1–2. Editor operations in Chromium; native compile optional. Microsoft IME, native UI, sync and crash recovery need separate evidence. No Gate verdict.',
};
if (crashRecovery) report.scope = 'Section 18 Step 7 recovery checkpoint: actual standalone API process SIGKILL before/after commit, plus combined Chromium and Rust SQLite Page/block/Task/Relation SIGKILL at immediate edit, local commit, committed push without ACK and staged pull before cursor. Approved 2026-10-01 A contract: all committed/saved input survives; optimistic input still saving may be absent. Tests compare every committed SQLite update, full Yjs state and saved structure/intent, and require complete pre-kill equality if saved was displayed. Page pending updates coalesce without debounce or metadata reordering. Fresh PostgreSQL schemas isolate each run. Windows native IPC/IME, performance and final Gates require separate evidence. No Gate verdict.';
if (performanceTests) report.scope = 'Section 18 Step 8: Step 7 regression plus production frontend/release Rust performance workloads: empty SQLite navigation, 1000-block journal restore and actual keyboard/frame/commit observations, 100 offline Yjs key edits and reconnect convergence, 1000 durable Task operations through the actual React sync engine. Browser uses read-only diagnostics and a test-only bridge. Timing observations are not a native Windows release startup or Microsoft IME Pass. P1/P2 actual OS checks and final Gates require separate evidence. No Gate verdict.';
const gitFiles = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' });
function sourceFiles(directory = '.') {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['.git', '.tools', '.data', '.codex-remote-attachments', 'node_modules', 'dist', 'dist-performance', 'target', 'playwright-report', 'test-results'].includes(entry.name) ||
        entry.name === '.env' || entry.name.endsWith('.tsbuildinfo')) return [];
    const file = `${directory}/${entry.name}`;
    if (file === './tests/evidence' || file === './docs' || file === './apps/client/src-tauri/gen') return [];
    return entry.isDirectory() ? sourceFiles(file) : entry.isFile() ? [file.slice(2)] : [];
  });
}
const files = (gitFiles.status === 0 ? (gitFiles.stdout ?? '').split('\0') : sourceFiles())
  .filter(file => file && !file.startsWith('tests/evidence/') && !file.startsWith('docs/') && file !== 'README.md' && file !== 'CHANGELOG.md').sort();
report.sourceDiscovery = gitFiles.status === 0 ? 'git ls-files' : 'filesystem (image excludes .git)';
if (!files.length) throw new Error('Cannot fingerprint an empty source inventory');
const sourceHash = createHash('sha256');
for (const file of files) { sourceHash.update(file); sourceHash.update('\0'); sourceHash.update(readFileSync(file)); }
report.sourceSha256 = sourceHash.digest('hex');
writeFileSync(`${directory}/source-files.json`, JSON.stringify(files, null, 2));
function run(id, command, args, expected, evidenceDirectory = directory) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, { env: { ...environment, GREIVA_EVIDENCE_DIR: evidenceDirectory }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
    shell: process.platform === 'win32' && command.endsWith('.cmd') });
  const log = `${id}.log`;
  writeFileSync(`${directory}/${log}`, `${result.stdout ?? ''}${result.stderr ?? ''}${result.error?.message ?? ''}`);
  const outcome = { id, command: [command, ...args], startedAt, finishedAt: new Date().toISOString(),
    exitCode: result.status, signal: result.signal, expected, status: result.status === 0 ? 'Pass' : 'Fail', log };
  report.results.push(outcome);
  console.log(`${id}: ${outcome.status}`);
  return result.status === 0;
}
if (step >= 5) run(`${prefix}-STORE-DRIVER`, 'cargo', ['build', '--locked', '--manifest-path', 'apps/client/src-tauri/crates/page-store/Cargo.toml', '--example', 'store-driver', '--target-dir', '.data/native-target'], 'Actual native repository builds for Docker IPC integration and browser E2E');
run(`${prefix}-BUILD`, npm, ['run', 'build'], 'All packages and app production builds succeed');
run(`${prefix}-TYPES`, npm, ['run', 'typecheck'], 'Strict TypeScript checks succeed, including tests');
run(`${prefix}-UNIT-INTEGRATION`, npm, ['test'], 'Model contracts, block transactions, real API/collaboration boot and SQLite tests pass; PostgreSQL is separately gated');
run(`${prefix}-E2E`, npm, ['run', 'test:e2e'], 'Chromium verifies editor blocks, slash, Mention, Todo, Toggle, movement, undo/redo, Markdown and service health');
run(`${prefix}-SQLITE-INIT`, npm, ['run', 'db:sqlite'], 'File database initializes with WAL and integrity_check=ok');
if (container) {
  run(`${prefix}-POSTGRES`, npm, ['run', 'test:postgres'], 'Live PostgreSQL 18.4 on the Compose network verifies database and server version', `${directory}/postgres`);
  if (clientSync) run(`${prefix}-STRUCTURED-E2E`,npm,['run','test:structured-e2e'],'Real HTTP, PostgreSQL and Rust SQLite verify conflict resolution, offline restart, remote updates, draft and focus preservation',`${directory}/structured-e2e`);
  if (crashRecovery) run(`${prefix}-COMBINED-CRASH`,npm,['run','test:crash'],'Four actual browser/store SIGKILL boundaries preserve all committed Page/block changes and structured intent, restore offline and converge with peers under the approved A contract',`${directory}/combined-crash`);
} else run(`${prefix}-POSTGRES-CONFIG`, 'docker', ['compose', '-f', 'infrastructure/postgres/compose.yaml', 'config', '--quiet'], 'Compose configuration validates');
if (!container && process.argv.includes('--postgres')) {
  if (run(`${prefix}-POSTGRES-START`, npm, ['run', 'db:up'], 'PostgreSQL 18.4 starts and becomes healthy')) {
    run(`${prefix}-POSTGRES`, npm, ['run', 'test:postgres'], 'Live SQL connection verifies database and server version', `${directory}/postgres`);
  } else report.results.push({ id: `${prefix}-POSTGRES`, status: 'Not run', reason: 'Database startup failed' });
} else if (!container) report.results.push({ id: `${prefix}-POSTGRES`, status: 'Not run', reason: 'Use --postgres with a Docker-enabled environment' });
if (process.argv.includes('--desktop')) {
  run(`${prefix}-DESKTOP-CHECK`, 'cargo', ['check', '--locked', '--manifest-path', 'apps/client/src-tauri/Cargo.toml'], 'Tauri desktop crate typechecks against the locked graph');
  if (crashRecovery) run(`${prefix}-DEFAULT-FEATURES`,'node',['scripts/verify-native-features.mjs'],'Normal Tauri dependency graph does not enable the crash-test-hooks feature');
} else report.results.push({ id: `${prefix}-DESKTOP-CHECK`, status: 'Not run', reason: 'Use --desktop with the native Tauri prerequisites' });
if (performanceTests && container) run(`${prefix}-PERFORMANCE`,npm,['run','test:performance'],'Production frontend and release Rust measure the Section 13 workloads and verify data correctness; timings and native/platform scope remain explicit',`${directory}/performance`);
report.finishedAt = new Date().toISOString();
writeFileSync(`${directory}/summary.json`, JSON.stringify(report, null, 2));
const rows = report.results.map(result => `| ${result.id} | ${result.status} | ${result.log ? `[log](${result.log})` : result.reason} |`).join('\n');
const gitDescription = report.gitCommit ?? (gitStatusResult.status === 0 ? 'unborn repository' : 'unavailable in execution environment; source fingerprint recorded');
writeFileSync(`${directory}/SUMMARY.md`, `# Step ${step} verification\n\n${report.startedAt} / ${report.environment.os} ${report.environment.arch} / Git: ${gitDescription}\n\nSource SHA-256: ${report.sourceSha256}\n\n| Test | Result | Evidence |\n| --- | --- | --- |\n${rows}\n\nScope: ${report.scope}\n\nSee [summary.json](summary.json) for environment, commands, timestamps, versions and result details.\n`);
console.log(`Evidence: ${relative(process.cwd(), directory)}`);
process.exitCode = report.results.some(result => result.status === 'Fail') ? 1 : 0;
