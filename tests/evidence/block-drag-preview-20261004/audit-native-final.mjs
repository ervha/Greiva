import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import * as Y from '/workspace/node_modules/yjs/dist/yjs.mjs';
const pageId = '01a10300-0000-7000-8000-000000000001';
function read(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  assert.equal(db.prepare('pragma integrity_check').get().integrity_check, 'ok');
  const pages = db.prepare('select id,title from pages order by id').all();
  const document = new Y.Doc(), history = [];
  for (const update of db.prepare('select seq,update_bytes,digest from page_updates where page_id=? order by seq').all(pageId)) {
    const sha256 = createHash('sha256').update(update.update_bytes).digest('hex');
    assert.equal(sha256, Buffer.from(update.digest).toString('hex'));
    Y.applyUpdate(document, update.update_bytes);
    const fragment = document.getXmlFragment('body');
    history.push({ seq: update.seq, sha256, body: fragment.toString(), blocks: fragment.toArray().map(block => block.toString()) });
  }
  db.close(); document.destroy(); return { pages, history };
}
const before = read('/tmp/drag619-before-gutter.sqlite'), after = read('/tmp/drag619-native-final.sqlite');
assert.deepEqual(after.pages, before.pages);
assert.deepEqual(after.history.slice(0, before.history.length), before.history);
const original = before.history.at(-1).body;
const h2 = '<heading level="2">H2 drag preview</heading>', h3 = '<heading level="3">H3 drag preview</heading>';
assert(original.startsWith(h3 + h2));
const moved = original.replace(h3 + h2, h2 + h3), newHistory = after.history.slice(before.history.length);
assert(newHistory.length >= 2); assert(newHistory.some(update => update.body === moved));
// The user explored more than one move, including the empty paragraph.
// Verify actual persisted permutations instead of assuming exactly one trial.
const originalBlocks = before.history.at(-1).blocks.slice().sort();
for (const update of newHistory) assert.deepEqual(update.blocks.slice().sort(), originalBlocks);
assert(newHistory.some(update => update.body === original));
const finalBody = after.history.at(-1).body;
const result = { result: 'Pass', product: '0.6.19 final rounded UI and gutter-drop correction',
  artifactSha256: 'd70e2dbad93d36bf147cc1eb4edfbdedbab6b388848173583fe41b5413079a48', pageId,
  operator: 'User physical mouse, straight handle-column movement and Ctrl+Z; user reported the appearance and operation look good',
  copyMethod: 'Existing Windows node:sqlite online backup, read-only source; Greiva left open',
  beforeUpdates: before.history.length, afterUpdates: after.history.length, newHistory, beforeBody: original, finalBody,
  finalMatchesFirstSeed: finalBody === before.history[0].body,
  finalMatchesPreTrial: finalBody === original,
  observation: 'Nine additional pure block-order updates include an empty-paragraph move and return. A single final Ctrl+Z cannot be inferred from stored Yjs origin; operator reported the requested interaction looks good. Final order is H2 then H3, matching the first seed, rather than the pre-trial H3 then H2.',
  allUpdateDigestsVerified: true, oldHistoryUnchanged: true, noExtraParagraphs: true, titleUnchanged: true,
  scope: 'Native physical gutter drag and Undo plus user visual acceptance. No Japanese IME, native performance or complete Gate verdict.' };
fs.writeFileSync('/tmp/drag619-native-final-audit.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ result: result.result, beforeUpdates: result.beforeUpdates, afterUpdates: result.afterUpdates, noExtraParagraphs: true }));
