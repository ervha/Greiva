import { createServer } from './server.js';
const server = createServer(Number(process.env.COLLABORATION_PORT ?? 1234), process.env.COLLABORATION_HOST ?? '127.0.0.1');
await server.listen();
console.log(JSON.stringify({ service: 'collaboration', event: 'listening', port: server.configuration.port }));
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void server.destroy().then(() => process.exit(0)); });
}
