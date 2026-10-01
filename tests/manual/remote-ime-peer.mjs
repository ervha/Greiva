import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const runId = new Date().toISOString().replace(/[:.]/g, '-');
const directory = `/workspace/.data/host-ime/remote-${runId}`;
await mkdir(directory, { recursive: true });
const clientId = randomUUID();
const pageId = '019a0070-0000-7000-8000-000000000001';
const document = new Y.Doc();
const records = [];
function log(type, detail = {}) {
  const record = { at: new Date().toISOString(), type, ...detail };
  records.push(record);
  console.log(JSON.stringify(record));
}
const provider = new HocuspocusProvider({
  url: `ws://127.0.0.1:1234?clientId=${clientId}`,
  name: `page:${pageId}`, document,
  onStatus: ({ status }) => log('connection', { status }),
  onSynced: ({ state }) => log('synced', { state }),
  onUnsyncedChanges: ({ number }) => log('pending', { number }),
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Peer sync or acknowledgement timed out');
    await sleep(50);
  }
}
let outcome = 'Incomplete';
try {
  await until(() => provider.isSynced && provider.unsyncedChanges === 0);
  const body = document.getXmlFragment('body');
  const target = body.toArray().find(node => node instanceof Y.XmlElement && node.nodeName === 'paragraph');
  if (!target) throw new Error('No paragraph available; refusing to change unrelated structure');
  log('ready', { clientId, pageId, directory, firstUpdateAfterMs: 20000, intervalMs: 5000, count: 12 });
  await sleep(20000);
  let remoteParagraph;
  let remoteText;
  for (let sequence = 1; sequence <= 12; sequence++) {
    document.transact(() => {
      if (sequence <= 6) {
        if (!remoteParagraph) {
          remoteParagraph = new Y.XmlElement('paragraph');
          remoteText = new Y.XmlText();
          remoteParagraph.insert(0, [remoteText]);
          body.insert(body.length, [remoteParagraph]);
        }
        remoteText.insert(remoteText.length, `［別段落${sequence}］`);
      } else {
        if (target.parent !== body) throw new Error('Target paragraph moved or deleted during test');
        let text = target.toArray().find(node => node instanceof Y.XmlText);
        if (!text) { text = new Y.XmlText(); target.insert(0, [text]); }
        text.insert(0, `［遠隔${sequence}］`);
      }
    }, 'native-ime-remote-peer');
    log('sent', { sequence, target: sequence <= 6 ? 'separate-paragraph' : 'native-first-paragraph' });
    await until(() => provider.unsyncedChanges === 0);
    log('acknowledged', { sequence });
    if (sequence < 12) await sleep(5000);
  }
  outcome = 'Remote updates acknowledged; native IME outcome pending';
  log('updates-finished', { nativeResult: 'Pending user report and native observations' });
  await sleep(10000);
} catch (error) {
  outcome = 'Remote sender failed';
  log('error', { message: String(error) });
  process.exitCode = 1;
} finally {
  await writeFile(`${directory}/peer-events.json`, JSON.stringify({ runId, clientId, pageId, outcome, records }, null, 2));
  await writeFile(`${directory}/peer-final-state.json`, JSON.stringify({ at: new Date().toISOString(), stateVector: Buffer.from(Y.encodeStateVector(document)).toString('base64'), bodyXml: document.getXmlFragment('body').toString(), nativeResult: 'Not inferred from peer state' }, null, 2));
  log('evidence-saved', { directory });
  provider.destroy();
  document.destroy();
}
