import { HocuspocusProvider } from '/workspace/node_modules/@hocuspocus/provider/dist/hocuspocus-provider.esm.js';
import * as Y from '/workspace/node_modules/yjs/dist/yjs.mjs';
import fs from 'node:fs';
const directory = '/tmp/ime620-peer'; fs.mkdirSync(directory, { recursive: true });
const clientId = crypto.randomUUID(), pageId = '01a10400-0000-7000-8000-000000000001';
const document = new Y.Doc(), records = [];
const peer = new HocuspocusProvider({ url: `ws://127.0.0.1:1234?clientId=${clientId}`, name: `page:${pageId}`, document });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) { const deadline = Date.now() + 15000; while (!predicate()) { if (Date.now() > deadline) throw Error('Peer convergence timed out'); await sleep(50); } }
function record(type, detail = {}) { const value = { at: new Date().toISOString(), type, ...detail }; records.push(value); fs.writeFileSync(`${directory}/events.json`, JSON.stringify({ clientId, pageId, records }, null, 2)); console.log(JSON.stringify(value)); }
await until(() => peer.isSynced);
if (process.argv.includes('--seed')) {
  Y.applyUpdate(document, fs.readFileSync('/tmp/ime620-seed-update.bin'));
  await until(() => peer.unsyncedChanges === 0);
  if (document.getXmlFragment('body').length !== 1000) throw Error('Shared seed merged incorrectly');
  record('seed-acknowledged', { blocks: 1000 });
} else if (!process.argv.includes('--snapshot')) {
  const body = document.getXmlFragment('body');
  if (body.length !== 1000 || !body.get(1).toString().includes('WIN620 remote ') || body.get(1).toString().includes('［遠隔')) throw Error('Unexpected IME fixture; refusing to edit');
  record('ready', { trigger: 'Waiting for explicit start marker. No update inferred from elapsed time.' });
  const sendNow = process.argv.includes('--send-now');
  while (!sendNow && !fs.existsSync(`${directory}/start`) && !fs.existsSync(`${directory}/finish`)) await sleep(100);
  if (sendNow || fs.existsSync(`${directory}/start`)) {
    record('operator-started');
    // Operator commits local trial first, then holds the second-line IME candidate.
    if (!sendNow) await sleep(30000);
    const text = body.get(1).get(0);
    for (let index = 1; index <= 3; index++) {
      document.transact(() => text.insert(0, `［遠隔${index}］`), 'windows-ime620-peer');
      await until(() => peer.unsyncedChanges === 0); record('remote-acknowledged', { index });
      await sleep(1000);
    }
  }
  while (!sendNow && !fs.existsSync(`${directory}/finish`)) await sleep(100);
  await until(() => peer.unsyncedChanges === 0);
}
fs.writeFileSync(`${directory}/final.json`, JSON.stringify({ at: new Date().toISOString(), clientId, pageId, bodyXml: document.getXmlFragment('body').toString(), clocks: Array.from(Y.decodeStateVector(Y.encodeStateVector(document))).sort(([a], [b]) => a - b), scope: 'Peer state and scheduling only. Actual Microsoft IME composition/candidate observations require operator report.' }, null, 2));
peer.destroy(); document.destroy();
