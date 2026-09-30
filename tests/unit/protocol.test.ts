import { describe, it, expect } from 'vitest';
import { pageSchema, taskSchema, relationSchema, syncOperationSchema, syncStateSchema, pushOperationSchema, pullRequestSchema } from '@greiva/protocol';
import { pageFixture, taskFixture, relationFixture, operationFixture } from '../fixtures/entities.js';

describe('STEP1-PROTOCOL: Section 4 shared model validation', () => {
  it('accepts the minimal Page, Task, Relation and operation fixtures', () => {
    expect(pageSchema.parse(pageFixture)).toEqual(pageFixture);
    expect(taskSchema.parse(taskFixture)).toEqual(taskFixture);
    expect(relationSchema.parse(relationFixture)).toEqual(relationFixture);
    expect(syncOperationSchema.parse(operationFixture)).toEqual(operationFixture);
  });
  it('requires page:{pageId} document names and rejects body duplication', () => {
    expect(pageSchema.safeParse({ ...pageFixture, yDocId: 'other' }).success).toBe(false);
    expect(pageSchema.safeParse({ ...pageFixture, body: [] }).success).toBe(false);
  });
  it.each(['2026-02-30', '2026-10-01T00:00:00Z', '2026-1-1'])('rejects invalid due date %s', due => {
    expect(taskSchema.safeParse({ ...taskFixture, due }).success).toBe(false);
  });
  it('accepts leap day and null due, and preserves tombstones', () => {
    expect(taskSchema.safeParse({ ...taskFixture, due: '2028-02-29' }).success).toBe(true);
    expect(taskSchema.parse({ ...taskFixture, due: null, deletedAt: taskFixture.updatedAt }).deletedAt).toBe(taskFixture.updatedAt);
  });
  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid server version %s', version => {
    expect(taskSchema.safeParse({ ...taskFixture, version }).success).toBe(false);
  });
  it('requires UTC timestamps and v7 IDs', () => {
    expect(taskSchema.safeParse({ ...taskFixture, updatedAt: '2026-09-30T09:00:00+09:00' }).success).toBe(false);
    expect(taskSchema.safeParse({ ...taskFixture, id: 'not-an-id' }).success).toBe(false);
  });
  it('excludes Page and local status/timestamps from structured push', () => {
    const { status: _status, createdAt: _createdAt, ...wire } = operationFixture;
    expect(pushOperationSchema.parse(wire)).toEqual(wire);
    expect(pushOperationSchema.safeParse({ ...wire, entityType: 'page' }).success).toBe(false);
    expect(pushOperationSchema.safeParse(operationFixture).success).toBe(false);
  });
  it('treats cursor as opaque and initializes the structured stream without a cursor', () => {
    expect(pullRequestSchema.parse({ cursor: 'opaque:server/42' }).cursor).toBe('opaque:server/42');
    expect(pullRequestSchema.safeParse({ cursor: 42 }).success).toBe(false);
    expect(syncStateSchema.parse({ stream: 'structured', cursor: null, lastSuccessfulSyncAt: null }).cursor).toBeNull();
  });
});
