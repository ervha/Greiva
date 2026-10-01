import { it, expect } from 'vitest';
import { DurabilityBoundary } from '../../apps/client/src/editor/local-page-store.js';
import * as Y from 'yjs';
import { emptyPageUpdate } from '@greiva/sync';
it('STEP5-BARRIER: waits for each commit in order and stops after a write failure', async () => {
  const reports: Array<[number, string | undefined]> = [];
  const boundary = new DurabilityBoundary((pending, error) => reports.push([pending, error]));
  let release!: () => void;
  const first = new Promise<void>(done => { release = done; });
  let next = false;
  boundary.enqueue(() => first);
  boundary.enqueue(async () => { next = true; throw new Error('disk full'); });
  let unsafeWrite = false;
  boundary.enqueue(async () => { unsafeWrite = true; });
  await Promise.resolve(); expect(next).toBe(false); expect(boundary.pending).toBe(3);
  release(); await expect(boundary.tail).rejects.toThrow('disk full');
  expect(next).toBe(true); expect(unsafeWrite).toBe(false); expect(boundary.pending).toBe(2);
  expect(reports.some(([, error]) => error?.includes('disk full'))).toBe(true);
});
it('STEP5-BOOTSTRAP: offline and server seeds merge as exactly one empty paragraph', () => {
  const a = new Y.Doc(); const b = new Y.Doc();
  Y.applyUpdate(a, emptyPageUpdate()); Y.applyUpdate(b, emptyPageUpdate());
  Y.applyUpdate(a, Y.encodeStateAsUpdate(b)); Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  expect(a.getXmlFragment('body').length).toBe(1);
  expect(Array.from(Y.encodeStateVector(a))).toEqual(Array.from(Y.encodeStateVector(b)));
  a.destroy(); b.destroy();
});
