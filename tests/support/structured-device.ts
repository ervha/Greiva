import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { structuredSnapshotSchema, pushOperationSchema, type PushOperation, type PushResult, type PullResponse } from '@greiva/protocol';

// Docker-only JSON-lines bridge to the actual Rust repository, also used by Tauri.
export class StructuredDevice {
  private child: ChildProcessWithoutNullStreams | null = null;
  private sequence = 0;
  private pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  constructor(readonly path: string) {}
  private start() {
    const child = spawn(resolve('.data/native-target/debug/examples/store-driver'), [this.path], { stdio: ['pipe','pipe','pipe'] });
    this.child = child;
    let stderr = '';
    child.stderr.on('data', data => { stderr += String(data); });
    const lines = createInterface({ input: child.stdout });
    lines.on('line', line => {
      const reply = JSON.parse(line) as { id: number; value?: unknown; error?: string };
      const pending = this.pending.get(reply.id); this.pending.delete(reply.id);
      if (reply.error) pending?.reject(new Error(reply.error)); else pending?.resolve(reply.value);
    });
    const ended = (reason: string) => {
      if (this.child !== child) return;
      this.child = null; lines.close();
      for (const pending of this.pending.values()) pending.reject(new Error(`${reason}: ${stderr}`));
      this.pending.clear();
    };
    child.on('error', error => ended(error.message));
    child.on('exit', (code,signal) => ended(`Rust store exited ${code ?? signal}`));
    return child;
  }
  request(command: string, fields: Record<string,unknown> = {}): Promise<unknown> {
    const child = this.child ?? this.start(); const id = ++this.sequence;
    return new Promise((resolve,reject) => {
      this.pending.set(id,{ resolve,reject });
      child.stdin.write(`${JSON.stringify({ id,command,...fields })}\n`, error => {
        if (error) { this.pending.delete(id); reject(error); }
      });
    });
  }
  async snapshot() { return structuredSnapshotSchema.parse(await this.request('structured-snapshot')); }
  async mutate(operation: PushOperation) { await this.request('structured-mutate',{ operation }); }
  async prepare() {
    const wire = await this.request('structured-prepare');
    return wire === null ? null : pushOperationSchema.parse(wire);
  }
  async acknowledge(result: PushResult) { await this.request('structured-ack',{ result }); }
  async applyPull(baseCursor: string | null,batch: PullResponse) { await this.request('structured-pull',{ baseCursor,batch }); }
  async close(signal: NodeJS.Signals = 'SIGTERM') {
    const child = this.child; if (!child) return;
    await new Promise<void>(done => { child.once('exit', () => done()); child.kill(signal); });
  }
}
