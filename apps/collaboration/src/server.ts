import { Server } from '@hocuspocus/server';
export function createServer(port = 1234, address = '127.0.0.1') {
  return new Server({
    port, address,
    // Step 1 validates server boot only; document connections start in Step 4.
    async onConnect() { throw new Error('Step 1: document collaboration is not implemented'); },
    async onRequest({ request, response }) {
      if (request.url === '/health') {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ service: 'collaboration', status: 'ok', implementationStep: 1 }));
        throw null; // Hocuspocus hook convention: stop default HTTP handling.
      }
    },
  });
}
