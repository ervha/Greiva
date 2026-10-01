import { it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { newId } from '@greiva/shared';
import { emptyPageUpdate } from '@greiva/sync';
it('STEP5-TRANSACTION: native repository rolls back the update with failed metadata and deduplicates replay', () => {
  const directory = mkdtempSync(join(tmpdir(), 'greiva-store-'));
  const path = join(directory, 'page.sqlite');
  const first = newId(); const second = newId();
  const bytes = Array.from(emptyPageUpdate());
  const executable = resolve('.data/native-target/debug/examples/store-driver');
  const request = (items: Array<Record<string, unknown>>) => {
    const run = spawnSync(executable, [path], { input: items.map((item, id) => JSON.stringify({ ...item, id })).join('\n') + '\n', encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    return run.stdout.trim().split('\n').map(line => JSON.parse(line) as { value: { metadata: { createdAt: string; updatedAt: string; yDocId: string; title: string }; updates: number[][] }; error?: string });
  };
  try {
    const initial = request([{ command: 'load', pageId: first }, { command: 'load', pageId: second }]);
    expect(initial[0]!.value.metadata.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    const db = new DatabaseSync(path);
    db.exec("CREATE TRIGGER reject_metadata BEFORE UPDATE ON pages BEGIN SELECT RAISE(ABORT,'metadata failure'); END");
    expect(request([{ command: 'append', pageId: first, update: bytes }])[0]!.error).toContain('metadata failure');
    expect(db.prepare('SELECT count(*) AS count FROM page_updates').get()?.count).toBe(0);
    expect(db.prepare('SELECT updated_at FROM pages WHERE id=?').get(first)?.updated_at).toBe(initial[0]!.value.metadata.updatedAt);
    db.exec('DROP TRIGGER reject_metadata'); db.close();
    const after = request([{ command: 'append', pageId: first, update: bytes }, { command: 'append', pageId: first, update: bytes }, { command: 'title', pageId: first, title: '保存したタイトル' }, { command: 'load', pageId: first }, { command: 'load', pageId: second }]);
    expect(after[3]!.value.updates).toEqual([bytes]);
    expect(after[3]!.value.metadata.title).toBe('保存したタイトル');
    expect(after[3]!.value.metadata.yDocId).toBe(`page:${first}`);
    expect(after[4]!.value.updates).toEqual([]);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
