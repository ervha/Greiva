import { it, expect } from 'vitest';
import * as Y from 'yjs';
import { PrivatePageEditorSession } from '../../apps/client/src/editor/private-page-session.js';
import { privateEditorFixture } from '../support/private-page-editor-fixture.js';
import { PrivateWorkspaceConnection } from '@greiva/sync';
const deferred = () => { let resolve!: () => void; const promise = new Promise<void>(yes => { resolve = yes; }); return { promise, resolve }; };

it('PRIVATE-EDITOR: restore never creates missing/corrupt data; explicit create queues before publishing and sends only after local commit', async () => {
  const f = await privateEditorFixture(); try {
    await expect(PrivatePageEditorSession.open(f.connection, f.store, f.pageId, { kind: 'local' })).rejects.toMatchObject({ stage: 'storage' });
    expect(f.state.updates).toHaveLength(0);
    const session = await PrivatePageEditorSession.open(f.connection, f.store, f.pageId, { kind: 'create', title: '日本語' });
    expect(session.snapshot).toMatchObject({ phase: 'ready', title: '日本語', pending: 1, synced: false });
    f.edit(session.document, 'local'); expect(session.snapshot).toMatchObject({ saving: 2, synced: false });
    await session.sync(); expect(session.snapshot).toMatchObject({ pending: 0, saving: 0, synced: true });
    expect(f.state.events.indexOf('send')).toBeGreaterThan(f.state.events.lastIndexOf('local-commit'));
    expect(f.server.getXmlFragment('body').toString()).toContain('local'); await session.close();
  } finally { await f.cleanup(); }
});
it('PRIVATE-EDITOR: lost ACK retries exact durable wire without duplicate server clock; transport error never claims synced', async () => {
  const f = await privateEditorFixture(); try {
    const session = await PrivatePageEditorSession.open(f.connection, f.store, f.pageId, { kind: 'create', title: '日本語' });
    f.state.loseAck = true; await expect(session.sync()).rejects.toMatchObject({ stage: 'transport' });
    expect(session.snapshot).toMatchObject({ pending: 1, synced: false, syncError: 'transport' });
    const vector = Y.encodeStateVector(f.server); await session.sync(); expect(f.state.wires[1]).toBe(f.state.wires[0]);
    expect(Y.encodeStateVector(f.server)).toEqual(vector); expect(session.snapshot.synced).toBe(true); await session.close();
  } finally { await f.cleanup(); }
});
it('PRIVATE-EDITOR: remote download commits before live apply and does not echo remote bytes into pending', async () => {
  const f = await privateEditorFixture(); try {
    f.edit(f.server, 'peer'); const session = await PrivatePageEditorSession.open(f.connection, f.store, f.pageId, { kind: 'remote' });
    expect(session.document.getXmlFragment('body').toString()).toContain('peer'); expect(session.snapshot.pending).toBe(0);
    session.document.on('update', () => f.state.events.push('live-apply')); f.edit(f.server, 'new '); await session.sync();
    expect(f.state.events.indexOf('live-apply')).toBeGreaterThan(f.state.events.lastIndexOf('remote-commit'));
    expect(f.state.queue).toHaveLength(0); expect(session.snapshot.synced).toBe(true); await session.close();
  } finally { await f.cleanup(); }
});
it('PRIVATE-EDITOR: composition defers committed remote bytes, merges local edits and reports synced only after application', async () => {
  const f = await privateEditorFixture(); try {
    const session = await PrivatePageEditorSession.open(f.connection, f.store, f.pageId, { kind: 'remote' });
    session.setComposing(true); f.edit(f.server, 'peer'); await session.sync();
    expect(session.document.getXmlFragment('body').toString()).not.toContain('peer');
    expect(session.snapshot).toMatchObject({ remoteWaiting: true, synced: false });
    f.edit(session.document, 'local'); await session.durable(); session.setComposing(false);
    expect(session.document.getXmlFragment('body').toString()).toContain('peer'); expect(session.document.getXmlFragment('body').toString()).toContain('local');
    expect(session.snapshot.synced).toBe(false); await session.sync(); expect(session.snapshot.synced).toBe(true); await session.close();
  } finally { await f.cleanup(); }
});
it('PRIVATE-EDITOR: refresh during admitted remote commit never applies a late response to the old Doc', async () => {
  const f = await privateEditorFixture(), wait = deferred(), entered = deferred(); try {
    const session = await PrivatePageEditorSession.open(f.connection, f.store, f.pageId, { kind: 'remote' });
    let applied = 0; session.document.on('update', () => { ++applied; }); f.edit(f.server, 'late');
    f.state.nativeHook = async request => { if (request.command === 'page_receive') { entered.resolve(); await wait.promise; } };
    const work = session.sync(); await entered.promise; await f.auth.refresh(); wait.resolve();
    await expect(work).rejects.toMatchObject({ stage: 'closed' }); expect(applied).toBe(0); expect(session.snapshot.phase).toBe('closed');
    await f.connection.bootstrap(); await expect(session.sync()).rejects.toMatchObject({ stage: 'closed' }); await session.close();
  } finally { wait.resolve(); await f.cleanup(); }
});
it('PRIVATE-EDITOR: Page close drains admitted local writes into the captured Page; reopen restores unsent bytes', async () => {
  const f = await privateEditorFixture(), wait = deferred(), entered = deferred(); try {
    const session = await PrivatePageEditorSession.open(f.connection, f.store, f.pageId, { kind: 'create', title: '日本語' });
    f.state.nativeHook = async request => { if (request.command === 'page_append') { entered.resolve(); await wait.promise; } };
    f.edit(session.document, 'retained'); await entered.promise; const close = session.close(); expect(session.snapshot.phase).toBe('closed');
    wait.resolve(); await close; f.state.nativeHook = null;
    const fresh = await PrivatePageEditorSession.open(f.connection, f.store, f.pageId, { kind: 'local' });
    expect(fresh.document.getXmlFragment('body').toString()).toContain('retained'); expect(fresh.snapshot.pending).toBeGreaterThan(1); await fresh.close();
  } finally { wait.resolve(); await f.cleanup(); }
});
it('PRIVATE-EDITOR: failed append retains live draft, prevents send and sanitizes native error', async () => {
  const f = await privateEditorFixture(); try {
    const session = await PrivatePageEditorSession.open(f.connection, f.store, f.pageId, { kind: 'create', title: '日本語' });
    f.state.nativeHook = async request => { if (request.command === 'page_append') throw Error('private path token'); };
    f.edit(session.document, 'unsaved'); await expect(session.durable()).rejects.toMatchObject({ stage: 'storage', message: 'Private Page editor storage' });
    expect(session.snapshot).toMatchObject({ saving: 0, storageError: 'storage', synced: false });
    expect(session.document.getXmlFragment('body').toString()).toContain('unsaved'); await expect(session.sync()).rejects.toMatchObject({ stage: 'storage' });
    expect(f.state.wires).toHaveLength(0); await expect(session.close()).rejects.toMatchObject({ stage: 'storage' });
  } finally { await f.cleanup(); }
});
it('PRIVATE-EDITOR: invalid journal is rejected without fallback, and a different connection cannot read a captured native store', async () => {
  const f = await privateEditorFixture(); try {
    f.state.loadOverride = { page: { metadata: f.metadata, updates: [[255]] }, pending: 0, serverHead: null };
    await expect(PrivatePageEditorSession.open(f.connection, f.store, f.pageId, { kind: 'local' })).rejects.toMatchObject({ stage: 'protocol' });
    expect(f.state.events).toEqual([]);
    const foreign = new PrivateWorkspaceConnection(f.auth, { apiUrl: 'http://127.0.0.1:3001', clientId: f.context.clientId });
    await expect(PrivatePageEditorSession.open(foreign, f.store, f.pageId, { kind: 'local' })).rejects.toMatchObject({ stage: 'protocol' }); foreign.close();
  } finally { await f.cleanup(); }
});
it('PRIVATE-EDITOR: same Page replacement closes old Editor permanently without closing shared workspace', async () => {
  const f = await privateEditorFixture(); try {
    const old = await PrivatePageEditorSession.open(f.connection, f.store, f.pageId, { kind: 'create', title: '日本語' });
    const fresh = await PrivatePageEditorSession.open(f.connection, f.store, f.pageId, { kind: 'local' });
    expect(old.snapshot.phase).toBe('closed'); await expect(old.sync()).rejects.toMatchObject({ stage: 'closed' });
    expect(f.connection.context).toEqual(f.context); await fresh.sync(); expect(fresh.snapshot.synced).toBe(true); await fresh.close();
  } finally { await f.cleanup(); }
});
it('PRIVATE-EDITOR: an edit during a sync cycle remains pending and a concurrent cycle is rejected', async () => {
  const f = await privateEditorFixture(), wait = deferred(), entered = deferred(); try {
    const session = await PrivatePageEditorSession.open(f.connection, f.store, f.pageId, { kind: 'create', title: '日本語' });
    f.state.httpHook = async kind => { if (kind === 'read') { entered.resolve(); await wait.promise; } };
    const work = session.sync(); await entered.promise; await expect(session.sync()).rejects.toMatchObject({ stage: 'busy' });
    f.edit(session.document, 'during'); wait.resolve(); await work;
    expect(session.snapshot).toMatchObject({ synced: false, pending: 2, saving: 0 });
    f.state.httpHook = null; await session.sync(); expect(session.snapshot.synced).toBe(true); await session.close();
  } finally { wait.resolve(); await f.cleanup(); }
});
