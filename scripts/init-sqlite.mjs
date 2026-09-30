import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const path = resolve(process.argv[2] ?? '.data/greiva-dev.sqlite');
mkdirSync(dirname(path), { recursive: true });
const db = new DatabaseSync(path);
try {
  db.exec(readFileSync(new URL('../infrastructure/sqlite/schema.sql', import.meta.url), 'utf8'));
  console.log(JSON.stringify({ path, sqlite: db.prepare('select sqlite_version() as version').get(), integrity: db.prepare('PRAGMA integrity_check').get(), journal: db.prepare('PRAGMA journal_mode').get() }));
} finally { db.close(); }
