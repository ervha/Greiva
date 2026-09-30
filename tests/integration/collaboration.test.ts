import { afterAll, beforeAll, it, expect } from 'vitest';
import { createServer } from '../../apps/collaboration/dist/server.js';
const server = createServer(0);
beforeAll(async () => { await server.listen(); });
afterAll(async () => { await server.destroy(); });
it('STEP1-COLLAB: boots Hocuspocus and responds to a real HTTP request', async () => {
  const response = await fetch(`${server.httpURL}/health`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ service: 'collaboration', status: 'ok', implementationStep: 1 });
});
