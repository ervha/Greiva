import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import fs from 'node:fs';
import * as Y from '/workspace/node_modules/yjs/dist/yjs.mjs';
const directory = '/tmp/drag619-seed'; fs.mkdirSync(directory, { recursive: true });
if (fs.existsSync(`${directory}/greiva.sqlite`)) throw Error('Refusing to overwrite fixture');
const child = spawn('/workspace/.data/native-target/debug/examples/store-driver', [`${directory}/greiva.sqlite`]);
const pending = new Map(); let sequence = 0;
createInterface({ input: child.stdout }).on('line', line => { const result = JSON.parse(line), request = pending.get(result.id); pending.delete(result.id); result.error ? request.reject(Error(result.error)) : request.resolve(result.value); });
function rpc(command, fields = {}) { const id = ++sequence; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); child.stdin.write(JSON.stringify({ id, command, ...fields }) + '\n'); }); }
const pageId = '01a10300-0000-7000-8000-000000000001'; await rpc('load', { pageId });
const document = new Y.Doc(), body = document.getXmlFragment('body');
for (const [level, text] of [[2, 'H2 drag preview'], [3, 'H3 drag preview']]) { const heading = new Y.XmlElement('heading'), content = new Y.XmlText(); heading.setAttribute('level', level); content.insert(0, text); heading.push([content]); body.push([heading]); }
const paragraph = new Y.XmlElement('paragraph'), text = new Y.XmlText(); text.insert(0, 'Multiple lines');
paragraph.push([text, new Y.XmlElement('hardBreak')]); const second = new Y.XmlText(); second.insert(0, 'Move this block as a card'); paragraph.push([second]); body.push([paragraph, new Y.XmlElement('paragraph')]);
await rpc('append', { pageId, update: Array.from(Y.encodeStateAsUpdate(document)) }); await rpc('title', { pageId, title: 'WIN619-DRAG' });
fs.writeFileSync(`${directory}/seed.json`, JSON.stringify({ product: '0.6.19', pageId, title: 'WIN619-DRAG', body: body.toString(), scope: 'New isolated fixture through actual Rust store; no native input or drag claim.' }, null, 2) + '\n');
child.stdin.end(); await new Promise(resolve => child.on('exit', resolve)); document.destroy(); console.log('Seed saved');
