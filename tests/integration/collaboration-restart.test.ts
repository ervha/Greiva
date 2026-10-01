import { it, expect } from 'vitest';
import { mkdtempSync, rmSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer as netServer } from 'node:net';
import { HocuspocusProvider } from '@hocuspocus/provider';
import * as Y from 'yjs';
import { UpdateStore } from '../../apps/collaboration/dist/update-store.js';

async function until(condition: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 10000;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for collaboration');
    await new Promise(resolve => setTimeout(resolve, 30));
  }
}
async function kill(process: ChildProcess) {
  if (process.exitCode !== null || process.signalCode !== null) return;
  const exited = new Promise(resolve => process.once('exit', resolve));
  process.kill('SIGKILL');
  await exited;
}
it('STEP4-RESTART: ACKed binary updates survive SIGKILL; disconnected edits converge after restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'greiva-restart-'));
  const socket = netServer();
  await new Promise<void>(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = (socket.address() as { port: number }).port;
  await new Promise<void>(resolve => socket.close(() => resolve()));
  const processes: ChildProcess[] = [];
  const providers: HocuspocusProvider[] = [];
  const docs: Y.Doc[] = [];
  const boot = async () => {
    const process = spawn(globalThis.process.execPath, ['apps/collaboration/dist/main.js'], {
      env: { ...globalThis.process.env, COLLABORATION_PORT: String(port), COLLABORATION_DATA_DIR: directory }, stdio: 'ignore',
    });
    processes.push(process);
    await until(async () => { try { return (await fetch(`http://127.0.0.1:${port}/health`)).ok; } catch { return false; } });
    return process;
  };
  const connect = (name: string) => {
    const document = new Y.Doc(); docs.push(document);
    const provider = new HocuspocusProvider({ url: `ws://127.0.0.1:${port}?clientId=${name}`, name: 'page:restart-test', document });
    providers.push(provider);
    return { provider, document };
  };
  try {
    const first = await boot();
    const a = connect('client-a');
    await until(() => a.provider.isSynced && a.provider.unsyncedChanges === 0);
    a.document.getText('proof').insert(0, 'durable');
    await until(() => a.provider.unsyncedChanges === 0);
    const durableVector = Y.encodeStateVector(a.document);
    await kill(first);
    a.provider.disconnect();
    a.document.getText('proof').insert(7, ' offline');
    await boot();
    const b = connect('client-b');
    await until(() => b.provider.isSynced && b.provider.unsyncedChanges === 0);
    expect(b.document.getText('proof').toString()).toBe('durable');
    expect(Y.decodeStateVector(Y.encodeStateVector(b.document))).toEqual(Y.decodeStateVector(durableVector));
    await a.provider.connect();
    await until(() => a.provider.unsyncedChanges === 0 && b.document.getText('proof').toString() === 'durable offline');
    expect(Y.decodeStateVector(Y.encodeStateVector(a.document))).toEqual(Y.decodeStateVector(Y.encodeStateVector(b.document)));
    expect(a.document.getXmlFragment('body').toJSON()).toBe(b.document.getXmlFragment('body').toJSON());
  } finally {
    providers.forEach(provider => provider.destroy());
    docs.forEach(document => document.destroy());
    await Promise.all(processes.map(kill));
    rmSync(directory, { recursive: true, force: true });
  }
}, 30000);

it('STEP4-JOURNAL: partial final append recovers; checksum corruption fails closed', () => {
  const directory = mkdtempSync(join(tmpdir(), 'greiva-journal-'));
  const store = new UpdateStore(directory);
  const original = new Y.Doc(); const restored = new Y.Doc();
  try {
    original.getText('proof').insert(0, 'preserve');
    store.append('page:journal', Y.encodeStateAsUpdate(original));
    const size = readFileSync(store.path('page:journal')).length;
    appendFileSync(store.path('page:journal'), Buffer.from([0, 0, 0, 99, 1]));
    expect(store.restore('page:journal', restored)).toBe(true);
    expect(restored.getText('proof').toString()).toBe('preserve');
    expect(readFileSync(store.path('page:journal')).length).toBe(size);
    const bytes = readFileSync(store.path('page:journal'));
    bytes[8] = bytes[8]! ^ 1;
    writeFileSync(store.path('page:journal'), bytes);
    expect(() => store.restore('page:journal', new Y.Doc())).toThrow('Corrupt Yjs journal');
    expect(() => store.path('page:../../escape')).toThrow('Invalid Page');
  } finally {
    original.destroy(); restored.destroy(); rmSync(directory, { recursive: true, force: true });
  }
});
