// Inspect a stopped-process DB/WAL copy in Docker using the actual Rust repository.
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import * as Y from 'yjs';
const [path, pageId, output] = process.argv.slice(2);
if (!path || !/^[0-9a-f-]{36}$/.test(pageId ?? '') || !output) throw new Error('SQLite copy, explicit Page UUID and output required');
const result = spawnSync('/workspace/.data/native-target/debug/examples/store-driver', [path], {
  input: JSON.stringify({ id: 'native-inspection', command: 'load', pageId }) + '\n', encoding: 'utf8', timeout: 15000,
});
if (result.status !== 0) throw new Error(result.stderr || 'Native repository inspector failed');
const reply = JSON.parse(result.stdout.trim());
if (reply.error) throw new Error(reply.error);
const document = new Y.Doc();
for (const bytes of reply.value.updates) Y.applyUpdate(document, Uint8Array.from(bytes), 'native-snapshot');
await writeFile(output, JSON.stringify({ at: new Date().toISOString(), metadata: reply.value.metadata, updates: reply.value.updates.length, bodyXml: document.getXmlFragment('body').toString(), clocks: Array.from(Y.decodeStateVector(Y.encodeStateVector(document))).sort(([a], [b]) => a - b) }, null, 2));
document.destroy();
