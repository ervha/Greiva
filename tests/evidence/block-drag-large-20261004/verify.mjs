import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const directory = '/tmp/block-drag-0620-large-verified'; fs.mkdirSync(directory, { recursive: true });
const inventory = JSON.parse(fs.readFileSync('/tmp/drag620-inventory.json'));
for (const file of inventory) assert.equal(createHash('sha256').update(fs.readFileSync(file.path)).digest('hex'), file.sha256, file.path);
fs.rmSync('tests/e2e/block-drag-debug.spec.ts', { force: true });
const results = [];
for (const [id, args] of [['TYPECHECK', ['run', 'typecheck']], ['UNIT', ['test']], ['E2E', ['run', 'test:e2e']]]) {
  const startedAt = new Date().toISOString();
  const result = spawnSync('npm', args, { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, env: { ...process.env, GREIVA_EVIDENCE_DIR: directory } });
  fs.writeFileSync(`${directory}/${id}.log`, (result.stdout ?? '') + (result.stderr ?? ''));
  results.push({ id, args, startedAt, finishedAt: new Date().toISOString(), exitCode: result.status });
  fs.writeFileSync(`${directory}/verification.json`, JSON.stringify({ product: '0.6.20', sourceFiles: inventory, results }, null, 2) + '\n');
  console.log(`${id}: ${result.status === 0 ? 'Pass' : 'Fail'}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

