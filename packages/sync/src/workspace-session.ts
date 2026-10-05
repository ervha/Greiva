import { idSchema } from '@greiva/shared';
import { workspacePushRequestSchema, workspacePullRequestSchema, verifyWorkspacePushResponse, verifyWorkspacePullResponse, type WorkspacePushRequest, type WorkspacePullResponse } from '@greiva/protocol/workspace';

export type WorkspaceSyncContext = Readonly<{ issuer: string; subjectId: string; workspaceId: string; clientId: string; streamEpoch: string }>;
type PullRequest = ReturnType<typeof workspacePullRequestSchema.parse>;
type PushResponse = ReturnType<typeof verifyWorkspacePushResponse>;
export interface WorkspaceSessionTransport {
  push(preparedWire: string, signal: AbortSignal): Promise<unknown>;
  pull(request: PullRequest, signal: AbortSignal): Promise<unknown>;
}
export interface WorkspaceSessionStore {
  // Implementations bind to this exact account/workspace/epoch store. Commit
  // receipt/pending or pull/cursor atomically. Never resolve a current UI store
  // after an await. Native durable implementations remain a separate gate.
  acknowledge(context: WorkspaceSyncContext, prepared: WorkspacePushRequest, response: PushResponse, preparedWire: string): Promise<void>;
  applyPull(context: WorkspaceSyncContext, request: PullRequest, response: WorkspacePullResponse): Promise<void>;
}
export class WorkspaceSessionError extends Error {
  constructor(readonly stage: 'closed' | 'busy' | 'protocol' | 'transport' | 'storage') {
    super(`Workspace sync ${stage}`); this.name = 'WorkspaceSessionError';
  }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}
function protocol<T>(work: () => T): T {
  try { return work(); } catch { throw new WorkspaceSessionError('protocol'); }
}

// A session is never reopened. Account/workspace/epoch switch closes it and
// creates another, even when switching back to the same IDs (no ABA revival).
export class WorkspaceSyncSession {
  readonly context: WorkspaceSyncContext;
  private readonly controller = new AbortController();
  private closed = false;
  private busy = false;
  private readonly pushTransport: WorkspaceSessionTransport['push'];
  private readonly pullTransport: WorkspaceSessionTransport['pull'];
  private readonly acknowledge: WorkspaceSessionStore['acknowledge'];
  private readonly applyPull: WorkspaceSessionStore['applyPull'];
  constructor(context: WorkspaceSyncContext, ports: { transport: WorkspaceSessionTransport; store: WorkspaceSessionStore }) {
    this.context = protocol(() => {
      if (typeof context.issuer !== 'string' || !context.issuer.trim() || typeof context.subjectId !== 'string' || !context.subjectId.trim()) throw new Error();
      return Object.freeze({ issuer: context.issuer, subjectId: context.subjectId, workspaceId: idSchema.parse(context.workspaceId), clientId: idSchema.parse(context.clientId), streamEpoch: idSchema.parse(context.streamEpoch) });
    });
    this.pushTransport = ports.transport.push.bind(ports.transport); this.pullTransport = ports.transport.pull.bind(ports.transport);
    this.acknowledge = ports.store.acknowledge.bind(ports.store); this.applyPull = ports.store.applyPull.bind(ports.store);
  }
  close() { this.closed = true; this.controller.abort(); }
  private check() { if (this.closed) throw new WorkspaceSessionError('closed'); }
  private async run(work: () => Promise<void>) {
    this.check(); if (this.busy) throw new WorkspaceSessionError('busy'); this.busy = true;
    try { await work(); this.check(); } finally { this.busy = false; }
  }
  private async transport(work: () => Promise<unknown>) {
    try { const value = await work(); this.check(); return value; }
    catch { this.check(); throw new WorkspaceSessionError('transport'); }
  }
  private async stored(work: () => Promise<void>) {
    // Synchronous check + invocation; a store commit already begun can finish
    // after close only in the captured old store. No rollback claim is made.
    this.check(); try { await work(); } catch { this.check(); throw new WorkspaceSessionError('storage'); }
  }
  async push(preparedWire: string) {
    await this.run(async () => {
      const request = protocol(() => {
        if (typeof preparedWire !== 'string') throw new Error();
        const value = workspacePushRequestSchema.parse(JSON.parse(preparedWire));
        if (value.workspaceId !== this.context.workspaceId || value.clientId !== this.context.clientId) throw new Error();
        return freeze(value);
      });
      const candidate = await this.transport(() => this.pushTransport(preparedWire, this.controller.signal));
      const response = protocol(() => freeze(verifyWorkspacePushResponse(request, this.context.streamEpoch, JSON.parse(JSON.stringify(candidate)))));
      await this.stored(() => this.acknowledge(this.context, request, response, preparedWire));
    });
  }
  async pull(candidateRequest: unknown) {
    await this.run(async () => {
      const request = protocol(() => {
        const value = workspacePullRequestSchema.parse(candidateRequest);
        if (value.workspaceId !== this.context.workspaceId || value.clientId !== this.context.clientId) throw new Error();
        return freeze(value);
      });
      const candidate = await this.transport(() => this.pullTransport(request, this.controller.signal));
      const response = protocol(() => {
        const value = verifyWorkspacePullResponse(this.context, JSON.parse(JSON.stringify(candidate)));
        if (value.operations.length > request.limit || (value.hasMore && (!value.operations.length || value.cursor === value.headCursor))
          || (!value.hasMore && value.cursor !== value.headCursor) || (value.operations.length && value.cursor === request.cursor)
          || new Set(value.operations.map(op => op.operationId)).size !== value.operations.length) throw new Error();
        let previous = 0n; for (const operation of value.operations) { const order = BigInt(operation.serverOrder); if (order <= previous) throw new Error(); previous = order; }
        return freeze(value);
      });
      await this.stored(() => this.applyPull(this.context, request, response));
    });
  }
}
