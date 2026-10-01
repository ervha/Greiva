// Docker-only peer for an explicitly selected native test Page. No GUI input.
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const [pageId, output] = process.argv.slice(2);
if (!/^[0-9a-f-]{36}$/.test(pageId ?? '') || !output) throw new Error('Explicit test Page UUID and output file required');
const document = new Y.Doc();
const clientId = randomUUID();
const provider = new HocuspocusProvider({ url: `ws://127.0.0.1:1234?clientId=${clientId}`, name: `page:${pageId}`, document });
async function until(predicate) {
  const deadline = Date.now() + 20000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Native peer convergence timed out');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
try {
  await until(() => provider.isSynced && provider.unsyncedChanges === 0);
  const body = document.getXmlFragment('body');
  await until(() => ['native-second', 'native-first', '日本語'].every(text => body.toString().includes(text)));
  const before = body.toString();
  const remote = new Y.XmlElement('paragraph');
  const text = new Y.XmlText(); text.insert(0, 'native-peer-received'); remote.insert(0, [text]);
  document.transact(() => body.insert(body.length, [remote]), 'native-recovery-test-peer');
  await until(() => provider.unsyncedChanges === 0);
  await new Promise(resolve => setTimeout(resolve, 2000));
  await writeFile(output, JSON.stringify({ at: new Date().toISOString(), pageId, clientId, before, bodyXml: body.toString(), clocks: Array.from(Y.decodeStateVector(Y.encodeStateVector(document))).sort(([a], [b]) => a - b), acknowledged: provider.unsyncedChanges === 0, nativeResult: 'Observe native window and compare its persisted Y.Doc independently' }, null, 2));
} finally { provider.destroy(); document.destroy(); }
