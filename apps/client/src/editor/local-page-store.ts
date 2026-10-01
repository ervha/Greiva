import { invoke, isTauri } from '@tauri-apps/api/core';
import { mergeUpdates } from 'yjs';
export type PageMetadata = { id: string; title: string; yDocId: string; createdAt: string; updatedAt: string };
export type StoredPage = { metadata: PageMetadata; updates: number[][] };
export interface LocalPageStore {
  list(): Promise<PageMetadata[]>;
  load(pageId: string): Promise<StoredPage>;
  append(pageId: string, update: Uint8Array): Promise<void>;
  setTitle(pageId: string, title: string): Promise<void>;
}
export function localPageStore(): LocalPageStore | null {
  if (isTauri()) return {
    list: () => invoke('page_list'),
    load: pageId => invoke('page_load', { pageId }),
    append: (pageId, update) => invoke('page_append', { pageId, update: Array.from(update) }),
    setTitle: (pageId, title) => invoke('page_set_title', { pageId, title }),
  };
  // Docker E2E transport to the actual Rust repository; no substitute SQLite implementation.
  if (import.meta.env.VITE_GREIVA_TEST_SQLITE === '1') {
    let device = localStorage.getItem('greiva-test-device');
    if (!device) { device = crypto.randomUUID(); localStorage.setItem('greiva-test-device', device); }
    const request = async <T>(command: string, fields: object): Promise<T> => {
      const response = await fetch('/__greiva_test_store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device, command, ...fields }) });
      const value = await response.json() as { value: T; error?: string };
      if (!response.ok || value.error) throw new Error(value.error ?? 'Test SQLite transport failed');
      return value.value;
    };
    return { list: () => request('list', {}), load: pageId => request('load', { pageId }), append: (pageId, update) => request('append', { pageId, update: Array.from(update) }), setTitle: (pageId, title) => request('title', { pageId, title }) };
  }
  return null;
}

// Each promise denotes a committed SQLite operation. Failed writes poison the
// boundary: subsequent writes and outgoing frames cannot silently pass it.
export class DurabilityBoundary {
  tail: Promise<void> = Promise.resolve();
  pending = 0;
  constructor(private report: (pending: number, error?: string) => void) {}
  enqueue(work: () => Promise<void>) {
    this.pending++;
    this.report(this.pending);
    this.tail = this.tail.then(work).then(() => { this.pending--; this.report(this.pending); });
    void this.tail.catch(error => this.report(this.pending, String(error)));
  }
}

// Coalesce only updates that are waiting for their turn; never delay the first
// write or merge across a metadata command. Every outgoing frame still waits
// for the boundary promise covering its updates.
export class PageWrites {
  private queued: { updates: Uint8Array[]; bytes: number } | null = null;
  constructor(private boundary: DurabilityBoundary, private store: LocalPageStore, private pageId: string) {}
  append(bytes: Uint8Array) {
    const copy = bytes.slice();
    if (this.queued && this.queued.bytes + copy.length <= 4 * 1024 * 1024) {
      this.queued.updates.push(copy); this.queued.bytes += copy.length; return;
    }
    const batch = { updates: [copy], bytes: copy.length }; this.queued = batch;
    this.boundary.enqueue(async () => {
      if (this.queued === batch) this.queued = null;
      await this.store.append(this.pageId, batch.updates.length === 1 ? batch.updates[0]! : mergeUpdates(batch.updates));
    });
  }
  setTitle(title: string) {
    this.queued = null;
    this.boundary.enqueue(() => this.store.setTitle(this.pageId, title));
  }
}
