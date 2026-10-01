import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { mkdirSync,existsSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Plugin, ViteDevServer, PreviewServer } from 'vite';

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
    const child = spawn(executable, [file(device)], { stdio: ['pipe', 'pipe', 'pipe'],env:{...process.env,GREIVA_CRASH_BARRIER_ROOT:file(device)} });
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
    // A request can race a deliberate store SIGKILL. A broken stdin is a
    // failed store command, not an unhandled event that may stop Vite.
    child.stdin.on('error', () => { ended(); child.kill('SIGKILL'); });
    return entry;
  }
  const configure = (server: ViteDevServer | PreviewServer) => {
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
              reply = { id: 0, value: { signal: entry?.child.signalCode ?? null,pid:entry?.child.pid,path:file(input.device),at:new Date().toISOString() } };
            } else if (input.command==='arm-pull-barrier' || input.command==='arm-page-barrier') {
              rmSync(`${file(input.device)}.reached`,{force:true});
              writeFileSync(`${file(input.device)}.armed`,input.command==='arm-pull-barrier' ? 'structured-pull-before-cursor':'page-append-before-commit');
              reply={id:0,value:null};
            } else if (input.command==='clear-barrier') {
              for (const suffix of ['.armed','.reached']) rmSync(`${file(input.device)}${suffix}`,{force:true});
              reply={id:0,value:null};
            } else if (input.command==='inspect' || input.command==='barrier-status') {
              const db=new DatabaseSync(file(input.device),{readOnly:true});
              try {
                const marker=existsSync(`${file(input.device)}.reached`) ? JSON.parse(readFileSync(`${file(input.device)}.reached`,'utf8')) as unknown : null;
                reply={id:0,value:{marker,
                  state:db.prepare("SELECT * FROM sync_state WHERE stream='structured'").get(),
                  receipts:db.prepare('SELECT * FROM structured_received ORDER BY server_order').all(),
                  entities:db.prepare('SELECT * FROM structured_server_entities ORDER BY entity_type,entity_id').all(),
                  conflicts:db.prepare('SELECT * FROM structured_conflicts ORDER BY id').all(),
                  pages:db.prepare('SELECT * FROM pages ORDER BY id').all(),
                  pageUpdates:db.prepare('SELECT seq,page_id,update_bytes,digest FROM page_updates ORDER BY seq').all().map(row=> ({...row,update_bytes:Array.from(row.update_bytes as Uint8Array),digest:Array.from(row.digest as Uint8Array)})),
                  integrity:db.prepare('PRAGMA integrity_check').get()}};
              } finally {db.close();}
            } else {
              const db = new DatabaseSync(file(input.device));
              try {
                if (input.command === 'write-failure') db.exec("CREATE TRIGGER fail_append BEFORE INSERT ON page_updates BEGIN SELECT RAISE(ABORT,'Injected SQLite write failure'); END");
                else if (input.command === 'structured-write-failure') db.exec("CREATE TRIGGER fail_structured_queue BEFORE INSERT ON sync_operations BEGIN SELECT RAISE(ABORT,'Injected structured queue failure'); END");
                else if (input.command === 'clear-structured-write-failure') db.exec('DROP TRIGGER fail_structured_queue');
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
  };
  return { name: 'greiva-test-sqlite-bridge', configureServer: configure, configurePreviewServer: configure };
}
