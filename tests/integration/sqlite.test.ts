import { it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
it('STEP1-SQLITE: initializes and reopens a local development database', () => {
  const directory = mkdtempSync(join(tmpdir(), 'greiva-sqlite-'));
  const path = join(directory, 'dev.sqlite');
  let db: DatabaseSync | undefined;
  try {
    db = new DatabaseSync(path);
    db.exec(readFileSync('infrastructure/sqlite/schema.sql', 'utf8'));
    expect(db.prepare('PRAGMA journal_mode').get()?.journal_mode).toBe('wal');
    expect(db.prepare('PRAGMA synchronous').get()?.synchronous).toBe(2);
    expect(db.prepare('PRAGMA foreign_keys').get()?.foreign_keys).toBe(1);
    db.exec('CREATE TABLE foundation_probe (value TEXT NOT NULL)');
    db.prepare('INSERT INTO foundation_probe VALUES (?)').run('日本語');
    db.close(); db = new DatabaseSync(path);
    expect(db.prepare('SELECT value FROM foundation_probe').get()?.value).toBe('日本語');
    expect(db.prepare('PRAGMA integrity_check').get()?.integrity_check).toBe('ok');
  } finally { db?.close(); rmSync(directory, { recursive: true, force: true }); }
});
