import { idSchema } from '@greiva/shared';
import { parseOperationPayload, pushOperationSchema, type PushOperation } from '@greiva/protocol';
export type { TaskCreate, TaskUpdate, RelationCreate, RelationUpdate } from '@greiva/domain';

export type ActorContext = Readonly<{ subjectId: string; workspaceId: string; clientId: string }>;
export type StructuredMutation = Readonly<{ context: ActorContext; operation: PushOperation }>;
export interface MutationAuthorization {
  // The adapter verifies the session/resource policy. A client ID is not auth.
  canMutate(request: StructuredMutation): Promise<boolean>;
}
export interface DurableMutationStore {
  // Atomically commit entity + operation, idempotently by operation ID/content.
  // Resolve only after durable commit. The production adapter is a separate gate.
  commit(request: StructuredMutation): Promise<void>;
}
export class MutationAuthorizationError extends Error {
  constructor() { super('Structured mutation is not authorized'); this.name = 'MutationAuthorizationError'; }
}
export class MutationCommitError extends Error {
  readonly outcome = 'unknown';
  constructor(readonly operationId: string, cause: unknown) {
    super('Durable commit outcome is unknown; recover or retry the same operation ID and content', { cause });
    this.name = 'MutationCommitError';
  }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}

// Portable application boundary; not a JWT validator or an SQL implementation.
export async function commitStructuredMutation(
  ports: Readonly<{ authorization: MutationAuthorization; store: DurableMutationStore }>,
  actor: ActorContext, candidate: unknown,
): Promise<Readonly<{ state: 'durable'; operationId: string; workspaceId: string }>> {
  const { authorization, store } = ports;
  if (typeof actor.subjectId !== 'string' || !actor.subjectId.trim()) throw new Error('Missing authenticated subject');
  const context = { subjectId: actor.subjectId, workspaceId: idSchema.parse(actor.workspaceId), clientId: idSchema.parse(actor.clientId) };
  const parsed = pushOperationSchema.parse(candidate);
  if (parsed.clientId !== context.clientId) throw new Error('Mutation client identity mismatch');
  // Parsing the domain payload clones caller-owned intent before async auth.
  const operation = { ...parsed, payload: parseOperationPayload(parsed) };
  const request = freeze({ context, operation });
  if (!await authorization.canMutate(request)) throw new MutationAuthorizationError();
  try { await store.commit(request); }
  catch (cause) { throw new MutationCommitError(operation.operationId, cause); }
  return Object.freeze({ state: 'durable', operationId: operation.operationId, workspaceId: context.workspaceId });
}
