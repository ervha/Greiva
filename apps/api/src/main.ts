import { createApp } from './app.js';
const app = await createApp();
await app.listen(Number(process.env.API_PORT ?? 3000), process.env.API_HOST ?? '127.0.0.1');
console.log(JSON.stringify({ service: 'api', event: 'listening', address: await app.getUrl() }));
