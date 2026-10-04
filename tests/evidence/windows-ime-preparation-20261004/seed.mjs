import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import fs from 'node:fs';
import * as Y from '/workspace/node_modules/yjs/dist/yjs.mjs';
import { emptyPageUpdate } from '/workspace/packages/sync/dist/index.js';
const directory = '/tmp/ime620-seed'; fs.mkdirSync(directory, { recursive: true });
if (fs.existsSync(`${directory}/greiva.sqlite`)) throw Error('Refusing to overwrite an existing fixture');
const child = spawn('/workspace/.data/native-target/debug/examples/store-driver', [`${directory}/greiva.sqlite`]);
const pending = new Map(); let sequence = 0;
createInterface({ input: child.stdout }).on('line', line => { const result = JSON.parse(line), request = pending.get(result.id); pending.delete(result.id); result.error ? request.reject(Error(result.error)) : request.resolve(result.value); });
function rpc(command, fields = {}) { const id = ++sequence; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); child.stdin.write(JSON.stringify({ id, command, ...fields }) + '\n'); }); }
const pageId = '01a10400-0000-7000-8000-000000000001'; await rpc('load', { pageId });
const document = new Y.Doc(); Y.applyUpdate(document, emptyPageUpdate());
const body = document.getXmlFragment('body');
document.transact(() => {
  body.delete(0, body.length);
  for (let index = 0; index < 1000; index++) {
    const paragraph = new Y.XmlElement('paragraph'), text = new Y.XmlText();
    text.insert(0, index === 0 ? 'WIN620 local ' : index === 1 ? 'WIN620 remote ' : `Block ${String(index).padStart(4, '0')}`);
    paragraph.insert(0, [text]); body.push([paragraph]);
  }
});
await rpc('append', { pageId, update: Array.from(Y.encodeStateAsUpdate(document)) });
await rpc('title', { pageId, title: 'WIN620-IME1000' });
fs.writeFileSync(`${directory}/seed.json`, JSON.stringify({ product: '0.6.20', pageId, title: 'WIN620-IME1000', blocks: body.length, bodyXml: body.toString(), clocks: Array.from(Y.decodeStateVector(Y.encodeStateVector(document))).sort(([a], [b]) => a - b), scope: 'Isolated 1000-block fixture via existing actual Rust store. Includes shared seed deletion; not native input evidence.' }, null, 2) + '\n');
fs.writeFileSync(`${directory}/seed-update.bin`, Y.encodeStateAsUpdate(document));
child.stdin.end(); await new Promise(resolve => child.on('exit', resolve)); document.destroy(); console.log('Isolated IME fixture ready');
