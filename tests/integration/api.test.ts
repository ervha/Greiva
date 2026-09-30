import { afterAll, beforeAll, it, expect } from 'vitest';
import { createApp } from '../../apps/api/dist/app.js';
let app: Awaited<ReturnType<typeof createApp>>;
beforeAll(async () => { app = await createApp(); });
afterAll(async () => { await app?.close(); });
it('STEP1-API: boots NestJS with Fastify and serves health only', async () => {
  const response = await app.inject({ method: 'GET', url: '/health' });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ service: 'api', status: 'ok', implementationStep: 1 });
  expect((await app.inject({ method: 'POST', url: '/sync/push', payload: {} })).statusCode).toBe(404);
});
