import {
  pushOperationSchema,
  parseOperationPayload,
  type PushOperation,
  type StructuredSnapshot,
  taskSchema,
  relationSchema,
} from '@greiva/protocol';
import {workspaceStructuredSnapshotSchema} from '@greiva/protocol/workspace';
import {
  type NativeWorkspaceHandle,
  type NativeStructuredSendStatus,
  type NativeStructuredPullStatus,
  NativeSessionPortError,
} from '../auth/native-session-port.js';

export type NativeStructuredPort = {
  readonly handle: NativeWorkspaceHandle | null;
  executeFor(handle: NativeWorkspaceHandle, request: Record<string, unknown>): Promise<unknown>;
  sendStructuredFor?(handle: NativeWorkspaceHandle): Promise<NativeStructuredSendStatus>;
  pullStructuredFor?(handle: NativeWorkspaceHandle): Promise<NativeStructuredPullStatus>;
};

export class NativeStructuredError extends Error {
  constructor(readonly stage: 'closed' | 'busy' | 'protocol' | 'storage' | 'transport') {
    super(`Native structured ${stage}`);
    this.name = 'NativeStructuredError';
  }
}

export type NativeStructuredState = Readonly<{
  phase: 'opening' | 'ready' | 'closed';
  busy: boolean;
  data: StructuredSnapshot | null;
  error: 'protocol' | 'storage' | 'transport' | null;
  pending: number;
  conflicts: number;
  rejected: number;
  synced: boolean;
  hasMore: boolean;
  retryMutation: boolean;
}>;

export class NativeStructuredSession {
  #phase: NativeStructuredState['phase'] = 'opening';
  #busy = false;
  #data: StructuredSnapshot | null = null;
  #error: NativeStructuredState['error'] = null;
  #revision = 0;
  #confirmed: number | null = null;
  #uncertain: PushOperation | null = null;
  #tail: Promise<void> = Promise.resolve();
  #closeWork: Promise<void> | null = null;
  #listeners = new Set<(state: NativeStructuredState) => void>();

  private constructor(
    private readonly port: NativeStructuredPort,
    readonly bound: NativeWorkspaceHandle
  ) {}

  static async open(port: NativeStructuredPort): Promise<NativeStructuredSession> {
    const bound = port.handle;
    if (!bound) throw new NativeStructuredError('closed');
    const session = new NativeStructuredSession(port, bound);
    try {
      await session.#reload();
      session.#check();
      session.#phase = 'ready';
      session.#publish();
      return session;
    } catch (error) {
      const failure = session.#failure(error);
      await session.close();
      throw failure;
    }
  }

  get snapshot(): NativeStructuredState {
    const pending = this.#data?.operations.filter(op => op.status === 'pending').length ?? 0;
    const conflicts = this.#data?.conflicts.filter(cf => cf.status === 'open').length ?? 0;
    const rejected = Math.max(
      this.#data?.operations.filter(op => op.status === 'rejected').length ?? 0,
      this.#data?.errors.length ?? 0
    );
    const hasMore = Boolean(this.#data && this.#data.state.cursor !== this.#data.state.headCursor);
    return Object.freeze({
      phase: this.#phase,
      busy: this.#busy,
      data: this.#data,
      error: this.#error,
      pending,
      conflicts,
      rejected,
      hasMore,
      retryMutation: this.#uncertain !== null,
      synced:
        this.#phase === 'ready' &&
        !this.#busy &&
        !this.#error &&
        !this.#uncertain &&
        !pending &&
        !conflicts &&
        !rejected &&
        !hasMore &&
        this.#confirmed === this.#revision,
    });
  }

  subscribe(listener: (state: NativeStructuredState) => void) {
    this.#listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  #publish() {
    for (const listener of this.#listeners) {
      try {
        listener(this.snapshot);
      } catch {
        /* observer cannot interrupt */
      }
    }
  }

  #check() {
    if (this.#phase === 'closed' || this.port.handle !== this.bound) {
      if (this.#phase !== 'closed') {
        void this.close();
      }
      throw new NativeStructuredError('closed');
    }
  }

  #failure(error: unknown): NativeStructuredError {
    if (this.#phase === 'closed' || this.port.handle !== this.bound) {
      return new NativeStructuredError('closed');
    }
    if (error instanceof NativeStructuredError) return error;
    if (error instanceof NativeSessionPortError) {
      return new NativeStructuredError(error.stage === 'closed' ? 'closed' : 'protocol');
    }
    return new NativeStructuredError('storage');
  }

  async #reload() {
    const value = await this.port.executeFor(this.bound, { command: 'snapshot' });
    this.#check();
    try {
      const parsed = workspaceStructuredSnapshotSchema.parse(value);
      if (
        parsed.context.workspaceId !== this.bound.context.workspaceId ||
        parsed.snapshot.clientId !== this.bound.context.clientId
      ) {
        throw Error();
      }
      this.#data = Object.freeze(parsed.snapshot);
      this.#publish();
    } catch {
      throw new NativeStructuredError('protocol');
    }
  }

  #run(work: () => Promise<void>) {
    this.#check();
    if (this.#phase !== 'ready' || this.#busy) throw new NativeStructuredError('busy');
    this.#busy = true;
    this.#error = null;
    this.#confirmed = null;
    this.#publish();
    const result = (async () => {
      try {
        await work();
        this.#check();
      } catch (error) {
        const failure = this.#failure(error);
        if (failure.stage === 'closed') {
          void this.close();
        } else {
          this.#error = failure.stage === 'busy' ? 'protocol' : failure.stage;
          this.#publish();
        }
        throw failure;
      } finally {
        this.#busy = false;
        this.#publish();
      }
    })();
    this.#tail = result.catch(() => {});
    return result;
  }

  async mutate(candidate: unknown) {
    this.#check();
    if (this.#uncertain) throw new NativeStructuredError('busy');
    let operation: PushOperation;
    try {
      operation = pushOperationSchema.parse(JSON.parse(JSON.stringify(candidate)));
      parseOperationPayload(operation);
      if (operation.clientId !== this.bound.context.clientId) throw Error();
    } catch {
      throw new NativeStructuredError('protocol');
    }
    return this.#commit(operation);
  }

  #commit(operation: PushOperation) {
    return this.#run(async () => {
      this.#uncertain = operation;
      const value = await this.port.executeFor(this.bound, { command: 'mutate', operation });
      this.#check();
      try {
        if (operation.entityType === 'task') {
          const entity = taskSchema.parse(value);
          if (entity.id !== operation.entityId) throw Error();
        } else {
          const entity = relationSchema.parse(value);
          if (entity.id !== operation.entityId) throw Error();
        }
      } catch {
        throw new NativeStructuredError('protocol');
      }
      ++this.#revision;
      await this.#reload();
      this.#check();
      this.#uncertain = null;
      this.#publish();
    });
  }

  async retryMutation() {
    this.#check();
    if (!this.#uncertain) throw new NativeStructuredError('protocol');
    return this.#commit(this.#uncertain);
  }

  async sync() {
    this.#check();
    if (this.#uncertain) throw new NativeStructuredError('busy');
    return this.#run(async () => {
      const revision = this.#revision;
      await this.#reload();
      if (this.port.sendStructuredFor) {
        for (let n = 0; n < 32; n++) {
          const status = await this.port.sendStructuredFor(this.bound);
          this.#check();
          if (status !== 'acknowledged') {
            if (status === 'send_unknown' || status === 'ack_pending') {
              this.#error = 'transport';
            }
            break;
          }
        }
      }
      if (this.port.pullStructuredFor) {
        for (let n = 0; n < 32; n++) {
          const result = await this.port.pullStructuredFor(this.bound);
          this.#check();
          if (result.status !== 'received') {
            if (result.status === 'read_unknown' || result.status === 'store_pending') {
              this.#error = 'transport';
            }
            break;
          }
          if (!result.hasMore) break;
        }
      }
      await this.#reload();
      if (
        revision === this.#revision &&
        !this.snapshot.pending &&
        !this.snapshot.conflicts &&
        !this.snapshot.rejected &&
        !this.snapshot.hasMore &&
        !this.#error
      ) {
        this.#confirmed = revision;
      }
    });
  }

  async close(): Promise<void> {
    if (this.#closeWork) return this.#closeWork;
    this.#phase = 'closed';
    this.#busy = false;
    this.#data = null;
    this.#uncertain = null;
    this.#confirmed = null;
    this.#publish();
    this.#closeWork = this.#tail.then(() => {
      this.#listeners.clear();
    });
    return this.#closeWork;
  }
}
