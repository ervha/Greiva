import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const directory = '/tmp/block-drag-0619-final-native'; fs.mkdirSync(directory, { recursive: true });
const inventory = JSON.parse(fs.readFileSync('/tmp/drag619-inventory.json'));
for (const file of inventory) assert.equal(createHash('sha256').update(fs.readFileSync(file.path)).digest('hex'), file.sha256, file.path);
const config = JSON.parse(fs.readFileSync('apps/client/src-tauri/tauri.conf.json'));
assert.equal(config.version, '0.6.19'); assert.equal(config.app.windows[0].dragDropEnabled, false);
const override = { identifier: 'dev.greiva.poc.drag619', app: { windows: [{ ...config.app.windows[0], url: 'index.html?page=01a10300-0000-7000-8000-000000000001' }] } };
const env = { ...process.env, VITE_GREIVA_TEST_HOOKS: '0', VITE_GREIVA_TEST_SQLITE: '0', CARGO_BUILD_JOBS: '2', TAURI_CONFIG: JSON.stringify(override) };
const results = []; let artifact = null, features = null;
function run(id, command, args) {
  const startedAt = new Date().toISOString(), result = spawnSync(command, args, { env, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  fs.writeFileSync(`${directory}/${id}.log`, (result.stdout ?? '') + (result.stderr ?? '') + (result.error?.message ?? ''));
  results.push({ id, command: [command, ...args], startedAt, finishedAt: new Date().toISOString(), exitCode: result.status });
  console.log(`${id}: ${result.status === 0 ? 'Pass' : 'Fail'}`); assert.equal(result.status, 0, id); return result.stdout;
}
try {
  run('BUILD', 'npm', ['run', 'build']);
  const assets = fs.readdirSync('apps/client/dist/assets').filter(file => file.endsWith('.js')).map(file => fs.readFileSync(`apps/client/dist/assets/${file}`, 'utf8')).join('\n');
  assert(assets.includes('block-drag-preview')); assert(!assets.includes('GREIVA_IME_TRACE'));
  const graph = JSON.parse(run('FEATURES', 'cargo', ['metadata', '--offline', '--locked', '--format-version', '1', '--manifest-path', 'apps/client/src-tauri/Cargo.toml', '--filter-platform', 'x86_64-pc-windows-msvc', '--features', 'custom-protocol']));
  const store = graph.packages.find(pkg => pkg.name === 'greiva-page-store'); assert.equal(store.version, '0.6.19');
  features = graph.resolve.nodes.find(node => node.id === store.id).features; assert(!features.includes('crash-test-hooks'));
  run('RELEASE-CROSS', 'cargo', ['xwin', 'build', '--release', '--offline', '--locked', '--manifest-path', 'apps/client/src-tauri/Cargo.toml', '--target', 'x86_64-pc-windows-msvc', '--features', 'custom-protocol', '--target-dir', '.data/windows-target']);
  const path = '.data/windows-target/x86_64-pc-windows-msvc/release/greiva-poc.exe', bytes = fs.readFileSync(path);
  artifact = { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  fs.copyFileSync(path, `${directory}/greiva-poc.exe`);
} finally {
  fs.writeFileSync(`${directory}/build.json`, JSON.stringify({ product: '0.6.19', at: new Date().toISOString(), configurationOverride: override, sourceFiles: inventory, frontendTestFlags: 0, storeFeatures: features, artifact, results, scope: 'Normal product frontend and release Rust, configuration-only isolated fixture. Docker build is separate from Windows physical drag and IME.' }, null, 2) + '\n');
}

