import { describe, it, expect } from 'vitest';
import { newId, utcNow } from '@greiva/shared';
import { parseOperationPayload } from '@greiva/protocol';
import { workspacePushRequestSchema, workspacePullRequestSchema, verifyWorkspacePushResponse, verifyWorkspacePullResponse, structuredOrderSchema, WorkspaceSyncContextMismatch } from '@greiva/protocol/workspace';
import { workspaceCursor, InvalidWorkspaceCursor } from '../../apps/api/src/workspace-cursor.js';
import { createHmac } from 'node:crypto';

function fixture() {
  const workspaceId = newId(), clientId = newId(), streamEpoch = newId(), now = utcNow();
  const operation = { operationId: newId(), clientId, entityId: newId(), entityType: 'task' as const, kind: 'create' as const, baseVersion: null, payload: { title: 'offline 日本語', status: 'todo', due: null } };
  const request = { protocolVersion: 1, workspaceId, clientId, operations: [operation] };
  const result = { operationId: operation.operationId, clientId, entityType: 'task', entityId: operation.entityId, serverOrder: '1', status: 'acknowledged', conflicts: [],
    entity: { id: operation.entityId, ...operation.payload, version: 1, createdAt: now, updatedAt: now, deletedAt: null } };
  const push = { protocolVersion: 1, workspaceId, streamEpoch, results: [result] };
  const pull = { protocolVersion: 1, workspaceId, streamEpoch, operations: [result], cursor: 'opaque-current', headCursor: 'opaque-head', hasMore: true, serverTime: now };
  return { workspaceId, clientId, streamEpoch, request, push, pull };
}
describe('versioned workspace sync wire', () => {
  it('preserves operation ID/content/causality and opaque cursors in explicit scope', () => {
    const f = fixture(), predecessorOperationId = newId();
    const request = { ...f.request, operations: [{ ...f.request.operations[0], predecessorOperationId }] };
    expect(workspacePushRequestSchema.parse(request)).toEqual(request);
    expect(workspacePullRequestSchema.parse({ protocolVersion: 1, workspaceId: f.workspaceId, clientId: f.clientId, cursor: null })).toMatchObject({ cursor: null, limit: 100 });
    expect(verifyWorkspacePushResponse(f.request, f.streamEpoch, f.push)).toEqual(f.push);
    expect(verifyWorkspacePullResponse(f, f.pull)).toEqual(f.pull);
  });
  it('rejects missing/unknown protocol, invalid workspace, claimed subject and mixed client batch', () => {
    const f = fixture();
    for (const request of [{ ...f.request, protocolVersion: 2 }, { ...f.request, protocolVersion: undefined }, { ...f.request, workspaceId: 'invalid' }, { ...f.request, subjectId: 'claimed-owner' }, { ...f.request, clientId: newId() }]) expect(workspacePushRequestSchema.safeParse(request).success).toBe(false);
  });
  it('rejects duplicate operation IDs within one batch', () => {
    const f = fixture(); expect(workspacePushRequestSchema.safeParse({ ...f.request, operations: [...f.request.operations, ...f.request.operations] }).success).toBe(false);
  });
  it('keeps invalid intent as a permanently rejectable operation envelope', () => {
    const f = fixture(), request = { ...f.request, operations: [{ ...f.request.operations[0], payload: { title: 'keep intent', status: 'unsupported', due: null } }] };
    const parsed = workspacePushRequestSchema.parse(request); expect(() => parseOperationPayload(parsed.operations[0]!)).toThrow();
    const response = { ...f.push, results: [{ ...f.push.results[0], status: 'rejected', entity: null, error: { code: 'invalid_payload', message: 'Invalid intent', retryable: false } }] };
    expect(verifyWorkspacePushResponse(request, f.streamEpoch, response)).toEqual(response);
  });
  it('refuses cross-workspace, changed epoch and unknown protocol responses', () => {
    const f = fixture();
    for (const alter of [{ workspaceId: newId() }, { streamEpoch: newId() }, { protocolVersion: 2 }]) {
      expect(() => verifyWorkspacePullResponse(f, { ...f.pull, ...alter })).toThrow();
      expect(() => verifyWorkspacePushResponse(f.request, f.streamEpoch, { ...f.push, ...alter })).toThrow();
    }
  });
  it('refuses missing, duplicated, unrelated or misidentified ACKs before applying them', () => {
    const f = fixture(), result = f.push.results[0]!;
    for (const results of [[], [result, result], [{ ...result, operationId: newId() }], [{ ...result, clientId: newId() }]]) {
      expect(() => verifyWorkspacePushResponse(f.request, f.streamEpoch, { ...f.push, results })).toThrow(WorkspaceSyncContextMismatch);
    }
    const id = newId(); expect(() => verifyWorkspacePushResponse(f.request, f.streamEpoch, { ...f.push, results: [{ ...result, entityId: id, entity: { ...result.entity, id } }] })).toThrow(WorkspaceSyncContextMismatch);
  });
  it('matches ACK identity independent of response order without replacing original wire', () => {
    const f = fixture(), operation = { ...f.request.operations[0]!, operationId: newId(), entityId: newId() };
    const request = { ...f.request, operations: [...f.request.operations, operation] };
    const result = { ...f.push.results[0]!, operationId: operation.operationId, entityId: operation.entityId, serverOrder: '2', entity: { ...f.push.results[0]!.entity, id: operation.entityId } };
    const response = { ...f.push, results: [result, ...f.push.results] };
    expect(verifyWorkspacePushResponse(request, f.streamEpoch, response)).toEqual(response); expect(request.operations[1]).toEqual(operation);
  });
  it('validates the exact bigint range and rejects malformed order without a numeric conversion', () => {
    for (const value of ['0', '9007199254740993', '9223372036854775807']) expect(structuredOrderSchema.parse(value)).toBe(value);
    for (const value of ['01', '-1', '1.5', '1e3', 'NaN', '', '9223372036854775808', '9'.repeat(1000), 1]) expect(structuredOrderSchema.safeParse(value).success).toBe(false);
    const f = fixture();
    expect(() => verifyWorkspacePushResponse(f.request, f.streamEpoch, { ...f.push, results: [{ ...f.push.results[0], serverOrder: '9223372036854775808' }] })).toThrow();
    expect(() => verifyWorkspacePullResponse(f, { ...f.pull, operations: [{ ...f.pull.operations[0], serverOrder: '9223372036854775808' }] })).toThrow();
  });
});
describe('server workspace cursor integrity', () => {
  const maximum = '9223372036854775807';
  it('roundtrips zero and orders beyond Number precision exactly', () => {
    const f = fixture(), cursor = workspaceCursor(f.workspaceId, f.streamEpoch, new Uint8Array(32).fill(31));
    expect(cursor.decode(null, maximum)).toBe(0n);
    for (const value of ['0', '9007199254740993', maximum]) expect(cursor.decode(cursor.encode(value), maximum)).toBe(BigInt(value));
  });
  it('rejects another workspace with the same epoch/key', () => {
    const f = fixture(), key = new Uint8Array(32).fill(32), a = workspaceCursor(f.workspaceId, f.streamEpoch, key), b = workspaceCursor(newId(), f.streamEpoch, key);
    expect(() => b.decode(a.encode('1'), '1')).toThrow(InvalidWorkspaceCursor);
  });
  it('rejects an old epoch instead of resetting or advancing its cursor', () => {
    const f = fixture(), key = new Uint8Array(32).fill(33), old = workspaceCursor(f.workspaceId, f.streamEpoch, key), current = workspaceCursor(f.workspaceId, newId(), key);
    expect(() => current.decode(old.encode('1'), '1')).toThrow(InvalidWorkspaceCursor);
  });
  it('captures the key and rejects other keys or changed signatures', () => {
    const f = fixture(), key = new Uint8Array(32).fill(34), original = workspaceCursor(f.workspaceId, f.streamEpoch, key), token = original.encode('1'); key.fill(35);
    expect(original.decode(token, '1')).toBe(1n);
    expect(() => workspaceCursor(f.workspaceId, f.streamEpoch, key).decode(token, '1')).toThrow(InvalidWorkspaceCursor);
    const changed = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'); expect(() => original.decode(changed, '1')).toThrow(InvalidWorkspaceCursor);
  });
  it('rejects future positions even with an authentic signature', () => {
    const f = fixture(), cursor = workspaceCursor(f.workspaceId, f.streamEpoch, new Uint8Array(32).fill(36));
    expect(() => cursor.decode(cursor.encode('10'), '9')).toThrow(InvalidWorkspaceCursor);
  });
  it('rejects malformed, truncated, oversized and noncanonical encodings', () => {
    const f = fixture(), cursor = workspaceCursor(f.workspaceId, f.streamEpoch, new Uint8Array(32).fill(37)), token = cursor.encode('1'), parts = token.split('.');
    for (const value of ['', 'g1.legacy', token + '.extra', token.slice(0, -5), `${parts[0]}.${parts[1]}=.${parts[2]}`, `gw1.${'a'.repeat(1025)}.${parts[2]}`, 12, undefined]) expect(() => cursor.decode(value, '1')).toThrow(InvalidWorkspaceCursor);
  });
  it('rejects signed wrong-stream/version/shape and invalid order content', () => {
    const f = fixture(), key = new Uint8Array(32).fill(38), cursor = workspaceCursor(f.workspaceId, f.streamEpoch, key);
    for (const value of [[f.workspaceId, 'pages', f.streamEpoch, '1'], [f.workspaceId, 'structured', f.streamEpoch, '01'], [f.workspaceId, 'structured', f.streamEpoch, 1], [f.workspaceId, 'structured', f.streamEpoch, '1', 'extra'], {}]) {
      const content = Buffer.from(JSON.stringify(value)).toString('base64url'), signature = createHmac('sha256', key).update(`gw1.${content}`).digest('base64url');
      expect(() => cursor.decode(`gw1.${content}.${signature}`, '1')).toThrow(InvalidWorkspaceCursor);
    }
  });
  it('requires explicit valid scope/key/head and never creates a live default secret', () => {
    const f = fixture(); expect(() => workspaceCursor(f.workspaceId, f.streamEpoch, new Uint8Array(31))).toThrow();
    expect(() => workspaceCursor('invalid', f.streamEpoch, new Uint8Array(32))).toThrow();
    const cursor = workspaceCursor(f.workspaceId, f.streamEpoch, new Uint8Array(32));
    expect(() => cursor.encode('01')).toThrow(); expect(() => cursor.decode(null, '-1')).toThrow();
  });
});
