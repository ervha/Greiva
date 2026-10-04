import fs from 'node:fs';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import * as Y from '/workspace/node_modules/yjs/dist/yjs.mjs';
const seed = JSON.parse(fs.readFileSync('/tmp/drag619-seed/seed.json'));
const db = new DatabaseSync('/tmp/drag619-native-first.sqlite', { readOnly: true });
assert.equal(db.prepare('pragma integrity_check').get().integrity_check, 'ok');
assert.equal(db.prepare('select title from pages where id=?').get(seed.pageId).title, seed.title);
const document = new Y.Doc(), history = [];
for (const update of db.prepare('select seq,update_bytes,digest from page_updates where page_id=? order by seq').all(seed.pageId)) {
  assert.equal(createHash('sha256').update(update.update_bytes).digest('hex'), Buffer.from(update.digest).toString('hex'));
  Y.applyUpdate(document, update.update_bytes); history.push({ seq: update.seq, body: document.getXmlFragment('body').toString() });
}
db.close(); document.destroy();
assert.equal(history.length, 3); assert.equal(history[0].body, seed.body); assert.equal(history[2].body, seed.body);
const h2 = '<heading level="2">H2 drag preview</heading>', h3 = '<heading level="3">H3 drag preview</heading>';
assert.equal(history[1].body, seed.body.replace(h2 + h3, h3 + h2));
const result = { result: 'Pass', candidate: '0.6.19 first free-floating preview revision; superseded by the requested column-aligned revision', pageId: seed.pageId, operator: 'User physical mouse and Ctrl+Z', copyMethod: 'node:sqlite online backup through existing Windows runtime, read-only source; 28 pages copied; Greiva left open', updates: history.length, history, noExtraParagraphs: true, allUpdateDigestsVerified: true, scope: 'First candidate only. Native final-revision display and Japanese IME remain separate.' };
fs.writeFileSync('/tmp/drag619-native-first-audit.json', JSON.stringify(result, null, 2) + '\n'); console.log(JSON.stringify({ result: result.result, updates: history.length, noExtraParagraphs: true }));
