import { describe, it, expect, vi } from 'vitest';
import { newId } from '@greiva/shared';
import { taskCreateSchema, taskUpdateSchema } from '@greiva/domain';
import { commitStructuredMutation, MutationAuthorizationError, MutationCommitError, type StructuredMutation } from '@greiva/application';

function fixture() {
  const actor = { subjectId: 'verified-provider-subject', workspaceId: newId(), clientId: newId() };
  const operation = { operationId: newId(), clientId: actor.clientId, entityId: newId(), entityType: 'task', kind: 'create', baseVersion: null, payload: { title: '日本語のTask', status: 'todo', due: '2028-02-29' } };
  const authorization = { canMutate: vi.fn(async (_request: StructuredMutation) => true) };
  const store = { commit: vi.fn(async (_request: StructuredMutation) => {}) };
  return { actor, operation, authorization, store, run: () => commitStructuredMutation({ authorization, store }, actor, operation) };
}
describe('portable structured command boundary', () => {
  it('keeps date-only/domain intent without a timezone conversion or title normalization', () => {
    expect(taskCreateSchema.parse({ title: '  日本語  ', status: 'todo', due: '2028-02-29' })).toEqual({ title: '  日本語  ', status: 'todo', due: '2028-02-29' });
    for (const due of ['2027-02-29', '0000-01-01', '2028-02-29T00:00:00Z']) expect(taskCreateSchema.safeParse({ title: '', status: 'todo', due }).success).toBe(false);
    expect(taskUpdateSchema.safeParse({}).success).toBe(false);
  });
  it('rejects invalid payload, wire and client identity before auth or any write', async () => {
    for (const alter of [(f: ReturnType<typeof fixture>) => { f.operation.payload.due = '2027-02-29'; }, (f: ReturnType<typeof fixture>) => { f.operation.entityId = 'invalid'; }, (f: ReturnType<typeof fixture>) => { f.actor.clientId = newId(); }]) {
      const f = fixture(); alter(f); await expect(f.run()).rejects.toThrow();
      expect(f.authorization.canMutate).not.toHaveBeenCalled(); expect(f.store.commit).not.toHaveBeenCalled();
    }
  });
  it('does not persist a valid mutation when the resource policy denies it', async () => {
    const f = fixture(); f.authorization.canMutate.mockResolvedValue(false);
    await expect(f.run()).rejects.toBeInstanceOf(MutationAuthorizationError);
    expect(f.store.commit).not.toHaveBeenCalled();
    expect(f.authorization.canMutate.mock.calls[0]![0].context).toEqual(f.actor);
  });
  it('does not treat an unavailable authorization service as a grant', async () => {
    const f = fixture(), cause = Error('Auth unavailable'); f.authorization.canMutate.mockRejectedValue(cause);
    await expect(f.run()).rejects.toBe(cause); expect(f.store.commit).not.toHaveBeenCalled();
  });
  it('captures immutable account/workspace/intent before awaiting authorization', async () => {
    const f = fixture(), originalActor = { ...f.actor }, originalOperation = structuredClone(f.operation);
    let grant!: (value: boolean) => void; f.authorization.canMutate.mockImplementation(() => new Promise(resolve => { grant = resolve; }));
    const result = f.run(); f.actor.subjectId = 'other-account'; f.actor.workspaceId = newId(); f.operation.payload.title = 'changed'; grant(true);
    await result; const request = f.store.commit.mock.calls[0]![0];
    expect(request.context).toEqual(originalActor); expect(request.operation).toEqual(originalOperation);
    expect(Object.isFrozen(request)).toBe(true); expect(Object.isFrozen(request.operation.payload)).toBe(true);
  });
  it('reports durable only after the store atomic-commit promise resolves', async () => {
    const f = fixture(); let release!: () => void, complete = false;
    f.store.commit.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
    const result = f.run().then(value => { complete = true; return value; });
    await vi.waitFor(() => expect(f.store.commit).toHaveBeenCalledOnce()); expect(complete).toBe(false);
    release(); await expect(result).resolves.toEqual({ state: 'durable', operationId: f.operation.operationId, workspaceId: f.actor.workspaceId });
  });
  it('keeps the bound store when caller replaces ports during authorization', async () => {
    const f = fixture(), ports = { authorization: f.authorization, store: f.store };
    let grant!: (value: boolean) => void;
    f.authorization.canMutate.mockImplementation(() => new Promise(resolve => { grant = resolve; }));
    const result = commitStructuredMutation(ports, f.actor, f.operation);
    const replacement = { commit: vi.fn(async (_request: StructuredMutation) => {}) };
    ports.store = replacement; grant(true); await result;
    expect(f.store.commit).toHaveBeenCalledOnce(); expect(replacement.commit).not.toHaveBeenCalled();
  });
  it('keeps the operation ID on ambiguous commit and allows the same-content retry', async () => {
    const f = fixture(), stored = new Map<string, string>(); let first = true;
    f.store.commit.mockImplementation(async request => {
      const text = JSON.stringify(request), existing = stored.get(request.operation.operationId);
      if (existing !== undefined) expect(existing).toBe(text); else stored.set(request.operation.operationId, text);
      if (first) { first = false; throw Error('Commit completed but adapter response lost'); }
    });
    const failure = await f.run().catch(error => error as MutationCommitError);
    expect(failure).toBeInstanceOf(MutationCommitError);
    if (!(failure instanceof MutationCommitError)) throw Error('Expected an ambiguous commit failure');
    expect(failure.outcome).toBe('unknown'); expect(failure.operationId).toBe(f.operation.operationId);
    await expect(f.run()).resolves.toMatchObject({ state: 'durable', operationId: f.operation.operationId }); expect(stored.size).toBe(1);
  });
  it('preserves Relation and Conflict-resolution wire fields without rewriting them', async () => {
    const f = fixture(); const operation = { ...f.operation, entityType: 'relation', kind: 'update', baseVersion: 3,
      predecessorOperationId: newId(), payload: { toId: newId() }, resolution: { conflictIds: [newId()], choice: 'local' } };
    await commitStructuredMutation(f, f.actor, operation);
    expect(f.store.commit.mock.calls[0]![0].operation).toEqual(operation);
  });
});
