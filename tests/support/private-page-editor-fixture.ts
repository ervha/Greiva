import * as Y from 'yjs';
import { newId } from '@greiva/shared';
import { AuthSession, PrivateWorkspaceConnection, emptyPageUpdate, pageBase64, pageBytes, pageDigest } from '@greiva/sync';
import type { PrivatePagePrepared } from '@greiva/protocol/private-page';
import { NativeWorkspaceStore, type NativeWorkspaceInvoke } from '../../apps/client/src/workspace/native-workspace-store.js';

export async function privateEditorFixture() {
  const context = { issuer: 'https://auth.fixture.invalid/auth/v1', subjectId: 'owner', workspaceId: newId(), clientId: newId(), streamEpoch: newId() };
  const pageId = newId(), server = new Y.Doc({ gc: false });
  Y.applyUpdate(server, emptyPageUpdate());
  const time = '2026-10-07T00:00:00.000Z';
  const metadata = { id: pageId, title: '日本語', yDocId: 'page:' + pageId, createdAt: time, updatedAt: time };
  const scope = { protocolVersion: 1, workspaceId: context.workspaceId, pageId, documentName: metadata.yDocId, editorSchemaVersion: 1 };
  const token = { access_token: 'fixture.access.signature', refresh_token: 'fixture-refresh', token_type: 'bearer', user: { id: context.subjectId } };
  const auth = new AuthSession(context.issuer, { login: async () => token, refresh: async () => token,
    verify: async () => ({ issuer: context.issuer, subjectId: context.subjectId, expiresAt: 200 }), revoke: async () => {} }, () => 100);
  const state = {
    updates: [] as number[][], queue: [] as PrivatePagePrepared[], events: [] as string[], wires: [] as string[], head: 1,
    nativeHook: null as null | ((request: Record<string, unknown>) => Promise<void>),
    httpHook: null as null | ((kind: string) => Promise<void>),
    loseAck: false, loadOverride: undefined as unknown,
  };
  let sequence = 0;
  const digests = new Set<string>();
  const connection = new PrivateWorkspaceConnection(auth, { apiUrl: 'http://127.0.0.1:3001', clientId: context.clientId }, async (input, init) => {
    const kind = String(input).split('/').at(-1)!;
    await state.httpHook?.(kind);
    if (kind === 'bootstrap' && String(input).endsWith('workspaces/bootstrap')) return new Response(JSON.stringify({ protocolVersion: 1, ...context, epoch: context.streamEpoch, issuer: undefined, subjectId: undefined, streamEpoch: undefined }));
    const body = JSON.parse(String(init?.body)) as Record<string, string>;
    if (kind === 'read') {
      const update = Y.encodeStateAsUpdate(server, pageBytes(body.stateVector!));
      return new Response(JSON.stringify({ ...scope, metadata, headOrder: String(state.head), update: pageBase64(update), digest: await pageDigest(update), stateVector: pageBase64(Y.encodeStateVector(server)) }));
    }
    state.wires.push(String(init?.body)); state.events.push('send');
    const update = pageBytes((body.initialUpdate ?? body.update)!), digest = await pageDigest(update);
    if (!digests.has(digest)) { Y.applyUpdate(server, update); digests.add(digest); if (kind === 'append') ++state.head; }
    if (state.loseAck) { state.loseAck = false; return new Response('{}', { status: 503 }); }
    return new Response(JSON.stringify(kind === 'bootstrap' ? { ...scope, metadata: { ...metadata, title: body.title }, initialDigest: digest }
      : { ...scope, serverOrder: String(state.head), headOrder: String(state.head), digest, stateVector: pageBase64(Y.encodeStateVector(server)) }));
  });
  const invoke: NativeWorkspaceInvoke = async (command, args) => {
    if (command === 'workspace_open') return { handle: 'abc-123-1', context };
    if (command === 'workspace_close') return null;
    const request = args!.request as Record<string, unknown>, kind = String(request.command);
    await state.nativeHook?.(request);
    if (kind === 'page_create' || kind === 'page_append') {
      if (kind === 'page_create') { if (state.updates.length) throw Error('Already exists'); metadata.title = String(request.title); }
      const update = Uint8Array.from(request.update as number[]); state.events.push('local-commit'); state.updates.push(Array.from(update));
      const wire = JSON.stringify({ protocolVersion: 1, clientId: context.clientId, editorSchemaVersion: 1,
        ...(kind === 'page_create' ? { title: metadata.title, initialUpdate: pageBase64(update) } : { update: pageBase64(update) }) });
      state.queue.push({ sequence: String(++sequence), pageId, kind: kind === 'page_create' ? 'bootstrap' : 'append', digest: await pageDigest(update), wire });
    } else if (kind === 'page_prepare') return state.queue[0] ?? null;
    else if (kind === 'page_ack') { state.events.push('ack-commit'); state.queue.shift(); }
    else if (kind === 'page_receive') {
      state.events.push('remote-commit'); const response = request.response as { update: string };
      state.updates.push(Array.from(pageBytes(response.update)));
    } else if (kind === 'page_load') {
      if (state.loadOverride !== undefined) return state.loadOverride;
      if (!state.updates.length) throw Error('Missing Page');
      return { page: { metadata, updates: state.updates.map(bytes => bytes.slice()) }, pending: state.queue.length, serverHead: state.queue.length ? null : String(state.head) };
    } else throw Error('Unexpected native request');
    return null;
  };
  await auth.login('fixture@example.invalid', 'fixture-password'); await connection.bootstrap();
  const store = await NativeWorkspaceStore.open(connection, invoke);
  return { context, pageId, metadata, auth, connection, store, server, state,
    edit(doc: Y.Doc, text: string) {
      const block = doc.getXmlFragment('body').get(0) as Y.XmlElement;
      if (!block.length) block.insert(0, [new Y.XmlText()]);
      (block.get(0) as Y.XmlText).insert(0, text);
    },
    async cleanup() { connection.close(); auth.close(); await store.close(); server.destroy(); },
  };
}
