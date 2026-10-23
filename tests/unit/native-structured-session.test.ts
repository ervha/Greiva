import {it,expect,vi} from 'vitest';
import {newId,utcNow} from '@greiva/shared';
import type {Task,Relation,PushOperation,StructuredSnapshot} from '@greiva/protocol';
import {
  NativeStructuredSession,
  NativeStructuredError,
  type NativeStructuredPort,
} from '../../apps/client/src/structured/native-structured-session.js';
import type {NativeWorkspaceHandle, NativeStructuredPullStatus} from '../../apps/client/src/auth/native-session-port.js';

const workspaceId = '01900000-0000-7000-8000-000000000001';
const clientId = '01900000-0000-7000-8000-000000000002';
const context = {
  issuer: 'https://fixture.invalid/auth/v1',
  subjectId: 'owner-A',
  workspaceId,
  clientId,
  streamEpoch: '01900000-0000-7000-8000-000000000003',
};
const handle: NativeWorkspaceHandle = {handle: 'handle-1', context};

function makeSnapshot(overrides?: Partial<StructuredSnapshot>): StructuredSnapshot {
  return {
    tasks: [],
    relations: [],
    operations: [],
    state: {
      stream: 'structured',
      cursor: null,
      headCursor: null,
      lastSuccessfulSyncAt: null,
    },
    clientId,
    conflicts: [],
    errors: [],
    ...overrides,
  };
}

function fixture(initialSnapshot = makeSnapshot()) {
  let currentHandle: NativeWorkspaceHandle | null = handle;
  let snapshot = JSON.parse(JSON.stringify(initialSnapshot)) as StructuredSnapshot;
  let failMutate = false;
  let mutateCount = 0;
  const sendStatuses: ('acknowledged' | 'idle' | 'send_unknown' | 'ack_pending')[] = [];
  const pullStatuses: NativeStructuredPullStatus[] = [];
  const calls: {command: string; args?: unknown}[] = [];

  const port: NativeStructuredPort = {
    get handle() {
      return currentHandle;
    },
    async executeFor(bound, request) {
      calls.push({command: 'executeFor', args: {bound, request}});
      if (bound !== currentHandle) throw Error('handle mismatch');
      const req = request as {command: string; operation?: PushOperation};
      if (req.command === 'snapshot') {
        return {context: bound.context, snapshot};
      }
      if (req.command === 'mutate') {
        mutateCount++;
        if (failMutate) throw Error('storage error');
        const op = req.operation!;
        const now = utcNow();
        if (op.entityType === 'task') {
          const payload = op.payload as {title: string; status: Task['status']; due: string | null};
          const existing = snapshot.tasks.find(t => t.id === op.entityId);
          let entity: Task;
          if (op.kind === 'create') {
            entity = {
              id: op.entityId,
              version: 1,
              title: payload.title,
              status: payload.status,
              due: payload.due,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
            };
            snapshot.tasks.push(entity);
          } else if (op.kind === 'update') {
            entity = {
              ...existing!,
              version: existing!.version + 1,
              ...payload,
              updatedAt: now,
            };
            snapshot.tasks = snapshot.tasks.map(t => t.id === entity.id ? entity : t);
          } else {
            entity = {
              ...existing!,
              version: existing!.version + 1,
              updatedAt: now,
              deletedAt: now,
            };
            snapshot.tasks = snapshot.tasks.map(t => t.id === entity.id ? entity : t);
          }
          snapshot.operations.push({
            ...op,
            createdAt: now,
            status: 'pending',
          });
          return entity;
        } else {
          const payload = op.payload as {fromType: 'task'|'page'; fromId: string; toType: 'task'|'page'; toId: string};
          const existing = snapshot.relations.find(r => r.id === op.entityId);
          let entity: Relation;
          if (op.kind === 'create') {
            entity = {
              id: op.entityId,
              version: 1,
              fromType: payload.fromType,
              fromId: payload.fromId,
              toType: payload.toType,
              toId: payload.toId,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
            };
            snapshot.relations.push(entity);
          } else if (op.kind === 'update') {
            entity = {
              ...existing!,
              version: existing!.version + 1,
              ...payload,
              updatedAt: now,
            };
            snapshot.relations = snapshot.relations.map(r => r.id === entity.id ? entity : r);
          } else {
            entity = {
              ...existing!,
              version: existing!.version + 1,
              updatedAt: now,
              deletedAt: now,
            };
            snapshot.relations = snapshot.relations.map(r => r.id === entity.id ? entity : r);
          }
          snapshot.operations.push({
            ...op,
            createdAt: now,
            status: 'pending',
          });
          return entity;
        }
      }
      throw Error(`unexpected command ${req.command}`);
    },
    async sendStructuredFor(bound) {
      calls.push({command: 'sendStructuredFor', args: {bound}});
      if (bound !== currentHandle) throw Error('handle mismatch');
      const next = sendStatuses.shift() ?? 'idle';
      if (next === 'acknowledged') {
        const pending = snapshot.operations.find(op => op.status === 'pending');
        if (pending) pending.status = 'acknowledged';
      }
      return next;
    },
    async pullStructuredFor(bound) {
      calls.push({command: 'pullStructuredFor', args: {bound}});
      if (bound !== currentHandle) throw Error('handle mismatch');
      const next = pullStatuses.shift() ?? {status: 'received', hasMore: false};
      return next;
    },
  };

  return {
    port,
    calls,
    get snapshot() {
      return snapshot;
    },
    set snapshot(s: StructuredSnapshot) {
      snapshot = s;
    },
    setHandle(h: NativeWorkspaceHandle | null) {
      currentHandle = h;
    },
    failMutate(v = true) {
      failMutate = v;
    },
    get mutateCount() {
      return mutateCount;
    },
    sendStatuses,
    pullStatuses,
  };
}

it('NATIVE-STRUCTURED: open loads snapshot and initializes session state and counts', async () => {
  const taskId = newId();
  const init = makeSnapshot({
    tasks: [{
      id: taskId,
      version: 1,
      title: 'Initial Task',
      status: 'todo',
      due: null,
      createdAt: utcNow(),
      updatedAt: utcNow(),
      deletedAt: null,
    }],
    state: {stream: 'structured', cursor: 'c1', headCursor: 'c2', lastSuccessfulSyncAt: null},
  });
  const f = fixture(init);
  const session = await NativeStructuredSession.open(f.port);

  expect(session.snapshot.phase).toBe('ready');
  expect(session.snapshot.busy).toBe(false);
  expect(session.snapshot.data?.tasks).toHaveLength(1);
  expect(session.snapshot.data?.tasks[0]?.title).toBe('Initial Task');
  expect(session.snapshot.hasMore).toBe(true);
  expect(session.snapshot.synced).toBe(false);
  expect(session.snapshot.error).toBeNull();
  expect(session.snapshot.retryMutation).toBe(false);

  await session.close();
  expect(session.snapshot.phase).toBe('closed');
});

it('NATIVE-STRUCTURED: open fails when port handle is missing or workspaceId mismatches', async () => {
  const f = fixture();
  f.setHandle(null);
  await expect(NativeStructuredSession.open(f.port)).rejects.toMatchObject({stage: 'closed'});

  const f2 = fixture();
  const badPort: NativeStructuredPort = {
    ...f2.port,
    async executeFor() {
      return {context: {...context, workspaceId: newId()}, snapshot: f2.snapshot};
    },
  };
  await expect(NativeStructuredSession.open(badPort)).rejects.toMatchObject({stage: 'protocol'});
});

it('NATIVE-STRUCTURED: mutate commits task creation and update, refreshing snapshot', async () => {
  const f = fixture();
  const session = await NativeStructuredSession.open(f.port);
  const taskId = newId();

  const op: PushOperation = {
    operationId: newId(),
    clientId,
    entityType: 'task',
    entityId: taskId,
    kind: 'create',
    baseVersion: null,
    payload: {title: 'New Native Task', status: 'in_progress', due: '2026-11-01'},
  };

  await session.mutate(op);
  expect(session.snapshot.data?.tasks).toHaveLength(1);
  expect(session.snapshot.data?.tasks[0]?.title).toBe('New Native Task');
  expect(session.snapshot.data?.tasks[0]?.status).toBe('in_progress');
  expect(session.snapshot.pending).toBe(1);

  const updateOp: PushOperation = {
    operationId: newId(),
    clientId,
    entityType: 'task',
    entityId: taskId,
    kind: 'update',
    baseVersion: 1,
    payload: {status: 'done'},
  };

  await session.mutate(updateOp);
  expect(session.snapshot.data?.tasks[0]?.status).toBe('done');
  expect(session.snapshot.pending).toBe(2);

  await session.close();
});

it('NATIVE-STRUCTURED: mutate commits relation creation and deletion', async () => {
  const f = fixture();
  const session = await NativeStructuredSession.open(f.port);
  const relId = newId();
  const fromId = newId();
  const toId = newId();

  const createRel: PushOperation = {
    operationId: newId(),
    clientId,
    entityType: 'relation',
    entityId: relId,
    kind: 'create',
    baseVersion: null,
    payload: {fromType: 'task', fromId, toType: 'page', toId},
  };

  await session.mutate(createRel);
  expect(session.snapshot.data?.relations).toHaveLength(1);
  expect(session.snapshot.data?.relations[0]?.fromType).toBe('task');
  expect(session.snapshot.data?.relations[0]?.toType).toBe('page');

  const deleteRel: PushOperation = {
    operationId: newId(),
    clientId,
    entityType: 'relation',
    entityId: relId,
    kind: 'delete',
    baseVersion: 1,
    payload: {},
  };

  await session.mutate(deleteRel);
  expect(session.snapshot.data?.relations[0]?.deletedAt).not.toBeNull();

  await session.close();
});

it('NATIVE-STRUCTURED: mutate rejects foreign clientId or malformed payload before sending', async () => {
  const f = fixture();
  const session = await NativeStructuredSession.open(f.port);

  const badClient: PushOperation = {
    operationId: newId(),
    clientId: newId(),
    entityType: 'task',
    entityId: newId(),
    kind: 'create',
    baseVersion: null,
    payload: {title: 'Foreign', status: 'todo', due: null},
  };

  await expect(session.mutate(badClient)).rejects.toMatchObject({stage: 'protocol'});
  expect(f.calls.filter(c => (c.args as {request?: {command?: string}} | undefined)?.request?.command === 'mutate')).toHaveLength(0);

  const badStatus = {
    operationId: newId(),
    clientId,
    entityType: 'task',
    entityId: newId(),
    kind: 'create',
    baseVersion: null,
    payload: {title: 'Bad Status', status: 'not_a_valid_status', due: null},
  };

  await expect(session.mutate(badStatus)).rejects.toMatchObject({stage: 'protocol'});
  await session.close();
});

it('NATIVE-STRUCTURED: storage failure in mutate sets retryMutation and retryMutation recovers', async () => {
  const f = fixture();
  const session = await NativeStructuredSession.open(f.port);
  const taskId = newId();

  const op: PushOperation = {
    operationId: newId(),
    clientId,
    entityType: 'task',
    entityId: taskId,
    kind: 'create',
    baseVersion: null,
    payload: {title: 'Uncertain Task', status: 'todo', due: null},
  };

  f.failMutate(true);
  await expect(session.mutate(op)).rejects.toMatchObject({stage: 'storage'});
  expect(session.snapshot.retryMutation).toBe(true);
  expect(session.snapshot.error).toBe('storage');

  f.failMutate(false);
  await session.retryMutation();
  expect(session.snapshot.retryMutation).toBe(false);
  expect(session.snapshot.error).toBeNull();
  expect(session.snapshot.data?.tasks).toHaveLength(1);
  expect(session.snapshot.data?.tasks[0]?.title).toBe('Uncertain Task');

  await session.close();
});

it('NATIVE-STRUCTURED: sync loops sendStructuredFor and pullStructuredFor and confirms synced state', async () => {
  const f = fixture();
  const session = await NativeStructuredSession.open(f.port);

  // Add 2 operations
  await session.mutate({
    operationId: newId(),
    clientId,
    entityType: 'task',
    entityId: newId(),
    kind: 'create',
    baseVersion: null,
    payload: {title: 'Task 1', status: 'todo', due: null},
  });
  await session.mutate({
    operationId: newId(),
    clientId,
    entityType: 'task',
    entityId: newId(),
    kind: 'create',
    baseVersion: null,
    payload: {title: 'Task 2', status: 'todo', due: null},
  });

  expect(session.snapshot.pending).toBe(2);

  f.sendStatuses.push('acknowledged', 'acknowledged', 'idle');
  f.pullStatuses.push({status: 'received', hasMore: true}, {status: 'received', hasMore: false});

  await session.sync();

  const sends = f.calls.filter(c => c.command === 'sendStructuredFor');
  const pulls = f.calls.filter(c => c.command === 'pullStructuredFor');
  expect(sends).toHaveLength(3);
  expect(pulls).toHaveLength(2);
  expect(session.snapshot.pending).toBe(0);
  expect(session.snapshot.synced).toBe(true);
  expect(session.snapshot.error).toBeNull();

  await session.close();
});

it('NATIVE-STRUCTURED: sync stops on transport errors and flags transport error', async () => {
  const f = fixture();
  const session = await NativeStructuredSession.open(f.port);

  await session.mutate({
    operationId: newId(),
    clientId,
    entityType: 'task',
    entityId: newId(),
    kind: 'create',
    baseVersion: null,
    payload: {title: 'Task Transport', status: 'todo', due: null},
  });

  f.sendStatuses.push('send_unknown');
  await session.sync();

  expect(session.snapshot.error).toBe('transport');
  expect(f.calls.filter(c => c.command === 'sendStructuredFor')).toHaveLength(1);

  await session.close();
});

it('NATIVE-STRUCTURED: handle revocation closes session and rejects subsequent actions', async () => {
  const f = fixture();
  const session = await NativeStructuredSession.open(f.port);

  f.setHandle(null);
  await expect(session.sync()).rejects.toMatchObject({stage: 'closed'});
  expect(session.snapshot.phase).toBe('closed');

  await expect(session.mutate({
    operationId: newId(),
    clientId,
    entityType: 'task',
    entityId: newId(),
    kind: 'create',
    baseVersion: null,
    payload: {title: 'Late', status: 'todo', due: null},
  })).rejects.toMatchObject({stage: 'closed'});
});
