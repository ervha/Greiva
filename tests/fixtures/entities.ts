import type { Page, Task, Relation, SyncOperation } from '@greiva/protocol';
export const ids = {
  page: '0199a000-0000-7000-8000-000000000001',
  task: '0199a000-0000-7000-8000-000000000002',
  relation: '0199a000-0000-7000-8000-000000000003',
  operation: '0199a000-0000-7000-8000-000000000004',
  client: '0199a000-0000-7000-8000-000000000005',
} as const;
const timestamp = '2026-09-30T00:00:00.000Z';
export const pageFixture: Page = { id: ids.page, title: '日本語ページ', yDocId: `page:${ids.page}`, createdAt: timestamp, updatedAt: timestamp };
export const taskFixture: Task = { id: ids.task, title: '検証タスク', status: 'todo', due: '2026-10-01', version: 1, createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
export const relationFixture: Relation = { id: ids.relation, fromType: 'page', fromId: ids.page, toType: 'task', toId: ids.task, version: 1, createdAt: timestamp, updatedAt: timestamp, deletedAt: null };
export const operationFixture: SyncOperation = { operationId: ids.operation, entityType: 'task', entityId: ids.task, kind: 'create', baseVersion: null, payload: { title: '検証タスク', status: 'todo', due: null }, clientId: ids.client, createdAt: timestamp, status: 'pending' };
