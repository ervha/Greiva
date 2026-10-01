import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Plugin } from 'vite';

type Reply = { id: number; value?: unknown; error?: string };
export function sqliteBridge(): Plugin {
  const processes = new Map<string, { child: ChildProcessWithoutNullStreams; pending: Map<number, (reply: Reply) => void> }>();
  const root = resolve(process.env.GREIVA_TEST_STORE_DIR ?? '../../.data/test-stores');
  mkdirSync(root, { recursive: true });
  let sequence = 0;
  const file = (device: string) => `${root}/${device}.sqlite`;
  function processFor(device: string) {
    const existing = processes.get(device);
    if (existing && existing.child.exitCode === null && existing.child.signalCode === null) return existing;
    const executable = resolve(process.env.GREIVA_STORE_DRIVER ?? '../../.data/native-target/debug/examples/store-driver');
    const child = spawn(executable, [file(device)], { stdio: ['pipe', 'pipe', 'pipe'] });
    const pending = new Map<number, (reply: Reply) => void>();
    const entry = { child, pending };
    processes.set(device, entry);
    createInterface({ input: child.stdout }).on('line', line => {
      const reply = JSON.parse(line) as Reply;
      pending.get(reply.id)?.(reply); pending.delete(reply.id);
    });
    child.stderr.on('data', data => console.error(`Rust store: ${data}`));
    const ended = () => {
      for (const [id, done] of pending) done({ id, error: 'Rust SQLite process terminated' });
      pending.clear(); if (processes.get(device) === entry) processes.delete(device);
    };
    child.on('exit', ended); child.on('error', ended);
    return entry;
  }
  return { name: 'greiva-test-sqlite-bridge',
    configureServer(server) {
      server.httpServer?.on('close', () => { for (const value of processes.values()) value.child.kill('SIGKILL'); });
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith('/__greiva_test_store')) return next();
        try {
          let raw = ''; for await (const chunk of request) raw += chunk;
          const input = JSON.parse(raw) as { device: string; command: string; [key: string]: unknown };
          if (!/^[a-zA-Z0-9-]{1,80}$/.test(input.device)) throw new Error('Invalid test device');
          let reply: Reply;
          if (request.url === '/__greiva_test_store_control') {
            if (input.command === 'kill') {
              const entry = processes.get(input.device);
              if (entry) { await new Promise<void>(done => { entry.child.once('exit', () => done()); entry.child.kill('SIGKILL'); }); }
              reply = { id: 0, value: { signal: 'SIGKILL', path: file(input.device) } };
            } else {
              const db = new DatabaseSync(file(input.device));
              try {
                if (input.command === 'write-failure') db.exec("CREATE TRIGGER fail_append BEFORE INSERT ON page_updates BEGIN SELECT RAISE(ABORT,'Injected SQLite write failure'); END");
                else if (input.command === 'corrupt') db.exec("UPDATE page_updates SET update_bytes=X'FFFF' WHERE seq=(SELECT max(seq) FROM page_updates)");
                else if (input.command === 'schema') db.exec('PRAGMA user_version=99');
                else throw new Error('Unknown test control');
              } finally { db.close(); }
              reply = { id: 0, value: null };
            }
          } else {
            const entry = processFor(input.device); const id = ++sequence;
            reply = await new Promise<Reply>(done => { entry.pending.set(id, done); entry.child.stdin.write(`${JSON.stringify({ ...input, id })}\n`); });
          }
          response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(reply));
        } catch (error) {
          response.statusCode = 500; response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ error: String(error) }));
        }
      });
    },
  };
}
