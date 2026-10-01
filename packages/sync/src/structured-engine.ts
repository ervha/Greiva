import { pullResponseSchema, pushResponseSchema, type PullResponse, type PushOperation, type PushResult, type StructuredSnapshot } from '@greiva/protocol';

export interface StructuredStore {
  snapshot(): Promise<StructuredSnapshot>;
  mutate(operation: PushOperation): Promise<void>;
  prepare(): Promise<PushOperation | null>;
  acknowledge(result: PushResult): Promise<void>;
  applyPull(baseCursor: string | null,batch: PullResponse): Promise<void>;
}
export interface StructuredTransport {
  pull(cursor: string | null,signal: AbortSignal): Promise<PullResponse>;
  push(operation: PushOperation,signal: AbortSignal): Promise<PushResult>;
}
export type StructuredPhase = 'loading' | 'syncing' | 'synced' | 'offline' | 'retrying' | 'storage-error' | 'protocol-error' | 'permission-error' | 'conflict' | 'rejected';
export type StructuredReport = { phase: StructuredPhase; snapshot: StructuredSnapshot | null; error: string | null };
export class StructuredTransportError extends Error {
  constructor(readonly category: 'network'|'protocol'|'permission',message: string) { super(message); }
}
export function httpStructuredTransport(baseUrl = 'http://127.0.0.1:3000',request: typeof fetch = fetch): StructuredTransport {
  async function post(path: string,body: object,signal: AbortSignal) {
    try {
      const response = await request(`${baseUrl}/sync/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.any([signal,AbortSignal.timeout(15_000)])});
      if (!response.ok) throw new StructuredTransportError(response.status===401 || response.status===403 ? 'permission' : response.status>=500 ? 'network' : 'protocol',`Structured ${path}: HTTP ${response.status}`);
      try { return await response.json() as unknown; } catch { throw new StructuredTransportError('protocol','Invalid structured response JSON'); }
    } catch (error) {
      if (error instanceof StructuredTransportError) throw error;
      throw new StructuredTransportError('network',String(error));
    }
  }
  return {
    async pull(cursor,signal) {
      const value = pullResponseSchema.safeParse(await post('pull',{cursor,limit:100},signal));
      if (!value.success) throw new StructuredTransportError('protocol','Invalid structured pull response');
      const batch = value.data;
      if (batch.operations.length>100 || (batch.hasMore && (batch.operations.length===0 || batch.cursor===batch.headCursor)) ||
          (!batch.hasMore && batch.cursor!==batch.headCursor) || (batch.operations.length>0 && batch.cursor===cursor)) throw new StructuredTransportError('protocol','Invalid structured cursor progress');
      return batch;
    },
    async push(operation,signal) {
      const value = pushResponseSchema.safeParse(await post('push',{operations:[operation]},signal));
      const result = value.success && value.data.results.length===1 ? value.data.results[0] : undefined;
      if (!result || result.operationId!==operation.operationId || result.clientId!==operation.clientId || result.entityId!==operation.entityId || result.entityType!==operation.entityType) throw new StructuredTransportError('protocol','Structured ACK identity mismatch');
      return result;
    },
  };
}

// Network work is serialized. Every ACK and pull page commits in the store before
// the next request. Stopping never clears a queue, resets a cursor or fabricates ACKs.
export class StructuredSyncEngine {
  private active = false;
  private stopped = false;
  private paused: boolean;
  private running = false;
  private wakeRequested = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private controller: AbortController | undefined;
  private retryDelay = 1000;
  private report: StructuredReport = {phase:'loading',snapshot:null,error:null};
  constructor(private readonly store: StructuredStore,private readonly transport: StructuredTransport,
    private readonly onReport: (report: StructuredReport)=>void,options: {paused?: boolean; pollMs?: number} = {}) {
    this.paused = options.paused ?? false; this.pollMs = options.pollMs ?? 2000;
  }
  private readonly pollMs: number;
  private publish(phase: StructuredPhase,error: string | null = null) {
    this.report = {...this.report,phase,error}; if (this.active) this.onReport(this.report);
  }
  private async stored<T>(work: ()=>Promise<T>): Promise<T> {
    try { return await work(); } catch (error) { throw new Error(`Structured storage: ${String(error)}`); }
  }
  private async refresh() {
    const snapshot = await this.stored(()=>this.store.snapshot()); this.report = {...this.report,snapshot};
    if (this.report.phase==='synced' && (snapshot.operations.some(operation=>operation.status==='pending') || snapshot.errors.length>0 || snapshot.conflicts.some(conflict=>conflict.status==='open') || snapshot.state.cursor!==snapshot.state.headCursor)) {
      this.report = {...this.report,phase:this.paused ? 'offline' : 'syncing'};
    }
    if (this.active) this.onReport(this.report); return snapshot;
  }
  start() { if (this.stopped) throw new Error('Create a new engine after stop'); if (this.active) return; this.active = true; this.kick(); }
  stop() { this.stopped = true; this.active = false; clearTimeout(this.timer); this.controller?.abort(); }
  setPaused(paused: boolean) {
    this.paused = paused; clearTimeout(this.timer);
    if (paused) { this.controller?.abort(); this.publish('offline'); }
    else { this.retryDelay = 1000; this.kick(); }
  }
  retry() { this.retryDelay = 1000; this.kick(); }
  async localChanged() {
    // Preserve a terminal transport/storage error until explicit Retry; local
    // changes remain durable and do not silently restart a failed protocol.
    const terminal = ['storage-error','protocol-error','permission-error'].includes(this.report.phase);
    try { await this.refresh(); } catch (error) { this.publish('storage-error',String(error)); throw error; }
    if (this.paused) this.publish('offline'); else if (!terminal) { this.publish('syncing'); this.kick(); }
  }
  private kick() {
    if (!this.active) return; clearTimeout(this.timer);
    if (this.running) { this.wakeRequested = true; return; }
    void this.cycle();
  }
  private allowed() { return this.active && !this.paused; }
  private async pullAll(signal: AbortSignal) {
    while (this.allowed()) {
      const snapshot = await this.refresh(); if (!this.allowed()) return;
      const batch = await this.transport.pull(snapshot.state.cursor,signal); if (!this.allowed()) return;
      await this.stored(()=>this.store.applyPull(snapshot.state.cursor,batch)); await this.refresh();
      if (!batch.hasMore) return;
    }
  }
  private async cycle() {
    this.running = true; this.wakeRequested = false; this.controller = new AbortController();
    let nextDelay: number | null = null;
    try {
      await this.refresh();
      if (!this.allowed()) { if (this.active) this.publish('offline'); return; }
      this.publish('syncing'); const signal = this.controller.signal;
      await this.pullAll(signal);
      while (this.allowed()) {
        const operation = await this.stored(()=>this.store.prepare()); if (!operation || !this.allowed()) break;
        const result = await this.transport.push(operation,signal); if (!this.allowed()) return;
        await this.stored(()=>this.store.acknowledge(result)); await this.refresh();
      }
      if (!this.allowed()) return;
      await this.pullAll(signal); if (!this.allowed()) return;
      const snapshot = await this.refresh();
      const pending = snapshot.operations.some(operation=>operation.status==='pending');
      this.publish(snapshot.errors.length>0 ? 'rejected' : snapshot.conflicts.some(conflict=>conflict.status==='open') ? 'conflict' :
        !pending && snapshot.state.cursor!==null && snapshot.state.cursor===snapshot.state.headCursor ? 'synced' : 'syncing');
      this.retryDelay = 1000; nextDelay = this.pollMs;
    } catch (error) {
      if (!this.active) return;
      if (this.paused) { this.publish('offline'); return; }
      if (error instanceof StructuredTransportError) {
        this.publish(error.category==='network' ? 'retrying' : error.category==='permission' ? 'permission-error' : 'protocol-error',error.message);
        if (error.category==='network') { nextDelay = this.retryDelay; this.retryDelay = Math.min(this.retryDelay*2,10_000); }
      } else this.publish('storage-error',String(error));
    } finally {
      this.running = false; this.controller = undefined;
      if (this.active) {
        if (this.wakeRequested && !this.paused && !['storage-error','protocol-error','permission-error'].includes(this.report.phase)) this.kick();
        else if (nextDelay!==null && !this.paused) this.timer = setTimeout(()=>this.kick(),nextDelay);
      }
    }
  }
}
