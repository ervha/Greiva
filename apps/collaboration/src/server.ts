import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';
import { UpdateStore } from './update-store.js';
export function createServer(port = 1234, address = '127.0.0.1', directory = process.env.COLLABORATION_DATA_DIR ?? '.data/collaboration') {
  const store = new UpdateStore(directory);
  return new Server({
    port, address,
    async onConnect({ documentName, requestParameters }) {
      store.path(documentName);
      const clientId = requestParameters.get('clientId');
      if (!clientId || !/^[a-zA-Z0-9-]{1,80}$/.test(clientId)) throw new Error('Missing or invalid clientId');
      console.log(JSON.stringify({ service: 'collaboration', event: 'connect', documentName, clientId }));
      return { clientId };
    },
    async onLoadDocument({ documentName, document }) {
      if (!store.restore(documentName, document)) {
        // Seed once on the server, before clients create an editor. This avoids duplicate empty paragraphs.
        document.getXmlFragment('body').insert(0, [new Y.XmlElement('paragraph')]);
        store.append(documentName, Y.encodeStateAsUpdate(document));
      }
    },
    async beforeSync({ documentName, type, payload, context }) {
      if (type === 1 || type === 2) {
        store.append(documentName, payload);
        console.log(JSON.stringify({ service: 'collaboration', event: 'durable-update', documentName,
          clientId: context.clientId, bytes: payload.length }));
      }
    },
    async onRequest({ request, response }) {
      if (request.url === '/health') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ service: 'collaboration', status: 'ok', implementationStep: 4 }));
        throw null; // Hocuspocus hook convention: stop default HTTP handling.
      }
    },
  });
}
