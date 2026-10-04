import { createServer as http } from 'node:http';
import { createServer } from '/workspace/apps/collaboration/dist/server.js';
const collaboration = createServer(1234, '0.0.0.0', '/tmp/ime620-collaboration');
await collaboration.listen();
// This experiment uses Page collaboration only; never imply structured sync passed.
http((_request, response) => { response.writeHead(503, { 'Access-Control-Allow-Origin': 'http://tauri.localhost' }); response.end('Structured API is not part of this isolated IME experiment'); }).listen(3000, '0.0.0.0');
console.log('Isolated 0.6.20 Page collaboration listening');
