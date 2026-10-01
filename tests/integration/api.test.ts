import { afterAll, beforeAll, it, expect } from 'vitest';
import { createApp } from '../../apps/api/dist/app.js';
let app: Awaited<ReturnType<typeof createApp>>;
beforeAll(async () => { app = await createApp({ databaseUrl: null }); });
afterAll(async () => { await app?.close(); });
it('STEP6-API: boots NestJS/Fastify and reports unavailable storage without an in-memory substitute', async () => {
  const response = await app.inject({ method: 'GET', url: '/health' });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ service: 'api', status: 'ok', implementationStep: 7 });
  expect((await app.inject({ method: 'GET', url: '/tasks' })).statusCode).toBe(503);
  expect((await app.inject({ method: 'GET', url: '/relations' })).statusCode).toBe(503);
  expect((await app.inject({ method: 'POST', url: '/sync/push', payload: {} })).statusCode).toBe(400);
  expect((await app.inject({ method: 'POST', url: '/sync/pull', payload: {cursor:null} })).statusCode).toBe(503);
});
